/**
 * Initialize the JUST ALIENS Launchpad program on Gorbagana.
 *
 * Run ONCE after deployment:
 *   npx ts-node scripts/initialize-launchpad.ts
 *
 * Make sure:
 *  1. SOLANA_KEYPAIR env var points to the admin keypair (or uses default ~/.config/solana/id.json)
 *  2. BASE_URI env var is set to the IPFS/Arweave base URI for the 10K metadata files
 *     e.g. export BASE_URI="https://arweave.net/YOUR_BASE_TX_ID"
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROGRAM_ID = new PublicKey('9CzjUboaFZtUhtkqVN2wgWEunDasdorwo6CJfYrJWngj');
const TREASURY = new PublicKey('Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo');
const RPC = 'https://rpc.trashscan.io';

async function main() {
  const keypairPath =
    process.env.SOLANA_KEYPAIR ||
    path.join(process.env.HOME!, '.config', 'solana', 'id.json');

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const baseUri = process.env.BASE_URI;
  if (!baseUri) {
    console.error('ERROR: BASE_URI env var is required.');
    console.error(
      'Example: export BASE_URI="https://arweave.net/YOUR_TX_ID"',
    );
    process.exit(1);
  }

  if (baseUri.length > 200) {
    console.error('ERROR: BASE_URI is too long (max 200 chars).');
    process.exit(1);
  }

  // Go-live timestamp: 0 = live immediately once setLive(true) is called
  // To schedule a future date: Math.floor(new Date('2026-04-15T00:00:00Z').getTime() / 1000)
  const goLiveTimestamp = 0;

  const connection = new Connection(RPC, 'confirmed');
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  const idl = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../src/idl/nft_launchpad.json'),
      'utf-8',
    ),
  );
  const program = new Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID,
  );

  // Check if already initialized
  try {
    const existing = await (program.account as any).launchpadConfig.fetch(configPda);
    console.log('Config PDA already initialized:');
    console.log('  authority:', existing.authority.toBase58());
    console.log('  treasury:', existing.treasury.toBase58());
    console.log('  baseUri:', existing.baseUri);
    console.log('  isLive:', existing.isLive);
    console.log('  itemsMinted:', existing.itemsMinted.toNumber());
    console.log('  maxSupply:', existing.maxSupply.toNumber());
    console.log('  mintPrice:', existing.mintPrice.toNumber() / 1e9, 'GOR');
    console.log('\nAlready initialized. If you need to update baseUri, run:');
    console.log('  BASE_URI=<uri> npx ts-node scripts/update-launchpad-uri.ts');
    return;
  } catch {
    // Not initialized yet — proceed
  }

  console.log('Initializing launchpad...');
  console.log('  Authority:', authority.publicKey.toBase58());
  console.log('  Treasury:', TREASURY.toBase58());
  console.log('  Base URI:', baseUri);
  console.log('  Config PDA:', configPda.toBase58());

  const tx = await (program.methods as any)
    .initialize(baseUri, TREASURY, new BN(goLiveTimestamp))
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      systemProgram: '11111111111111111111111111111111',
    })
    .rpc();

  console.log('\n✅ Initialized! Signature:', tx);
  console.log('Config PDA:', configPda.toBase58());
  console.log('\nNext steps:');
  console.log(
    '  1. Set live:   npx ts-node scripts/set-live-launchpad.ts true',
  );
  console.log(
    '  2. Update launchpadService.ts: set isLive: false (on-chain controls it now)',
  );
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
