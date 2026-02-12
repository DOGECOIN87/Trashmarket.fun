use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};

declare_id!("FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq");

// ── Hardcoded Constants ──────────────────────────────────────────────
/// sGOR SPL Token mint on Gorbagana
pub const SGOR_MINT: Pubkey = pubkey!("71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg");

/// Minimum order size in lamports / token base units
pub const MIN_ORDER_AMOUNT: u64 = 100_000; // 0.0001 in 9-decimal tokens

/// Maximum order lifetime in slots (~400ms/slot → ~24 hours)
pub const MAX_EXPIRY_SLOTS: u64 = 216_000;

// ── Direction Enum ───────────────────────────────────────────────────
/// Direction 0 = Maker sells sGOR (SPL), wants gGOR (native) in return
/// Direction 1 = Maker sells gGOR (native), wants sGOR (SPL) in return

#[program]
pub mod gorbagana_bridge {
    use super::*;

    // ═══════════════════════════════════════════════════════════════════
    // CREATE ORDER
    // ═══════════════════════════════════════════════════════════════════
    /// Creates an escrow order. The maker deposits funds into the escrow:
    ///   - Direction 0 (sGOR→gGOR): maker deposits sGOR via SPL transfer
    ///   - Direction 1 (gGOR→sGOR): maker deposits gGOR via system transfer
    pub fn create_order(
        ctx: Context<CreateOrder>,
        amount: u64,
        direction: u8,
        expiration_slot: u64,
    ) -> Result<()> {
        // ── Validation ───────────────────────────────────────────────
        require!(amount >= MIN_ORDER_AMOUNT, BridgeError::InvalidAmount);
        require!(direction <= 1, BridgeError::InvalidDirection);

        let clock = Clock::get()?;
        require!(
            expiration_slot > clock.slot,
            BridgeError::ExpirationInPast
        );
        require!(
            expiration_slot <= clock.slot.checked_add(MAX_EXPIRY_SLOTS).unwrap(),
            BridgeError::ExpirationTooFar
        );

        // ── Populate order state ─────────────────────────────────────

        {
            let order = &mut ctx.accounts.order;
            order.maker = ctx.accounts.maker.key();
            order.amount = amount;
            order.direction = direction;
            order.expiration_slot = expiration_slot;
            order.is_filled = false;
            order.bump = ctx.bumps.order;
        }

        // ── Escrow deposit ───────────────────────────────────────────
        match direction {
            // Direction 0: Maker deposits sGOR (SPL token) into escrow
            0 => {
                let escrow_ta = ctx.accounts.escrow_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingEscrowTokenAccount)?;
                let maker_ta = ctx.accounts.maker_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingMakerTokenAccount)?;

                // Validate mint is sGOR
                require!(maker_ta.mint == SGOR_MINT, BridgeError::InvalidMint);

                let cpi_accounts = SplTransfer {
                    from: maker_ta.to_account_info(),
                    to: escrow_ta.to_account_info(),
                    authority: ctx.accounts.maker.to_account_info(),
                };
                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        cpi_accounts,
                    ),
                    amount,
                )?;
            }
            // Direction 1: Maker deposits gGOR (native gas) into escrow PDA
            1 => {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.maker.to_account_info(),
                            to: ctx.accounts.order.to_account_info(),
                        },
                    ),
                    amount,
                )?;
            }
            _ => return Err(BridgeError::InvalidDirection.into()),
        }

        emit!(OrderCreated {
            order_key: ctx.accounts.order.key(),
            maker: ctx.accounts.maker.key(),
            amount,
            direction,
            expiration_slot,
        });

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════════
    // FILL ORDER — Atomic P2P swap
    // ═══════════════════════════════════════════════════════════════════
    /// Fills an existing order. The taker provides what the maker wants,
    /// and receives what the maker escrowed.
    ///
    /// Direction 0 (maker sold sGOR):
    ///   Taker sends gGOR (native) → Maker
    ///   Escrow releases sGOR (SPL) → Taker
    ///
    /// Direction 1 (maker sold gGOR):
    ///   Taker sends sGOR (SPL) → Maker
    ///   Escrow releases gGOR (native) → Taker
    pub fn fill_order(ctx: Context<FillOrder>) -> Result<()> {
        let order = &ctx.accounts.order;

        // ── Validation ───────────────────────────────────────────────
        require!(!order.is_filled, BridgeError::OrderAlreadyFilled);
        require!(
            Clock::get()?.slot <= order.expiration_slot,
            BridgeError::OrderExpired
        );

        let amount = order.amount;
        let direction = order.direction;
        let maker_key = order.maker;
        let bump = order.bump;

        // PDA signer seeds for escrow releases
        let seeds: &[&[u8]] = &[
            b"order",
            maker_key.as_ref(),
            &amount.to_le_bytes(),
            &[bump],
        ];

        match direction {
            // Direction 0: sGOR escrowed → release SPL to taker; taker pays native gGOR to maker
            0 => {
                // (a) Taker sends gGOR (native) to Maker
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.taker.to_account_info(),
                            to: ctx.accounts.maker.to_account_info(),
                        },
                    ),
                    amount,
                )?;

                // (b) Escrow releases sGOR (SPL) to Taker
                let escrow_ta = ctx.accounts.escrow_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingEscrowTokenAccount)?;
                let taker_receive_ta = ctx.accounts.taker_receive_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingTakerReceiveTokenAccount)?;

                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        SplTransfer {
                            from: escrow_ta.to_account_info(),
                            to: taker_receive_ta.to_account_info(),
                            authority: ctx.accounts.order.to_account_info(),
                        },
                        &[seeds],
                    ),
                    amount,
                )?;
            }
            // Direction 1: gGOR escrowed (native in PDA) → release to taker; taker pays sGOR to maker
            1 => {
                // (a) Taker sends sGOR (SPL) to Maker
                let taker_ta = ctx.accounts.taker_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingTakerTokenAccount)?;
                let maker_receive_ta = ctx.accounts.maker_receive_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingMakerReceiveTokenAccount)?;

                require!(taker_ta.mint == SGOR_MINT, BridgeError::InvalidMint);

                token::transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        SplTransfer {
                            from: taker_ta.to_account_info(),
                            to: maker_receive_ta.to_account_info(),
                            authority: ctx.accounts.taker.to_account_info(),
                        },
                    ),
                    amount,
                )?;

                // (b) Release gGOR (native) from PDA to Taker
                // We transfer lamports directly from the order PDA
                let order_info = ctx.accounts.order.to_account_info();
                let taker_info = ctx.accounts.taker.to_account_info();

                **order_info.try_borrow_mut_lamports()? -= amount;
                **taker_info.try_borrow_mut_lamports()? += amount;
            }
            _ => return Err(BridgeError::InvalidDirection.into()),
        }

        // Mark as filled (account will be closed below via `close` constraint)
        let order = &mut ctx.accounts.order;
        order.is_filled = true;

        emit!(OrderFilled {
            order_key: order.key(),
            maker: maker_key,
            taker: ctx.accounts.taker.key(),
            amount,
            direction,
        });

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════════
    // CANCEL ORDER — Maker reclaims escrowed funds
    // ═══════════════════════════════════════════════════════════════════
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let order = &ctx.accounts.order;

        require!(!order.is_filled, BridgeError::OrderAlreadyFilled);
        require!(
            ctx.accounts.maker.key() == order.maker,
            BridgeError::Unauthorized
        );

        let amount = order.amount;
        let direction = order.direction;
        let maker_key = order.maker;
        let bump = order.bump;

        let seeds: &[&[u8]] = &[
            b"order",
            maker_key.as_ref(),
            &amount.to_le_bytes(),
            &[bump],
        ];

        match direction {
            // Direction 0: Return sGOR (SPL) from escrow to maker
            0 => {
                let escrow_ta = ctx.accounts.escrow_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingEscrowTokenAccount)?;
                let maker_ta = ctx.accounts.maker_token_account
                    .as_ref()
                    .ok_or(BridgeError::MissingMakerTokenAccount)?;

                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        SplTransfer {
                            from: escrow_ta.to_account_info(),
                            to: maker_ta.to_account_info(),
                            authority: ctx.accounts.order.to_account_info(),
                        },
                        &[seeds],
                    ),
                    amount,
                )?;
            }
            // Direction 1: Return gGOR (native) from PDA to maker
            1 => {
                let order_info = ctx.accounts.order.to_account_info();
                let maker_info = ctx.accounts.maker.to_account_info();

                **order_info.try_borrow_mut_lamports()? -= amount;
                **maker_info.try_borrow_mut_lamports()? += amount;
            }
            _ => return Err(BridgeError::InvalidDirection.into()),
        }

        emit!(OrderCancelled {
            order_key: order.key(),
            maker: maker_key,
            amount,
            direction,
        });

        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════
