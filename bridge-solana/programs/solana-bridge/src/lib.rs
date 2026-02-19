use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};

// TODO: Replace with actual program ID after `anchor keys list`
declare_id!("9CGxVdboSmVnQYn8vLwK7mTSo7Qd62DFGFxPjxjQPRez");

// ── Hardcoded Constants ──────────────────────────────────────────────
/// sGOR SPL Token mint on Solana Mainnet
pub const SGOR_MINT: Pubkey = pubkey!("71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg");

/// Minimum order size in token base units (6 decimals for sGOR)
pub const MIN_ORDER_AMOUNT: u64 = 100_000; // 0.1 sGOR

/// Maximum order lifetime in slots (~400ms/slot → ~24 hours)
pub const MAX_EXPIRY_SLOTS: u64 = 216_000;

/// Direction for this program (Solana side - handles sGOR only)
/// This program ONLY handles sGOR escrow. gGOR is handled by Gorbagana program.
///
/// When someone wants to trade sGOR → gGOR:
/// 1. They create an order HERE (Solana) locking sGOR
/// 2. Counterparty fills on Gorbagana network
///
/// When someone wants to trade gGOR → sGOR:
/// 1. They create order on Gorbagana locking gGOR
/// 2. Counterparty fills HERE (Solana) sending sGOR

#[program]
pub mod solana_bridge {
    use super::*;

    // ═══════════════════════════════════════════════════════════════════
    // CREATE ORDER (Maker locks sGOR on Solana)
    // ═══════════════════════════════════════════════════════════════════
    /// Creates an sGOR escrow order on Solana.
    /// Maker deposits sGOR into escrow, expecting gGOR on Gorbagana in return.
    pub fn create_order(
        ctx: Context<CreateOrder>,
        amount: u64,
        expiration_slot: u64,
        gorbagana_recipient: Pubkey, // Maker's Gorbagana address to receive gGOR
    ) -> Result<()> {
        // ── Validation ───────────────────────────────────────────────
        require!(amount >= MIN_ORDER_AMOUNT, BridgeError::InvalidAmount);

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
            order.expiration_slot = expiration_slot;
            order.gorbagana_recipient = gorbagana_recipient;
            order.is_filled = false;
            order.bump = ctx.bumps.order;
        }

        // ── Deposit sGOR into escrow ─────────────────────────────────
        let escrow_ta = &ctx.accounts.escrow_token_account;
        let maker_ta = &ctx.accounts.maker_token_account;

        // Validate mint is sGOR
        require!(maker_ta.mint == SGOR_MINT, BridgeError::InvalidMint);
        require!(escrow_ta.mint == SGOR_MINT, BridgeError::InvalidMint);

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

