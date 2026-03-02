use anchor_lang::prelude::*;

#[account]
pub struct RaffleState {
    pub authority: Pubkey,
    pub raffle_count: u64,
}

impl RaffleState {
    pub const SIZE: usize = 32 + 8;
}

#[account]
pub struct Raffle {
    pub raffle_id: u64,
    pub creator: Pubkey,
    pub nft_mint: Pubkey,
    pub ticket_price: u64,
    pub total_tickets: u64,
    pub tickets_sold: u64,
    pub end_time: i64,
    pub status: RaffleStatus,
    pub winner: Option<Pubkey>,
    pub randomness: Option<u64>,
    pub platform_fee_bps: u16,
}

impl Raffle {
    // 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + (1+32) + (1+8) + 2 = 141, padded to 200
    pub const SIZE: usize = 200;

    pub fn calculate_fee_bps(duration_hours: i64) -> u16 {
        if duration_hours <= 6 {
            250 // 2.5%
        } else if duration_hours <= 24 {
            500 // 5%
        } else if duration_hours <= 48 {
            750 // 7.5%
        } else {
            1000 // 10%
        }
    }
}

#[account]
pub struct TicketAccount {
    pub raffle_id: u64,
    pub buyer: Pubkey,
    pub ticket_count: u64,
    pub ticket_numbers: Vec<u64>,
}

impl TicketAccount {
    // 8 + 32 + 8 + 4 + (8 * max_tickets) — use a generous default
    pub const BASE_SIZE: usize = 8 + 32 + 8 + 4;

    pub fn size(max_tickets: usize) -> usize {
        Self::BASE_SIZE + (8 * max_tickets)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RaffleStatus {
    Active,
    Drawing,
    Completed,
    Cancelled,
}
