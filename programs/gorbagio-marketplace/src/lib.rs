use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("DohoM3SvQzfcHVWH1r6BVTWdcNgYQxsxsTqxeZWBmL2E");

#[program]
pub mod gorbagio_marketplace {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        treasury: Pubkey,
        fee_bps: u16,
        collection_mint: Pubkey,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, treasury, fee_bps, collection_mint)
    }

    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        instructions::list_nft::handler(ctx, price)
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        instructions::buy_nft::handler(ctx)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handler(ctx)
    }

    pub fn update_price(ctx: Context<UpdatePrice>, new_price: u64) -> Result<()> {
        instructions::update_price::handler(ctx, new_price)
    }
}
