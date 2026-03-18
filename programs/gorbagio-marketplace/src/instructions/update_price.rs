use anchor_lang::prelude::*;
use crate::state::Listing;
use crate::error::MarketplaceError;

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        constraint = seller.key() == listing.seller @ MarketplaceError::UnauthorizedSeller
    )]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", listing.nft_mint.as_ref()],
        bump = listing.bump
    )]
    pub listing: Box<Account<'info, Listing>>,
}

pub fn handler(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
    require!(new_price > 0, MarketplaceError::InvalidPrice);

    let listing = &mut ctx.accounts.listing;
    let old_price = listing.price;
    listing.price = new_price;

    emit!(PriceUpdated {
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        old_price,
        new_price,
    });

    msg!(
        "Price updated for NFT {}: {} -> {}",
        listing.nft_mint,
        old_price,
        new_price
    );
    Ok(())
}

#[event]
pub struct PriceUpdated {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub old_price: u64,
    pub new_price: u64,
}
