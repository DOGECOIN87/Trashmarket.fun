# Step-by-Step AI Instruction: Gorbagana Bridge Deployment (FINAL)

This document provides a sequential workflow for finalizing and deploying the `trashmarket.fun` bridge. Follow each step in order.

---

### Step 1: Environment & Project Initialization
1.  **Clone Repository**: Ensure you are working within the `DOGECOIN87/Trashmarket.fun` repository.
2.  **Initialize Anchor**: If the project does not have an Anchor workspace, run `anchor init bridge`.
3.  **Install Dependencies**: Ensure `@coral-xyz/anchor`, `@solana/web3.js`, and `spl-token` are installed.
4.  **Configure RPC**: Set the Solana CLI and Anchor configuration to use the Gorbagana RPC: `https://rpc.trashscan.io`.

### Step 2: Generate Vanity Program ID
1.  **Brute-force Keypair**: Use `solana-keygen grind --starts-with BRIDGE:1` to generate a keypair starting with "BRIDGE".
2.  **Configure Project**: Update `lib.rs` and `Anchor.toml` with the new Program ID.

### Step 3: Implement Production Logic (Native & SPL)
1.  **Code Integration**: Use the provided `lib.rs` logic but modify it for native token support.
2.  **Configure sGOR (SPL)**: Set `SGOR_MINT` to `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`. Use `anchor_spl::token` for these transfers.
3.  **Configure gGOR (Native Gas)**: 
    *   **CRITICAL**: gGOR is the native gas token. **No wrapped tokens are allowed.**
    *   Modify the `fill_order` and `create_order` logic to use `system_program::transfer` for gGOR movements instead of the SPL Token program.
4.  **Verify PDAs**: Ensure seeds are deterministic: `[b"order", maker.key().as_ref(), &amount.to_le_bytes()]`.

### Step 4: Comprehensive Testing
1.  **Unit Tests**: Implement tests in `tests/bridge.ts` for `create_order`, `fill_order`, and `cancel_order`.
2.  **Native Token Verification**: Verify that gGOR transfers occur via the System Program and that balances change correctly without any wrapping/unwrapping.
3.  **Security Tests**: Verify failure on expired orders, unauthorized cancellations, and invalid mints.
4.  **Stress Testing**: Run 50+ concurrent transactions to ensure state consistency.

### Step 5: Production Deployment
1.  **Build**: Run `anchor build`.
2.  **Funding**: Request the user to fund the deployment wallet once the Program ID and deployment costs are calculated.
3.  **Deploy**: Deploy to `https://rpc.trashscan.io` using `anchor deploy`.

### Step 6: Final Security Lockdown
1.  **Lock Program**: Run `solana program set-upgrade-authority <PROGRAM_ID> --final`. **This is irreversible.**
2.  **Verification**: Confirm the `BRIDGE...` ID is live, immutable, and correctly handling native gGOR.

### Step 7: Synchronize with GitHub
1.  **Commit & Push**: Push all code, tests, and deployment logs to the `DOGECOIN87/Trashmarket.fun` repository.
