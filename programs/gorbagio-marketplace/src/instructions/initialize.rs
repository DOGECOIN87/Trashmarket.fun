use anchor_lang::prelude::*;
use crate::state::MarketplaceConfig;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketplaceConfig::SIZE,
        seeds = [b"marketplace_config"],
        bump
    )]
    pub marketplace_config: Box<Account<'info, MarketplaceConfig>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    treasury: Pubkey,
    fee_bps: u16,
    collection_mint: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.marketplace_config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.fee_bps = fee_bps;
    config.collection_mint = collection_mint;
    config.listing_count = 0;

    msg!("Marketplace initialized: fee={}bps, collection={}", fee_bps, collection_mint);
    Ok(())
}
