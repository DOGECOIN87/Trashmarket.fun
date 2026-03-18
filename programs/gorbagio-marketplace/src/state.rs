use anchor_lang::prelude::*;

#[account]
pub struct MarketplaceConfig {
    /// Admin authority who can update config
    pub authority: Pubkey,
    /// Treasury wallet that receives marketplace fees
    pub treasury: Pubkey,
    /// Marketplace fee in basis points (250 = 2.5%)
    pub fee_bps: u16,
    /// Required collection mint for listed NFTs
    pub collection_mint: Pubkey,
    /// Total number of listings ever created
    pub listing_count: u64,
}

impl MarketplaceConfig {
    // 32 + 32 + 2 + 32 + 8 = 106
    pub const SIZE: usize = 106;
}

#[account]
pub struct Listing {
    /// Seller's wallet address
    pub seller: Pubkey,
    /// NFT mint address
    pub nft_mint: Pubkey,
    /// Price in native GOR lamports (9 decimals)
    pub price: u64,
    /// Timestamp when listed
    pub created_at: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl Listing {
    // 32 + 32 + 8 + 8 + 1 = 81
    pub const SIZE: usize = 81;
}
