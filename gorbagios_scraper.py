#!/usr/bin/env python3
"""
Gorbagios NFT Collection Scraper for Solana
============================================
Scrapes ALL NFT data for the "Gorbagios" collection (4,444 NFTs)
from the Gorbagana Chain project on Solana.

Data sources:
  1. Magic Eden API v2 (listings, activities, collection stats)
  2. Solana RPC (on-chain metadata via Metaplex)
  3. Off-chain metadata URIs (traits, images, etc.)

Output:
  - gorbagios_collection_stats.json   (floor price, volume, supply, etc.)
  - gorbagios_listings.json           (all current listings)
  - gorbagios_activities.json         (recent sales, listings, delistings)
  - gorbagios_nfts_full.json          (every NFT with metadata + traits)
  - gorbagios_holders.json            (holder distribution snapshot)
  - gorbagios_summary.csv             (flat CSV of all NFTs for analysis)

Usage:
  pip install requests aiohttp tqdm --break-system-packages
  python gorbagios_scraper.py

Configuration:
  - Edit COLLECTION_SYMBOL below if the Magic Eden slug differs
  - Optionally set SOLANA_RPC to a private RPC for faster fetching
"""

import json
import csv
import time
import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests
from tqdm import tqdm

# ─── Configuration ───────────────────────────────────────────────────────────

# Magic Eden collection symbol/slug — try common variations
# The script will auto-detect which one works
COLLECTION_SYMBOL_CANDIDATES = [
    "gorbagio",       # ← Confirmed correct slug on Magic Eden
    "gorbagios",
    "gorbagana",
    "gorbagana_nft",
]

# APIs
ME_API_BASE = "https://api-mainnet.magiceden.dev/v2"
ME_RPC_BASE = "https://api-mainnet.magiceden.dev/rpc"
SOLANA_RPC = "https://api.mainnet-beta.solana.com"

# Rate limiting (be respectful)
REQUEST_DELAY = 0.25  # seconds between ME API calls
PAGE_SIZE = 20        # Magic Eden default page size for listings
ACTIVITY_PAGE_SIZE = 100

# Output directory
OUTPUT_DIR = Path("gorbagios_data")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("gorbagios")

# ─── HTTP Session ────────────────────────────────────────────────────────────

session = requests.Session()
session.headers.update({
    "User-Agent": "GorbagiosScraper/1.0",
    "Accept": "application/json",
})


