use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, TransferChecked};

declare_id!("5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe");

/// Maximum deposit amount (increased for higher level play)
const MAX_DEPOSIT: u64 = 1_000_000_000; // Still 1B - plenty for 9999.
/// Maximum initial balance for new game sessions (increased to 9999)
const MAX_INITIAL_BALANCE: u64 = 9999;
/// Maximum game score (999,999,999)
const MAX_SCORE: u64 = 999_999_999;
/// DEBRIS token has 9 decimals: 1 token = 1_000_000_000 base units
const DEBRIS_DECIMALS_MULTIPLIER: u64 = 1_000_000_000;
/// Platform fee in basis points (250 BPS = 2.5%)
const PLATFORM_FEE_BPS: u64 = 250;

#[program]
pub mod junkpusher {
    use super::*;

    /// Initialize the game config (one-time admin setup).
    /// Stores the admin authority for privileged operations.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        let config = &mut ctx.accounts.game_config;
        config.admin = ctx.accounts.admin.key();

        msg!("Game config initialized, admin: {}", config.admin);
        Ok(())
    }

    /// Initialize a new game session for a player.
    /// Creates a PDA-based GameState account tied to the player's wallet.
    /// Initial balance is capped at MAX_INITIAL_BALANCE (100) to prevent
    /// players from creating accounts with inflated balances.
    pub fn initialize_game(ctx: Context<InitializeGame>, initial_balance: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        // Cap initial balance — this is free-play credit, not deposited tokens
        let capped_balance = initial_balance.min(MAX_INITIAL_BALANCE);

        game_state.player = ctx.accounts.player.key();
        game_state.score = 0;
        game_state.balance = capped_balance;
        game_state.net_profit = 0;
        game_state.total_coins_collected = 0;
        game_state.created_at = clock.unix_timestamp;
        game_state.last_updated = clock.unix_timestamp;
        game_state.is_initialized = true;

        msg!("Game initialized for player: {} (balance: {})", game_state.player, capped_balance);
        Ok(())
    }

    /// Record a coin collection event (e.g., bump action).
    /// Only the player who owns the game state can call this.
    pub fn record_coin_collection(ctx: Context<UpdateGameState>, amount: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(amount > 0, GameError::InvalidAmount);

        game_state.total_coins_collected = game_state
            .total_coins_collected
            .checked_add(amount)
            .ok_or(GameError::Overflow)?;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Recorded {} coins collected", amount);
        Ok(())
    }

    /// Record final game score.
    /// Validates score is within bounds [0, 999_999_999].
    pub fn record_score(ctx: Context<UpdateGameState>, score: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(score <= MAX_SCORE, GameError::ScoreOverflow);

        // Keep the highest score
        if score > game_state.score {
            game_state.score = score;
        }
        game_state.last_updated = clock.unix_timestamp;

        msg!("Score recorded: {}", score);
        Ok(())
    }

    /// Deposit DEBRIS tokens from the player's token account into the treasury.
    /// A 2.5% platform fee is deducted from the credited game balance.
    pub fn deposit_balance(ctx: Context<DepositBalance>, amount: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(amount > 0, GameError::InvalidAmount);
        require!(amount <= MAX_DEPOSIT, GameError::DepositTooLarge);

        // Convert human-readable amount to base units (9 decimals)
        let transfer_amount = amount
            .checked_mul(DEBRIS_DECIMALS_MULTIPLIER)
            .ok_or(GameError::Overflow)?;

        // Transfer full DEBRIS amount: player → treasury (Token-2022 transfer_checked)
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.player_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
                mint: ctx.accounts.debris_mint.to_account_info(),
            },
        );
        token_interface::transfer_checked(transfer_ctx, transfer_amount, 9)?;

        // Calculate platform fee (2.5%) - fee stays in treasury as platform revenue
        let fee = amount
            .checked_mul(PLATFORM_FEE_BPS)
            .ok_or(GameError::Overflow)?
            .checked_div(10_000)
            .ok_or(GameError::Overflow)?;
        let credited_amount = amount
            .checked_sub(fee)
            .ok_or(GameError::Underflow)?;

        // Credit player's game balance with fee-adjusted amount
        game_state.balance = game_state
            .balance
            .checked_add(credited_amount)
            .ok_or(GameError::Overflow)?;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Deposited {} DEBRIS (credited {} after {}% fee)", amount, credited_amount, PLATFORM_FEE_BPS as f64 / 100.0);
        Ok(())
    }

    /// Withdraw DEBRIS tokens from the treasury to the player.
    /// Allows withdrawal up to the player's current game balance.
    /// Uses PDA authority to sign the transfer from treasury.
    pub fn withdraw_balance(ctx: Context<WithdrawBalance>, amount: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(amount > 0, GameError::InvalidAmount);
        require!(amount <= game_state.balance, GameError::InsufficientBalance);

        // Convert human-readable amount to base units (9 decimals)
        let transfer_amount = amount
            .checked_mul(DEBRIS_DECIMALS_MULTIPLIER)
            .ok_or(GameError::Overflow)?;

        // Transfer DEBRIS tokens: treasury → player (signed by PDA, Token-2022)
        let seeds = &[b"treasury_authority".as_ref(), &[ctx.bumps.treasury_authority]];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.treasury_token_account.to_account_info(),
                to: ctx.accounts.player_token_account.to_account_info(),
                authority: ctx.accounts.treasury_authority.to_account_info(),
                mint: ctx.accounts.debris_mint.to_account_info(),
            },
            signer_seeds,
        );
        token_interface::transfer_checked(transfer_ctx, transfer_amount, 9)?;

        // Update game state
        game_state.balance = game_state
            .balance
            .checked_sub(amount)
            .ok_or(GameError::Underflow)?;
        game_state.net_profit = game_state
            .net_profit
            .checked_sub(amount as i64)
            .ok_or(GameError::Underflow)?;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Withdrew {} DEBRIS tokens", amount);
        Ok(())
    }

    /// Reset the game state (clear score, balance, etc.).
    /// Requires balance to be 0 first — withdraw or spend balance before resetting
    /// to prevent accidental loss of deposited funds.
    pub fn reset_game(ctx: Context<UpdateGameState>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(game_state.balance == 0, GameError::ResetWithBalance);

        game_state.score = 0;
        game_state.balance = 0;
        game_state.net_profit = 0;
        game_state.total_coins_collected = 0;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Game reset for player: {}", game_state.player);
        Ok(())
    }

    /// Update balance and net profit from game engine results.
    /// ADMIN ONLY: Requires the game config admin to co-sign.
    /// This prevents players from arbitrarily setting their own balance/winnings.
    pub fn update_balance(ctx: Context<AdminUpdateGameState>, new_balance: u64, net_profit_delta: i64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);

        game_state.balance = new_balance;
        game_state.net_profit = game_state
            .net_profit
            .checked_add(net_profit_delta)
            .ok_or(GameError::Overflow)?;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Balance updated: {}, net profit delta: {}", new_balance, net_profit_delta);
        Ok(())
    }
}

