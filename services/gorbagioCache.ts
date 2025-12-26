import { db } from '../firebase.config';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  Timestamp,
  query,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { Collection, NFT } from '../types';

// Cache configuration
const CACHE_COLLECTION = 'gorbagioCache';
const METADATA_DOC = 'metadata';
const NFTS_COLLECTION = 'nfts';

// Cache duration: 1 hour (in milliseconds)
const CACHE_DURATION_MS = 60 * 60 * 1000;

interface CacheMetadata {
  lastSynced: Timestamp;
  totalCount: number;
  collectionData: Collection;
  apiSource: string;
}

interface CachedNFT extends NFT {
  cachedAt: Timestamp;
}

/**
 * Check if cache is still valid (not expired)
 */
export const isCacheValid = async (): Promise<boolean> => {
  try {
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return false;
    }

    const metadata = metaSnap.data() as CacheMetadata;
    const lastSynced = metadata.lastSynced.toMillis();
    const now = Date.now();

    return (now - lastSynced) < CACHE_DURATION_MS;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Get cache age in minutes
 */
export const getCacheAge = async (): Promise<number | null> => {
  try {
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return null;
    }

    const metadata = metaSnap.data() as CacheMetadata;
    const lastSynced = metadata.lastSynced.toMillis();
    const now = Date.now();

    return Math.floor((now - lastSynced) / (60 * 1000));
  } catch (error) {
    console.error('Error getting cache age:', error);
    return null;
  }
};

/**
 * Get cached collection metadata
 */
export const getCachedCollection = async (): Promise<Collection | null> => {
  try {
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return null;
    }

    const metadata = metaSnap.data() as CacheMetadata;
    return metadata.collectionData;
  } catch (error) {
    console.error('Error getting cached collection:', error);
    return null;
  }
};

/**
 * Get cached NFTs with pagination
 */
export const getCachedNFTs = async (options?: {
  limit?: number;
  offset?: number;
}): Promise<{ nfts: NFT[]; total: number }> => {
  try {
    // Get total count from metadata
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return { nfts: [], total: 0 };
    }

    const metadata = metaSnap.data() as CacheMetadata;
    const total = metadata.totalCount;

    // Get NFTs from subcollection
    const nftsRef = collection(db, CACHE_COLLECTION, METADATA_DOC, NFTS_COLLECTION);
    const nftsQuery = query(
      nftsRef,
      orderBy('name'),
      ...(options?.limit ? [firestoreLimit(options.limit)] : [])
    );

    const nftsSnap = await getDocs(nftsQuery);

    let nfts: NFT[] = nftsSnap.docs.map(doc => {
      const data = doc.data() as CachedNFT;
      // Remove the cachedAt field when returning
      const { cachedAt, ...nft } = data;
      return nft as NFT;
    });

    // Apply offset manually (Firestore doesn't have native offset)
    if (options?.offset) {
      nfts = nfts.slice(options.offset);
    }

    return { nfts, total };
  } catch (error) {
    console.error('Error getting cached NFTs:', error);
    return { nfts: [], total: 0 };
  }
};

/**
 * Save collection and NFTs to cache
 */
export const saveToCache = async (
  collectionData: Collection,
  nfts: NFT[]
): Promise<boolean> => {
  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Save metadata
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metadata: CacheMetadata = {
      lastSynced: now,
      totalCount: nfts.length,
      collectionData,
      apiSource: 'https://gorapi.onrender.com/api/gorbagios'
    };
    batch.set(metaRef, metadata);

    // Commit metadata first
    await batch.commit();

    // Save NFTs in batches (Firestore limit is 500 per batch)
    const BATCH_SIZE = 400;
    for (let i = 0; i < nfts.length; i += BATCH_SIZE) {
      const nftBatch = writeBatch(db);
      const chunk = nfts.slice(i, i + BATCH_SIZE);

      for (const nft of chunk) {
        const nftRef = doc(db, CACHE_COLLECTION, METADATA_DOC, NFTS_COLLECTION, nft.id);
        const cachedNFT: CachedNFT = {
          ...nft,
          cachedAt: now
        };
        nftBatch.set(nftRef, cachedNFT);
      }

      await nftBatch.commit();
    }

    console.log(`Cached ${nfts.length} Gorbagios to Firestore`);
    return true;
  } catch (error) {
    console.error('Error saving to cache:', error);
    return false;
  }
};

/**
 * Clear the cache
 */
export const clearCache = async (): Promise<boolean> => {
  try {
    // Get all NFT docs
    const nftsRef = collection(db, CACHE_COLLECTION, METADATA_DOC, NFTS_COLLECTION);
    const nftsSnap = await getDocs(nftsRef);

    // Delete in batches
    const BATCH_SIZE = 400;
    const docs = nftsSnap.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + BATCH_SIZE);

      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }

      await batch.commit();
    }

    // Delete metadata
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const batch = writeBatch(db);
    batch.delete(metaRef);
    await batch.commit();

    console.log('Cache cleared');
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
};

/**
 * Get cache status info
 */
export const getCacheStatus = async (): Promise<{
  hasCachedData: boolean;
  lastSynced: Date | null;
  ageMinutes: number | null;
  totalCached: number;
  isValid: boolean;
}> => {
  try {
    const metaRef = doc(db, CACHE_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (!metaSnap.exists()) {
      return {
        hasCachedData: false,
        lastSynced: null,
        ageMinutes: null,
        totalCached: 0,
        isValid: false
      };
    }

    const metadata = metaSnap.data() as CacheMetadata;
    const lastSyncedMs = metadata.lastSynced.toMillis();
    const now = Date.now();
    const ageMinutes = Math.floor((now - lastSyncedMs) / (60 * 1000));

    return {
      hasCachedData: true,
      lastSynced: new Date(lastSyncedMs),
      ageMinutes,
      totalCached: metadata.totalCount,
      isValid: (now - lastSyncedMs) < CACHE_DURATION_MS
    };
  } catch (error) {
    console.error('Error getting cache status:', error);
    return {
      hasCachedData: false,
      lastSynced: null,
      ageMinutes: null,
      totalCached: 0,
      isValid: false
    };
  }
};
