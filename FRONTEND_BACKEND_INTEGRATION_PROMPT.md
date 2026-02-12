# AI Assistant Prompt: Gorbagana Bridge Frontend/Backend Integration

## Objective
Integrate the Trashmarket.fun frontend with the deployed Gorbagana Bridge program. Replace all mock data and Firebase-only functionality with real on-chain interactions.

## Current State
- **Deployed Program ID**: `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`
- **RPC**: `https://rpc.trashscan.io`
- **sGOR Mint (Solana)**: `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`
- **Bridge Directory**: `/home/mattrick/Desktop/trshmarket/Trashmarket.fun/bridge/`
- **Frontend Directory**: `/home/mattrick/Desktop/trshmarket/Trashmarket.fun/`

## CRITICAL: Execute ONE Step at a Time
**STOP and confirm success after each step before proceeding.**

---

## PHASE 1: Setup & Dependencies

### Step 1: Install Required Dependencies
```bash
cd /home/mattrick/Desktop/trshmarket/Trashmarket.fun
npm install @coral-xyz/anchor@0.30.1 @solana/web3.js @solana/spl-token @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-base @solana/wallet-adapter-backpack
```

**STOP: Confirm package.json includes these dependencies.**

### Step 2: Copy IDL to Frontend
```bash
cp /home/mattrick/Desktop/trshmarket/Trashmarket.fun/bridge/target/idl/gorbagana_bridge.json /home/mattrick/Desktop/trshmarket/Trashmarket.fun/src/idl/
cp /home/mattrick/Desktop/trshmarket/Trashmarket.fun/bridge/target/types/gorbagana_bridge.ts /home/mattrick/Desktop/trshmarket/Trashmarket.fun/src/idl/
```

**STOP: Verify files exist in src/idl/ directory.**

---

## PHASE 2: Create Core Infrastructure

### Step 3: Create Anchor Context Provider
Create `/home/mattrick/Desktop/trshmarket/Trashmarket.fun/src/contexts/AnchorContext.tsx`:

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { GorbaganaBridge } from '../idl/gorbagana_bridge';
import idl from '../idl/gorbagana_bridge.json';

const PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');

interface AnchorContextType {
  program: Program<GorbaganaBridge>;
  provider: AnchorProvider;
  programId: PublicKey;
  sgorMint: PublicKey;
}

const AnchorContext = createContext<AnchorContextType | null>(null);

export const AnchorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = useWallet();
  const { connection } = useConnection();

  const value = useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program(
      idl as any,
      provider
    ) as Program<GorbaganaBridge>;

    return {
      program,
      provider,
      programId: PROGRAM_ID,
      sgorMint: SGOR_MINT
    };
  }, [connection, wallet]);

  return (
    <AnchorContext.Provider value={value}>
      {children}
    </AnchorContext.Provider>
  );
};

export const useAnchor = () => {
  const context = useContext(AnchorContext);
  if (!context) throw new Error('useAnchor must be used within AnchorProvider');
  return context;
};
```

**STOP: Verify no TypeScript errors.**

### Step 4: Update App.tsx with Wallet Providers
Wrap the app with Solana wallet providers:

```typescript
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { AnchorProvider } from './contexts/AnchorContext';

const RPC_URL = 'https://rpc.trashscan.io';