// ACCOUNT STRUCTS
// ═══════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(amount: u64, direction: u8)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    /// Order PDA — deterministic from maker + amount
    #[account(
        init,
        seeds = [b"order", maker.key().as_ref(), &amount.to_le_bytes()],
        bump,
        payer = maker,
        space = Order::LEN,
    )]
    pub order: Box<Account<'info, Order>>,

    /// Escrow token account for sGOR (only needed for direction 0)
    /// Initialized with the order PDA as authority
    #[account(
        init_if_needed,
        token::mint = sgor_mint,
        token::authority = order,
        seeds = [b"escrow", maker.key().as_ref(), &amount.to_le_bytes()],
        bump,
        payer = maker,
    )]
    pub escrow_token_account: Option<Box<Account<'info, TokenAccount>>>,

    /// Maker's sGOR token account (only needed for direction 0)
    #[account(mut)]
    pub maker_token_account: Option<Box<Account<'info, TokenAccount>>>,

    /// sGOR mint account (needed for escrow_token_account init)
    pub sgor_mint: Option<Box<Account<'info, Mint>>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FillOrder<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK: Maker receives funds. Validated via order.maker constraint.
    #[account(
        mut,
        constraint = maker.key() == order.maker @ BridgeError::Unauthorized
    )]
    pub maker: AccountInfo<'info>,

    #[account(
        mut,
        close = maker,
        seeds = [b"order", order.maker.as_ref(), &order.amount.to_le_bytes()],
        bump = order.bump,
    )]
    pub order: Account<'info, Order>,

    // ── SPL accounts (optional, depends on direction) ────────────
    /// Escrow sGOR token account (direction 0)
    #[account(mut)]
    pub escrow_token_account: Option<Account<'info, TokenAccount>>,

    /// Taker's sGOR token account to send FROM (direction 1)
    #[account(mut)]
    pub taker_token_account: Option<Account<'info, TokenAccount>>,

    /// Taker's sGOR token account to receive INTO (direction 0)
    #[account(mut)]
    pub taker_receive_token_account: Option<Account<'info, TokenAccount>>,

    /// Maker's sGOR token account to receive INTO (direction 1)
    #[account(mut)]
    pub maker_receive_token_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        mut,
        close = maker,
        has_one = maker @ BridgeError::Unauthorized,
        seeds = [b"order", order.maker.as_ref(), &order.amount.to_le_bytes()],
        bump = order.bump,
    )]
    pub order: Account<'info, Order>,

    /// Escrow sGOR token account (direction 0 only)
    #[account(mut)]
    pub escrow_token_account: Option<Account<'info, TokenAccount>>,

    /// Maker's sGOR token account to receive refund (direction 0 only)
    #[account(mut)]
    pub maker_token_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

