import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import raffleIdl from '../idl/goraffle.json';

// GGOR uses 9 decimals (same as SOL)
export const GGOR_DECIMALS = 9;

// Program ID (will be updated after deployment)
export const RAFFLE_PROGRAM_ID = new PublicKey('AkD5NMs4wDPMLQrwCW681qdFTZaBz7k5SRDaBCGKsJ5g');

// GGOR mint address (verify with TrashScan)
export const GGOR_MINT = new PublicKey('GGor1111111111111111111111111111111111111111');

// Decimal conversion utilities (9 decimals like SOL)
export const toGGOR = (amount: number): BN => {
  return new BN(Math.round(amount * Math.pow(10, 9)));
};

export const fromGGOR = (lamports: BN | number): number => {
  const val = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return val / Math.pow(10, 9);
};

export const formatGGOR = (lamports: BN | number): string => {
  return `${fromGGOR(lamports).toFixed(2)} GGOR`;
};

// Calculate platform fee based on duration
export const calculatePlatformFeeBps = (durationHours: number): number => {
  if (durationHours <= 6) {
    return 250;  // 2.5%
  } else if (durationHours <= 24) {
    return 500;  // 5%
  } else if (durationHours <= 48) {
    return 750;  // 7.5%
  } else {
    return 1000; // 10%
  }
};

// Format fee percentage for display
export const formatFeeBps = (bps: number): string => {
  return `${(bps / 100).toFixed(1)}%`;
};

export interface Raffle {
  raffleId: number;
  creator: string;
  nftMint: string;
  ticketPrice: number; // in GGOR (UI amount)
  totalTickets: number;
  ticketsSold: number;
  endTime: number; // Unix timestamp
  status: 'active' | 'drawing' | 'completed' | 'cancelled';
  winner?: string;
  randomness?: number;
  publicKey: string;
  platformFeeBps: number; // Dynamic fee based on duration
}

export interface TicketAccount {
  raffleId: number;
  buyer: string;
  ticketCount: number;
  ticketNumbers: number[];
}

