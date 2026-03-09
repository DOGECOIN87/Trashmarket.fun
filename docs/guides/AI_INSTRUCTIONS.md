# AI Development & Deployment Instructions for Trashmarket.fun

This document provides essential context and instructions for AI agents working on the Trashmarket.fun codebase.

## Project Overview
Trashmarket.fun is a decentralized application (dApp) built with React, Vite, and Tailwind CSS, integrating with Solana and Gorbagana blockchains. It features a bridge, a DEX, and various community-driven components.

## Deployment Architecture
- **Frontend**: Hosted on GitHub Pages (`gh-pages` branch).
- **Domain**: `trashmarket.fun` (configured via `CNAME`).
- **Backend**: Cloudflare Workers (located in `/backend`).
- **Database**: Firestore (for submissions) and Cloudflare D1 (for backend services).

## Critical Instructions for AI Agents

### 1. Deployment Fixes & Maintenance
- **GitHub Pages Compatibility**: Always ensure a `.nojekyll` file exists in the root of the deployment branch to prevent GitHub from ignoring files starting with underscores (common in Vite builds).
- **Base Path**: The `vite.config.ts` is configured with `base: './'`. Do not change this unless moving away from GitHub Pages.
- **Routing**: The app uses `HashRouter` to ensure compatibility with static hosting. Do not switch to `BrowserRouter` without implementing a proper 404 redirect strategy for GitHub Pages.

### 2. Environment Variables
- Frontend environment variables must be prefixed with `VITE_`.
- Sensitive secrets (like `ADMIN_WALLETS` or `JWT_SECRET`) must be managed via Cloudflare Wrangler secrets, never committed to the repository.

### 3. Code Style & Standards
- Follow the **Gorbagana Brand Guidelines** (refer to `gorbagana-brand` skill if available).
- Use **Tailwind CSS** for all styling.
- Maintain the "Brutalist/Industrial" aesthetic: high contrast, monospace fonts (`JetBrains Mono`), and neon accents (`#adff02`).

### 4. Common Troubleshooting
- **UI Won't Load**: 
    - Check if `index.html` in the `gh-pages` branch correctly points to the generated assets.
    - Verify that the `.nojekyll` file is present.
    - Ensure no breaking changes were introduced in `App.tsx` or `index.tsx`.
- **Bridge Issues**: Refer to `DEPLOYMENT_GUIDE.md` for Solana program deployment steps.

## Workflow
1. **Develop**: Make changes in the `main` branch.
2. **Build**: Run `npm run build` to generate the `dist` folder.
3. **Deploy**: Use `npm run deploy` (which uses `gh-pages`) to push the `dist` folder to the `gh-pages` branch.

---
*Last Updated: Feb 19, 2026*
