use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    #[msg("Invalid ticket count")]
    InvalidTicketCount,        // 6000
    #[msg("Invalid ticket price")]
    InvalidTicketPrice,        // 6001
    #[msg("Invalid end time")]
    InvalidEndTime,            // 6002
    #[msg("Raffle is not active")]
    RaffleNotActive,           // 6003
    #[msg("Raffle has ended")]
    RaffleEnded,               // 6004
    #[msg("Not enough tickets available")]
    NotEnoughTickets,          // 6005
    #[msg("Invalid raffle status")]
    InvalidStatus,             // 6006
    #[msg("Raffle has not ended yet")]
    RaffleNotEnded,            // 6007
    #[msg("Cannot cancel raffle")]
    CannotCancel,              // 6008
    #[msg("Insufficient balance")]
    InsufficientBalance,       // 6009
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,        // 6010
    #[msg("Invalid ticket account")]
    InvalidTicketAccount,      // 6011
    #[msg("No ticket accounts provided")]
    NoTicketAccounts,          // 6012
    #[msg("Incomplete ticket accounts - all must be provided")]
    IncompleteTicketAccounts,  // 6013
    #[msg("Winner not found in ticket accounts")]
    WinnerNotFound,            // 6014
    #[msg("Invalid winner")]
    InvalidWinner,             // 6015
}
