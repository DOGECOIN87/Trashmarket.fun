use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::{Raffle, RaffleStatus, TicketAccount};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct BuyTickets<'info> {
    #[account(
        mut,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = buyer_token_account.mint == ggor_mint.key(),
        constraint = buyer_token_account.owner == buyer.key()
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow_ggor", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + TicketAccount::size(100),
        seeds = [b"tickets", raffle_id.to_le_bytes().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub ticket_account: Account<'info, TicketAccount>,

    pub ggor_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<BuyTickets>, raffle_id: u64, quantity: u64) -> Result<()> {
    let raffle = &ctx.accounts.raffle;

    // Validate raffle is active
    require!(raffle.status == RaffleStatus::Active, RaffleError::RaffleNotActive);

    // Check raffle hasn't expired
    let current_time = Clock::get()?.unix_timestamp;
    require!(raffle.end_time > current_time, RaffleError::RaffleEnded);

    // Check enough tickets remain
    require!(quantity > 0, RaffleError::InvalidTicketCount);
    let remaining = raffle.total_tickets.checked_sub(raffle.tickets_sold)
        .ok_or(RaffleError::ArithmeticOverflow)?;
    require!(quantity <= remaining, RaffleError::NotEnoughTickets);

    // Calculate total cost
    let total_cost = raffle.ticket_price.checked_mul(quantity)
        .ok_or(RaffleError::ArithmeticOverflow)?;

    // Check buyer has enough balance
    require!(
        ctx.accounts.buyer_token_account.amount >= total_cost,
        RaffleError::InsufficientBalance
    );

    // Transfer GGOR tokens from buyer to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.buyer_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::transfer(cpi_ctx, total_cost)?;

    // Update raffle tickets sold
    let raffle = &mut ctx.accounts.raffle;
    let start_ticket = raffle.tickets_sold;
    raffle.tickets_sold = raffle.tickets_sold.checked_add(quantity)
        .ok_or(RaffleError::ArithmeticOverflow)?;

    // Update ticket account
    let ticket_account = &mut ctx.accounts.ticket_account;
    if ticket_account.ticket_count == 0 {
        ticket_account.raffle_id = raffle_id;
        ticket_account.buyer = ctx.accounts.buyer.key();
    }
    ticket_account.ticket_count = ticket_account.ticket_count.checked_add(quantity)
        .ok_or(RaffleError::ArithmeticOverflow)?;

    for i in 0..quantity {
        ticket_account.ticket_numbers.push(start_ticket + i);
    }

    emit!(TicketsPurchased {
        raffle_id,
        buyer: ctx.accounts.buyer.key(),
        quantity,
        total_cost,
        tickets_sold: raffle.tickets_sold,
    });

    msg!("Bought {} tickets for raffle {}", quantity, raffle_id);
    Ok(())
}

#[event]
pub struct TicketsPurchased {
    pub raffle_id: u64,
    pub buyer: Pubkey,
    pub quantity: u64,
    pub total_cost: u64,
    pub tickets_sold: u64,
}
