use anchor_lang::prelude::*;
use crate::state::{Raffle, RaffleState};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct PurgeRaffle<'info> {
    #[account(
        seeds = [b"raffle_state"],
        bump,
        constraint = raffle_state.authority == authority.key() @ RaffleError::Unauthorized
    )]
    pub raffle_state: Account<'info, RaffleState>,

    #[account(
        mut,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump,
        close = authority
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(_ctx: Context<PurgeRaffle>, raffle_id: u64) -> Result<()> {
    msg!("Raffle {} purged by admin", raffle_id);
    Ok(())
}