// ─── Account Structures ────────────────────────────────────────────────────

/// GameConfig PDA - stores admin authority for privileged operations.
/// Seeds: ["game_config"]
#[account]
pub struct GameConfig {
    /// The admin authority who can call update_balance
    pub admin: Pubkey,  // 32 bytes
}

impl GameConfig {
    pub const SIZE: usize = 8 + 32; // discriminator + admin
}

/// GameState PDA - stores per-player game data.
/// Seeds: ["game_state", player_pubkey]
#[account]
pub struct GameState {
    /// The player's wallet address
    pub player: Pubkey,         // 32 bytes
    /// Highest score achieved
    pub score: u64,             // 8 bytes
    /// Current DEBRIS balance in-game
    pub balance: u64,           // 8 bytes
    /// Net profit/loss (can be negative)
    pub net_profit: i64,        // 8 bytes
    /// Total coins collected across all sessions
    pub total_coins_collected: u64, // 8 bytes
    /// Timestamp of account creation
    pub created_at: i64,        // 8 bytes
    /// Timestamp of last update
    pub last_updated: i64,      // 8 bytes
    /// Whether the game state is initialized
    pub is_initialized: bool,   // 1 byte
}

impl GameState {
    pub const SIZE: usize = 8  // discriminator
        + 32  // player
        + 8   // score
        + 8   // balance
        + 8   // net_profit
        + 8   // total_coins_collected
        + 8   // created_at
        + 8   // last_updated
        + 1;  // is_initialized
    // Total: 89 bytes
}

