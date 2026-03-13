# Trashmarket.fun Deployment Handover

## Objective
Complete the on-chain Anchor program deployment and post-deploy verification for the Trashmarket.fun project.

## Context
The backend Cloudflare Worker (`trashmarket-api`) has already been updated and uploaded to the user's Cloudflare account. The next step is to build and deploy the updated Anchor program to the **Gorbagana** network.

## Repository Details
- **Repo**: `DOGECOIN87/Trashmarket.fun`
- **Program Path**: `/home/ubuntu/Trashmarket.fun/programs/junkpusher/`
- **Program ID**: `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe`
- **Network**: Gorbagana (Solana fork)
- **RPC URL**: `https://rpc.trashscan.io`

## Instructions for the Next Assistant
1.  **Environment Setup**:
    - Install Rust, Solana CLI (v1.18.12), and Anchor CLI (v0.29.0).
    - Ensure `build-essential` is installed for the Rust compiler.
2.  **Build and Deploy**:
    - Navigate to the root of the repository.
    - Run `anchor build`.
    - Deploy the program using: `anchor deploy --provider.cluster https://rpc.trashscan.io`.
    - **Note**: This is a program upgrade. Ensure the upgrade authority keypair is correctly configured in `Anchor.toml`.
3.  **Post-Deploy Verification**:
    - Verify the backend health: `curl https://trashmarket.fun/api/health`.
    - Test authentication rejection for `/api/game/update-balance` and `/api/game/sign` as specified in the original requirements.
    - Verify the on-chain program: `anchor verify 5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe --provider.cluster https://rpc.trashscan.io`.

## Important Constraints
- Do **NOT** modify any source code; it is already updated and type-checked.
- Do **NOT** change the Program ID.
- Do **NOT** delete or close any existing on-chain accounts.
