use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Listing, MarketplaceConfig};
use crate::error::MarketplaceError;

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Validated as listing.seller, receives GOR payment
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::UnauthorizedSeller
    )]
    pub seller: AccountInfo<'info>,

    #[account(
        seeds = [b"marketplace_config"],
        bump
    )]
    pub marketplace_config: Box<Account<'info, MarketplaceConfig>>,

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
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer
    )]
    pub buyer_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA signer for escrow, validated by seeds
    #[account(
        seeds = [b"marketplace_authority"],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// CHECK: Treasury wallet, validated against config
    #[account(
        mut,
        constraint = treasury.key() == marketplace_config.treasury
    )]
    pub treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<BuyNft>) -> Result<()> {
    let listing = &ctx.accounts.listing;
    let config = &ctx.accounts.marketplace_config;

    // Buyer cannot be the seller
    require!(
        ctx.accounts.buyer.key() != listing.seller,
        MarketplaceError::BuyerIsSeller
    );

    // Calculate fee and seller proceeds (checked arithmetic)
    let price = listing.price;
    let fee = price
        .checked_mul(config.fee_bps as u64)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;
    let seller_proceeds = price
        .checked_sub(fee)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;

    // --- Transfer native GOR: buyer -> seller ---
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        seller_proceeds,
    )?;

    // --- Transfer native GOR fee: buyer -> treasury ---
    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // --- Transfer NFT: escrow -> buyer (PDA signer) ---
    let authority_bump = ctx.bumps.escrow_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"marketplace_authority", &[authority_bump]]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.buyer_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, 1)?;

    emit!(NftSold {
        seller: listing.seller,
        buyer: ctx.accounts.buyer.key(),
        nft_mint: listing.nft_mint,
        price,
        fee,
    });

    msg!(
        "NFT {} sold to {} for {} lamports (fee: {})",
        listing.nft_mint,
        ctx.accounts.buyer.key(),
        price,
        fee
    );
    Ok(())
}

#[event]
pub struct NftSold {
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub fee: u64,
}
