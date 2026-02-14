import React, { createContext, useContext, useMemo } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { AnchorProvider as AnchorAnchorProvider, Program } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import type { GorbaganaBridge } from '../src/idl/gorbagana_bridge';
import idl from '../src/idl/gorbagana_bridge.json';

const PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');
const GORBAGANA_RPC = 'https://rpc.trashscan.io';

interface AnchorContextType {
    program: Program<GorbaganaBridge> | null;
    provider: AnchorAnchorProvider | null;
    gorbaganaProvider: AnchorAnchorProvider | null;
    programId: PublicKey;
    sgorMint: PublicKey;
}

const AnchorContext = createContext<AnchorContextType>({
    program: null,
    provider: null,
    gorbaganaProvider: null,
    programId: PROGRAM_ID,
    sgorMint: SGOR_MINT,
});

export const AnchorContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const wallet = useWallet();
    const { connection } = useConnection();

    const value = useMemo<AnchorContextType>(() => {
        try {
            // Standard provider (uses current wallet connection)
            const provider = new AnchorAnchorProvider(
                connection,
                wallet as any,
                {
                    commitment: 'confirmed',
                    preflightCommitment: 'processed',
                    skipPreflight: true,
                }
            );

            // Dedicated Gorbagana provider for Bridge interactions
            const gorbaganaConnection = new Connection(GORBAGANA_RPC, 'confirmed');
            const gorbaganaProvider = new AnchorAnchorProvider(
                gorbaganaConnection,
                wallet as any,
                {
                    commitment: 'confirmed',
                    preflightCommitment: 'processed',
                    skipPreflight: true,
                }
            );

            // The Bridge program MUST always use the Gorbagana provider
            const program = new Program(
                idl as any,
                gorbaganaProvider
            ) as unknown as Program<GorbaganaBridge>;

            return {
                program,
                provider,
                gorbaganaProvider,
                programId: PROGRAM_ID,
                sgorMint: SGOR_MINT,
            };
        } catch (err) {
            console.warn('AnchorContext: Failed to initialize program:', err);
            return {
                program: null,
                provider: null,
                gorbaganaProvider: null,
                programId: PROGRAM_ID,
                sgorMint: SGOR_MINT,
            };
        }
    }, [connection, wallet]);

    return (
        <AnchorContext.Provider value={value}>
            {children}
        </AnchorContext.Provider>
    );
};

export const useAnchor = () => {
    return useContext(AnchorContext);
};