// ─── Instruction Contexts ──────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = GameConfig::SIZE,
        seeds = [b"game_config"],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = player,
        space = GameState::SIZE,
        seeds = [b"game_state", player.key().as_ref()],
        bump
    )]
    pub game_state: Account<'info, GameState>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateGameState<'info> {
    #[account(
        mut,
        seeds = [b"game_state", player.key().as_ref()],
        bump,
        has_one = player
    )]
    pub game_state: Account<'info, GameState>,

    pub player: Signer<'info>,
}

/// Admin-only game state update — requires admin co-signature
#[derive(Accounts)]
pub struct AdminUpdateGameState<'info> {
    #[account(
        mut,
        seeds = [b"game_state", player.key().as_ref()],
        bump,
        has_one = player
    )]
    pub game_state: Account<'info, GameState>,

    /// CHECK: The player whose state is being updated (not required to sign)
    pub player: AccountInfo<'info>,

    #[account(
        seeds = [b"game_config"],
        bump,
        has_one = admin @ GameError::Unauthorized
    )]
    pub game_config: Account<'info, GameConfig>,

    /// The admin authority — must match game_config.admin
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositBalance<'info> {
    #[account(
        mut,
        seeds = [b"game_state", player.key().as_ref()],
        bump,
        has_one = player
    )]
    pub game_state: Account<'info, GameState>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// Player's DEBRIS token account (source)
    #[account(
        mut,
        constraint = player_token_account.owner == player.key() @ GameError::InvalidTokenAccount,
        constraint = player_token_account.mint == debris_mint.key() @ GameError::InvalidTokenMint
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury's DEBRIS token account (destination) - must be controlled by treasury PDA
    #[account(
        mut,
        constraint = treasury_token_account.mint == debris_mint.key() @ GameError::InvalidTokenMint,
        constraint = treasury_token_account.owner == treasury_authority.key() @ GameError::InvalidTreasury
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    /// DEBRIS token mint
    pub debris_mint: InterfaceAccount<'info, token_interface::Mint>,

    /// CHECK: Treasury authority PDA - validates treasury_token_account ownership
    #[account(
        seeds = [b"treasury_authority"],
        bump
    )]
    pub treasury_authority: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawBalance<'info> {
    #[account(
        mut,
        seeds = [b"game_state", player.key().as_ref()],
        bump,
        has_one = player
    )]
    pub game_state: Account<'info, GameState>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// Player's DEBRIS token account (destination)
    #[account(
        mut,
        constraint = player_token_account.owner == player.key() @ GameError::InvalidTokenAccount,
        constraint = player_token_account.mint == debris_mint.key() @ GameError::InvalidTokenMint
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury's DEBRIS token account (source) - must be controlled by treasury PDA
    #[account(
        mut,
        constraint = treasury_token_account.mint == debris_mint.key() @ GameError::InvalidTokenMint,
        constraint = treasury_token_account.owner == treasury_authority.key() @ GameError::InvalidTreasury
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    /// DEBRIS token mint
    pub debris_mint: InterfaceAccount<'info, token_interface::Mint>,

    /// PDA authority that controls the treasury token account
    /// Seeds: ["treasury_authority"]
    #[account(
        seeds = [b"treasury_authority"],
        bump
    )]
    /// CHECK: PDA used as token account authority, validated by seeds
    pub treasury_authority: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

// ─── Errors ────────────────────────────────────────────────────────────────

#[error_code]
pub enum GameError {
    #[msg("Game state not initialized")]
    NotInitialized,
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Deposit exceeds maximum limit")]
    DepositTooLarge,
    #[msg("Score exceeds maximum limit (999,999,999)")]
    ScoreOverflow,
    #[msg("Withdrawal exceeds verified winnings")]
    WithdrawalExceedsWinnings,
    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Invalid token account owner")]
    InvalidTokenAccount,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Unauthorized: admin signature required")]
    Unauthorized,
    #[msg("Cannot reset game with non-zero balance — withdraw first")]
    ResetWithBalance,
}
