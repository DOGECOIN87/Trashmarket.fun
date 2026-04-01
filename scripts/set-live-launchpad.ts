/**
 * Toggle minting live/paused for the JUST ALIENS collection.
 *
 * Usage:
 *   npx ts-node scripts/set-live-launchpad.ts true   # go live
 *   npx ts-node scripts/set-live-launchpad.ts false  # pause
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROGRAM_ID = new PublicKey('9CzjUboaFZtUhtkqVN2wgWEunDasdorwo6CJfYrJWngj');
const RPC = 'https://rpc.trashscan.io';

async function main() {
  const arg = process.argv[2];
  if (arg !== 'true' && arg !== 'false') {
    console.error('Usage: npx ts-node scripts/set-live-launchpad.ts <true|false>');
    process.exit(1);
  }
  const isLive = arg === 'true';

  const keypairPath =
    process.env.SOLANA_KEYPAIR ||
    path.join(process.env.HOME!, '.config', 'solana', 'id.json');

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

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

  const tx = await (program.methods as any)
    .setLive(isLive)
    .accounts({
      authority: authority.publicKey,
      config: configPda,
    })
    .rpc();

  console.log(`✅ Minting is now ${isLive ? 'LIVE' : 'PAUSED'}`);
  console.log('Signature:', tx);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
