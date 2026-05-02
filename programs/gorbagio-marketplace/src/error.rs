use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Invalid price: must be greater than 0")]
    InvalidPrice,
    #[msg("NFT is not from the Gorbagio collection")]
    InvalidCollection,
    #[msg("Only the seller can perform this action")]
    UnauthorizedSeller,
    #[msg("Insufficient balance to purchase")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid metadata account")]
    InvalidMetadata,
    #[msg("Buyer cannot be the seller")]
    BuyerIsSeller,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Escrow account is not empty")]
    EscrowNotEmpty,
    #[msg("Listing is still active; cancel it before closing the escrow")]
    ListingStillActive,
}
