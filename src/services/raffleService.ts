import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import raffleIdl from '../idl/goraffle.json';
import type { Goraffle } from '../idl/goraffle';

// GGOR uses 9 decimals (same as SOL)
export const GGOR_DECIMALS = 9;

// Program ID (will be updated after deployment)
export const RAFFLE_PROGRAM_ID = new PublicKey('EyanJkk7BV9nA5ZzuBQLqC3FWf25dLdgbURhLiV3Hc31');

// Wrapped GOR (GGOR) mint address - native SPL token, 9 decimals
export const GGOR_MINT = new PublicKey('So11111111111111111111111111111111111111112');

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
  raffleId: string; // Changed to string for safety
  creator: string;
  nftMint: string;
  ticketPrice: number; // in GGOR (UI amount)
  totalTickets: number;
  ticketsSold: number;
  endTime: number; // Unix timestamp
  status: 'active' | 'drawing' | 'completed' | 'cancelled' | 'expired_returned';
  winner?: string;
  randomness?: string; // Changed to string for safety (u64)
  publicKey: string;
  platformFeeBps: number; // Dynamic fee based on duration
}

export interface TicketAccount {
  raffleId: string;
  buyer: string;
  ticketCount: number;
  ticketNumbers: string[]; // Changed to string[] for safety
}

