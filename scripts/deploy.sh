#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Gorbagana Bridge — Deployment Script
# Follows: Step-by-Step AI Instruction: Gorbagana Bridge Deployment
# Target: trashmarket.fun / https://rpc.trashscan.io
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

RPC_URL="https://rpc.trashscan.io"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Step 1: Environment Check ────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " GORBAGANA BRIDGE DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

command -v solana   >/dev/null 2>&1 || err "solana CLI not found. Install: https://docs.solana.com/cli/install-solana-cli-tools"
command -v anchor   >/dev/null 2>&1 || err "anchor CLI not found. Install: cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli"

log "Solana CLI: $(solana --version)"
log "Anchor CLI: $(anchor --version)"

# ── Step 1.4: Configure RPC ──────────────────────────────────────────
solana config set --url "$RPC_URL" >/dev/null 2>&1
log "RPC configured: $RPC_URL"

WALLET=$(solana address 2>/dev/null || echo "NOT SET")
log "Deployment wallet: $WALLET"

# ── Step 2: Generate Vanity Program ID ────────────────────────────────
echo ""
echo "── Step 2: Vanity Program ID ─────────────────────────────────"

if [ -f "keypairs/bridge-keypair.json" ]; then
    PROGRAM_ID=$(solana-keygen pubkey keypairs/bridge-keypair.json)
    log "Existing keypair found: $PROGRAM_ID"
else
    warn "No vanity keypair found. Generate one with:"
    echo "    mkdir -p keypairs"
    echo "    solana-keygen grind --starts-with BRIDGE:1"
    echo "    mv BRIDGE*.json keypairs/bridge-keypair.json"
    echo ""
    read -p "Press Enter after generating, or Ctrl+C to abort..."
    PROGRAM_ID=$(solana-keygen pubkey keypairs/bridge-keypair.json)
    log "Program ID: $PROGRAM_ID"
fi

# Update Anchor.toml with real program ID
if grep -q "BRIDGE1111111111111111111111111111111111111" Anchor.toml; then
    sed -i "s/BRIDGE1111111111111111111111111111111111111/$PROGRAM_ID/g" Anchor.toml
    log "Updated Anchor.toml with Program ID: $PROGRAM_ID"
fi

# Update lib.rs declare_id
if grep -q "BRIDGE1111111111111111111111111111111111111" programs/bridge/src/lib.rs; then
    sed -i "s/BRIDGE1111111111111111111111111111111111111/$PROGRAM_ID/g" programs/bridge/src/lib.rs
    log "Updated lib.rs declare_id with Program ID: $PROGRAM_ID"
fi

# ── Step 4: Build ─────────────────────────────────────────────────────
echo ""
echo "── Step 4: Build ─────────────────────────────────────────────"
anchor build
log "Build successful"

# ── Step 5: Calculate deployment cost ─────────────────────────────────
echo ""
echo "── Step 5: Deployment ────────────────────────────────────────"

PROGRAM_SO="target/deploy/gorbagana_bridge.so"
if [ -f "$PROGRAM_SO" ]; then
    SIZE=$(stat -c%s "$PROGRAM_SO" 2>/dev/null || stat -f%z "$PROGRAM_SO")
    # Rough cost: ~2x file size in lamports for rent exemption
    COST_LAMPORTS=$((SIZE * 2 * 7))
    COST_SOL=$(echo "scale=4; $COST_LAMPORTS / 1000000000" | bc)
    log "Program binary: $SIZE bytes"
    warn "Estimated deployment cost: ~$COST_SOL SOL (gGOR)"
else
    err "Build artifact not found at $PROGRAM_SO"
fi

BALANCE=$(solana balance --url "$RPC_URL" 2>/dev/null | awk '{print $1}')
log "Current wallet balance: $BALANCE SOL"

echo ""
warn "Please ensure your wallet has sufficient funds for deployment."
read -p "Press Enter to deploy, or Ctrl+C to abort..."

# Deploy
anchor deploy \
    --provider.cluster "$RPC_URL" \
    --program-keypair keypairs/bridge-keypair.json

log "Deployment successful!"
echo ""

PROGRAM_ID_LIVE=$(solana-keygen pubkey keypairs/bridge-keypair.json)
log "Program ID (live): $PROGRAM_ID_LIVE"

# ── Step 6: Security Lockdown ─────────────────────────────────────────
echo ""
echo "── Step 6: Security Lockdown ─────────────────────────────────"
echo ""
warn "⚠️  IRREVERSIBLE: The next step locks the program permanently."
warn "    No further upgrades will be possible."
echo ""
echo "    Command: solana program set-upgrade-authority $PROGRAM_ID_LIVE --final"
echo ""
read -p "Type 'LOCK' to proceed, or anything else to skip: " CONFIRM

if [ "$CONFIRM" == "LOCK" ]; then
    solana program set-upgrade-authority "$PROGRAM_ID_LIVE" --final --url "$RPC_URL"
    log "Program LOCKED. Immutable deployment confirmed."
else
    warn "Skipped lockdown. You can lock later with:"
    echo "    solana program set-upgrade-authority $PROGRAM_ID_LIVE --final"
fi

# ── Step 7: Verification ─────────────────────────────────────────────
echo ""
echo "── Step 7: Verification ──────────────────────────────────────"
solana program show "$PROGRAM_ID_LIVE" --url "$RPC_URL"

echo ""
echo "═══════════════════════════════════════════════════════════════"
log "DEPLOYMENT COMPLETE"
echo "  Program ID : $PROGRAM_ID_LIVE"
echo "  RPC        : $RPC_URL"
echo "  Explorer   : https://trashscan.io/program/$PROGRAM_ID_LIVE"
echo "═══════════════════════════════════════════════════════════════"
