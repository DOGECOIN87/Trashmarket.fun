use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;
use crate::state::{Raffle, RaffleStatus, TicketAccount};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct DrawWinner<'info> {
    #[account(
        mut,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    // Remaining accounts: all TicketAccount PDAs for this raffle
    // These are passed by the caller and verified on-chain
}

pub fn handler(ctx: Context<DrawWinner>, raffle_id: u64) -> Result<()> {
    let raffle = &ctx.accounts.raffle;

    // Must be active
    require!(raffle.status == RaffleStatus::Active, RaffleError::RaffleNotActive);

    // Must be ended (time expired) or sold out
    let current_time = Clock::get()?.unix_timestamp;
    let is_ended = current_time >= raffle.end_time;
    let is_sold_out = raffle.tickets_sold >= raffle.total_tickets;
    require!(is_ended || is_sold_out, RaffleError::RaffleNotEnded);

    // Must have at least one ticket sold
    require!(raffle.tickets_sold > 0, RaffleError::InvalidTicketCount);

    // Must have at least one ticket account passed
    require!(!ctx.remaining_accounts.is_empty(), RaffleError::NoTicketAccounts);

    // Generate pseudo-random number from slot hashes and timestamp
    let clock = Clock::get()?;
    let slot = clock.slot;
    let timestamp = clock.unix_timestamp;

    let seed_data: Vec<u8> = [
        slot.to_le_bytes().as_ref(),
        timestamp.to_le_bytes().as_ref(),
        raffle_id.to_le_bytes().as_ref(),
        raffle.tickets_sold.to_le_bytes().as_ref(),
    ].concat();

    let hash = anchor_lang::solana_program::hash::hash(&seed_data);
    let hash_bytes = hash.to_bytes();
    let randomness = u64::from_le_bytes(hash_bytes[0..8].try_into().unwrap());

    // Pick winning ticket number (0-indexed)
    let winning_ticket = randomness % raffle.tickets_sold;

    // Iterate through remaining accounts (ticket accounts) to find the winner
    let mut winner_pubkey: Option<Pubkey> = None;
    let mut total_tickets_verified: u64 = 0;

    for account_info in ctx.remaining_accounts.iter() {
        // Verify the account is owned by our program
        require!(
            account_info.owner == ctx.program_id,
            RaffleError::InvalidTicketAccount
        );

        // Deserialize the ticket account
        let data = account_info.try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        let ticket_account = TicketAccount::try_deserialize(&mut data_slice)
            .map_err(|_| RaffleError::InvalidTicketAccount)?;

        // Verify this ticket account belongs to our raffle
        require!(
            ticket_account.raffle_id == raffle_id,
            RaffleError::InvalidTicketAccount
        );

        total_tickets_verified = total_tickets_verified
            .checked_add(ticket_account.ticket_count)
            .ok_or(RaffleError::ArithmeticOverflow)?;

        // Check if this account holds the winning ticket
        if winner_pubkey.is_none() && ticket_account.ticket_numbers.contains(&winning_ticket) {
            winner_pubkey = Some(ticket_account.buyer);
        }
    }

    // Verify all tickets are accounted for (prevents manipulation by omitting ticket accounts)
    require!(
        total_tickets_verified == raffle.tickets_sold,
        RaffleError::IncompleteTicketAccounts
    );

    // Winner must have been found
    let winner = winner_pubkey.ok_or(RaffleError::WinnerNotFound)?;

    // Update raffle state - set to Drawing (prize must be claimed separately)
    let raffle = &mut ctx.accounts.raffle;
    raffle.status = RaffleStatus::Drawing;
    raffle.winner = Some(winner);
    raffle.randomness = Some(randomness);

    emit!(WinnerDrawn {
        raffle_id,
        winner,
        winning_ticket,
        randomness,
        prize_nft: raffle.nft_mint,
    });

    msg!("Winner drawn for raffle {}: {} (ticket #{})", raffle_id, winner, winning_ticket);
    Ok(())
}

#[event]
pub struct WinnerDrawn {
    pub raffle_id: u64,
    pub winner: Pubkey,
    pub winning_ticket: u64,
    pub randomness: u64,
    pub prize_nft: Pubkey,
}