export class RaffleService {
  private program: Program<Goraffle>;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    this.program = new Program(raffleIdl as unknown as Goraffle, this.provider);
  }

  // Get PDA for raffle state
  async getRaffleStatePDA(): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('raffle_state')],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for specific raffle
  async getRafflePDA(raffleId: string | number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('raffle'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow authority
  async getEscrowAuthorityPDA(raffleId: string | number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow NFT account
  async getEscrowNftPDA(raffleId: string | number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow_nft'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for escrow GGOR account
  async getEscrowGgorPDA(raffleId: string | number): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from('escrow_ggor'), new BN(raffleId).toArrayLike(Buffer, 'le', 8)],
      RAFFLE_PROGRAM_ID
    );
  }

  // Get PDA for ticket account
  async getTicketAccountPDA(raffleId: string | number, buyer: PublicKey): Promise<[PublicKey, number]> {
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

    const transaction = await this.program.methods
      .initialize()
      .accounts({
        raffleState: raffleStatePDA,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .transaction();

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = this.provider.wallet.publicKey;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Create a new raffle (atomic: escrow + raffle in a single transaction)
  async createRaffle(
    nftMint: PublicKey,
    ticketPriceGGOR: number,
    totalTickets: number,
    durationHours: number,
    sourceNftTokenAccount?: PublicKey // Optional: specific account holding the NFT
  ): Promise<{ signature: string; raffleId: string }> {
    const creator = this.provider.wallet.publicKey;
    const raffleId = Date.now().toString(); // Use string for large IDs
    const endTime = Math.floor(Date.now() / 1000) + (durationHours * 3600);
    const ticketPrice = toGGOR(ticketPriceGGOR);

    // Get user's NFT token account
    let nftTokenAccount = sourceNftTokenAccount;
    if (!nftTokenAccount) {
      nftTokenAccount = await getAssociatedTokenAddress(nftMint, creator);
    }

    // Verify it exists and has the NFT
    try {
      const accountInfo = await getAccount(this.connection, nftTokenAccount);
      if (accountInfo.amount === 0n) {
        throw new Error(`NFT account ${nftTokenAccount.toString()} has 0 balance.`);
      }
    } catch (e: any) {
      if (e.message?.includes('balance')) throw e;
      throw new Error(`NFT account not found: ${nftTokenAccount.toString()}. Ensure the NFT is in your wallet.`);
    }

    // Get PDAs
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [raffleStatePDA] = await this.getRaffleStatePDA();
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);

    // Build both instructions into one atomic transaction
    const transaction = new Transaction();

    // Instruction 1: Create escrow token accounts
    const escrowIx = await this.program.methods
      .createEscrow(new BN(raffleId))
      .accounts({
        creator,
        nftMint,
        ggorMint: GGOR_MINT,
        escrowAuthority,
        escrowNftAccount,
        escrowTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .instruction();

    transaction.add(escrowIx);

    // Instruction 2: Create raffle and transfer NFT
    const raffleIx = await this.program.methods
      .createRaffle(
        new BN(raffleId),
        ticketPrice,
        new BN(totalTickets),
        new BN(endTime)
      )
      .accounts({
        raffle: rafflePDA,
        raffleState: raffleStatePDA,
        creator,
        nftMint,
        nftTokenAccount,
        escrowNftAccount,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .instruction();

    transaction.add(raffleIx);

    // Send atomic transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = creator;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return { signature: tx, raffleId };
  }

  // Buy tickets for a raffle
  async buyTickets(
    raffleId: string | number,
    quantity: number
  ): Promise<string> {
    const buyer = this.provider.wallet.publicKey;
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);
    const [ticketAccount] = await this.getTicketAccountPDA(raffleId, buyer);

    // Get buyer's wrapped GOR (native mint) token account
    const buyerTokenAccount = await getAssociatedTokenAddress(
      GGOR_MINT,
      buyer
    );

    // Fetch raffle to calculate total cost
    const raffleData = await this.program.account.raffle.fetch(rafflePDA);
    const ticketPrice = (raffleData as any).ticketPrice as BN;
    const totalCost = ticketPrice.mul(new BN(quantity));

    // Build transaction with wrapping instructions
    const transaction = new Transaction();

    // 1. Create wrapped GOR ATA if it doesn't exist
    let ataExists = false;
    try {
      await getAccount(this.connection, buyerTokenAccount);
      ataExists = true;
    } catch {
      // ATA doesn't exist, create it
    }

    if (!ataExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          GGOR_MINT
        )
      );
    }

    // 2. Transfer native GOR into the wrapped token account
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: buyerTokenAccount,
        lamports: totalCost.toNumber(),
      })
    );

    // 3. Sync the native balance so the token account reflects the deposit
    transaction.add(
      createSyncNativeInstruction(buyerTokenAccount)
    );

    // 4. Buy tickets instruction
    const buyIx = await this.program.methods
      .buyTickets(new BN(raffleId), new BN(quantity))
      .accounts({
        raffle: rafflePDA,
        buyer,
        buyerTokenAccount,
        escrowTokenAccount,
        ticketAccount,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .instruction();

    transaction.add(buyIx);

    // 5. Close the wrapped GOR account to reclaim rent (returns remaining wrapped GOR as native)
    transaction.add(
      createCloseAccountInstruction(
        buyerTokenAccount,
        buyer,
        buyer
      )
    );

    // Send transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = buyer;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Draw winner for a raffle (Phase 1: determine winner on-chain via remaining_accounts)
  async drawWinner(raffleId: string | number): Promise<string> {
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [raffleStatePDA] = await this.getRaffleStatePDA();

    // Fetch all ticket accounts for this raffle using memcmp filter
    const raffleIdBytes = new BN(raffleId).toArrayLike(Buffer, 'le', 8);
    const ticketAccounts = await this.program.account.ticketAccount.all([
      {
        memcmp: {
          offset: 8, // skip 8-byte discriminator
          bytes: bs58.encode(raffleIdBytes),
        },
      },
    ]);

    if (ticketAccounts.length === 0) {
      throw new Error('No ticket accounts found for this raffle');
    }

    // Pass all ticket account pubkeys as remaining accounts
    const remainingAccounts = ticketAccounts.map((t: any) => ({
      pubkey: t.publicKey,
      isWritable: false,
      isSigner: false,
    }));

    const transaction = await this.program.methods
      .drawWinner(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        raffleState: raffleStatePDA,
        authority: this.provider.wallet.publicKey,
      } as any)
      .remainingAccounts(remainingAccounts)
      .transaction();

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = this.provider.wallet.publicKey;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Claim prize for a raffle (Phase 2: transfer NFT to winner and GGOR to creator)
  async claimPrize(raffleId: string | number, nftMint: PublicKey): Promise<string> {
    const payer = this.provider.wallet.publicKey;
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [raffleStatePDA] = await this.getRaffleStatePDA();
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);
    const [escrowTokenAccount] = await this.getEscrowGgorPDA(raffleId);

    // Get raffle data to find winner and creator
    const raffleData = await this.program.account.raffle.fetch(rafflePDA);
    const winner = raffleData.winner as PublicKey;
    const creator = raffleData.creator as PublicKey;

    if (!winner) {
      throw new Error('No winner set on raffle - draw winner first');
    }

    // Get platform authority from raffle state
    const raffleStateData = await this.program.account.raffleState.fetch(raffleStatePDA);
    const platformAuthority = raffleStateData.authority as PublicKey;

    // Derive ATAs
    const winnerNftAccount = await getAssociatedTokenAddress(nftMint, winner);
    const creatorTokenAccount = await getAssociatedTokenAddress(GGOR_MINT, creator);
    const platformTokenAccount = await getAssociatedTokenAddress(GGOR_MINT, platformAuthority);

    // Build transaction — create any missing ATAs before the claim instruction
    const transaction = new Transaction();

    // Check and create winner's NFT ATA if missing
    try {
      await getAccount(this.connection, winnerNftAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, winnerNftAccount, winner, nftMint)
      );
    }

    // Check and create creator's GGOR ATA if missing
    try {
      await getAccount(this.connection, creatorTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, creatorTokenAccount, creator, GGOR_MINT)
      );
    }

    // Check and create platform's GGOR ATA if missing
    try {
      await getAccount(this.connection, platformTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, platformTokenAccount, platformAuthority, GGOR_MINT)
      );
    }

    // Add the claim prize instruction
    const claimIx = await this.program.methods
      .claimPrize(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        raffleState: raffleStatePDA,
        winner,
        escrowNftAccount,
        winnerNftAccount,
        escrowTokenAccount,
        creatorTokenAccount,
        platformTokenAccount,
        escrowAuthority,
        nftMint,
        ggorMint: GGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        authority: payer,
      } as any)
      .instruction();

    transaction.add(claimIx);

    // Send transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Cancel a raffle (creator only, no tickets sold)
  async cancelRaffle(raffleId: string | number, nftMint: PublicKey): Promise<string> {
    const payer = this.provider.wallet.publicKey;
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);

    // Get creator's NFT token account
    const creatorNftAccount = await getAssociatedTokenAddress(nftMint, payer);

    const transaction = new Transaction();

    // Ensure creator's NFT ATA exists (may have been closed)
    try {
      await getAccount(this.connection, creatorNftAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, creatorNftAccount, payer, nftMint)
      );
    }

    const cancelIx = await this.program.methods
      .cancelRaffle(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        authority: payer,
        escrowNftAccount,
        creatorNftAccount,
        escrowAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .instruction();

    transaction.add(cancelIx);

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Return unsold NFT to creator (automatic for expired raffles with no sales)
  async returnUnsoldNFT(raffleId: string | number, nftMint: PublicKey, creatorAddress: PublicKey): Promise<string> {
    const payer = this.provider.wallet.publicKey;
    const [rafflePDA] = await this.getRafflePDA(raffleId);
    const [escrowAuthority] = await this.getEscrowAuthorityPDA(raffleId);
    const [escrowNftAccount] = await this.getEscrowNftPDA(raffleId);

    // Get creator's NFT token account
    const creatorNftAccount = await getAssociatedTokenAddress(nftMint, creatorAddress);

    const transaction = new Transaction();

    // Ensure creator's NFT ATA exists (may have been closed)
    try {
      await getAccount(this.connection, creatorNftAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, creatorNftAccount, creatorAddress, nftMint)
      );
    }

    const cancelIx = await this.program.methods
      .cancelRaffle(new BN(raffleId))
      .accounts({
        raffle: rafflePDA,
        authority: payer,
        escrowNftAccount,
        creatorNftAccount,
        escrowAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .instruction();

    transaction.add(cancelIx);

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer;

    const signed = await this.provider.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction({ signature: tx, blockhash, lastValidBlockHeight }, 'confirmed');

    return tx;
  }

  // Check if a raffle has expired with no sales and should be auto-returned
  isExpiredNoSales(raffle: Raffle): boolean {
    const now = Date.now();
    return raffle.endTime <= now && raffle.ticketsSold === 0;
  }

  // Fetch all raffles
  async fetchAllRaffles(): Promise<Raffle[]> {
    const raffles = await this.program.account.raffle.all();

    return raffles.map((r: any) => ({
      raffleId: r.account.raffleId.toString(),
      creator: r.account.creator.toString(),
      nftMint: r.account.nftMint.toString(),
      ticketPrice: fromGGOR(r.account.ticketPrice),
      totalTickets: r.account.totalTickets.toNumber(),
      ticketsSold: r.account.ticketsSold.toNumber(),
      endTime: r.account.endTime.toNumber() * 1000, // Convert to ms
      status: Object.keys(r.account.status)[0] as any,
      winner: r.account.winner?.toString(),
      randomness: r.account.randomness?.toString(),
      publicKey: r.publicKey.toString(),
      platformFeeBps: r.account.platformFeeBps || 500, // Default to 5% if not set
    }));
  }

  // Fetch specific raffle
  async fetchRaffle(raffleId: string | number): Promise<Raffle | null> {
    try {
      const [rafflePDA] = await this.getRafflePDA(raffleId);
      const r = await this.program.account.raffle.fetch(rafflePDA);

      return {
        raffleId: (r as any).raffleId.toString(),
        creator: (r as any).creator.toString(),
        nftMint: (r as any).nftMint.toString(),
        ticketPrice: fromGGOR((r as any).ticketPrice),
        totalTickets: (r as any).totalTickets.toNumber(),
        ticketsSold: (r as any).ticketsSold.toNumber(),
        endTime: (r as any).endTime.toNumber() * 1000,
        status: Object.keys((r as any).status)[0] as any,
        winner: (r as any).winner?.toString(),
        randomness: (r as any).randomness?.toString(),
        publicKey: rafflePDA.toString(),
        platformFeeBps: (r as any).platformFeeBps || 500,
      };
    } catch (e) {
      return null;
    }
  }

  // Fetch user's tickets for a raffle
  async fetchUserTickets(raffleId: string | number, buyer: PublicKey): Promise<TicketAccount | null> {
    try {
      const [ticketAccountPDA] = await this.getTicketAccountPDA(raffleId, buyer);
      const t = await this.program.account.ticketAccount.fetch(ticketAccountPDA);

      return {
        raffleId: (t as any).raffleId.toString(),
        buyer: (t as any).buyer.toString(),
        ticketCount: (t as any).ticketCount.toNumber(),
        ticketNumbers: (t as any).ticketNumbers.map((n: any) => n.toString()),
      };
    } catch (e) {
      return null;
    }
  }
}
