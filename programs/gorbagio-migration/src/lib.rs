//! # Gorbagio Migration Program
//!
//! Migrates legacy Gorbagio NFTs (Token-2022 with inline metadata) to
//! Metaplex Token Metadata standard on Gorbagana.
//!
//! The legacy token is burned (irreversible, supply → 0) and a new
//! Metaplex-compliant NFT is minted in one atomic transaction.
//! If any step fails, the entire transaction rolls back — no NFTs can be lost.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use anchor_spl::token_interface::{
    self as token_interface, Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount,
    TokenInterface,
};
use mpl_token_metadata::instructions::{
    CreateMasterEditionV3, CreateMasterEditionV3InstructionArgs, CreateMetadataAccountV3,
    CreateMetadataAccountV3InstructionArgs,
};
use mpl_token_metadata::types::{Collection, DataV2};
use solana_program::program::invoke;

declare_id!("3PtknVekKAYAYExL6YQWxf6bycpGWoQQ9tNM566qzKmU");

/// Known update authority for the Gorbagio collection on Gorbagana.
const GORBAGIO_UPDATE_AUTHORITY: Pubkey =
    pubkey!("fair1sCzkkPSvF44QGoD89ThvZdK1e4vP1jBKxW3v7M");

/// Gorbagio collection NFT mint on Gorbagana.
const GORBAGIO_COLLECTION_MINT: Pubkey =
    pubkey!("FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1");

/// Treasury wallet that receives migration fees.
const TREASURY: Pubkey = pubkey!("77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb");

/// Migration fee: 1000 GOR (9 decimals).
const MIGRATION_FEE: u64 = 1_000_000_000_000;

#[program]
pub mod gorbagio_migration {
    use super::*;

