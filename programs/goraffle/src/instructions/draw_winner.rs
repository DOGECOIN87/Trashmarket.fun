use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::{Raffle, RaffleStatus};
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

    /// CHECK: The winner account, validated by the winning ticket lookup
    #[account(mut)]
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

    // Generate pseudo-random number from slot hashes and timestamp
    let clock = Clock::get()?;
    let slot = clock.slot;
    let timestamp = clock.unix_timestamp;

    // Use a combination of slot, timestamp, and raffle data for randomness
    let seed_data: Vec<u8> = [
        slot.to_le_bytes().as_ref(),
        timestamp.to_le_bytes().as_ref(),
        raffle_id.to_le_bytes().as_ref(),
        raffle.tickets_sold.to_le_bytes().as_ref(),
    ].concat();

    let hash = anchor_lang::solana_program::hash::hash(&seed_data);
    let hash_bytes = hash.to_bytes();
    let randomness = u64::from_le_bytes(hash_bytes[0..8].try_into().unwrap());

    // Pick winning ticket
    let winning_ticket = randomness % raffle.tickets_sold;

    // Transfer NFT from escrow to winner
    let escrow_bump = ctx.bumps.escrow_authority;
    let raffle_id_bytes = raffle_id.to_le_bytes();
    let seeds = &[
        b"escrow" as &[u8],
        raffle_id_bytes.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

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

    // Update raffle state
    let raffle = &mut ctx.accounts.raffle;
    raffle.status = RaffleStatus::Completed;
    raffle.winner = Some(ctx.accounts.winner.key());
    raffle.randomness = Some(randomness);

    emit!(WinnerDrawn {
        raffle_id,
        winner: ctx.accounts.winner.key(),
        winning_ticket,
        randomness,
        prize_nft: raffle.nft_mint,
        creator_earnings,
    });

    msg!("Winner drawn for raffle {}: ticket #{}", raffle_id, winning_ticket);
    Ok(())
}

#[event]
pub struct WinnerDrawn {
    pub raffle_id: u64,
    pub winner: Pubkey,
    pub winning_ticket: u64,
    pub randomness: u64,
    pub prize_nft: Pubkey,
    pub creator_earnings: u64,
}