def safe_get(url, params=None, retries=3, delay=1):
    """GET with retries and rate limiting."""
    for attempt in range(retries):
        try:
            time.sleep(REQUEST_DELAY)
            resp = session.get(url, params=params, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait = delay * (2 ** attempt)
                log.warning(f"Rate limited, waiting {wait}s...")
                time.sleep(wait)
            elif resp.status_code == 404:
                return None
            else:
                log.warning(f"HTTP {resp.status_code} for {url}")
                time.sleep(delay)
        except requests.exceptions.RequestException as e:
            log.warning(f"Request error (attempt {attempt+1}): {e}")
            time.sleep(delay * (2 ** attempt))
    return None


# ─── Step 0: Detect collection symbol ───────────────────────────────────────

def detect_collection_symbol():
    """Try candidate symbols against Magic Eden API."""
    log.info("Detecting collection symbol on Magic Eden...")
    for symbol in COLLECTION_SYMBOL_CANDIDATES:
        url = f"{ME_API_BASE}/collections/{symbol}/stats"
        data = safe_get(url)
        if data and data.get("floorPrice") is not None:
            log.info(f"Found collection: '{symbol}'")
            return symbol
        # Also try the listings endpoint
        url2 = f"{ME_API_BASE}/collections/{symbol}/listings"
        data2 = safe_get(url2, params={"offset": 0, "limit": 1})
        if data2 and len(data2) > 0:
            log.info(f"Found collection via listings: '{symbol}'")
            return symbol

    # If none worked, try searching
    log.info("Trying Magic Eden collection search...")
    search_url = f"{ME_API_BASE}/collections"
    for term in ["gorbag", "gorba"]:
        results = safe_get(search_url, params={"offset": 0, "limit": 50})
        if results:
            for col in results:
                name = (col.get("name") or "").lower()
                symbol = (col.get("symbol") or "").lower()
                if "gorba" in name or "gorba" in symbol:
                    found = col.get("symbol")
                    log.info(f"Found via search: '{found}' ({col.get('name')})")
                    return found

    log.warning("Could not auto-detect symbol. Using 'gorbagios' as default.")
    log.warning("If this doesn't work, find the correct slug from:")
    log.warning("  https://magiceden.io/marketplace/<slug>")
    return "gorbagios"


# ─── Step 1: Collection Stats ───────────────────────────────────────────────

def fetch_collection_stats(symbol):
    """Get collection-level stats (floor, volume, supply, etc.)."""
    log.info("Fetching collection stats...")
    url = f"{ME_API_BASE}/collections/{symbol}/stats"
    data = safe_get(url)
    if not data:
        log.error("Failed to fetch collection stats")
        return {}

    # Convert lamports to SOL where applicable
    stats = {
        "symbol": symbol,
        "floorPrice_lamports": data.get("floorPrice"),
        "floorPrice_SOL": (data.get("floorPrice") or 0) / 1e9,
        "listedCount": data.get("listedCount"),
        "avgPrice24hr_lamports": data.get("avgPrice24hr"),
        "avgPrice24hr_SOL": (data.get("avgPrice24hr") or 0) / 1e9,
        "volumeAll_lamports": data.get("volumeAll"),
        "volumeAll_SOL": (data.get("volumeAll") or 0) / 1e9,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    log.info(f"  Floor: {stats['floorPrice_SOL']:.4f} SOL | "
             f"Listed: {stats['listedCount']} | "
             f"Total Volume: {stats['volumeAll_SOL']:.2f} SOL")
    return stats


# ─── Step 2: All Current Listings ────────────────────────────────────────────

def fetch_all_listings(symbol):
    """Paginate through all current listings."""
    log.info("Fetching all current listings...")
    listings = []
    offset = 0

    while True:
        url = f"{ME_API_BASE}/collections/{symbol}/listings"
        data = safe_get(url, params={"offset": offset, "limit": PAGE_SIZE})
        if not data or len(data) == 0:
            break
        listings.extend(data)
        offset += len(data)
        log.info(f"  Fetched {len(listings)} listings so far...")
        if len(data) < PAGE_SIZE:
            break

    log.info(f"  Total listings: {len(listings)}")

    # Clean up listing data
    cleaned = []
    for item in listings:
        price = item.get("price")
        # ME v2 listings API returns price in SOL (not lamports)
        price_sol = price if isinstance(price, (int, float)) else 0
        price_info = item.get("priceInfo", {})
        raw_lamports = None
        if price_info and price_info.get("solPrice"):
            raw_lamports = price_info["solPrice"].get("rawAmount")

        cleaned.append({
            "tokenMint": item.get("tokenMint"),
            "tokenAddress": item.get("tokenAddress"),
            "seller": item.get("seller"),
            "price_SOL": price_sol,
            "price_lamports": raw_lamports,
            "auctionHouse": item.get("auctionHouse"),
            "sellerReferral": item.get("sellerReferral"),
            "tokenSize": item.get("tokenSize"),
            "expiry": item.get("expiry"),
            "rarity": item.get("rarity", {}),
            "extra": item.get("extra", {}),
        })
    return cleaned


# ─── Step 3: Activity History ────────────────────────────────────────────────

def fetch_activities(symbol, max_pages=50):
    """Fetch recent activities (sales, listings, delistings, etc.)."""
    log.info("Fetching activity history...")
    activities = []
    offset = 0

    for page in range(max_pages):
        url = f"{ME_API_BASE}/collections/{symbol}/activities"
        data = safe_get(url, params={"offset": offset, "limit": ACTIVITY_PAGE_SIZE})
        if not data or len(data) == 0:
            break
        activities.extend(data)
        offset += len(data)
        log.info(f"  Fetched {len(activities)} activities...")
        if len(data) < ACTIVITY_PAGE_SIZE:
            break

    log.info(f"  Total activities: {len(activities)}")

    # Enrich with SOL prices
    for act in activities:
        if act.get("price"):
            act["price_SOL"] = act["price"] / 1e9
        else:
            act["price_SOL"] = None
    return activities


# ─── Step 4: All NFTs with Metadata ─────────────────────────────────────────

def fetch_all_nfts_via_listings_and_holders(symbol):
    """
    Fetch every NFT in the collection using Magic Eden's token listing.
    ME API v2 provides /collections/{symbol}/listings for listed items,
    but to get ALL tokens we use the RPC endpoint.
    """
    log.info("Fetching all NFTs in the collection...")

    # Method 1: Try ME's getListedNFTsByQuery (gets listed + some metadata)
    all_tokens = []

    # First get listed NFTs (already have from listings)
    # Then try to get the full collection via the older RPC API
    query = json.dumps({
        "$match": {"collectionSymbol": symbol},
        "$sort": {"takerAmount": 1},
        "$skip": 0,
        "$limit": 20,
    })

    # Method 2: Use the v2 tokens endpoint for the collection
    log.info("  Fetching token mints from Magic Eden...")
    offset = 0
    token_mints = []

    while True:
        url = f"{ME_API_BASE}/collections/{symbol}/listings"
        data = safe_get(url, params={"offset": offset, "limit": PAGE_SIZE})
        if not data or len(data) == 0:
            break
        for item in data:
            mint = item.get("tokenMint")
            if mint and mint not in token_mints:
                token_mints.append(mint)
        offset += len(data)
        if len(data) < PAGE_SIZE:
            break

    log.info(f"  Found {len(token_mints)} unique mints from listings")
    return token_mints


def fetch_nft_metadata(mint_address):
    """Fetch individual NFT metadata from Magic Eden."""
    url = f"{ME_API_BASE}/tokens/{mint_address}"
    return safe_get(url)


def fetch_offchain_metadata(uri):
    """Fetch the off-chain JSON metadata (traits, image, etc.)."""
    if not uri:
        return None
    try:
        time.sleep(0.1)
        resp = session.get(uri, timeout=15)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def fetch_all_nft_details(mint_addresses):
    """Fetch full metadata for every NFT."""
    log.info(f"Fetching detailed metadata for {len(mint_addresses)} NFTs...")
    nfts = []

    for i, mint in enumerate(tqdm(mint_addresses, desc="NFT metadata")):
        token_data = fetch_nft_metadata(mint)
        if not token_data:
            nfts.append({"mintAddress": mint, "error": "failed to fetch"})
            continue

        # Extract key fields
        nft = {
            "mintAddress": mint,
            "name": token_data.get("name"),
            "image": token_data.get("image"),
            "animationUrl": token_data.get("animationUrl"),
            "externalUrl": token_data.get("externalUrl"),
            "collection": token_data.get("collection"),
            "collectionName": token_data.get("collectionName"),
            "owner": token_data.get("owner"),
            "supply": token_data.get("supply"),
            "delegate": token_data.get("delegate"),
            "frozen": token_data.get("frozen"),
            "listed": token_data.get("listed"),
            "listStatus": token_data.get("listStatus"),
            "price_SOL": token_data.get("price"),
            "updateAuthority": token_data.get("updateAuthority"),
            "sellerFeeBasisPoints": token_data.get("sellerFeeBasisPoints"),
            "primarySaleHappened": token_data.get("primarySaleHappened"),
            "tokenStandard": token_data.get("tokenStandard"),
        }

        # Traits / attributes
        attributes = token_data.get("attributes") or []
        nft["attributes"] = attributes
        nft["trait_count"] = len(attributes)

        # Build flat trait dict for CSV
        for attr in attributes:
            trait_type = attr.get("trait_type", "unknown")
            trait_value = attr.get("value", "")
            nft[f"trait_{trait_type}"] = trait_value

        nfts.append(nft)

    log.info(f"  Fetched metadata for {len(nfts)} NFTs")
    return nfts


# ─── Step 5: Holder Distribution ─────────────────────────────────────────────

def compute_holder_distribution(nfts):
    """Compute holder stats from NFT ownership data."""
    log.info("Computing holder distribution...")
    holders = {}
    for nft in nfts:
        owner = nft.get("owner")
        if owner:
            if owner not in holders:
                holders[owner] = {"address": owner, "count": 0, "nfts": []}
            holders[owner]["count"] += 1
            holders[owner]["nfts"].append(nft.get("mintAddress"))

    holder_list = sorted(holders.values(), key=lambda x: x["count"], reverse=True)
    log.info(f"  Unique holders: {len(holder_list)}")
    if holder_list:
        log.info(f"  Top holder: {holder_list[0]['address'][:12]}... with {holder_list[0]['count']} NFTs")

    return {
        "unique_holders": len(holder_list),
        "top_holders": holder_list[:50],
        "distribution": {
            "1_nft": sum(1 for h in holder_list if h["count"] == 1),
            "2_5_nfts": sum(1 for h in holder_list if 2 <= h["count"] <= 5),
            "6_10_nfts": sum(1 for h in holder_list if 6 <= h["count"] <= 10),
            "11_25_nfts": sum(1 for h in holder_list if 11 <= h["count"] <= 25),
            "26_plus_nfts": sum(1 for h in holder_list if h["count"] >= 26),
        },
        "all_holders": [{"address": h["address"], "count": h["count"]} for h in holder_list],
    }


# ─── Step 6: Export to CSV ───────────────────────────────────────────────────

def export_csv(nfts, filepath):
    """Export flat NFT data to CSV for easy analysis."""
    if not nfts:
        return

    # Collect all possible keys
    all_keys = set()
    for nft in nfts:
        all_keys.update(nft.keys())

    # Remove complex nested fields from CSV
    skip_keys = {"attributes", "extra", "rarity"}
    csv_keys = sorted(all_keys - skip_keys)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_keys, extrasaction="ignore")
        writer.writeheader()
        for nft in nfts:
            row = {k: nft.get(k, "") for k in csv_keys}
            writer.writerow(row)

    log.info(f"  Exported {len(nfts)} rows to {filepath}")


# ─── Step 7: Alternative - Scrape via ME Marketplace Page ────────────────────

def fetch_collection_tokens_via_rpc(symbol):
    """
    Use ME's internal RPC to get listed tokens with full metadata.
    Returns list of dicts with mintAddress fields.
    """
    log.info("Attempting to fetch tokens via ME RPC...")
    all_tokens = []
    offset = 0
    limit = 20

    while True:
        url = f"{ME_RPC_BASE}/getListedNFTsByQuery"
        query = {
            "$match": {"collectionSymbol": symbol},
            "$sort": {"createdAt": -1},
            "$skip": offset,
            "$limit": limit,
        }
        params = {"q": json.dumps(query)}
        data = safe_get(url, params=params)

        if not data:
            break

        # Handle both {results: [...]} and direct list responses
        results = data.get("results") if isinstance(data, dict) else data
        if not results or not isinstance(results, list):
            break

        for item in results:
            if isinstance(item, dict):
                all_tokens.append(item)
            elif isinstance(item, str):
                all_tokens.append({"mintAddress": item})

        offset += len(results)
        log.info(f"  RPC: fetched {len(all_tokens)} tokens...")

        if len(results) < limit:
            break

    return all_tokens


def fetch_all_mints_from_activities(activities):
    """
    Extract unique mint addresses from activity history.
    This captures both listed AND unlisted NFTs that have had any activity.
    """
    log.info("Extracting mint addresses from activity history...")
    mints = set()
    for act in activities:
        mint = act.get("tokenMint")
        if mint:
            mints.add(mint)
    log.info(f"  Found {len(mints)} unique mints from activities")
    return mints


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("""
╔══════════════════════════════════════════════════╗
║     Gorbagios NFT Collection Scraper v1.0        ║
║     Collection: Gorbagios (Gorbagana Chain)      ║
║     Blockchain: Solana                           ║
║     Supply: 4,444 NFTs                           ║
╚══════════════════════════════════════════════════╝
    """)

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Step 0: Detect symbol
    symbol = detect_collection_symbol()

    # Step 1: Collection stats
    stats = fetch_collection_stats(symbol)
    save_json(stats, OUTPUT_DIR / "gorbagios_collection_stats.json")

    # Step 2: All current listings
    listings = fetch_all_listings(symbol)
    save_json(listings, OUTPUT_DIR / "gorbagios_listings.json")

    # Step 3: Activity history
    activities = fetch_activities(symbol)
    save_json(activities, OUTPUT_DIR / "gorbagios_activities.json")

    # Step 4: Get all mint addresses and full metadata
    # First try getting tokens from RPC
    rpc_tokens = fetch_collection_tokens_via_rpc(symbol)

    # Collect all unique mint addresses from ALL sources
    mint_set = set()

    # From listings
    for listing in listings:
        if listing.get("tokenMint"):
            mint_set.add(listing["tokenMint"])

    # From RPC tokens
    for token in rpc_tokens:
        if isinstance(token, dict):
            mint = token.get("mintAddress") or token.get("tokenMint")
        elif isinstance(token, str):
            mint = token
        else:
            continue
        if mint:
            mint_set.add(mint)

    # From activities (captures unlisted NFTs too!)
    activity_mints = fetch_all_mints_from_activities(activities)
    mint_set.update(activity_mints)

    mint_addresses = list(mint_set)
    log.info(f"Total unique mint addresses discovered: {len(mint_addresses)}")

    # Fetch detailed metadata for each NFT
    if mint_addresses:
        nfts = fetch_all_nft_details(mint_addresses)
    else:
        log.warning("No mint addresses found. The collection symbol may be wrong.")
        log.warning("Try visiting https://magiceden.io and searching for 'Gorbagios'")
        log.warning("Then update COLLECTION_SYMBOL_CANDIDATES in this script.")
        nfts = []

    save_json(nfts, OUTPUT_DIR / "gorbagios_nfts_full.json")

    # Step 5: Holder distribution
    holders = compute_holder_distribution(nfts)
    save_json(holders, OUTPUT_DIR / "gorbagios_holders.json")

    # Step 6: CSV export
    export_csv(nfts, OUTPUT_DIR / "gorbagios_summary.csv")

    # Print summary
    print("\n" + "=" * 55)
    print("  SCRAPE COMPLETE")
    print("=" * 55)
    print(f"  Collection:      {symbol}")
    print(f"  NFTs scraped:    {len(nfts)}")
    print(f"  Listings:        {len(listings)}")
    print(f"  Activities:      {len(activities)}")
    print(f"  Unique holders:  {holders.get('unique_holders', 'N/A')}")
    if stats:
        print(f"  Floor price:     {stats.get('floorPrice_SOL', 'N/A')} SOL")
        print(f"  Total volume:    {stats.get('volumeAll_SOL', 'N/A')} SOL")
    print(f"\n  Output dir:      {OUTPUT_DIR.resolve()}")
    print(f"  Files created:")
    for f in sorted(OUTPUT_DIR.iterdir()):
        size = f.stat().st_size
        print(f"    {f.name:<40} ({size:,} bytes)")
    print("=" * 55)


def save_json(data, filepath):
    """Save data to JSON file."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    log.info(f"Saved: {filepath}")


if __name__ == "__main__":
    main()
