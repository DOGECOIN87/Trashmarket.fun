use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::{Raffle, RaffleState, RaffleStatus};
use crate::error::RaffleError;

// Step 1: Create escrow accounts for a raffle
#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Validated as mint by token::mint constraint
    pub nft_mint: AccountInfo<'info>,
    /// CHECK: Validated as mint by token::mint constraint
    pub ggor_mint: AccountInfo<'info>,

    /// CHECK: PDA signer for escrow accounts
    #[account(
        seeds = [b"escrow", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = creator,
        token::mint = nft_mint,
        token::authority = escrow_authority,
        seeds = [b"escrow_nft", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        token::mint = ggor_mint,
        token::authority = escrow_authority,
        seeds = [b"escrow_ggor", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_escrow_handler(_ctx: Context<CreateEscrow>, _raffle_id: u64) -> Result<()> {
    msg!("Escrow accounts created for raffle");
    Ok(())
}

// Step 2: Create the raffle and transfer NFT
#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct CreateRaffle<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Raffle::SIZE,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(
        mut,
        seeds = [b"raffle_state"],
        bump
    )]
    pub raffle_state: Box<Account<'info, RaffleState>>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = nft_token_account.mint == nft_mint.key(),
        constraint = nft_token_account.owner == creator.key(),
        constraint = nft_token_account.amount == 1
    )]
    pub nft_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"escrow_nft", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    pub ggor_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateRaffle>,
    raffle_id: u64,
    ticket_price: u64,
    total_tickets: u64,
    end_time: i64,
) -> Result<()> {
    require!(total_tickets > 0, RaffleError::InvalidTicketCount);
    require!(ticket_price > 0, RaffleError::InvalidTicketPrice);

    let current_time = Clock::get()?.unix_timestamp;
    require!(end_time > current_time, RaffleError::InvalidEndTime);

    // Calculate duration in hours and determine platform fee
    let duration_seconds = end_time - current_time;
    let duration_hours = duration_seconds / 3600;
    let platform_fee_bps = Raffle::calculate_fee_bps(duration_hours);

    // Transfer NFT to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.nft_token_account.to_account_info(),
        to: ctx.accounts.escrow_nft_account.to_account_info(),
        authority: ctx.accounts.creator.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, 1)?;

    // Initialize raffle account
    let raffle = &mut ctx.accounts.raffle;
    raffle.raffle_id = raffle_id;
    raffle.creator = ctx.accounts.creator.key();
    raffle.nft_mint = ctx.accounts.nft_mint.key();
    raffle.ticket_price = ticket_price;
    raffle.total_tickets = total_tickets;
    raffle.tickets_sold = 0;
    raffle.end_time = end_time;
    raffle.status = RaffleStatus::Active;
    raffle.winner = None;
    raffle.randomness = None;
    raffle.platform_fee_bps = platform_fee_bps;

    // Increment raffle count
    let raffle_state = &mut ctx.accounts.raffle_state;
    raffle_state.raffle_count = raffle_state.raffle_count.checked_add(1)
        .ok_or(RaffleError::ArithmeticOverflow)?;

    emit!(RaffleCreated {
        raffle_id,
        creator: raffle.creator,
        nft_mint: raffle.nft_mint,
        ticket_price,
        total_tickets,
        end_time,
        platform_fee_bps,
    });

    msg!("Raffle {} created with {} bps platform fee", raffle_id, platform_fee_bps);
    Ok(())
}

#[event]
pub struct RaffleCreated {
    pub raffle_id: u64,
    pub creator: Pubkey,
    pub nft_mint: Pubkey,
    pub ticket_price: u64,
    pub total_tickets: u64,
    pub end_time: i64,
    pub platform_fee_bps: u16,
}
