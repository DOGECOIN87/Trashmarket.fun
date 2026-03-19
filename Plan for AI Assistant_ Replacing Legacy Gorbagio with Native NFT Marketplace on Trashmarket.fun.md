## Plan for AI Assistant: Replacing Legacy Gorbagio with Native NFT Marketplace on Trashmarket.fun

**Objective**: Completely replace the existing Gorbagio feature on Trashmarket.fun, including all links to external platforms (e.g., Tensor), with a new, secure, and native NFT trading marketplace specifically for the **migrated Gorbagio collection** on the Gorbagana Chain. The entire solution must adhere to Trashmarket.fun's architectural patterns and brand guidelines.

**Context**: The Trashmarket.fun dApp utilizes a React 19/Vite frontend, Anchor programs on Gorbagana, and a Cloudflare Worker backend. The new Gorbagio NFT collection is based on the Metaplex Token Metadata standard, as established by the `Gorbagio Migration Program`.

---

### Phase 1: Legacy Feature Removal & Project Setup

**Goal**: Eliminate all traces of the old Gorbagio feature and prepare the project for new marketplace development.

**Instructions for AI Assistant**:

The initial step involves a thorough cleanup of the existing Trashmarket.fun dApp to remove all components related to the legacy Gorbagio feature and external NFT marketplaces. This includes identifying and removing all UI components, pages, routes, and navigation links from the frontend codebase. The AI assistant should perform a comprehensive search for keywords such as `Gorbagio`, `Tensor`, `Magic Eden`, and `OpenSea` to ensure all related code is either removed or refactored. Concurrently, the Cloudflare Worker backend must be reviewed to remove any API endpoints that exclusively served the legacy Gorbagio feature or proxied requests to external marketplaces. If any Solana programs specifically for the *legacy* Gorbagio feature exist (distinct from the migration program), they should be identified for deprecation or removal, noting that the `Gorbagio Migration Program` is a prerequisite and must remain. Finally, a new Anchor program for the marketplace should be initialized within the existing Trashmarket.fun Anchor workspace, typically under `programs/gorbagio_marketplace`, with its initial `lib.rs` and `Cargo.toml` files defined.

### Phase 2: Native NFT Marketplace Smart Contract Development

**Goal**: Implement a secure and efficient Anchor program for listing, buying, and managing Gorbagio NFTs.

**Instructions for AI Assistant**:

Development of the native NFT marketplace smart contract will commence with defining the necessary Anchor account structures. These structures will include a `ListingAccount` to store details such as the seller, NFT mint address, price, and state of an NFT listing. For enhanced security and clarity, the marketplace will utilize a **program-owned escrow** for listed NFTs, meaning the NFT is transferred to a dedicated program-controlled Associated Token Account (ATA) upon listing. This `EscrowAccount` will be derived as a PDA from the `ListingAccount` and the NFT's mint address. Following this, the AI assistant will implement core Anchor instructions, strictly adhering to `solana-secure-contracts` best practices. These instructions include `list_nft`, which allows users to list a Gorbagio NFT for sale. A critical security check for `list_nft` is to **verify that the NFT belongs to the migrated Gorbagio collection**. This verification should be performed by checking the NFT's `collection` field in its Metaplex Metadata against a predefined, immutable `CollectionMint` or `CollectionAuthority` address stored within the marketplace program's state or hardcoded as a constant. The instruction will then transfer the NFT from the seller to the program-controlled `EscrowAccount`. The `buy_nft` instruction will enable users to purchase listed NFTs, facilitating the transfer of SOL from the buyer to the seller (after deducting any marketplace fees) and the NFT from the program's `EscrowAccount` to the buyer, subsequently closing or updating the `ListingAccount`. Additionally, a `cancel_listing` instruction will allow sellers to retrieve their NFTs from the `EscrowAccount` and update the listing status. Throughout this phase, robust security hardening measures, as outlined in `solana-secure-contracts`, must be applied, covering signer checks, ownership validations, secure PDA derivation (using canonical bump seeds and ensuring PDAs are derived securely), re-initialization guards, checked arithmetic for all financial calculations, and rigorous CPI security (validating all CPI contexts and ensuring correct program IDs). Comprehensive `ErrorCode` enums should be implemented to provide clear and descriptive error messages, and finally, the Anchor IDL for the new marketplace program must be generated.

### Phase 3: Backend (Cloudflare Worker) API Development

