use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4Mk9t8VaZahZq4Y9iPBUzPnnM9yYpfrebBT4sTH7c5ej");

#[program]
pub mod goraffle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        raffle_id: u64,
    ) -> Result<()> {
        instructions::create_raffle::create_escrow_handler(ctx, raffle_id)
    }

    pub fn create_raffle(
        ctx: Context<CreateRaffle>,
        raffle_id: u64,
        ticket_price: u64,
        total_tickets: u64,
        end_time: i64,
    ) -> Result<()> {
        instructions::create_raffle::handler(ctx, raffle_id, ticket_price, total_tickets, end_time)
    }

    pub fn buy_tickets(
        ctx: Context<BuyTickets>,
        raffle_id: u64,
        quantity: u64,
    ) -> Result<()> {
        instructions::buy_tickets::handler(ctx, raffle_id, quantity)
    }

    pub fn draw_winner(
        ctx: Context<DrawWinner>,
        raffle_id: u64,
    ) -> Result<()> {
        instructions::draw_winner::handler(ctx, raffle_id)
    }

    pub fn cancel_raffle(
        ctx: Context<CancelRaffle>,
        raffle_id: u64,
    ) -> Result<()> {
        instructions::cancel_raffle::handler(ctx, raffle_id)
    }
}
