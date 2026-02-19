# Trashmarket.fun Deployment Guide

This guide provides the necessary steps to deploy the Solana-side bridge program and configure the required Firebase services for the Trashmarket.fun dApp.

## 1. Solana Bridge Program Deployment (FEAT-02)

The Gorbagana-Solana bridge requires a program to be deployed on both chains. The Gorbagana-side program is already deployed. The following steps outline how to deploy the Solana-side program once you have sufficient funds.

### Prerequisites

- **Solana CLI Tool Suite**: Ensure you have the Solana CLI installed and configured. You can get it from the official [Solana documentation](https://docs.solana.com/cli/install-solana-cli-tools).
- **Anchor Framework**: The bridge program is built with Anchor. Install it by following the instructions on the [Anchor website](https://www.anchor-lang.com/docs/installation).
- **Program Source Code**: You will need the source code for the `gorbagana-bridge` Solana program. This is assumed to be in a separate repository.
- **Solana Wallet**: A funded Solana wallet with enough SOL to cover deployment costs (typically 1-2 SOL for a new program).

### Deployment Steps

1.  **Navigate to the Program Directory**: Open your terminal and change into the directory containing the Anchor program for the Solana bridge.

    ```bash
    cd path/to/your/gorbagana-bridge-solana-program
    ```

2.  **Build the Program**: Compile the Anchor program to generate the on-chain bytecode.

    ```bash
    anchor build
    ```

    This command will create a `target/deploy` directory containing the program's `.so` file.

3.  **Configure Solana CLI**: Ensure your Solana CLI is pointing to the desired network (e.g., mainnet-beta) and your funded wallet.

    ```bash
    # Set to mainnet
    solana config set --url https://api.mainnet-beta.solana.com

    # Set your wallet
    solana config set --keypair /path/to/your/wallet.json
    ```

4.  **Deploy the Program**: Deploy the compiled program to the Solana network. This command will return a new Program ID.

    ```bash
    anchor deploy
    ```

5.  **Update Frontend**: Once deployed, you will receive a new Program ID. You must update this ID in the Trashmarket.fun frontend code.

    -   Open `/home/ubuntu/Trashmarket.fun/contexts/AnchorContext.tsx`.
    -   Replace the placeholder `SOLANA_DEVNET_PROGRAM_ID` with your new Program ID.

    ```typescript
    // Before
    const SOLANA_DEVNET_PROGRAM_ID = new PublicKey("66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M");

    // After
    const SOLANA_DEVNET_PROGRAM_ID = new PublicKey("YOUR_NEW_PROGRAM_ID_HERE");
    ```

6.  **Re-deploy Frontend**: After updating the Program ID, you will need to rebuild and redeploy the Trashmarket.fun frontend for the changes to take effect.

## 2. Firebase Setup Guide (SEC-04)

Firebase is used for the collection submission feature, including storing submission data and securing access with Firestore Security Rules.

### Step 1: Create a Firebase Project

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click **"Add project"** and follow the on-screen instructions.
3.  Give your project a name (e.g., `trashmarket-fun`).
4.  You can disable Google Analytics for this project if you wish.

### Step 2: Create a Firestore Database

1.  From your new project's dashboard, go to the **Build** section in the left-hand menu and click on **Firestore Database**.
2.  Click **"Create database"**.
3.  Start in **production mode**. This ensures your database is not publicly readable/writable by default.
4.  Choose a location for your database.

### Step 3: Get Firebase Configuration for Web App

1.  In the Firebase console, go to **Project Overview** -> **Project settings** (the gear icon).
2.  Under the **General** tab, scroll down to **Your apps**.
3.  Click the web icon (`</>`) to create a new web app.
4.  Give it a nickname (e.g., `Trashmarket Web`) and click **"Register app"**.
5.  Firebase will provide you with a `firebaseConfig` object. You will need these values.

### Step 4: Configure Frontend Environment

1.  In the `Trashmarket.fun` project, create a `.env.local` file in the root directory if you don't have one.
2.  Copy the configuration from `.env.example` and paste the values from your Firebase project's `firebaseConfig` object.

    ```.env
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

### Step 5: Deploy Firestore Security Rules

The `firestore.rules` file in the project root defines the security for your database. You need to deploy these rules.

1.  **Install Firebase CLI**: If you don't have it, install the Firebase CLI globally.

    ```bash
    npm install -g firebase-tools
    ```

2.  **Login to Firebase**: Authenticate the CLI with your Google account.

    ```bash
    firebase login
    ```

3.  **Initialize Firebase in the Project**: In the root of the `Trashmarket.fun` directory, run:

    ```bash
    firebase init firestore
    ```

    -   Select **"Use an existing project"** and choose the Firebase project you created.
    -   When asked for the rules file, use the default `firestore.rules`.

4.  **Deploy the Rules**: Now, deploy the rules to your project.

    ```bash
    firebase deploy --only firestore:rules
    ```

### Step 6: Configure Admin Wallets (Server-Side)

Admin access is now managed by the Cloudflare Worker backend, not client-side environment variables.

1.  **Install Wrangler CLI**: If you haven't already, install the Cloudflare Wrangler CLI.

    ```bash
    npm install -g wrangler
    ```

2.  **Set Admin Wallets Secret**: In the `/home/ubuntu/Trashmarket.fun/backend` directory, run the following command. Replace the wallet addresses with your actual admin wallets.

    ```bash
    cd /home/ubuntu/Trashmarket.fun/backend
    wrangler secret put ADMIN_WALLETS
    ```

    Wrangler will prompt you to enter the secret value. Paste a comma-separated list of your admin wallet public keys:

    `WALLET_PUBKEY_1,WALLET_PUBKEY_2,WALLET_PUBKEY_3`

3.  **Set JWT Secret**: Create a strong, random secret for signing session tokens.

    ```bash
    wrangler secret put JWT_SECRET
    ```

    Enter a long, random string when prompted.

4.  **Deploy the Worker**: Deploy the backend worker to Cloudflare.

    ```bash
    npm run deploy
    ```

Your Firebase setup is now complete and secured.