**Goal**: Create secure and efficient API endpoints in the Cloudflare Worker to interact with the new marketplace smart contract.

**Instructions for AI Assistant**:

This phase focuses on developing the backend API endpoints within the Cloudflare Worker to facilitate interaction with the new marketplace smart contract. The AI assistant should create the following RESTful API endpoints:

| Endpoint | Method | Description |
| :--------------------------------- | :----- | :------------------------------------------ |
| `/api/marketplace/list` | `POST` | For creating an NFT listing. |
| `/api/marketplace/buy` | `POST` | For purchasing an NFT. |
| `/api/marketplace/cancel` | `POST` | For canceling an NFT listing. |
| `/api/marketplace/listings` | `GET` | To fetch all active listings. |
| `/api/marketplace/listings/:mint_address` | `GET` | To fetch a specific listing by its mint address. |
| `/api/marketplace/user-listings/:wallet_address` | `GET` | To fetch listings by a specific user wallet address. |

Each endpoint's logic must involve receiving necessary data from the frontend, constructing the appropriate Solana transaction using the marketplace program's IDL, and sending the transaction to the Solana network. The endpoints should return transaction signatures or relevant data to the frontend. A critical aspect of this phase is implementing a robust strategy for indexing and caching marketplace data to ensure fast frontend queries. This may involve utilizing a Cloudflare D1 database for storing active listings and sales history, listening to Solana program logs for real-time updates, and caching frequently accessed data in Cloudflare KV stores. Robust authentication and authorization checks must be implemented for all API endpoints to prevent unauthorized access or malicious activity. This includes verifying user identity (e.g., via wallet signature) for `POST` requests and ensuring that only authorized users can perform actions like listing or canceling their own NFTs.

### Phase 4: Frontend (React/Vite) UI Development

**Goal**: Develop a visually appealing and highly functional user interface for the Gorbagio NFT marketplace, adhering to Trashmarket.fun's brand guidelines.

**Instructions for AI Assistant**:

Development of the frontend UI will begin with creating a central `GorbagioMarketplace.tsx` component to serve as the entry point for the marketplace. Strict adherence to `trashmarket-fun-brand-guidelines` is paramount, ensuring a brutalist, neon-on-black terminal-like aesthetic, utilizing official Trashmarket.fun brand colors, preferring monospace or industrial-style fonts, and maintaining clean, functional, and edgy layouts with clear calls to action. The UI will feature a **Browse Listings View** to display all active Gorbagio NFT listings, complete with NFT images, names, prices, and seller information, alongside filtering, sorting, and pagination options. A dedicated **NFT Detail View** will provide comprehensive information for each listing, including a "Buy Now" button that triggers the `buy_nft` transaction via the backend API. Furthermore, a **User Dashboard/My Listings** section will allow users to view their owned NFTs, list new NFTs, cancel active listings, and review past transactions. Seamless integration with the existing Solana wallet adapter is essential, as is the implementation of real-time updates through WebSockets or polling. Finally, clear visual feedback for loading states, transaction confirmations, and error messages must be provided to enhance the user experience. The frontend should also handle the display of NFT metadata, including images, by querying the Metaplex metadata account or a reliable RPC/indexer service.

### Phase 5: Testing, Deployment & Monitoring

**Goal**: Ensure the new marketplace is fully functional, secure, and performant before and after deployment.

**Instructions for AI Assistant**:

This final phase encompasses comprehensive testing, deployment, and ongoing monitoring. The AI assistant must write extensive unit and integration tests for the `gorbagio_marketplace` Anchor program using Anchor's TypeScript testing framework, covering all instructions under various valid and invalid scenarios. Integration tests for the Cloudflare Worker endpoints are also crucial to ensure correct interaction with the Solana program and proper data handling. End-to-end tests, utilizing tools like Playwright or Cypress, should be implemented to simulate full user flows through the marketplace UI. Deployment will involve deploying the `gorbagio_marketplace` program to Gorbagana Mainnet-beta, the updated Cloudflare Worker with new API endpoints, and the updated Trashmarket.fun frontend. Post-deployment, robust monitoring for smart contract health, API endpoint performance, and frontend errors must be established. Integrating analytics to track marketplace activity, including listings, sales, and user engagement, will provide valuable insights for future improvements.

---

**Deliverable**: A fully functional, secure, and branded native Gorbagio NFT trading marketplace integrated into the Trashmarket.fun dApp, with all legacy Gorbagio features removed.
