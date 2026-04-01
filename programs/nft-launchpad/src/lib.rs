use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::{
    instructions::{CreateMasterEditionV3CpiBuilder, CreateMetadataAccountV3CpiBuilder},
    types::{Creator, DataV2},
    ID as TOKEN_METADATA_ID,
};

declare_id!("9CzjUboaFZtUhtkqVN2wgWEunDasdorwo6CJfYrJWngj");

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SUPPLY: u64 = 10_000;
/// 200 GOR in lamports (9 decimals)
const DEFAULT_MINT_PRICE: u64 = 200_000_000_000;
const COLLECTION_NAME: &str = "BRUH, IT'S JUST ALIENS";
const COLLECTION_SYMBOL: &str = "JALIEN";
const SELLER_FEE_BASIS_POINTS: u16 = 500; // 5%

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod nft_launchpad {
    use super::*;

    /// One-time initialization. Called by the authority (deployer) after deploy.
    /// `base_uri` should be the IPFS/Arweave base URI *without* trailing slash,
    /// e.g. "https://arweave.net/YOUR_BASE_TX_ID"
    /// Each NFT's metadata will be fetched from: `{base_uri}/{index}.json`
    pub fn initialize(
        ctx: Context<Initialize>,
        base_uri: String,
        treasury: Pubkey,
        go_live_timestamp: i64,
    ) -> Result<()> {
        require!(base_uri.len() <= 200, LaunchpadError::UriTooLong);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = treasury;
        config.base_uri = base_uri;
        config.items_minted = 0;
        config.max_supply = MAX_SUPPLY;
        config.mint_price = DEFAULT_MINT_PRICE;
        config.is_live = false;
        config.go_live_timestamp = go_live_timestamp;
        config.bump = ctx.bumps.config;

        emit!(CollectionInitialized {
            authority: config.authority,
            treasury: config.treasury,
            max_supply: config.max_supply,
            mint_price: config.mint_price,
        });

        Ok(())
    }

    /// Flip the live flag. Admin only.
    pub fn set_live(ctx: Context<AdminOnly>, is_live: bool) -> Result<()> {
        ctx.accounts.config.is_live = is_live;
        emit!(LiveStatusChanged { is_live });
        Ok(())
    }

    /// Update the base URI (e.g. after uploading assets). Admin only.
    pub fn update_base_uri(ctx: Context<AdminOnly>, base_uri: String) -> Result<()> {
        require!(base_uri.len() <= 200, LaunchpadError::UriTooLong);
        ctx.accounts.config.base_uri = base_uri;
        Ok(())
    }

    /// Update the mint price. Admin only.
    pub fn update_price(ctx: Context<AdminOnly>, new_price: u64) -> Result<()> {
        require!(new_price > 0, LaunchpadError::InvalidPrice);
        ctx.accounts.config.mint_price = new_price;
        Ok(())
    }

    /// Update the go-live timestamp. Admin only.
    pub fn update_go_live(ctx: Context<AdminOnly>, go_live_timestamp: i64) -> Result<()> {
        ctx.accounts.config.go_live_timestamp = go_live_timestamp;
        Ok(())
    }

    /// Mint one NFT from the collection.
    /// The client must pass a freshly generated Keypair as `nft_mint` (signer).
    /// Payment of `mint_price` GOR lamports is transferred to the treasury.
    /// A Metaplex token metadata account + master edition are created via CPI.
    pub fn mint_nft(ctx: Context<MintNft>) -> Result<()> {
        // ── Guards — read all config fields up front before any mutable borrow ──
        let is_live = ctx.accounts.config.is_live;
        let items_minted = ctx.accounts.config.items_minted;
        let max_supply = ctx.accounts.config.max_supply;
        let go_live_timestamp = ctx.accounts.config.go_live_timestamp;
        let mint_price = ctx.accounts.config.mint_price;
        let config_bump = ctx.accounts.config.bump;
        let authority = ctx.accounts.config.authority;
        let base_uri = ctx.accounts.config.base_uri.clone();

        require!(is_live, LaunchpadError::MintingNotLive);
        require!(items_minted < max_supply, LaunchpadError::SoldOut);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= go_live_timestamp,
            LaunchpadError::MintingNotLive
        );

        // ── 1. Collect GOR payment: minter → treasury ──────────────────────
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.minter.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            mint_price,
        )?;

        // ── 2. Mint 1 token — config PDA is the mint authority ─────────────
        let seeds: &[&[u8]] = &[b"config", &[config_bump]];
        let signer_seeds = &[seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.minter_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // ── 3. Build per-token URI and name ────────────────────────────────
        let index = items_minted;
        let uri = format!("{}/{}.json", base_uri.trim_end_matches('/'), index);
        let name = format!("{} #{}", COLLECTION_NAME, index + 1);

        // ── 4. Create Metaplex metadata account ────────────────────────────
        CreateMetadataAccountV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
            .metadata(&ctx.accounts.metadata)
            .mint(&ctx.accounts.nft_mint.to_account_info())
            .mint_authority(&ctx.accounts.config.to_account_info())
            .payer(&ctx.accounts.minter.to_account_info())
            .update_authority(&ctx.accounts.config.to_account_info(), true)
            .system_program(&ctx.accounts.system_program.to_account_info())
            .data(DataV2 {
                name,
                symbol: COLLECTION_SYMBOL.to_string(),
                uri,
                seller_fee_basis_points: SELLER_FEE_BASIS_POINTS,
                creators: Some(vec![Creator {
                    address: authority,
                    verified: false,
                    share: 100,
                }]),
                collection: None,
                uses: None,
            })
            .is_mutable(true)
            .invoke_signed(signer_seeds)?;

        // ── 5. Create master edition → locks supply at 1 (true 1/1 NFT) ───
        CreateMasterEditionV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
            .edition(&ctx.accounts.master_edition)
            .mint(&ctx.accounts.nft_mint.to_account_info())
            .update_authority(&ctx.accounts.config.to_account_info())
            .mint_authority(&ctx.accounts.config.to_account_info())
            .payer(&ctx.accounts.minter.to_account_info())
            .metadata(&ctx.accounts.metadata)
            .token_program(&ctx.accounts.token_program.to_account_info())
            .system_program(&ctx.accounts.system_program.to_account_info())
            .max_supply(0)
            .invoke_signed(signer_seeds)?;

        // ── 6. Increment counter ───────────────────────────────────────────
        let config = &mut ctx.accounts.config;
        config.items_minted = config
            .items_minted
            .checked_add(1)
            .ok_or(LaunchpadError::Overflow)?;

        emit!(NftMinted {
            minter: ctx.accounts.minter.key(),
            mint: ctx.accounts.nft_mint.key(),
            index,
            treasury_received: mint_price,
        });

        Ok(())
    }

    /// Emergency withdraw lamports from the config PDA (in case any
    /// accidentally accumulate there). Admin only.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let config_info = ctx.accounts.config.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();

        **config_info.try_borrow_mut_lamports()? = config_info
            .lamports()
            .checked_sub(amount)
            .ok_or(LaunchpadError::Overflow)?;
        **treasury_info.try_borrow_mut_lamports()? = treasury_info
            .lamports()
            .checked_add(amount)
            .ok_or(LaunchpadError::Overflow)?;

        Ok(())
    }
}

