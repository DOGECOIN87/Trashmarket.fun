# TrashMarket.fun Gorbagana Mainnet Preparation

## Implementation Tasks

### Phase 1: Complete Gorbagana Conversion
- [x] 1. Create utils/gorbaganaRPC.ts with full RPC client
- [x] 2. Update contexts/NetworkContext.tsx to Gorbagana-only
- [x] 3. Create contexts/WalletContext.tsx with Backpack/Gorbag support
- [x] 4. Update components/Navbar.tsx with wallet modal and remove toggle
- [x] 5. Update App.tsx to include WalletProvider
- [x] 6. Verify Tailwind configuration for new colors
- [ ] 7. Complete final testing and deployment

### Phase 2: Featured Collections Setup
- [x] 8. Ensure Gorbagios remains primary featured collection
- [ ] 9. Add Just Aliens collection with placeholder data
- [ ] 10. Configure both collections for Gorbagana network

### Phase 3: Collection Submission System
- [ ] 11. Install Firebase SDK and setup configuration
- [ ] 12. Update types.ts with CollectionSubmission interface
- [ ] 13. Create submissionService.ts with Firebase operations
- [ ] 14. Build Submit.tsx multi-step form page
- [ ] 15. Create image upload components
- [ ] 16. Build Admin.tsx review dashboard
- [ ] 17. Update App.tsx routing and Navbar
- [ ] 18. Test submission and review workflows

## Configuration Details

### Network Configuration (Gorbagana)
- RPC: `https://rpc.gorbagana.wtf`
- Explorer: `https://trashscan.io`
- Currency: `GOR` (display: `G`)
- Network: `Gorbagana_L2`
- Metric: `GPS` (Gorbagana Per Second)

### Featured Collections
1. **Gorbagios** (Primary - Native chain brand)
2. **Just Aliens** (Secondary - Owner collection)
   - URL: justaliens.space
   - Status: Deployed on Solana, ready for Gorbagana

### Submission System Requirements
- Storage: Firebase (Firestore + Storage)
- Admin Auth: Wallet + Password dual protection
- Email Notifications: Placeholder (implement later)
- Submission Limit: 3 submissions max per wallet
- Approval: Manual review only

## Next Steps
1. Complete Gorbagana testing
2. Add Just Aliens collection data
3. Implement Firebase integration
4. Build submission system
5. Create admin dashboard
6. Test end-to-end functionality
