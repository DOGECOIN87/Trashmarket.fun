import React, { createContext, useContext, useMemo } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { AnchorProvider as AnchorAnchorProvider, Program } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { GORBAGANA_CONFIG } from './NetworkContext';
import type { GorbaganaBridge } from '../idl/gorbagana_bridge';
import gorbaganaIdl from '../idl/gorbagana_bridge.json';
import solanaIdl from '../idl/solana_bridge.json';

// Gorbagana Program
const GORBAGANA_PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT_MAINNET = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');

// Solana Devnet Program
const SOLANA_DEVNET_PROGRAM_ID = new PublicKey('66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M');
const SGOR_MINT_DEVNET = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');

interface AnchorContextType {
    program: Program<GorbaganaBridge> | null; // Gorbagana program
    solanaProgram: Program | null; // Solana devnet program
    provider: AnchorAnchorProvider | null;
    gorbaganaProvider: AnchorAnchorProvider | null;
    programId: PublicKey;
    sgorMint: PublicKey;
}

const AnchorContext = createContext<AnchorContextType>({
    program: null,
    solanaProgram: null,
    provider: null,
    gorbaganaProvider: null,
    programId: GORBAGANA_PROGRAM_ID,
    sgorMint: SGOR_MINT_MAINNET,
});

export const AnchorContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const wallet = useWallet();
    const { connection } = useConnection();

    // Use stable references to prevent infinite re-renders
    const walletPublicKey = wallet.publicKey?.toBase58() ?? null;
    const walletConnected = wallet.connected;

    const value = useMemo<AnchorContextType>(() => {
        try {
            // Wait until connection and wallet are ready
            // Connection must have a valid RPC endpoint
            if (!connection || !connection.rpcEndpoint || connection.rpcEndpoint === '') {
                return {
                    program: null,
                    solanaProgram: null,
                    provider: null,
                    gorbaganaProvider: null,
                    programId: GORBAGANA_PROGRAM_ID,
                    sgorMint: SGOR_MINT_MAINNET,
                };
            }

            // Standard provider (uses current wallet connection - dynamically switched)
            // If wallet is not connected, we use a dummy wallet for read-only access
            const readOnlyWallet = {
                publicKey: PublicKey.default,
                signTransaction: async (tx: any) => tx,
                signAllTransactions: async (txs: any) => txs,
            };

            const activeWallet = (walletConnected && wallet) ? wallet : readOnlyWallet;

            const provider = new AnchorAnchorProvider(
                connection,
                activeWallet as any,
                {
                    commitment: 'confirmed',
                    preflightCommitment: 'processed',
                    skipPreflight: false,
                }
            );

            // Dedicated Gorbagana provider for Bridge interactions
            const gorbaganaConnection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
            const gorbaganaProvider = new AnchorAnchorProvider(
                gorbaganaConnection,
                activeWallet as any,
                {
                    commitment: 'confirmed',
                    preflightCommitment: 'processed',
                    skipPreflight: false,
                }
            );

            // Gorbagana bridge program
            const program = new Program(
                gorbaganaIdl as any,
                gorbaganaProvider
            ) as unknown as Program<GorbaganaBridge>;

            // Solana devnet bridge program (uses dynamic connection from provider)
            const solanaProgram = new Program(
                solanaIdl as any,
                provider
            );

            return {
                program,
                solanaProgram,
                provider,
                gorbaganaProvider,
                programId: GORBAGANA_PROGRAM_ID,
                sgorMint: SGOR_MINT_MAINNET,
            };
        } catch (err) {
            console.warn('AnchorContext: Failed to initialize program:', err);
            return {
                program: null,
                solanaProgram: null,
                provider: null,
                gorbaganaProvider: null,
                programId: GORBAGANA_PROGRAM_ID,
                sgorMint: SGOR_MINT_MAINNET,
            };
        }
    }, [connection, walletPublicKey, walletConnected]);

    return (
        <AnchorContext.Provider value={value}>
            {children}
        </AnchorContext.Provider>
    );
};

export const useAnchor = () => {
    return useContext(AnchorContext);
};
