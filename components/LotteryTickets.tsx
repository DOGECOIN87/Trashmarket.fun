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
import { Loader2, Ticket, AlertCircle, CheckCircle2, RefreshCw, Info, X, Lock } from 'lucide-react';
import { getJunkBalance } from '../lib/tokenService';

const RPC = "https://rpc.trashscan.io";
const PROGRAM_ID = new PublicKey("HStdQm36PAk5KzizXqFmkN6LZ2sW7HgHTxsDDUeJqarw");
const MINT = new PublicKey("BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF");

const LotteryTickets: React.FC = () => {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');
    const [junkBalance, setJunkBalance] = useState<number | null>(null);
    const [ticketBalance, setTicketBalance] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [rawData, setRawData] = useState<string>('');

    // Feature Flag: Set to true when Trashcoin enables the feature
    const IS_FEATURE_ENABLED = false;

    const fetchBalances = useCallback(async () => {
        if (!publicKey || !connection) return;
        
        setIsRefreshing(true);
        try {
            const jBalance = await getJunkBalance(connection, publicKey);
            setJunkBalance(jBalance);

            // Try to find the user state account
            const [userStatePda] = await PublicKey.findProgramAddress(
                [Buffer.from("user"), publicKey.toBuffer()],
                PROGRAM_ID
            );

            const accountInfo = await connection.getAccountInfo(userStatePda);
            if (accountInfo && accountInfo.data) {
                const data = accountInfo.data;
                setRawData(data.toString('hex'));
                if (data.length >= 48) {
                    const tickets = new BN(data.slice(40, 48), 'le').toNumber();
                    setTicketBalance(tickets);
                } else {
                    setTicketBalance(0);
                }
            } else {
                // Try alternative seed
                const [altPda] = await PublicKey.findProgramAddress(
                    [Buffer.from("user-state"), publicKey.toBuffer()],
                    PROGRAM_ID
                );
                const altInfo = await connection.getAccountInfo(altPda);
                if (altInfo && altInfo.data) {
                    setRawData(altInfo.data.toString('hex'));
                    if (altInfo.data.length >= 48) {
                        setTicketBalance(new BN(altInfo.data.slice(40, 48), 'le').toNumber());
                    } else {
                        setTicketBalance(0);
                    }
                } else {
                    setTicketBalance(0);
                    setRawData('No account found');
                }
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
        if (!IS_FEATURE_ENABLED) return;
        
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

            const transaction = new Transaction();
            const [userPda] = await PublicKey.findProgramAddress(
                [Buffer.from("user"), publicKey.toBuffer()],
                PROGRAM_ID
            );

            const keys = [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: MINT, isSigner: false, isWritable: true },
                { pubkey: config, isSigner: false, isWritable: true },
                { pubkey: vault, isSigner: false, isWritable: true },
                { pubkey: userAta, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: userPda, isSigner: false, isWritable: true },
            ];

            transaction.add({
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
            setTimeout(fetchBalances, 3000);
        } catch (err: any) {
            console.error("Transaction failed:", err);
            setStatus('error');
            setMessage(err.message || 'Transaction failed');
        }
    };

    return (
        <>
            {/* Footer Trigger Button */}
            <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-3 px-4 py-2 bg-black border border-white/10 hover:border-magic-green/50 transition-all group"
            >
                <div className="w-6 h-6 rounded-sm overflow-hidden bg-magic-green/20 flex items-center justify-center">
                    <img src="/assets/logo.svg" alt="JUNK" className="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-xs font-bold text-gray-400 group-hover:text-magic-green uppercase tracking-widest font-mono">Convert JUNK</span>
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-magic-dark border border-magic-green/30 shadow-[0_0_50px_rgba(0,255,0,0.1)] relative overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                            <div className="flex items-center gap-2">
                                <Ticket className="w-5 h-5 text-magic-green" />
                                <h3 className="text-sm font-bold text-white tracking-widest uppercase font-pusia">JUNK TO TICKETS</h3>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {!connected ? (
                                <div className="py-8 text-center border border-dashed border-white/10">
                                    <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Connect Wallet to Participate</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Balances */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/40 border border-white/5 p-4 rounded-sm">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Your JUNK</p>
                                            <p className="text-lg font-bold text-white font-mono">
                                                {junkBalance !== null ? junkBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '---'}
                                            </p>
                                        </div>
                                        <div className="bg-magic-green/5 border border-magic-green/20 p-4 rounded-sm relative">
                                            <p className="text-[10px] text-magic-green/70 uppercase tracking-widest mb-1">Your Tickets</p>
                                            <p className="text-lg font-bold text-magic-green font-mono">
                                                {ticketBalance !== null ? ticketBalance.toLocaleString() : '---'}
                                            </p>
                                            {isRefreshing && (
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 animate-spin text-magic-green" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <form onSubmit={handleConvert} className="space-y-4">
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="ENTER JUNK AMOUNT"
                                                className="w-full bg-black border border-white/10 group-hover:border-magic-green/30 focus:border-magic-green/50 text-white font-mono text-sm p-4 outline-none transition-all placeholder:text-gray-700"
                                                disabled={status === 'loading' || !IS_FEATURE_ENABLED}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => junkBalance && setAmount(junkBalance.toString())}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-magic-green hover:text-white transition-colors uppercase tracking-widest"
                                                disabled={!IS_FEATURE_ENABLED}
                                            >
                                                MAX
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <button
                                                type="submit"
                                                disabled={status === 'loading' || !amount || parseFloat(amount) <= 0 || !IS_FEATURE_ENABLED}
                                                className="w-full bg-magic-green hover:bg-white text-black font-bold py-4 text-sm transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,0,0.2)]"
                                            >
                                                {!IS_FEATURE_ENABLED ? (
                                                    <>
                                                        <Lock className="w-4 h-4" />
                                                        TEMPORARILY DISABLED
                                                    </>
                                                ) : status === 'loading' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'CONVERT NOW'
                                                )}
                                            </button>
                                            {!IS_FEATURE_ENABLED && (
                                                <p className="mt-2 text-[9px] text-gray-500 text-center uppercase tracking-widest font-mono">
                                                    Waiting for Trashcoin to enable this feature
                                                </p>
                                            )}
                                        </div>
                                    </form>

                                    {/* Status */}
                                    {(status === 'success' || status === 'error' || status === 'loading') && (
                                        <div className={`flex items-start gap-3 text-xs font-mono p-4 border ${
                                            status === 'success' ? 'text-magic-green bg-magic-green/5 border-magic-green/20' : 
                                            status === 'error' ? 'text-red-400 bg-red-400/5 border-red-400/20' : 
                                            'text-blue-400 bg-blue-400/5 border-blue-400/20'
                                        }`}>
                                            {status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : 
                                             status === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : 
                                             <Loader2 className="w-4 h-4 shrink-0 animate-spin" />}
                                            <p className="uppercase tracking-tight">{message}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
                            <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                                Verified On-Chain
                            </p>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setShowDebug(!showDebug)}
                                    className="text-gray-600 hover:text-magic-green transition-colors"
                                    title="Debug Info"
                                >
                                    <Info className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={fetchBalances}
                                    disabled={isRefreshing}
                                    className="text-magic-green/50 hover:text-magic-green transition-colors"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Debug Panel */}
                        {showDebug && (
                            <div className="p-4 bg-black border-t border-white/10 max-h-32 overflow-y-auto">
                                <p className="text-[9px] text-gray-500 uppercase mb-2 font-mono">Raw Account Data (Hex)</p>
                                <div className="text-[9px] text-gray-600 font-mono break-all leading-tight">
                                    {rawData || 'No data'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default LotteryTickets;
