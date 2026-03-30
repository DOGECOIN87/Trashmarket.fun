import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Rocket, Twitter, Globe, MessageCircle, Send, ArrowRight, Loader2, Inbox } from 'lucide-react';
import { getPendingSubmissions, getSubmissionsByWallet } from '../services/submissionService';
import { CollectionSubmission, SubmissionStatus } from '../types';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';

const SUBMISSIONS_COLLECTION = 'submissions';

async function getApprovedCollections(): Promise<CollectionSubmission[]> {
  try {
    const q = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('status', '==', SubmissionStatus.APPROVED),
      orderBy('reviewedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CollectionSubmission[];
  } catch (err) {
    console.error('[Launchpad] Failed to load approved collections:', err);
    return [];
  }
}

const Launchpad: React.FC = () => {
  const [collections, setCollections] = useState<CollectionSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApprovedCollections().then(data => {
      setCollections(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative border-b border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-magic-green/10 border border-magic-green/30 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-magic-green" />
            </div>
            <span className="text-xs font-bold text-magic-green uppercase tracking-widest font-mono">Collection Launchpad</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
            UPCOMING <span className="text-magic-green">DROPS</span>
          </h1>
          <p className="text-gray-400 font-mono text-sm max-w-xl mb-8 leading-relaxed">
            Hand-picked NFT collections launching on Trashmarket. Every project reviewed and approved by the team.
          </p>
          <Link
            to="/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-magic-green text-black font-bold text-sm uppercase tracking-wider hover:bg-[#cbf30c] transition-all"
          >
            Submit Your Collection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-magic-green animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border border-white/10 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-white font-black text-xl mb-2">No approved drops yet</h2>
            <p className="text-gray-500 text-sm font-mono mb-6">Be the first to launch on Trashmarket.</p>
            <Link
              to="/submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-magic-green/50 text-magic-green font-bold text-xs uppercase tracking-wider hover:bg-magic-green hover:text-black transition-all"
            >
              Submit a Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {collections.map(col => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function CollectionCard({ collection: col }: { collection: CollectionSubmission }) {
  const mintDate = col.mintDate ? new Date(col.mintDate) : null;
  const isUpcoming = mintDate && mintDate > new Date();
  const isMinting = mintDate && !isUpcoming;

  return (
    <div className="border border-white/10 bg-black/60 flex flex-col overflow-hidden hover:border-magic-green/30 transition-all group">
      {/* Banner */}
      <div className="relative h-36 bg-[#111] overflow-hidden">
        {col.bannerUrl ? (
          <img src={col.bannerUrl} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-magic-green/10 to-transparent" />
        )}
        {/* Status badge */}
        <div className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
          isUpcoming ? 'bg-magic-green text-black' : 'bg-white/10 text-white'
        }`}>
          {isUpcoming ? 'UPCOMING' : 'MINTING'}
        </div>
      </div>

      {/* Logo + Name */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-white/5">
        {col.logoUrl ? (
          <img src={col.logoUrl} alt={col.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/10 flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-magic-green/10 border-2 border-magic-green/20 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-5 h-5 text-magic-green" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-white font-black text-base truncate">{col.name}</h3>
          <span className="text-xs text-magic-green font-mono">{col.symbol}</span>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 flex-grow">
        <p className="text-gray-400 text-xs font-mono leading-relaxed line-clamp-3 mb-4">{col.description}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Supply" value={col.supply?.toLocaleString() ?? '—'} />
          <Stat label="Mint Price" value={col.mintPrice ? `${col.mintPrice} GOR` : 'TBA'} />
          <Stat label="Royalty" value={col.royaltyPercentage ? `${col.royaltyPercentage}%` : '—'} />
        </div>

        {mintDate && (
          <div className="border border-white/10 bg-white/5 px-3 py-2 text-center mb-4">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Mint Date</p>
            <p className="text-white font-black text-sm">
              {mintDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-3">
        {col.website && (
          <SocialLink href={col.website} icon={<Globe className="w-3.5 h-3.5" />} label="Website" />
        )}
        {col.twitter && (
          <SocialLink href={col.twitter.startsWith('http') ? col.twitter : `https://twitter.com/${col.twitter}`} icon={<Twitter className="w-3.5 h-3.5" />} label="Twitter" />
        )}
        {col.discord && (
          <SocialLink href={col.discord} icon={<MessageCircle className="w-3.5 h-3.5" />} label="Discord" />
        )}
        {col.telegram && (
          <SocialLink href={col.telegram.startsWith('http') ? col.telegram : `https://t.me/${col.telegram}`} icon={<Send className="w-3.5 h-3.5" />} label="Telegram" />
        )}
        {col.contractAddress && (
          <a
            href={`https://explorer.gorbagana.wtf/address/${col.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] text-gray-600 hover:text-magic-green font-mono flex items-center gap-1 transition-colors"
          >
            Contract <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-white font-black text-xs">{value}</p>
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="w-7 h-7 border border-white/10 flex items-center justify-center text-gray-500 hover:text-magic-green hover:border-magic-green/40 transition-all"
    >
      {icon}
    </a>
  );
}

export default Launchpad;