#[account]
pub struct Order {
    pub maker: Pubkey,       // 32
    pub amount: u64,         // 8
    pub direction: u8,       // 1  (0 = sGOR→gGOR, 1 = gGOR→sGOR)
    pub expiration_slot: u64, // 8
    pub is_filled: bool,     // 1
    pub bump: u8,            // 1
}

impl Order {
    pub const LEN: usize = 8  // discriminator
        + 32  // maker
        + 8   // amount
        + 1   // direction
        + 8   // expiration_slot
        + 1   // is_filled
        + 1;  // bump
}

// ═══════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════

#[error_code]
pub enum BridgeError {
    #[msg("Amount must be >= minimum order size.")]
    InvalidAmount,

    #[msg("Invalid direction. Must be 0 (sGOR→gGOR) or 1 (gGOR→sGOR).")]
    InvalidDirection,

    #[msg("Invalid token mint for this direction.")]
    InvalidMint,

    #[msg("Order has expired.")]
    OrderExpired,

    #[msg("Order has already been filled.")]
    OrderAlreadyFilled,

    #[msg("Insufficient funds for swap.")]
    InsufficientFunds,

    #[msg("Unauthorized — only the maker can perform this action.")]
    Unauthorized,

    #[msg("Expiration slot is in the past.")]
    ExpirationInPast,

    #[msg("Expiration too far in the future (max ~24 hours).")]
    ExpirationTooFar,

    #[msg("Missing escrow token account (required for SPL direction).")]
    MissingEscrowTokenAccount,

    #[msg("Missing maker token account (required for SPL direction).")]
    MissingMakerTokenAccount,

    #[msg("Missing taker token account.")]
    MissingTakerTokenAccount,

    #[msg("Missing taker receive token account.")]
    MissingTakerReceiveTokenAccount,

    #[msg("Missing maker receive token account.")]
    MissingMakerReceiveTokenAccount,
}

// ═══════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════

#[event]
pub struct OrderCreated {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub amount: u64,
    pub direction: u8,
    pub expiration_slot: u64,
}

#[event]
pub struct OrderFilled {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub amount: u64,
    pub direction: u8,
}

#[event]
pub struct OrderCancelled {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub amount: u64,
    pub direction: u8,
}
