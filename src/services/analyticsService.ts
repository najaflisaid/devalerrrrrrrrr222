/**
 * Lightweight client-side analytics: tracks product views and search queries
 * by incrementing counters in Firestore.
 *
 * Collections:
 *   - product_view_counts/{productId}  → { count, lastViewed, productName, image }
 *   - search_query_counts/{queryHash}  → { query, count, lastSearched }
 */
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  Timestamp,
  increment,
  query,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const VIEWS_COL = 'product_view_counts';
const SEARCHES_COL = 'search_query_counts';

// Throttle: prevent counting the same product view for 30 minutes from the same browser
const VIEW_TTL_MS = 30 * 60 * 1000;

const lsKey = (kind: 'view' | 'search', id: string) => `__dv_track_${kind}_${id}`;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';

export const trackProductView = async (
  productId: string,
  meta?: { name?: string; image?: string }
): Promise<void> => {
  if (!productId) return;
  // Throttle by localStorage
  try {
    const last = Number(localStorage.getItem(lsKey('view', productId)) || '0');
    if (Date.now() - last < VIEW_TTL_MS) return;
    localStorage.setItem(lsKey('view', productId), String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    await setDoc(
      doc(db, VIEWS_COL, productId),
      {
        productId,
        productName: meta?.name || '',
        image: meta?.image || '',
        count: increment(1),
        lastViewed: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackProductView failed:', err);
  }
};

export const trackSearch = async (rawQuery: string): Promise<void> => {
  const q = (rawQuery || '').trim();
  if (q.length < 2) return;
  const id = slugify(q);
  // Throttle: don't count the same query > once per 5 min from same browser
  try {
    const last = Number(localStorage.getItem(lsKey('search', id)) || '0');
    if (Date.now() - last < 5 * 60 * 1000) return;
    localStorage.setItem(lsKey('search', id), String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    await setDoc(
      doc(db, SEARCHES_COL, id),
      {
        query: q,
        count: increment(1),
        lastSearched: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackSearch failed:', err);
  }
};

export interface ProductViewStat {
  productId: string;
  productName: string;
  image: string;
  count: number;
  lastViewed?: any;
}

export interface SearchStat {
  query: string;
  count: number;
  lastSearched?: any;
}

export const getTopViewedProducts = async (n = 20): Promise<ProductViewStat[]> => {
  try {
    const snap = await getDocs(query(collection(db, VIEWS_COL), orderBy('count', 'desc'), fbLimit(n)));
    return snap.docs.map((d) => ({ ...(d.data() as any) } as ProductViewStat));
  } catch {
    // Fallback when index is unavailable
    const snap = await getDocs(collection(db, VIEWS_COL));
    return snap.docs
      .map((d) => ({ ...(d.data() as any) } as ProductViewStat))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, n);
  }
};

export const getTopSearches = async (n = 30): Promise<SearchStat[]> => {
  try {
    const snap = await getDocs(query(collection(db, SEARCHES_COL), orderBy('count', 'desc'), fbLimit(n)));
    return snap.docs.map((d) => ({ ...(d.data() as any) } as SearchStat));
  } catch {
    const snap = await getDocs(collection(db, SEARCHES_COL));
    return snap.docs
      .map((d) => ({ ...(d.data() as any) } as SearchStat))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, n);
  }
};

// Eslint helper: prevent unused warnings for getDoc
export const __ping = async () => getDoc(doc(db, VIEWS_COL, '__ping__'));
