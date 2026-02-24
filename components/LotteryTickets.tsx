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
import { Loader2, Ticket, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
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
    const [ticketBalance, setTicketBalance] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchBalances = useCallback(async () => {
        if (!publicKey || !connection) return;
        
        setIsRefreshing(true);
        try {
            // 1. Fetch JUNK Balance
            const jBalance = await getJunkBalance(connection, publicKey);
            setJunkBalance(jBalance);

            // 2. Fetch Ticket Balance from User State PDA
            // Seed: ["user-state", user_pubkey]
            const [userStatePda] = await PublicKey.findProgramAddress(
                [Buffer.from("user-state"), publicKey.toBuffer()],
                PROGRAM_ID
            );

            const accountInfo = await connection.getAccountInfo(userStatePda);
            if (accountInfo && accountInfo.data) {
                // Anchor account data starts with 8-byte discriminator
                // Ticket count is likely a u64 (8 bytes) after the discriminator
                // We'll try to read it. If it's a standard Anchor account:
                // [8b disc][32b user][8b tickets] -> tickets start at offset 40
                if (accountInfo.data.length >= 48) {
                    const tickets = new BN(accountInfo.data.slice(40, 48), 'le').toNumber();
                    setTicketBalance(tickets);
                } else {
                    // Fallback or different layout
                    setTicketBalance(0);
                }
            } else {
                setTicketBalance(0);
            }
        } catch (err) {
            console.error("Failed to fetch balances:", err);
        } finally {
            setIsRefreshing(false);
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (connected) {
            fetchBalances();
        } else {
            setJunkBalance(null);
            setTicketBalance(null);
        }
    }, [connected, fetchBalances]);

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

        setStatus('loading');
        setMessage('Preparing transaction...');

        try {
            const conn = new Connection(RPC, "confirmed");
            const rawAmount = new BN(amount).mul(new BN(10).pow(new BN(9)));

            const [config] = await PublicKey.findProgramAddress(
                [Buffer.from("config")],
                PROGRAM_ID
            );

            const vault = getAssociatedTokenAddressSync(MINT, config, true);
            const userAta = getAssociatedTokenAddressSync(MINT, publicKey);

            const discriminator = Buffer.from(
                await crypto.subtle.digest("SHA-256", new TextEncoder().encode("global:deposit"))
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

            setMessage('Please sign the transaction...');
            const signed = await signTransaction(transaction);
            
            setMessage('Confirming transaction...');
            const signature = await conn.sendRawTransaction(signed.serialize());
            await conn.confirmTransaction(signature, "confirmed");

            setStatus('success');
            setMessage(`Successfully converted ${amount} JUNK!`);
            setAmount('');
            setTimeout(fetchBalances, 2000); // Refresh after delay
        } catch (err: any) {
            console.error("Transaction failed:", err);
            setStatus('error');
            setMessage(err.message || 'Transaction failed');
        }
    };

    return (
        <div className="bg-black/60 border border-magic-green/20 p-5 rounded-sm backdrop-blur-md shadow-[0_0_15px_rgba(0,255,0,0.05)]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-magic-green animate-pulse" />
                    <h3 className="text-sm font-bold text-white tracking-widest uppercase font-pusia">JUNK TO TICKETS</h3>
                </div>
                {connected && (
                    <button 
                        onClick={fetchBalances}
                        disabled={isRefreshing}
                        className="text-magic-green/50 hover:text-magic-green transition-colors"
                        title="Refresh Balances"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            {!connected ? (
                <div className="py-4 text-center border border-dashed border-white/10">
                    <p className="text-gray-500 text-[10px] font-mono uppercase tracking-widest">Connect Wallet to Participate</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Ticket Counter Display */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/40 border border-white/5 p-3 rounded-sm">
                            <p className="text-[9px] text-gray-500 uppercase tracking-tighter mb-1">Your JUNK</p>
                            <p className="text-sm font-bold text-white font-mono">
                                {junkBalance !== null ? junkBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '---'}
                            </p>
                        </div>
                        <div className="bg-magic-green/5 border border-magic-green/20 p-3 rounded-sm">
                            <p className="text-[9px] text-magic-green/70 uppercase tracking-tighter mb-1">Your Tickets</p>
                            <p className="text-sm font-bold text-magic-green font-mono">
                                {ticketBalance !== null ? ticketBalance.toLocaleString() : '---'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleConvert} className="space-y-3">
                        <div className="relative group">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="ENTER JUNK AMOUNT"
                                className="w-full bg-black/80 border border-white/10 group-hover:border-magic-green/30 focus:border-magic-green/50 text-white font-mono text-xs p-3 outline-none transition-all placeholder:text-gray-700"
                                disabled={status === 'loading'}
                            />
                            <button 
                                type="button"
                                onClick={() => junkBalance && setAmount(junkBalance.toString())}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-magic-green hover:text-white transition-colors uppercase tracking-widest"
                            >
                                MAX
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'loading' || !amount || parseFloat(amount) <= 0}
                            className="w-full bg-magic-green hover:bg-white text-black font-bold py-3 text-xs transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,255,0,0.2)]"
                        >
                            {status === 'loading' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                'CONVERT NOW'
                            )}
                        </button>
                    </form>

                    {/* Status Messages */}
                    {(status === 'success' || status === 'error' || status === 'loading') && (
                        <div className={`flex items-start gap-2 text-[10px] font-mono p-3 border ${
                            status === 'success' ? 'text-magic-green bg-magic-green/5 border-magic-green/20' : 
                            status === 'error' ? 'text-red-400 bg-red-400/5 border-red-400/20' : 
                            'text-blue-400 bg-blue-400/5 border-blue-400/20'
                        }`}>
                            {status === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : 
                             status === 'error' ? <AlertCircle className="w-3 h-3 shrink-0" /> : 
                             <Loader2 className="w-3 h-3 shrink-0 animate-spin" />}
                            <p className="uppercase tracking-tighter">{message}</p>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[8px] text-gray-600 font-mono uppercase text-center tracking-[0.2em]">
                    Verified On-Chain • Trashmarket.fun
                </p>
            </div>
        </div>
    );
};

export default LotteryTickets;
