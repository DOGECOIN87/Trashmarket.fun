import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { ArrowRight, CheckCircle, AlertCircle, Loader, RefreshCw, Shield, Trash2, Wrench } from 'lucide-react';
import { audioManager } from '../lib/audioManager';
import type { LegacyGorbagio, MigratedGorbagioNeedingFix } from '../services/migrationService';

type MigrationStatus = 'idle' | 'loading' | 'migrating' | 'success' | 'error';

interface MigrationState {
  nfts: LegacyGorbagio[];
  selected: string | null; // mint address
  status: MigrationStatus;
  message: string;
  signature: string;
}

interface CollectionFixState {
  nfts: MigratedGorbagioNeedingFix[];
  fixing: string | null; // mint currently being fixed
  status: 'idle' | 'loading' | 'fixing' | 'success' | 'error';
  message: string;
  signature: string;
}

const GorbagioMigration: React.FC = () => {
  useEffect(() => audioManager.playOnInteraction('page_gorbagio'), []);

  const { connected, publicKey, wallet } = useWallet();
  const { connection } = useConnection();

  const [state, setState] = useState<MigrationState>({
    nfts: [],
    selected: null,
    status: 'idle',
    message: '',
    signature: '',
  });

  const [fixState, setFixState] = useState<CollectionFixState>({
    nfts: [],
    fixing: null,
    status: 'idle',
    message: '',
    signature: '',
  });

  const loadNFTs = useCallback(async () => {
    if (!connected || !publicKey) return;

    setState((s) => ({ ...s, status: 'loading', message: 'Scanning wallet for legacy Gorbagios...' }));
    setFixState((s) => ({ ...s, status: 'loading', message: 'Checking migrated NFTs...' }));

    try {
      const { fetchUserLegacyGorbagios, fetchMigratedGorbagiosNeedingCollectionFix } = await import('../services/migrationService');

      const [nfts, needFix] = await Promise.all([
        fetchUserLegacyGorbagios(connection, publicKey),
        fetchMigratedGorbagiosNeedingCollectionFix(connection, publicKey),
      ]);

      setState((s) => ({
        ...s,
        nfts,
        status: 'idle',
        message: nfts.length === 0 ? 'No legacy Gorbagios found in your wallet.' : '',
      }));
      setFixState((s) => ({
        ...s,
        nfts: needFix,
        status: 'idle',
        message: '',
      }));
    } catch (err) {
      console.error('[Migration] Error loading NFTs:', err);
      setState((s) => ({
        ...s,
        status: 'error',
        message: 'Failed to scan wallet. Please try again.',
      }));
      setFixState((s) => ({ ...s, status: 'idle' }));
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    loadNFTs();
  }, [loadNFTs]);

  const handleMigrate = async () => {
    if (!state.selected || !wallet?.adapter || !publicKey) return;

    const nft = state.nfts.find((n) => n.mint === state.selected);
    if (!nft) return;

    setState((s) => ({ ...s, status: 'migrating', message: 'Building migration transaction...' }));

    const { executeMigration } = await import('../services/migrationService');
    const result = await executeMigration(
      connection,
      wallet.adapter,
      nft.mint,
      nft.name,
      nft.symbol,
      nft.uri,
    );

    if (result.success) {
      audioManager.play('purchase_success');
      setState((s) => ({
        ...s,
        status: 'success',
        message: `Migration successful! New mint: ${result.newMint}`,
        signature: result.signature,
        nfts: s.nfts.filter((n) => n.mint !== state.selected),
        selected: null,
      }));
      // Auto-refresh after 2s to update both lists
      setTimeout(() => loadNFTs(), 2000);
    } else {
      audioManager.play('error');
      setState((s) => ({
        ...s,
        status: 'error',
        message: result.error || 'Migration failed',
      }));
    }
  };

  const handleFixCollection = async (mintAddress: string) => {
    if (!wallet?.adapter || !publicKey) return;

    setFixState((s) => ({ ...s, fixing: mintAddress, status: 'fixing', message: 'Setting collection on NFT...' }));

    const { executeSetCollection } = await import('../services/migrationService');
    const result = await executeSetCollection(connection, wallet.adapter, mintAddress);

    if (result.success) {
      audioManager.play('purchase_success');
      setFixState((s) => ({
        ...s,
        fixing: null,
        status: 'success',
        message: 'Collection set successfully! The deployer will verify it shortly.',
        signature: result.signature,
        nfts: s.nfts.filter((n) => n.mint !== mintAddress),
      }));
      // Auto-refresh after 2s
      setTimeout(() => loadNFTs(), 2000);
    } else {
      audioManager.play('error');
      setFixState((s) => ({
        ...s,
        fixing: null,
        status: 'error',
        message: result.error || 'Failed to set collection',
      }));
    }
  };

  const selectedNFT = state.nfts.find((n) => n.mint === state.selected);

  return (
    <div className="min-h-screen bg-black text-white p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 border border-[#39FF14]/30 bg-black/80 p-6">
          <h1 className="text-2xl font-mono font-bold text-[#39FF14] mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6" />
            GORBAGIO MIGRATION
          </h1>
          <p className="text-gray-400 text-sm font-mono">
            Migrate your legacy Gorbagio NFTs to the official Metaplex Token Metadata standard.
            Legacy NFTs are permanently locked in a burn vault — new Metaplex-compliant versions are minted to your wallet.
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 font-mono">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#39FF14]" />
              ONE-WAY MIGRATION
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              METADATA PRESERVED
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              LEGACY LOCKED FOREVER
            </span>
          </div>
        </div>

        {/* Not Connected */}
        {!connected && (
          <div className="border border-gray-700 bg-gray-900/50 p-12 text-center">
            <Trash2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-mono text-lg mb-2">WALLET NOT CONNECTED</p>
            <p className="text-gray-600 font-mono text-sm">Connect your wallet to scan for legacy Gorbagios</p>
          </div>
        )}

        {/* Loading */}
        {connected && state.status === 'loading' && (
          <div className="border border-gray-700 bg-gray-900/50 p-12 text-center">
            <Loader className="w-8 h-8 text-[#39FF14] mx-auto mb-4 animate-spin" />
            <p className="text-gray-400 font-mono">{state.message}</p>
          </div>
        )}

        {/* NFT Grid */}
        {connected && state.status !== 'loading' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm text-gray-400">
                YOUR LEGACY GORBAGIOS ({state.nfts.length})
              </h2>
              <button
                onClick={loadNFTs}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#39FF14] font-mono transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> REFRESH
              </button>
            </div>

            {state.nfts.length === 0 && state.status !== 'success' && (
              <div className="border border-gray-800 bg-gray-900/30 p-8 text-center mb-6">
                <p className="text-gray-500 font-mono text-sm">
                  {state.message || 'No legacy Gorbagios found.'}
                </p>
              </div>
            )}

            {state.nfts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                {state.nfts.map((nft) => (
                  <button
                    key={nft.mint}
                    onClick={() => setState((s) => ({ ...s, selected: nft.mint, status: 'idle', message: '' }))}
                    className={`border p-2 transition-all text-left ${
                      state.selected === nft.mint
                        ? 'border-[#39FF14] bg-[#39FF14]/5 shadow-[0_0_10px_rgba(57,255,20,0.2)]'
                        : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="aspect-square bg-gray-900 mb-2 overflow-hidden">
                      {nft.image ? (
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                          <Trash2 className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <p className="font-mono text-xs text-white truncate">{nft.name}</p>
                    <p className="font-mono text-[10px] text-gray-600 truncate">
                      {nft.mint.slice(0, 8)}...{nft.mint.slice(-4)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Migration Panel */}
            {selectedNFT && (
              <div className="border border-[#39FF14]/20 bg-gray-900/50 p-6">
                <h3 className="font-mono text-sm text-[#39FF14] mb-4">MIGRATION DETAILS</h3>

                <div className="flex items-center gap-4 mb-6">
                  {/* Legacy */}
                  <div className="flex-1 border border-red-500/30 bg-red-500/5 p-3">
                    <p className="font-mono text-[10px] text-red-400 mb-1">LEGACY (WILL BE LOCKED)</p>
                    <div className="flex items-center gap-2">
                      {selectedNFT.image && (
                        <img src={selectedNFT.image} alt="" className="w-10 h-10 object-cover" />
                      )}
                      <div>
                        <p className="font-mono text-xs text-white">{selectedNFT.name}</p>
                        <p className="font-mono text-[10px] text-gray-500">{selectedNFT.symbol}</p>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-[#39FF14] flex-shrink-0" />

                  {/* New Metaplex */}
                  <div className="flex-1 border border-[#39FF14]/30 bg-[#39FF14]/5 p-3">
                    <p className="font-mono text-[10px] text-[#39FF14] mb-1">NEW METAPLEX NFT</p>
                    <div className="flex items-center gap-2">
                      {selectedNFT.image && (
                        <img src={selectedNFT.image} alt="" className="w-10 h-10 object-cover" />
                      )}
                      <div>
                        <p className="font-mono text-xs text-white">{selectedNFT.name}</p>
                        <p className="font-mono text-[10px] text-gray-500">Metaplex Standard</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono text-gray-500 mb-4 space-y-1">
                  <p>Name: <span className="text-gray-300">{selectedNFT.name}</span></p>
                  <p>Symbol: <span className="text-gray-300">{selectedNFT.symbol}</span></p>
                  <p>URI: <span className="text-gray-300 break-all">{selectedNFT.uri}</span></p>
                </div>

                <button
                  onClick={handleMigrate}
                  disabled={state.status === 'migrating'}
                  className={`w-full py-3 font-mono font-bold text-sm transition-all ${
                    state.status === 'migrating'
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90 hover:shadow-[0_0_20px_rgba(57,255,20,0.3)]'
                  }`}
                >
                  {state.status === 'migrating' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      MIGRATING...
                    </span>
                  ) : (
                    'MIGRATE TO METAPLEX'
                  )}
                </button>
              </div>
            )}

            {/* Status Messages */}
            {state.status === 'success' && (
              <div className="mt-4 border border-[#39FF14]/30 bg-[#39FF14]/5 p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-sm text-[#39FF14]">{state.message}</p>
                  {state.signature && (
                    <a
                      href={`https://trashscan.io/tx/${state.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-400 hover:text-[#39FF14] mt-1 inline-block"
                    >
                      View on Trashscan: {state.signature.slice(0, 16)}...
                    </a>
                  )}
                </div>
              </div>
            )}

            {state.status === 'error' && (
              <div className="mt-4 border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-sm text-red-400">{state.message}</p>
              </div>
            )}

            {/* Collection Fix Section */}
            {fixState.nfts.length > 0 && (
              <div className="mt-8 border border-yellow-500/30 bg-yellow-500/5 p-6">
                <h3 className="font-mono text-sm text-yellow-400 mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  FIX COLLECTION ({fixState.nfts.length})
                </h3>
                <p className="text-gray-500 text-xs font-mono mb-4">
                  These migrated Gorbagios are missing their collection tag. Click to fix — your wallet will sign a metadata update.
                </p>

                <div className="space-y-3">
                  {fixState.nfts.map((nft) => (
                    <div
                      key={nft.mint}
                      className="flex items-center gap-3 border border-gray-800 bg-gray-900/50 p-3"
                    >
                      {nft.image ? (
                        <img src={nft.image} alt={nft.name} className="w-12 h-12 object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <Trash2 className="w-5 h-5 text-gray-700" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-white truncate">{nft.name}</p>
                        <p className="font-mono text-[10px] text-gray-600 truncate">
                          {nft.mint.slice(0, 8)}...{nft.mint.slice(-4)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleFixCollection(nft.mint)}
                        disabled={fixState.status === 'fixing'}
                        className={`px-4 py-2 font-mono text-xs font-bold transition-all flex-shrink-0 ${
                          fixState.fixing === nft.mint
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-yellow-500 text-black hover:bg-yellow-400'
                        }`}
                      >
                        {fixState.fixing === nft.mint ? (
                          <span className="flex items-center gap-1">
                            <Loader className="w-3 h-3 animate-spin" /> FIXING...
                          </span>
                        ) : (
                          'FIX COLLECTION'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collection Fix Status */}
            {fixState.status === 'success' && (
              <div className="mt-4 border border-[#39FF14]/30 bg-[#39FF14]/5 p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-sm text-[#39FF14]">{fixState.message}</p>
                  {fixState.signature && (
                    <a
                      href={`https://trashscan.io/tx/${fixState.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-400 hover:text-[#39FF14] mt-1 inline-block"
                    >
                      View on Trashscan: {fixState.signature.slice(0, 16)}...
                    </a>
                  )}
                </div>
              </div>
            )}

            {fixState.status === 'error' && (
              <div className="mt-4 border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-sm text-red-400">{fixState.message}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GorbagioMigration;
