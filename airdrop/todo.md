# DEBRIS Airdrop Registration - TODO

## Core Features
- [x] Database schema for registrations (user_id, twitter_id, gorbagana_wallet, created_at)
- [x] X.com OAuth authentication integration (via Manus OAuth)
- [x] Gorbagana wallet address validation and submission form
- [x] Duplicate prevention (one wallet per X.com account via unique constraint)
- [x] Registration success/confirmation page
- [x] Admin dashboard to view and export registered users

## UI & Branding
- [x] Upload and integrate custom assets (logo.svg, enhanced_logo_v6.svg, hero image)
- [x] Animated SVG background element
- [x] Brutalist terminal aesthetic (JetBrains Mono, neon green #adff02, black #000000)
- [x] Responsive layout with solid black background
- [x] Hero section with provided artwork
- [x] Header with Trashmarket branding

## Backend & API
- [x] Create registration tRPC procedure
- [x] Create wallet validation procedure
- [x] Create admin export procedure (CSV, JSON, wallet list copy)
- [x] Implement duplicate prevention logic

## Testing
- [x] Unit tests for wallet validation (5 tests passing)
- [ ] Integration tests for registration flow

## Deployment Ready
- [x] All assets uploaded to S3/CDN
- [x] Environment variables configured
- [ ] Production build tested


## Real-Time Admin Dashboard (NEW)
- [x] Create tRPC procedures for live registration updates
- [x] Add real-time stats display (total count, last 24h, last hour)
- [x] Implement live feed of recent registrations (latest 15)
- [x] Add auto-refresh with configurable polling intervals
- [x] Display registration trends and hourly statistics
- [x] Add unit tests for stats calculations (9 tests passing)


## Wallet-Based Access Control (NEW)
- [x] Add admin wallet address to environment variables (ADMIN_WALLET_ADDRESS)
- [x] Create tRPC procedure to verify wallet access (verifyAdminWallet mutation)
- [x] Add wallet verification to Home component with mutation
- [x] Display access denied page for unauthorized wallets (AdminAccessDenied component)
- [x] Add unit tests for wallet verification logic (6 tests passing)
