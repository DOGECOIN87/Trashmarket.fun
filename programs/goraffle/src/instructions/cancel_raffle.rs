use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Raffle, RaffleStatus};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct CancelRaffle<'info> {
    #[account(
        mut,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump,
        constraint = raffle.creator == authority.key()
    )]
    pub raffle: Account<'info, Raffle>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow_nft", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_nft_account.mint == raffle.nft_mint,
        constraint = creator_nft_account.owner == authority.key()
    )]
    pub creator_nft_account: Account<'info, TokenAccount>,

    /// CHECK: PDA signer for escrow accounts
    #[account(
        seeds = [b"escrow", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelRaffle>, raffle_id: u64) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.status == RaffleStatus::Active, RaffleError::InvalidStatus);
    require!(raffle.tickets_sold == 0, RaffleError::CannotCancel);

    // Return NFT to creator
    let escrow_bump = ctx.bumps.escrow_authority;
    let raffle_id_bytes = raffle_id.to_le_bytes();
    let seeds = &[
        b"escrow" as &[u8],
        raffle_id_bytes.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.creator_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token::transfer(cpi_ctx, 1)?;

    raffle.status = RaffleStatus::Cancelled;

    emit!(RaffleCancelled {
        raffle_id,
        creator: raffle.creator,
    });

    msg!("Raffle {} cancelled by creator", raffle_id);
    Ok(())
}

#[event]
pub struct RaffleCancelled {
    pub raffle_id: u64,
    pub creator: Pubkey,
}
