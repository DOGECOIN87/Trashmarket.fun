use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use mpl_token_metadata::accounts::Metadata;
use crate::state::{Listing, MarketplaceConfig};
use crate::error::MarketplaceError;

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [b"marketplace_config"],
        bump
    )]
    pub marketplace_config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::SIZE,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump
    )]
    pub listing: Box<Account<'info, Listing>>,

    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = seller_nft_account.mint == nft_mint.key(),
        constraint = seller_nft_account.owner == seller.key(),
        constraint = seller_nft_account.amount == 1
    )]
    pub seller_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = seller,
        token::mint = nft_mint,
        token::authority = escrow_authority,
        seeds = [b"escrow_nft", nft_mint.key().as_ref()],
        bump
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA signer for escrow accounts, validated by seeds
    #[account(
        seeds = [b"marketplace_authority"],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// CHECK: Metaplex metadata account, validated in handler
    pub metadata_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ListNft>, price: u64) -> Result<()> {
    require!(price > 0, MarketplaceError::InvalidPrice);

    // --- Collection verification ---
    // Deserialize Metaplex metadata and verify collection key matches
    let metadata_info = &ctx.accounts.metadata_account;
    let metadata = Metadata::safe_deserialize(&metadata_info.data.borrow())
        .map_err(|_| MarketplaceError::InvalidMetadata)?;

    let collection = metadata
        .collection
        .ok_or(MarketplaceError::InvalidCollection)?;

    require!(
        collection.key == ctx.accounts.marketplace_config.collection_mint,
        MarketplaceError::InvalidCollection
    );

    // Verify metadata account is derived from the correct mint
    let (expected_metadata, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            ctx.accounts.nft_mint.key().as_ref(),
        ],
        &mpl_token_metadata::ID,
    );
    require!(
        metadata_info.key() == expected_metadata,
        MarketplaceError::InvalidMetadata
    );

    // --- Transfer NFT to escrow ---
    let cpi_accounts = Transfer {
        from: ctx.accounts.seller_nft_account.to_account_info(),
        to: ctx.accounts.escrow_nft_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::transfer(cpi_ctx, 1)?;

    // --- Initialize listing ---
    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.price = price;
    listing.created_at = Clock::get()?.unix_timestamp;
    listing.bump = ctx.bumps.listing;

    emit!(NftListed {
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        price,
    });

    msg!(
        "NFT {} listed by {} for {} lamports",
        listing.nft_mint,
        listing.seller,
        price
    );
    Ok(())
}

#[event]
pub struct NftListed {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
}