// ─── Account Structs ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + LaunchpadConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, LaunchpadConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ LaunchpadError::Unauthorized,
    )]
    pub config: Account<'info, LaunchpadConfig>,
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    /// Pays for the mint and all account creation
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, LaunchpadConfig>,

    /// Receives 200 GOR — validated against config.treasury
    /// CHECK: Constraint enforces this is the correct treasury address
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ LaunchpadError::InvalidTreasury,
    )]
    pub treasury: AccountInfo<'info>,

    /// New unique mint for this NFT — client generates a fresh Keypair
    #[account(
        init,
        payer = minter,
        mint::decimals = 0,
        mint::authority = config,
        mint::freeze_authority = config,
    )]
    pub nft_mint: Account<'info, Mint>,

    /// Minter's token account for this NFT
    #[account(
        init_if_needed,
        payer = minter,
        associated_token::mint = nft_mint,
        associated_token::authority = minter,
    )]
    pub minter_ata: Account<'info, TokenAccount>,

    /// Metaplex metadata PDA — seeds validated by token metadata program CPI
    /// CHECK: Derived and validated by the Metaplex Token Metadata program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Metaplex master edition PDA — makes this a true 1/1 NFT
    /// CHECK: Derived and validated by the Metaplex Token Metadata program
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: Metaplex Token Metadata program — confirmed deployed on Gorbagana
    #[account(address = TOKEN_METADATA_ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ LaunchpadError::Unauthorized,
    )]
    pub config: Account<'info, LaunchpadConfig>,

    /// CHECK: Treasury wallet, validated against config.treasury
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ LaunchpadError::InvalidTreasury,
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct LaunchpadConfig {
    /// Admin who can toggle live, update price/URI
    pub authority: Pubkey,        // 32
    /// Wallet that receives all mint payments
    pub treasury: Pubkey,         // 32
    /// Base URI for metadata (IPFS/Arweave), no trailing slash
    #[max_len(200)]
    pub base_uri: String,         // 4 + 200
    /// Number of NFTs minted so far
    pub items_minted: u64,        // 8
    /// Hard cap — 10,000
    pub max_supply: u64,          // 8
    /// Price per mint in lamports (200 GOR = 200_000_000_000)
    pub mint_price: u64,          // 8
    /// Whether minting is currently active
    pub is_live: bool,            // 1
    /// Unix timestamp when minting opens (can be 0 for immediate)
    pub go_live_timestamp: i64,   // 8
    /// PDA bump seed
    pub bump: u8,                 // 1
                                  // Total: 8 disc + 302 data = 310 bytes
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum LaunchpadError {
    #[msg("Minting is not live yet")]
    MintingNotLive,
    #[msg("Collection is sold out")]
    SoldOut,
    #[msg("Unauthorized — only the admin can perform this action")]
    Unauthorized,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("URI too long (max 200 chars)")]
    UriTooLong,
    #[msg("Invalid price — must be greater than 0")]
    InvalidPrice,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct CollectionInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub max_supply: u64,
    pub mint_price: u64,
}

#[event]
pub struct NftMinted {
    pub minter: Pubkey,
    pub mint: Pubkey,
    pub index: u64,
    pub treasury_received: u64,
}

#[event]
pub struct LiveStatusChanged {
    pub is_live: bool,
}
