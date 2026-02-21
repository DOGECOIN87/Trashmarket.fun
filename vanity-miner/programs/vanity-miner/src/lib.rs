// Vanity Miner Smart Contract - Anchor Program
// Manages GOR deposits, batch charging, and withdrawals for vanity address mining.
// Deployed to Gorbagana L2 at https://rpc.trashscan.io

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4");

// Platform treasury wallet
const TREASURY: &str = "TMABDMgLHfmmRNyHgbHTP9P5XP1zrAMFfbRAef69o9f";

#[program]
pub mod vanity_miner {
    use super::*;

    /// Initialize a new mining account for the user.
    /// Creates a PDA seeded with ["mining", user_pubkey].
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        let mining_account = &mut ctx.accounts.mining_account;
        mining_account.owner = ctx.accounts.user.key();
        mining_account.balance = 0;
        mining_account.total_spent = 0;
        mining_account.matches_found = 0;
        mining_account.is_active = false;
        mining_account.bump = ctx.bumps.mining_account;
        Ok(())
    }

    /// Deposit GOR into the mining account.
    /// Transfers native GOR from user to the program vault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer native GOR (lamports) from user to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let mining_account = &mut ctx.accounts.mining_account;
        mining_account.balance = mining_account
            .balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            amount,
            new_balance: mining_account.balance,
        });

        Ok(())
    }

    /// Charge for a mining batch.
    /// Deducts `cost` from user's mining balance and transfers from vault to treasury.
    pub fn charge_for_batch(ctx: Context<ChargeForBatch>, cost: u64) -> Result<()> {
        let mining_account = &mut ctx.accounts.mining_account;

        require!(
            mining_account.balance >= cost,
            ErrorCode::InsufficientBalance
        );

        mining_account.balance = mining_account
            .balance
            .checked_sub(cost)
            .ok_or(ErrorCode::Overflow)?;
        mining_account.total_spent = mining_account
            .total_spent
            .checked_add(cost)
            .ok_or(ErrorCode::Overflow)?;

        // Transfer from vault to treasury using vault PDA as signer
        let vault_bump = ctx.bumps.vault;
        let vault_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                &[vault_seeds],
            ),
            cost,
        )?;

        emit!(BatchChargedEvent {
            user: ctx.accounts.user.key(),
            cost,
            remaining_balance: mining_account.balance,
        });

        Ok(())
    }

    /// Withdraw remaining balance back to the user.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let mining_account = &mut ctx.accounts.mining_account;
        let amount = mining_account.balance;

        require!(amount > 0, ErrorCode::NoBalance);

        // Transfer from vault back to user using vault PDA as signer
        let vault_bump = ctx.bumps.vault;
        let vault_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount,
        )?;

        mining_account.balance = 0;

        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    /// Record a vanity address match found by the user.
    pub fn record_match(ctx: Context<RecordMatch>, address: String) -> Result<()> {
        let mining_account = &mut ctx.accounts.mining_account;
        mining_account.matches_found = mining_account
            .matches_found
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(MatchFound {
            user: ctx.accounts.user.key(),
            address,
            timestamp: Clock::get()?.unix_timestamp,
            total_matches: mining_account.matches_found,
        });

        Ok(())
    }
}

// === Account Structs ===

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + MiningAccount::SIZE,
        seeds = [b"mining", user.key().as_ref()],
        bump
    )]
    pub mining_account: Account<'info, MiningAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mining", user.key().as_ref()],
        bump = mining_account.bump,
        constraint = mining_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub mining_account: Account<'info, MiningAccount>,

    /// CHECK: PDA vault for holding deposited GOR. Validated by seeds.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChargeForBatch<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mining", user.key().as_ref()],
        bump = mining_account.bump,
        constraint = mining_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub mining_account: Account<'info, MiningAccount>,

    /// CHECK: PDA vault. Validated by seeds.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Platform treasury wallet. Hardcoded address check.
    #[account(
        mut,
        constraint = treasury.key().to_string() == TREASURY @ ErrorCode::InvalidTreasury,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mining", user.key().as_ref()],
        bump = mining_account.bump,
        constraint = mining_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub mining_account: Account<'info, MiningAccount>,

    /// CHECK: PDA vault. Validated by seeds.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordMatch<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mining", user.key().as_ref()],
        bump = mining_account.bump,
        constraint = mining_account.owner == user.key() @ ErrorCode::Unauthorized,
    )]
    pub mining_account: Account<'info, MiningAccount>,
}

// === State ===

#[account]
pub struct MiningAccount {
    pub owner: Pubkey,       // 32 bytes
    pub balance: u64,        // 8 bytes - GOR lamports
    pub total_spent: u64,    // 8 bytes - Lifetime spent
    pub matches_found: u32,  // 4 bytes - Total matches
    pub is_active: bool,     // 1 byte  - Currently mining
    pub bump: u8,            // 1 byte  - PDA bump seed
}

impl MiningAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 4 + 1 + 1; // 54 bytes
}

// === Events ===

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct BatchChargedEvent {
    pub user: Pubkey,
    pub cost: u64,
    pub remaining_balance: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MatchFound {
    pub user: Pubkey,
    pub address: String,
    pub timestamp: i64,
    pub total_matches: u32,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance for batch")]
    InsufficientBalance,
    #[msg("No balance to withdraw")]
    NoBalance,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Unauthorized: not the account owner")]
    Unauthorized,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
}
