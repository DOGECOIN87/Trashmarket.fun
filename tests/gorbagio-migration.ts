import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  getAccount,
  ExtensionType,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import { createInitializeInstruction } from "@solana/spl-token-metadata";
import { assert } from "chai";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const MIGRATION_PROGRAM_ID = new PublicKey("3PtknVekKAYAYExL6YQWxf6bycpGWoQQ9tNM566qzKmU");
const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// Must match the on-chain constant
const GORBAGIO_UPDATE_AUTHORITY = new PublicKey("fair1sCzkkPSvF44QGoD89ThvZdK1e4vP1jBKxW3v7M");

// sha256("global:migrate_gorbagio")[0..8]
const MIGRATE_DISCRIMINATOR = Buffer.from([
  0x4e, 0xd2, 0x1e, 0x0c, 0x73, 0x37, 0x74, 0x96,
]);

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function encodeMigrateData(name: string, symbol: string, uri: string): Buffer {
  const nameBytes = Buffer.from(name, "utf8");
  const symbolBytes = Buffer.from(symbol, "utf8");
  const uriBytes = Buffer.from(uri, "utf8");

  const dataLen = 8 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length;
  const buf = Buffer.alloc(dataLen);
  let offset = 0;

  MIGRATE_DISCRIMINATOR.copy(buf, offset);
  offset += 8;

  buf.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(buf, offset);
  offset += nameBytes.length;

  buf.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(buf, offset);
  offset += symbolBytes.length;

  buf.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(buf, offset);

  return buf;
}

function deriveMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METAPLEX_METADATA_PROGRAM_ID,
  );
}

function deriveMasterEditionPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    METAPLEX_METADATA_PROGRAM_ID,
  );
}

/**
 * Create a Token-2022 mint with metadata extension mimicking a legacy Gorbagio.
 */