function App() {
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AnchorProvider>
            {/* Your existing app content */}
          </AnchorProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

**STOP: Confirm app compiles without errors.**

---

## PHASE 3: Rewrite Bridge Service

### Step 5: Rewrite `services/bridgeService.ts`
Replace the entire file with on-chain functionality:

```typescript
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useAnchor } from '../contexts/AnchorContext';

const PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');

export interface BridgeOrder {
  orderPDA: PublicKey;
  maker: PublicKey;
  amount: BN;
  direction: number;
  expirationSlot: BN;
  isFilled: boolean;
  bump: number;
}

export const useBridgeService = () => {
  const { program, provider } = useAnchor();

  // Derive Order PDA
  const deriveOrderPDA = (maker: PublicKey, amount: BN): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('order'),
        maker.toBuffer(),
        amount.toArrayLike(Buffer, 'le', 8),
      ],
      PROGRAM_ID
    );
    return pda;
  };

  // Create Order (Direction 1: gGOR -> sGOR)
  const createOrderGGOR = async (amount: number, expirationSlot: number) => {
    const wallet = provider.wallet;
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

    const tx = await program.methods
      .createOrder(amountBN, 1, new BN(expirationSlot))
      .accounts({
        maker: wallet.publicKey,
        order: orderPDA,
        escrowTokenAccount: null,
        makerTokenAccount: null,
        sgorMint: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { tx, orderPDA };
  };

  // Create Order (Direction 0: sGOR -> gGOR)
  const createOrderSGOR = async (amount: number, expirationSlot: number) => {
    const wallet = provider.wallet;
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

    const escrowPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from('escrow'),
        wallet.publicKey.toBuffer(),
        amountBN.toArrayLike(Buffer, 'le', 8),
      ],
      PROGRAM_ID
    )[0];

    const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);

    const tx = await program.methods
      .createOrder(amountBN, 0, new BN(expirationSlot))
      .accounts({
        maker: wallet.publicKey,
        order: orderPDA,
        escrowTokenAccount: escrowPDA,
        makerTokenAccount: makerATA,
        sgorMint: SGOR_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { tx, orderPDA, escrowPDA };
  };

  // Fill Order
  const fillOrder = async (orderPDA: PublicKey) => {
    const wallet = provider.wallet;
    
    // Fetch order to get direction and maker
    const order = await program.account.order.fetch(orderPDA);
    
    const accounts: any = {
      taker: wallet.publicKey,
      maker: order.maker,
      order: orderPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };

    if (order.direction === 0) {
      // Direction 0: Taker sends gGOR, receives sGOR
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          order.maker.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];
      
      accounts.escrowTokenAccount = escrowPDA;
      accounts.takerReceiveTokenAccount = takerATA;
    } else {
      // Direction 1: Taker sends sGOR, receives gGOR
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);
      
      accounts.takerTokenAccount = takerATA;
      accounts.makerReceiveTokenAccount = makerATA;
    }

    const tx = await program.methods
      .fillOrder()
      .accounts(accounts)
      .rpc();

    return tx;
  };

  // Cancel Order
  const cancelOrder = async (orderPDA: PublicKey) => {
    const wallet = provider.wallet;
    const order = await program.account.order.fetch(orderPDA);

    const accounts: any = {
      maker: wallet.publicKey,
      order: orderPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };

    if (order.direction === 0) {
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          wallet.publicKey.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      
      accounts.escrowTokenAccount = escrowPDA;
      accounts.makerTokenAccount = makerATA;
    }

    const tx = await program.methods
      .cancelOrder()
      .accounts(accounts)
      .rpc();

    return tx;
  };

  // Fetch all orders
  const fetchAllOrders = async (): Promise<BridgeOrder[]> => {
    const accounts = await program.account.order.all();
    return accounts.map(acc => ({
      orderPDA: acc.publicKey,
      maker: acc.account.maker,
      amount: acc.account.amount,
      direction: acc.account.direction,
      expirationSlot: acc.account.expirationSlot,
      isFilled: acc.account.isFilled,
      bump: acc.account.bump,
    }));
  };

  return {
    createOrderGGOR,
    createOrderSGOR,
    fillOrder,
    cancelOrder,
    fetchAllOrders,
    deriveOrderPDA,
  };
};

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
```

**STOP: Verify no TypeScript errors and all imports resolve.**

---

## PHASE 4: Update Bridge.tsx Page

### Step 6: Replace Mock Data with Real Data
Update `/home/mattrick/Desktop/trshmarket/Trashmarket.fun/src/pages/Bridge.tsx`:

Replace the mock orders useEffect with:

```typescript
import { useBridgeService } from '../services/bridgeService';
import { useAnchor } from '../contexts/AnchorContext';
import { useWallet } from '@solana/wallet-adapter-react';

const Bridge: React.FC = () => {
  const { connected } = useWallet();
  const { fetchAllOrders, createOrderGGOR, createOrderSGOR, fillOrder, cancelOrder } = useBridgeService();
  const { program } = useAnchor();
  
  const [orders, setOrders] = useState<BridgeOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch real orders from blockchain
  useEffect(() => {
    if (!program) return;
    
    const loadOrders = async () => {
      setLoading(true);
      try {
        const allOrders = await fetchAllOrders();
        // Filter active orders (not filled, not expired)
        const activeOrders = allOrders.filter(o => !o.isFilled);
        setOrders(activeOrders);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [program]);

  // Handle create order
  const handleCreateOrder = async (values: { amount: number, direction: number }) => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const currentSlot = await program.provider.connection.getSlot();
      const expirationSlot = currentSlot + 216000; // ~24 hours

      if (values.direction === 1) {
        // gGOR -> sGOR
        await createOrderGGOR(values.amount * 1e9, expirationSlot);
      } else {
        // sGOR -> gGOR
        await createOrderSGOR(values.amount * 1e9, expirationSlot);
      }
      
      alert('Order created successfully!');
      // Refresh orders
      const allOrders = await fetchAllOrders();
      setOrders(allOrders.filter(o => !o.isFilled));
    } catch (err: any) {
      alert('Failed to create order: ' + err.message);
    }
  };

  // Handle fill order
  const handleFillOrder = async (orderPDA: PublicKey) => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }

    try {
      await fillOrder(orderPDA);
      alert('Order filled successfully!');
      // Refresh orders
      const allOrders = await fetchAllOrders();
      setOrders(allOrders.filter(o => !o.isFilled));
    } catch (err: any) {
      alert('Failed to fill order: ' + err.message);
    }
  };

  // Rest of component... update the table to use real orders
  // Map orders to display format
  const displayOrders = orders.map(order => ({
    id: order.orderPDA.toBase58(),
    seller: order.maker.toBase58().slice(0, 8) + '...',
    sellToken: order.direction === 0 ? 'sGOR' : 'gGOR',
    buyToken: order.direction === 0 ? 'gGOR' : 'sGOR',
    amount: order.amount.toNumber() / 1e9,
    status: 'active',
    timestamp: Date.now(),
    requiredWallet: 'Any Wallet',
    orderPDA: order.orderPDA
  }));

  // ... rest of JSX using displayOrders instead of mockOrders
};
```

**STOP: Verify component renders without errors.**

---

## PHASE 5: Testing

### Step 7: Test Full Flow
1. **Connect Wallet**: Verify wallet connection works
2. **Create Order**: Test creating both directions
3. **View Orders**: Confirm orders appear in list
4. **Fill Order**: Test filling an existing order
5. **Cancel Order**: Test canceling your own order

**STOP: Each test must pass before continuing.**

---

## CRITICAL CHECKLIST

### Must Verify:
- [ ] All dependencies installed
- [ ] IDL files copied to frontend
- [ ] No TypeScript compilation errors
- [ ] Wallet connects successfully
- [ ] Can create orders on-chain
- [ ] Can view orders from chain
- [ ] Can fill orders
- [ ] Can cancel orders
- [ ] UI updates after transactions
- [ ] Error handling works

### Security Checks:
- [ ] Program ID is correct: `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`
- [ ] sGOR mint is correct: `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`
- [ ] RPC is: `https://rpc.trashscan.io`
- [ ] No hardcoded private keys
- [ ] Wallet approval required for all transactions

---

## COMPLETION CRITERIA

The integration is complete when:
1. ✅ Users can connect their wallet
2. ✅ Users can create orders (both directions)
3. ✅ Users can view all active orders from the blockchain
4. ✅ Users can fill orders
5. ✅ Users can cancel their own orders
6. ✅ All transactions show loading states
7. ✅ Errors are handled gracefully
8. ✅ UI updates automatically after transactions

---

## TROUBLESHOOTING

### If "Program not found":
- Verify Program ID is correct
- Check RPC URL is `https://rpc.trashscan.io`

### If "Wallet not connected":
- Ensure `useWallet()` hook is used correctly
- Check WalletProvider is at top level

### If transactions fail:
- Verify wallet has sufficient gGOR for fees
- Check order hasn't expired
- Verify direction (0 or 1) is correct

---

**Execute ONE step at a time. Confirm success before proceeding.**
