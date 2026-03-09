use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TokenAccount, TransferChecked};

// Will be replaced with actual program ID after first deployment
declare_id!("5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe");

/// Maximum deposit amount (1 billion DEBRIS in human-readable units)
const MAX_DEPOSIT: u64 = 1_000_000_000;
/// Maximum game score
const MAX_SCORE: u64 = 999_999_999;
/// DEBRIS token decimals (10^9)
const DEBRIS_DECIMALS_MULTIPLIER: u64 = 1_000_000_000;

#[program]
pub mod junkpusher {
    use super::*;

    /// Initialize a new game session for a player.
    /// Creates a PDA-based GameState account tied to the player's wallet.
    pub fn initialize_game(ctx: Context<InitializeGame>, initial_balance: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        game_state.player = ctx.accounts.player.key();
        game_state.score = 0;
        game_state.balance = initial_balance;
        game_state.net_profit = 0;
        game_state.total_coins_collected = 0;
        game_state.created_at = clock.unix_timestamp;
        game_state.last_updated = clock.unix_timestamp;
        game_state.is_initialized = true;

        msg!("Game initialized for player: {}", game_state.player);
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
    /// Updates the on-chain game balance accordingly.
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

        // Transfer DEBRIS tokens: player → treasury (Token-2022 transfer_checked)
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

        // Update game state balance
        game_state.balance = game_state
            .balance
            .checked_add(amount)
            .ok_or(GameError::Overflow)?;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Deposited {} DEBRIS tokens", amount);
        Ok(())
    }

    /// Withdraw DEBRIS tokens from the treasury to the player.
    /// Only allows withdrawal up to verified winnings (net_profit).
    /// Uses PDA authority to sign the transfer from treasury.
    pub fn withdraw_balance(ctx: Context<WithdrawBalance>, amount: u64) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);
        require!(amount > 0, GameError::InvalidAmount);

        // Only allow withdrawal of verified winnings (positive net profit)
        let verified_winnings = if game_state.net_profit > 0 {
            game_state.net_profit as u64
        } else {
            0u64
        };
        require!(
            amount <= verified_winnings,
            GameError::WithdrawalExceedsWinnings
        );
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
    pub fn reset_game(ctx: Context<UpdateGameState>) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        let clock = Clock::get()?;

        require!(game_state.is_initialized, GameError::NotInitialized);

        game_state.score = 0;
        game_state.balance = 0;
        game_state.net_profit = 0;
        game_state.total_coins_collected = 0;
        game_state.last_updated = clock.unix_timestamp;

        msg!("Game reset for player: {}", game_state.player);
        Ok(())
    }

    /// Update balance and net profit from game engine results.
    /// Called after game rounds to sync on-chain state with game outcome.
    pub fn update_balance(ctx: Context<UpdateGameState>, new_balance: u64, net_profit_delta: i64) -> Result<()> {
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
    #[account(mut)]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury's DEBRIS token account (destination)
    #[account(mut)]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    /// DEBRIS token mint
    pub debris_mint: InterfaceAccount<'info, token_interface::Mint>,

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
    #[account(mut)]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury's DEBRIS token account (source)
    #[account(mut)]
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
}
