import React, { useState, useEffect, useCallback } from 'react';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram 
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import BN from "bn.js";
import { Loader2, Ticket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getJunkBalance } from '../lib/tokenService';

const RPC = "https://rpc.trashscan.io";
const PROGRAM_ID = new PublicKey("HStdQm36PAk5KzizXqFmkN6LZ2sW7HgHTxsDDUeJqarw");
const MINT = new PublicKey("BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF");

const LotteryTickets: React.FC = () => {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');
    const [junkBalance, setJunkBalance] = useState<number | null>(null);

    const fetchBalance = useCallback(async () => {
        if (publicKey && connection) {
            try {
                const balance = await getJunkBalance(connection, publicKey);
                setJunkBalance(balance);
            } catch (err) {
                console.error("Failed to fetch JUNK balance:", err);
            }
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (connected) {
            fetchBalance();
        } else {
            setJunkBalance(null);
        }
    }, [connected, fetchBalance]);

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey || !signTransaction) {
            setStatus('error');
            setMessage('Wallet not connected');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setStatus('error');
            setMessage('Please enter a valid amount');
            return;
        }

        if (junkBalance !== null && amountNum > junkBalance) {
            setStatus('error');
            setMessage('Insufficient JUNK balance');
            return;
        }

        setStatus('loading');
        setMessage('Preparing transaction...');

        try {
            const conn = new Connection(RPC, "confirmed");
            const rawAmount = new BN(amount).mul(new BN(10).pow(new BN(9)));

            // Derive config PDA
            const [config] = await PublicKey.findProgramAddress(
                [Buffer.from("config")],
                PROGRAM_ID
            );

            const vault = getAssociatedTokenAddressSync(
                MINT,
                config,
                true
            );

            const userAta = getAssociatedTokenAddressSync(
                MINT,
                publicKey
            );

            // Anchor discriminator for "deposit"
            const discriminator = Buffer.from(
                await crypto.subtle.digest(
                    "SHA-256",
                    new TextEncoder().encode("global:deposit")
                )
            ).slice(0, 8);

            const amountBuffer = rawAmount.toArrayLike(Buffer, "le", 8);
            const data = Buffer.concat([discriminator, amountBuffer]);

            const keys = [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: MINT, isSigner: false, isWritable: true },
                { pubkey: config, isSigner: false, isWritable: true },
                { pubkey: vault, isSigner: false, isWritable: true },
                { pubkey: userAta, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ];

            const transaction = new Transaction().add({
                keys,
                programId: PROGRAM_ID,
                data,
            });

            transaction.feePayer = publicKey;
            const { blockhash } = await conn.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            setMessage('Please sign the transaction in your wallet...');
            const signed = await signTransaction(transaction);
            
            setMessage('Confirming transaction...');
            const signature = await conn.sendRawTransaction(signed.serialize());
            await conn.confirmTransaction(signature, "confirmed");

            setStatus('success');
            setMessage(`Successfully converted ${amount} JUNK to Lottery Tickets!`);
            setAmount('');
            fetchBalance();
        } catch (err: any) {
            console.error("Transaction failed:", err);
            setStatus('error');
            setMessage(err.message || 'Transaction failed');
        }
    };

    return (
        <div className="bg-black/40 border border-white/10 p-6 rounded-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
                <Ticket className="w-6 h-6 text-magic-green" />
                <h3 className="text-lg font-bold text-white tracking-tighter uppercase">Convert JUNK to Lottery Tickets by Trashcoin</h3>
            </div>

            {!connected ? (
                <p className="text-gray-500 text-sm font-mono italic">Connect your wallet to participate in the lottery.</p>
            ) : (
                <form onSubmit={handleConvert} className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-gray-500 px-1">
                            <span>Amount of JUNK</span>
                            <span>Balance: {junkBalance !== null ? junkBalance.toLocaleString() : '...'} JUNK</span>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-black border border-white/10 focus:border-magic-green/50 text-white font-mono p-3 outline-none transition-all"
                                disabled={status === 'loading'}
                            />
                            <button 
                                type="button"
                                onClick={() => junkBalance && setAmount(junkBalance.toString())}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-magic-green hover:text-white transition-colors uppercase tracking-tighter"
                            >
                                Max
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !amount || parseFloat(amount) <= 0}
                        className="w-full bg-magic-green hover:bg-white text-black font-bold py-3 px-6 transition-all uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Convert to Tickets'
                        )}
                    </button>

                    {status === 'success' && (
                        <div className="flex items-start gap-2 text-magic-green text-xs font-mono bg-magic-green/10 p-3 border border-magic-green/20">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p>{message}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex items-start gap-2 text-red-400 text-xs font-mono bg-red-400/10 p-3 border border-red-400/20">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{message}</p>
                        </div>
                    )}
                    
                    {status === 'loading' && (
                        <div className="flex items-start gap-2 text-blue-400 text-xs font-mono bg-blue-400/10 p-3 border border-blue-400/20">
                            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                            <p>{message}</p>
                        </div>
                    )}
                </form>
            )}
        </div>
    );
};

export default LotteryTickets;
