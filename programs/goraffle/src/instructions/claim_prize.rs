use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::{Raffle, RaffleState, RaffleStatus};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        seeds = [b"raffle", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(
        seeds = [b"raffle_state"],
        bump
    )]
    pub raffle_state: Box<Account<'info, RaffleState>>,

    /// CHECK: The winner account, validated against raffle.winner
    #[account(
        mut,
        constraint = raffle.winner == Some(winner.key()) @ RaffleError::InvalidWinner
    )]
    pub winner: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"escrow_nft", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = nft_mint,
        associated_token::authority = winner,
    )]
    pub winner_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"escrow_ggor", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = creator_token_account.mint == ggor_mint.key(),
        constraint = creator_token_account.owner == raffle.creator
    )]
    pub creator_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = platform_token_account.mint == ggor_mint.key(),
        constraint = platform_token_account.owner == raffle_state.authority
    )]
    pub platform_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA signer for escrow accounts
    #[account(
        seeds = [b"escrow", raffle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub nft_mint: Box<Account<'info, Mint>>,
    pub ggor_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimPrize>, raffle_id: u64) -> Result<()> {
    let raffle = &ctx.accounts.raffle;

    // Must be in Drawing state (winner already determined)
    require!(raffle.status == RaffleStatus::Drawing, RaffleError::InvalidStatus);

    // Winner must be set
    require!(raffle.winner.is_some(), RaffleError::WinnerNotFound);

    // Build escrow signer seeds
    let escrow_bump = ctx.bumps.escrow_authority;
    let raffle_id_bytes = raffle_id.to_le_bytes();
    let seeds = &[
        b"escrow" as &[u8],
        raffle_id_bytes.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    // Transfer NFT from escrow to winner
    let nft_transfer = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.winner_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            nft_transfer,
            signer,
        ),
        1,
    )?;

    // Calculate platform fee and creator earnings
    let total_ggor = ctx.accounts.escrow_token_account.amount;
    let fee_amount = total_ggor
        .checked_mul(raffle.platform_fee_bps as u64)
        .ok_or(RaffleError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(RaffleError::ArithmeticOverflow)?;
    let creator_earnings = total_ggor
        .checked_sub(fee_amount)
        .ok_or(RaffleError::ArithmeticOverflow)?;

    // Transfer creator earnings from escrow to creator
    if creator_earnings > 0 {
        let ggor_transfer = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                ggor_transfer,
                signer,
            ),
            creator_earnings,
        )?;
    }

    // Transfer platform fee from escrow to platform wallet
    if fee_amount > 0 {
        let fee_transfer = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.platform_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                fee_transfer,
                signer,
            ),
            fee_amount,
        )?;
    }

    // Update raffle state to Completed
    let raffle = &mut ctx.accounts.raffle;
    raffle.status = RaffleStatus::Completed;

    emit!(PrizeClaimed {
        raffle_id,
        winner: ctx.accounts.winner.key(),
        prize_nft: raffle.nft_mint,
        creator_earnings,
    });

    msg!("Prize claimed for raffle {}: NFT sent to {}", raffle_id, ctx.accounts.winner.key());
    Ok(())
}

#[event]
pub struct PrizeClaimed {
    pub raffle_id: u64,
    pub winner: Pubkey,
    pub prize_nft: Pubkey,
    pub creator_earnings: u64,
}