    /// Migrates a legacy Gorbagio NFT to a Metaplex-compliant NFT.
    ///
    /// All steps are atomic — if any fails, the entire transaction rolls back.
    ///
    /// 1. Validate the legacy mint is a Gorbagio (update authority check).
    /// 2. Burn the legacy token (supply → 0, irreversible).
    /// 3. Close the user's legacy token account (rent returned to user).
    /// 4. Mint 1 token of the new mint to the user's ATA.
    /// 5. Create Metaplex Metadata account.
    /// 6. Create Metaplex Master Edition (revokes mint authority, supply permanently = 1).
    pub fn migrate_gorbagio(
        ctx: Context<MigrateGorbagio>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // --- Step 1: Validate the legacy mint is a Gorbagio ---
        let legacy_mint_info = ctx.accounts.legacy_mint.to_account_info();
        let data = legacy_mint_info.try_borrow_data()?;
        let update_authority =
            parse_token2022_update_authority(&data).ok_or(ErrorCode::NotAGorbagio)?;
        require!(
            update_authority == GORBAGIO_UPDATE_AUTHORITY,
            ErrorCode::NotAGorbagio
        );
        drop(data);

        // --- Step 2: Collect migration fee (1000 GOR → treasury) ---
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(transfer_ctx, MIGRATION_FEE)?;

        // --- Step 3: Burn the legacy token via Token-2022 ---
        // (was Step 2 before fee was added)
        let burn_accounts = token_interface::Burn {
            mint: ctx.accounts.legacy_mint.to_account_info(),
            from: ctx.accounts.user_legacy_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let burn_ctx = CpiContext::new(
            ctx.accounts.legacy_token_program.to_account_info(),
            burn_accounts,
        );
        token_interface::burn(burn_ctx, 1)?;

        // --- Step 3: Close the legacy token account (rent → user) ---
        let close_accounts = token_interface::CloseAccount {
            account: ctx.accounts.user_legacy_token_account.to_account_info(),
            destination: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let close_ctx = CpiContext::new(
            ctx.accounts.legacy_token_program.to_account_info(),
            close_accounts,
        );
        token_interface::close_account(close_ctx)?;

        // --- Step 4: Mint 1 token of the new mint ---
        let mint_to_accounts = MintTo {
            mint: ctx.accounts.new_mint.to_account_info(),
            to: ctx.accounts.user_new_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let mint_to_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            mint_to_accounts,
        );
        token::mint_to(mint_to_ctx, 1)?;

        // --- Step 5: Create Metaplex Metadata Account ---
        let create_metadata_ix = CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata_account.key(),
            mint: ctx.accounts.new_mint.key(),
            mint_authority: ctx.accounts.user.key(),
            payer: ctx.accounts.user.key(),
            update_authority: (ctx.accounts.user.key(), true),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        }
        .instruction(CreateMetadataAccountV3InstructionArgs {
            data: DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: None,
                collection: Some(Collection {
                    verified: false,
                    key: GORBAGIO_COLLECTION_MINT,
                }),
                uses: None,
            },
            is_mutable: true,
            collection_details: None,
        });

        invoke(
            &create_metadata_ix,
            &[
                ctx.accounts.metadata_account.to_account_info(),
                ctx.accounts.new_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;

        // --- Step 6: Create Metaplex Master Edition ---
        // This revokes mint authority, permanently fixing supply at 1.
        let create_master_edition_ix = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition_account.key(),
            mint: ctx.accounts.new_mint.key(),
            update_authority: ctx.accounts.user.key(),
            mint_authority: ctx.accounts.user.key(),
            payer: ctx.accounts.user.key(),
            metadata: ctx.accounts.metadata_account.key(),
            token_program: ctx.accounts.token_program.key(),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        }
        .instruction(CreateMasterEditionV3InstructionArgs {
            max_supply: Some(0),
        });

        invoke(
            &create_master_edition_ix,
            &[
                ctx.accounts.master_edition_account.to_account_info(),
                ctx.accounts.new_mint.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.metadata_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

/// Parse the update authority from Token-2022 inline metadata extension.
///
/// Walks TLV extensions starting at offset 166 to find type 19 (TokenMetadata),
/// then reads the 32-byte update authority pubkey.
fn parse_token2022_update_authority(data: &[u8]) -> Option<Pubkey> {
    if data.len() < 170 {
        return None;
    }
    let mut off = 166;
    while off + 4 <= data.len() {
        let ext_type = u16::from_le_bytes([data[off], data[off + 1]]);
        let ext_len = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;

        if ext_type == 19 {
            let start = off + 4;
            if start + 32 > data.len() {
                return None;
            }
            let bytes: [u8; 32] = data[start..start + 32].try_into().ok()?;
            return Some(Pubkey::new_from_array(bytes));
        }

        off += 4 + ext_len;
    }
    None
}

/// Accounts for the `migrate_gorbagio` instruction.
#[derive(Accounts)]
pub struct MigrateGorbagio<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    // ---- Legacy side (Token-2022) ----

    /// The legacy Gorbagio NFT mint (Token-2022 with inline metadata).
    #[account(mut)]
    pub legacy_mint: Box<InterfaceAccount<'info, InterfaceMint>>,

    /// The user's Token-2022 token account holding the legacy Gorbagio NFT.
    #[account(
        mut,
        constraint = user_legacy_token_account.mint == legacy_mint.key() @ ErrorCode::InvalidMint,
        constraint = user_legacy_token_account.owner == user.key() @ ErrorCode::InvalidOwner,
        constraint = user_legacy_token_account.amount == 1 @ ErrorCode::InvalidAmount,
    )]
    pub user_legacy_token_account: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,

    /// The Token-2022 program for burn/close operations.
    pub legacy_token_program: Interface<'info, TokenInterface>,

    // ---- New side (standard SPL Token for Metaplex) ----

    /// New mint for the Metaplex NFT (standard SPL Token).
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = user,
        mint::freeze_authority = user,
    )]
    pub new_mint: Box<Account<'info, Mint>>,

    /// User's ATA for the new Metaplex NFT.
    #[account(
        init,
        payer = user,
        associated_token::mint = new_mint,
        associated_token::authority = user,
    )]
    pub user_new_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Created via CPI to Metaplex. Validated by Metaplex program.
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK: Created via CPI to Metaplex. Validated by Metaplex program.
    #[account(mut)]
    pub master_edition_account: UncheckedAccount<'info>,

    /// CHECK: Address validated against known Metaplex program ID.
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,

    /// Standard SPL Token program (for new mint + mint_to).
    pub token_program: Program<'info, Token>,

    /// CHECK: Treasury wallet validated by address constraint.
    #[account(mut, address = TREASURY)]
    pub treasury: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided mint does not match the legacy token account.")]
    InvalidMint,
    #[msg("The user does not own the legacy token account.")]
    InvalidOwner,
    #[msg("The legacy token account must contain exactly 1 token.")]
    InvalidAmount,
    #[msg("This NFT is not a Gorbagio. Only legacy Gorbagio NFTs can be migrated.")]
    NotAGorbagio,
}
