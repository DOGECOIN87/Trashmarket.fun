use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::Listing;
use crate::error::MarketplaceError;

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::UnauthorizedSeller
    )]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump = listing.bump,
        close = seller
    )]
    pub listing: Box<Account<'info, Listing>>,

    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"escrow_nft", nft_mint.key().as_ref()],
        bump
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = seller_nft_account.mint == nft_mint.key(),
        constraint = seller_nft_account.owner == seller.key()
    )]
    pub seller_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA signer for escrow, validated by seeds
    #[account(
        seeds = [b"marketplace_authority"],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    let listing = &ctx.accounts.listing;

    // Transfer NFT back from escrow to seller (PDA signer)
    let authority_bump = ctx.bumps.escrow_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"marketplace_authority", &[authority_bump]]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.seller_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, 1)?;

    emit!(ListingCancelled {
        seller: listing.seller,
        nft_mint: listing.nft_mint,
    });

    msg!("Listing cancelled for NFT {}", listing.nft_mint);
    Ok(())
}

#[event]
pub struct ListingCancelled {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
}