async function createLegacyGorbagioMint(
  connection: anchor.web3.Connection,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string,
  updateAuthority: PublicKey = GORBAGIO_UPDATE_AUTHORITY,
): Promise<{ mint: Keypair; tokenAccount: PublicKey }> {
  const mint = Keypair.generate();

  const nameBytes = Buffer.from(name, "utf8");
  const symbolBytes = Buffer.from(symbol, "utf8");
  const uriBytes = Buffer.from(uri, "utf8");

  // Only allocate space for the mint + MetadataPointer extension initially.
  // The TokenMetadata extension is variable-length and gets added by
  // the initialize metadata instruction (it reallocs internally).
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);

  // But we must pre-fund with enough lamports for the FULL size including metadata,
  // because the realloc won't add lamports.
  // Metadata ext size: TLV header (4) + updateAuth (32) + mint (32) + name (4+len) + symbol (4+len) + uri (4+len) + additionalMeta (4)
  const metadataExtLen = 32 + 32 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length + 4;
  const fullSize = mintLen + TYPE_SIZE + LENGTH_SIZE + metadataExtLen;

  const lamports = await connection.getMinimumBalanceForRentExemption(fullSize);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initMetadataPointerIx = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey, // metadata address = self
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintIx = createInitializeMintInstruction(
    mint.publicKey,
    0, // decimals
    payer.publicKey, // mint authority
    null, // freeze authority
    TOKEN_2022_PROGRAM_ID,
  );

  // First transaction: create account + init pointer + init mint
  const tx1 = new Transaction().add(
    createAccountIx,
    initMetadataPointerIx,
    initMintIx,
  );
  await anchor.web3.sendAndConfirmTransaction(connection, tx1, [payer, mint]);

  // Second transaction: initialize metadata extension (reallocs the account)
  const initMetadataIx = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint.publicKey,
    metadata: mint.publicKey,
    mintAuthority: payer.publicKey,
    name,
    symbol,
    uri,
    updateAuthority,
  });

  const tx2 = new Transaction().add(initMetadataIx);
  await anchor.web3.sendAndConfirmTransaction(connection, tx2, [payer]);

  // Create ATA for Token-2022
  const tokenAccount = await createAssociatedTokenAccount(
    connection,
    payer,
    mint.publicKey,
    payer.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // Mint 1 token
  const mintToIx = createMintToInstruction(
    mint.publicKey,
    tokenAccount,
    payer.publicKey,
    1,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
  const mintTx = new Transaction().add(mintToIx);
  await anchor.web3.sendAndConfirmTransaction(connection, mintTx, [payer]);

  return { mint, tokenAccount };
}

/** Build and send a migration transaction */
async function buildAndSendMigration(
  connection: anchor.web3.Connection,
  user: Keypair,
  legacyMint: PublicKey,
  legacyTokenAccount: PublicKey,
  name: string,
  symbol: string,
  uri: string,
): Promise<{ newMint: Keypair; tx: string }> {
  const newMint = Keypair.generate();

  const userNewTokenAccount = await getAssociatedTokenAddress(
    newMint.publicKey,
    user.publicKey,
  );

  const [metadataAccount] = deriveMetadataPDA(newMint.publicKey);
  const [masterEditionAccount] = deriveMasterEditionPDA(newMint.publicKey);

  const migrateIx = new TransactionInstruction({
    programId: MIGRATION_PROGRAM_ID,
    keys: [
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: legacyMint, isSigner: false, isWritable: true },
      { pubkey: legacyTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: newMint.publicKey, isSigner: true, isWritable: true },
      { pubkey: userNewTokenAccount, isSigner: false, isWritable: true },
      { pubkey: metadataAccount, isSigner: false, isWritable: true },
      { pubkey: masterEditionAccount, isSigner: false, isWritable: true },
      { pubkey: METAPLEX_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: encodeMigrateData(name, symbol, uri),
  });

  const transaction = new Transaction().add(migrateIx);
  const tx = await anchor.web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [user, newMint],
  );

  return { newMint, tx };
}

// ═══════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════
describe("gorbagio_migration", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  let user: Keypair;

  before(async () => {
    user = Keypair.generate();

    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig);
  });

  // ─── Happy Path ──────────────────────────────────────────────────
  describe("Successful Migration", () => {
    let legacyMint: Keypair;
    let legacyTokenAccount: PublicKey;

    it("creates a legacy Gorbagio Token-2022 NFT", async () => {
      const result = await createLegacyGorbagioMint(
        provider.connection,
        user,
        "Gorbagio #42",
        "GRBG",
        "https://example.com/gorbagio/42.json",
      );
      legacyMint = result.mint;
      legacyTokenAccount = result.tokenAccount;

      const account = await getAccount(
        provider.connection,
        legacyTokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      );
      assert.equal(account.amount.toString(), "1", "Legacy token account should hold 1 NFT");
    });

    it("migrates the legacy Gorbagio to Metaplex NFT", async () => {
      const { newMint } = await buildAndSendMigration(
        provider.connection,
        user,
        legacyMint.publicKey,
        legacyTokenAccount,
        "Gorbagio #42",
        "GRBG",
        "https://example.com/gorbagio/42.json",
      );

      // Verify new NFT exists with supply = 1
      const userNewTokenAccount = await getAssociatedTokenAddress(
        newMint.publicKey,
        user.publicKey,
      );
      const newAccount = await getAccount(provider.connection, userNewTokenAccount);
      assert.equal(newAccount.amount.toString(), "1", "New token account should hold 1 NFT");
      assert.equal(
        newAccount.mint.toBase58(),
        newMint.publicKey.toBase58(),
        "Token account mint should match new mint",
      );

      // Verify legacy token account was closed (burned + closed)
      try {
        await getAccount(provider.connection, legacyTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
        assert.fail("Legacy token account should be closed after migration");
      } catch (e: any) {
        assert.isTrue(
          e.message.includes("could not find account") ||
          e.message.includes("Failed to find") ||
          e.name === "TokenAccountNotFoundError",
          `Expected account-not-found, got: ${e.message}`,
        );
      }

      // Verify legacy mint supply is 0
      const legacyMintInfo = await provider.connection.getAccountInfo(legacyMint.publicKey);
      if (legacyMintInfo) {
        const supply = legacyMintInfo.data.readBigUInt64LE(36);
        assert.equal(supply.toString(), "0", "Legacy mint supply should be 0 after burn");
      }

      // Verify Metaplex metadata + master edition exist
      const [metadataAccount] = deriveMetadataPDA(newMint.publicKey);
      const [masterEditionAccount] = deriveMasterEditionPDA(newMint.publicKey);

      const metadataInfo = await provider.connection.getAccountInfo(metadataAccount);
      assert.isNotNull(metadataInfo, "Metadata account should exist");

      const masterEditionInfo = await provider.connection.getAccountInfo(masterEditionAccount);
      assert.isNotNull(masterEditionInfo, "Master Edition account should exist");
    });
  });

  // ─── Error: Wrong Update Authority ────────────────────────────────
  describe("Rejects non-Gorbagio NFT", () => {
    it("rejects a Token-2022 NFT with wrong update authority", async () => {
      const wrongAuthority = Keypair.generate();

      const { mint: fakeMint, tokenAccount: fakeTokenAccount } =
        await createLegacyGorbagioMint(
          provider.connection,
          user,
          "Fake NFT",
          "FAKE",
          "https://example.com/fake.json",
          wrongAuthority.publicKey, // WRONG authority
        );

      try {
        await buildAndSendMigration(
          provider.connection,
          user,
          fakeMint.publicKey,
          fakeTokenAccount,
          "Fake NFT",
          "FAKE",
          "https://example.com/fake.json",
        );
        assert.fail("Should reject non-Gorbagio NFT");
      } catch (e: any) {
        const logs = e?.logs?.join(" ") || e?.message || "";
        assert.isTrue(
          logs.includes("NotAGorbagio") ||
          logs.includes("6003") ||
          logs.includes("not a Gorbagio"),
          `Expected NotAGorbagio error, got: ${logs.slice(0, 200)}`,
        );
      }
    });
  });

  // ─── Error: Wrong Owner ───────────────────────────────────────────
  describe("Rejects wrong owner", () => {
    it("rejects migration if user does not own the legacy token", async () => {
      const otherUser = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        otherUser.publicKey,
        5 * LAMPORTS_PER_SOL,
      );
      await provider.connection.confirmTransaction(sig);

      const { mint: otherMint, tokenAccount: otherTokenAccount } =
        await createLegacyGorbagioMint(
          provider.connection,
          otherUser,
          "Gorbagio #99",
          "GRBG",
          "https://example.com/gorbagio/99.json",
        );

      try {
        await buildAndSendMigration(
          provider.connection,
          user, // wrong user
          otherMint.publicKey,
          otherTokenAccount,
          "Gorbagio #99",
          "GRBG",
          "https://example.com/gorbagio/99.json",
        );
        assert.fail("Should reject migration of NFT not owned by user");
      } catch (e: any) {
        const logs = e?.logs?.join(" ") || e?.message || "";
        assert.isTrue(
          logs.includes("InvalidOwner") ||
          logs.includes("6001") ||
          logs.includes("owner") ||
          logs.includes("Error"),
          `Expected ownership error, got: ${logs.slice(0, 200)}`,
        );
      }
    });
  });
});
