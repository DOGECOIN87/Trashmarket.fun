use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount};
use crate::state::MarketplaceConfig;
use crate::error::MarketplaceError;

/// Admin-only instruction to close orphaned escrow token accounts.
///
/// An orphaned escrow arises when a listing is cancelled or a sale completes
/// on the old program version that did not close the escrow.  The escrow PDA
/// ends up with 0 tokens but still holds rent lamports, which prevents the
/// same NFT from being relisted (the subsequent `list_nft` `init` fails with
/// AccountAlreadyInUse / Custom:0).
///
/// Safety guarantees:
///   - Caller must be the marketplace authority (admin).
///   - Escrow must be empty (amount == 0); an NFT in escrow means an active
///     listing — those must not be touched.
///   - Rent is returned to `rent_destination`, which should be the original
///     seller where known, or the admin wallet as a fallback.
#[derive(Accounts)]
pub struct CloseOrphanedEscrow<'info> {
    /// Marketplace admin — must match `marketplace_config.authority`.
    #[account(
        mut,
        constraint = authority.key() == marketplace_config.authority @ MarketplaceError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"marketplace_config"],
        bump
    )]
    pub marketplace_config: Box<Account<'info, MarketplaceConfig>>,

    /// The NFT whose escrow account is being closed.
    pub nft_mint: Box<Account<'info, Mint>>,

    /// The orphaned escrow token PDA.  Must be empty (amount == 0).
    #[account(
        mut,
        seeds = [b"escrow_nft", nft_mint.key().as_ref()],
        bump,
        constraint = escrow_nft_account.amount == 0 @ MarketplaceError::EscrowNotEmpty
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA signer for escrow operations, validated by seeds.
    #[account(
        seeds = [b"marketplace_authority"],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    /// Recipient of the reclaimed rent lamports (original seller or admin).
    /// CHECK: Verified off-chain by the admin running the cleanup script.
    #[account(mut)]
    pub rent_destination: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CloseOrphanedEscrow>) -> Result<()> {
    let authority_bump = ctx.bumps.escrow_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"marketplace_authority", &[authority_bump]]];

    let close_accounts = CloseAccount {
        account: ctx.accounts.escrow_nft_account.to_account_info(),
        destination: ctx.accounts.rent_destination.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        close_accounts,
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    msg!(
        "Closed orphaned escrow for NFT {}; rent returned to {}",
        ctx.accounts.nft_mint.key(),
        ctx.accounts.rent_destination.key()
    );
    Ok(())
}
