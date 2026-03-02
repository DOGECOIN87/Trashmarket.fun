use anchor_lang::prelude::*;
use crate::state::RaffleState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RaffleState::SIZE,
        seeds = [b"raffle_state"],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    raffle_state.authority = ctx.accounts.authority.key();
    raffle_state.raffle_count = 0;

    msg!("Raffle state initialized");
    Ok(())
}