export class RaffleService {
  private program: Program;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    this.program = new Program(raffleIdl as Idl, RAFFLE_PROGRAM_ID, this.provider);
  }

  // Get PDA for raffle state
  async getRaffleStatePDA(): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('raffle_state')],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for specific raffle
  async getRafflePDA(raffleId: number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('raffle'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow authority
  async getEscrowAuthorityPDA(raffleId: number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow NFT account
  async getEscrowNftPDA(raffleId: number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow_nft'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow GGOR account
  async getEscrowGgorPDA(raffleId: number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow_ggor'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for ticket account
  async getTicketAccountPDA(raffleId: number, buyer: PublicKey): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('tickets'),
        new BN(raffleId).toArrayLike(Buffer, 'le', 8),
        buyer.toBuffer()
      ],
      RAFFLE_PROGRAM_ID
    );
  }

  // Initialize raffle state (one-time, admin only)
  async initialize(): Promise<string> {
    const [raffleStatePDA] = await this.getRaffleStatePDA();
    
    const tx = await this.program.methods
      .initialize()
      .accounts({
        raffleState: raffleStatePDA,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // Create a new raffle
  async createRaffle(
    nftMint: PublicKey,
    ticketPriceGGOR: number,
    totalTickets: number,
    durationHours: number
  ): Promise<{ signature: string; raffleId: number }> {
    const raffleId = Date.now(); // Use timestamp as unique ID
    const endTime = Math.floor(Date.now() / 1000) + (durationHours * 3600);
    const ticketPrice = toGGOR(ticketPriceGGOR);

    // Get user's NFT token account
    const nftTokenAccount = await getAssociatedTokenAddress(
      nftMint,
      this.provider.wallet.publicKey
    );

    // Get PDAs
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [raffleStatePDA] = await this.getRaffleStatePDA();
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);

    const tx = await this.program.methods
      .createRaffle(
        new BN(raffleId),
        ticketPrice,
        new BN(totalTickets),
        new BN(endTime)
      )
      .accounts({
        raffle: rafflePDA,
        raffleState: raffleStatePDA,
        creator: this.provider.wallet.publicKey,
        nftMint,
        nftTokenAccount,
        escrowNftAccount,
        escrowAuthority,
        escrowTokenAccount,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { signature: tx, raffleId };
  }

  // Buy tickets for a raffle
  async buyTickets(
    raffleId: number,
    quantity: number
  ): Promise<string> {
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);
    const [ticketAccount] = await this.getTicketAccountPDA(raffleId, this.provider.wallet.publicKey);

    // Get buyer's GGOR token account
    const buyerTokenAccount = await getAssociatedTokenAddress(
      GGOR_MINT,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .buyTickets(new BN(raffleId), new BN(quantity))
      .accounts({
        raffle: rafflePDA,
        buyer: this.provider.wallet.publicKey,
        buyerTokenAccount,
        escrowTokenAccount,
        ticketAccount,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return tx;
  }

  // Draw winner for a raffle
  async drawWinner(raffleId: number, winnerPubkey: PublicKey, nftMint: PublicKey): Promise<string> {
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [raffleStatePDA] = await this.getRaffleStatePDA();
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);

    // Get raffle data to find creator
    const raffleData = await this.program.account.raffle.fetch(rafflePDA);
    const creator = raffleData.creator as PublicKey;

    // Get raffle state to find platform fee wallet
    const raffleStateData = await this.program.account.raffleState.fetch(raffleStatePDA);
    const platformFeeWallet = raffleStateData.platformFeeWallet as PublicKey;

    // Get winner's NFT token account
    const winnerNftAccount = await getAssociatedTokenAddress(nftMint, winnerPubkey);

    // Get creator's GGOR token account
    const creatorTokenAccount = await getAssociatedTokenAddress(GGOR_MINT, creator);

    // Get platform fee GGOR token account
    const platformFeeAccount = await getAssociatedTokenAddress(GGOR_MINT, platformFeeWallet);

    const tx = await this.program.methods
      .drawWinner(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        raffleState: raffleStatePDA,
        winner: winnerPubkey,
        escrowNftAccount,
        winnerNftAccount,
        escrowTokenAccount,
        creatorTokenAccount,
        platformFeeAccount,
        escrowAuthority,
        nftMint,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // Cancel a raffle (creator only, no tickets sold)
  async cancelRaffle(raffleId: number, nftMint: PublicKey): Promise<string> {
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);

    // Get creator's NFT token account
    const creatorNftAccount = await getAssociatedTokenAddress(
      nftMint,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .cancelRaffle(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        authority: this.provider.wallet.publicKey,
        escrowNftAccount,
        creatorNftAccount,
        escrowAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // Fetch all raffles
  async fetchAllRaffles(): Promise<Raffle[]> {
    const raffles = await this.program.account.raffle.all();
    
    return raffles.map((r: any) => ({
      raffleId: r.account.raffleId.toNumber(),
      creator: r.account.creator.toString(),
      nftMint: r.account.nftMint.toString(),
      ticketPrice: fromGGOR(r.account.ticketPrice),
      totalTickets: r.account.totalTickets.toNumber(),
      ticketsSold: r.account.ticketsSold.toNumber(),
      endTime: r.account.endTime.toNumber() * 1000, // Convert to ms
      status: Object.keys(r.account.status)[0] as any,
      winner: r.account.winner?.toString(),
      randomness: r.account.randomness?.toNumber(),
      publicKey: r.publicKey.toString(),
      platformFeeBps: r.account.platformFeeBps || 500, // Default to 5% if not set
    }));
  }

  // Fetch specific raffle
  async fetchRaffle(raffleId: number): Promise<Raffle | null> {
    try {
      const [rafflePDA] = await this.getRafflePDA(raffleId);
      const r = await this.program.account.raffle.fetch(rafflePDA);
      
      return {
        raffleId: (r as any).raffleId.toNumber(),
        creator: (r as any).creator.toString(),
        nftMint: (r as any).nftMint.toString(),
        ticketPrice: fromGGOR((r as any).ticketPrice),
        totalTickets: (r as any).totalTickets.toNumber(),
        ticketsSold: (r as any).ticketsSold.toNumber(),
        endTime: (r as any).endTime.toNumber() * 1000,
        status: Object.keys((r as any).status)[0] as any,
        winner: (r as any).winner?.toString(),
        randomness: (r as any).randomness?.toNumber(),
        publicKey: rafflePDA.toString(),
        platformFeeBps: (r as any).platformFeeBps || 500,
      };
    } catch (e) {
      return null;
    }
  }

  // Fetch user's tickets for a raffle
  async fetchUserTickets(raffleId: number, buyer: PublicKey): Promise<TicketAccount | null> {
    try {
      const [ticketAccountPDA] = await this.getTicketAccountPDA(raffleId, buyer);
      const t = await this.program.account.ticketAccount.fetch(ticketAccountPDA);
      
      return {
        raffleId: (t as any).raffleId.toNumber(),
        buyer: (t as any).buyer.toString(),
        ticketCount: (t as any).ticketCount.toNumber(),
        ticketNumbers: (t as any).ticketNumbers.map((n: any) => n.toNumber()),
      };
    } catch (e) {
      return null;
    }
  }
}