        emit!(OrderCreated {
            order_key: ctx.accounts.order.key(),
            maker: ctx.accounts.maker.key(),
            amount,
            gorbagana_recipient,
            expiration_slot,
        });

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════════
    // FILL ORDER (Taker sends sGOR, claims on Gorbagana)
    // ═══════════════════════════════════════════════════════════════════
    /// Fills an sGOR order.
    /// This is called when a Gorbagana order is being filled - the taker
    /// sends sGOR on Solana to the maker.
    ///
    /// Flow:
    /// 1. Gorbagana maker locked gGOR there
    /// 2. Taker sends sGOR HERE to the Gorbagana maker
    /// 3. Taker then claims gGOR on Gorbagana
    pub fn fill_order(ctx: Context<FillOrder>) -> Result<()> {
        let order = &ctx.accounts.order;

        // ── Validation ───────────────────────────────────────────────
        require!(!order.is_filled, BridgeError::OrderAlreadyFilled);
        require!(
            Clock::get()?.slot <= order.expiration_slot,
            BridgeError::OrderExpired
        );

        let amount = order.amount;
        let maker_key = order.maker;
        let bump = order.bump;

        // PDA signer seeds for escrow release
        let seeds: &[&[u8]] = &[
            b"order",
            maker_key.as_ref(),
            &amount.to_le_bytes(),
            &[bump],
        ];

        // Release sGOR from escrow to taker
        let escrow_ta = &ctx.accounts.escrow_token_account;
        let taker_ta = &ctx.accounts.taker_token_account;

        require!(taker_ta.mint == SGOR_MINT, BridgeError::InvalidMint);

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: escrow_ta.to_account_info(),
                    to: taker_ta.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        // Mark as filled
        let order = &mut ctx.accounts.order;
        order.is_filled = true;

        emit!(OrderFilled {
            order_key: order.key(),
            maker: maker_key,
            taker: ctx.accounts.taker.key(),
            amount,
        });

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════════
    // CANCEL ORDER — Maker reclaims escrowed sGOR
    // ═══════════════════════════════════════════════════════════════════
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let order = &ctx.accounts.order;

        require!(!order.is_filled, BridgeError::OrderAlreadyFilled);
        require!(
            ctx.accounts.maker.key() == order.maker,
            BridgeError::Unauthorized
        );

        let amount = order.amount;
        let maker_key = order.maker;
        let bump = order.bump;

        let seeds: &[&[u8]] = &[
            b"order",
            maker_key.as_ref(),
            &amount.to_le_bytes(),
            &[bump],
        ];

        // Return sGOR from escrow to maker
        let escrow_ta = &ctx.accounts.escrow_token_account;
        let maker_ta = &ctx.accounts.maker_token_account;

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

        emit!(OrderCancelled {
            order_key: order.key(),
            maker: maker_key,
            amount,
        });

        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════
// ACCOUNT STRUCTS
// ═══════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(amount: u64)]
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

    /// Escrow token account for sGOR
    /// Initialized with the order PDA as authority
    #[account(
        init,
        token::mint = sgor_mint,
        token::authority = order,
        seeds = [b"escrow", maker.key().as_ref(), &amount.to_le_bytes()],
        bump,
        payer = maker,
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    /// Maker's sGOR token account (source of deposit)
    #[account(
        mut,
        constraint = maker_token_account.mint == SGOR_MINT @ BridgeError::InvalidMint
    )]
    pub maker_token_account: Box<Account<'info, TokenAccount>>,

    /// sGOR mint account
    #[account(constraint = sgor_mint.key() == SGOR_MINT @ BridgeError::InvalidMint)]
    pub sgor_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FillOrder<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK: Maker receives nothing on Solana (gets gGOR on Gorbagana).
    /// Validated via order.maker constraint.
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

    /// Escrow sGOR token account (holds maker's escrowed sGOR)
    #[account(
        mut,
        constraint = escrow_token_account.mint == SGOR_MINT @ BridgeError::InvalidMint
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Taker's sGOR token account (receives escrowed sGOR)
    #[account(
        mut,
        constraint = taker_token_account.mint == SGOR_MINT @ BridgeError::InvalidMint
    )]
    pub taker_token_account: Account<'info, TokenAccount>,

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

    /// Escrow sGOR token account
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Maker's sGOR token account (receives refund)
    #[account(mut)]
    pub maker_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

#[account]
pub struct Order {
    pub maker: Pubkey,                 // 32 - Solana maker address
    pub amount: u64,                   // 8  - sGOR amount (6 decimals)
    pub gorbagana_recipient: Pubkey,   // 32 - Maker's Gorbagana address (for gGOR)
    pub expiration_slot: u64,          // 8
    pub is_filled: bool,               // 1
    pub bump: u8,                      // 1
}

impl Order {
    pub const LEN: usize = 8  // discriminator
        + 32  // maker
        + 8   // amount
        + 32  // gorbagana_recipient
        + 8   // expiration_slot
        + 1   // is_filled
        + 1;  // bump = 90 bytes total
}

// ═══════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════

#[error_code]
pub enum BridgeError {
    #[msg("Amount must be >= minimum order size.")]
    InvalidAmount,

    #[msg("Invalid token mint. Must be sGOR.")]
    InvalidMint,

    #[msg("Order has expired.")]
    OrderExpired,

    #[msg("Order has already been filled.")]
    OrderAlreadyFilled,

    #[msg("Unauthorized — only the maker can perform this action.")]
    Unauthorized,

    #[msg("Expiration slot is in the past.")]
    ExpirationInPast,

    #[msg("Expiration too far in the future (max ~24 hours).")]
    ExpirationTooFar,
}

// ═══════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════

#[event]
pub struct OrderCreated {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub amount: u64,
    pub gorbagana_recipient: Pubkey,
    pub expiration_slot: u64,
}

#[event]
pub struct OrderFilled {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OrderCancelled {
    pub order_key: Pubkey,
    pub maker: Pubkey,
    pub amount: u64,
}
