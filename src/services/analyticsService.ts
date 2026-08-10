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

// Throttle: prevent duplicate counting within a short window (per query/product, per browser)
const VIEW_TTL_MS = 60 * 1000; // 1 min: same product view within 60s only counts once
const SEARCH_TTL_MS = 5 * 1000; // 5 sec: prevents accidental double-fires (debounce)

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
  // Light throttle: prevent double-fire within 5 sec from same browser
  try {
    const last = Number(localStorage.getItem(lsKey('search', id)) || '0');
    if (Date.now() - last < SEARCH_TTL_MS) return;
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
  // Sort by `lastSearched` desc — ən son axtarılan söz birinci, sonra zamana görə
  const toMs = (v: any): number =>
    v?.toMillis ? v.toMillis()
      : typeof v === 'number' ? v
      : v instanceof Date ? v.getTime()
      : v?.seconds ? v.seconds * 1000
      : 0;
  try {
    const snap = await getDocs(query(collection(db, SEARCHES_COL), orderBy('lastSearched', 'desc'), fbLimit(n)));
    return snap.docs.map((d) => ({ ...(d.data() as any) } as SearchStat));
  } catch {
    const snap = await getDocs(collection(db, SEARCHES_COL));
    return snap.docs
      .map((d) => ({ ...(d.data() as any) } as SearchStat))
      .sort((a, b) => toMs(b.lastSearched) - toMs(a.lastSearched))
      .slice(0, n);
  }
};

// Eslint helper: prevent unused warnings for getDoc
export const __ping = async () => getDoc(doc(db, VIEWS_COL, '__ping__'));

// =================================================================
// Daily visitors tracking — sayta giriş edənlərin günlük statistikası
// =================================================================
const VISITS_COL = 'daily_visits';
const VISIT_SESSION_KEY = '__dv_visit_logged'; // sessionStorage flag

const todayId = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const trackDailyVisit = async (): Promise<void> => {
  // Sessiya başına bir dəfə qeyd et (eyni browser tab-ı dəfələrlə açmasın)
  try {
    if (sessionStorage.getItem(VISIT_SESSION_KEY)) return;
    sessionStorage.setItem(VISIT_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
  try {
    const id = todayId();
    await setDoc(
      doc(db, VISITS_COL, id),
      {
        date: id,
        count: increment(1),
        lastUpdated: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackDailyVisit failed:', err);
  }
};

export interface DailyVisitStat {
  date: string; // YYYY-MM-DD
  count: number;
}

export const getDailyVisits = async (days = 30): Promise<DailyVisitStat[]> => {
  try {
    const snap = await getDocs(collection(db, VISITS_COL));
    const all = snap.docs.map((d) => ({ ...(d.data() as any) } as DailyVisitStat));
    // Son N gün üçün YYYY-MM-DD massivi qur, çatışmayanları 0 ilə doldur
    const result: DailyVisitStat[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const id = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const found = all.find((x) => x.date === id);
      result.push({ date: id, count: found?.count || 0 });
    }
    return result;
  } catch (err) {
    console.warn('getDailyVisits failed:', err);
    return [];
  }
};

// =================================================================
// Anonim cart / wishlist event tracking — qeydiyyatsız istifadəçilər
// hansı məhsulları sebete/wishlist-a əlavə etdiklərini görmək üçün
// =================================================================
const ANON_EVENTS_COL = 'anon_product_interest';

export const trackAnonProductInterest = async (
  productId: string,
  kind: 'cart' | 'wishlist',
  meta?: { name?: string; image?: string; brand?: string }
): Promise<void> => {
  if (!productId) return;
  // Qeydiyyatlı istifadəçilər customer_carts / customer_wishlists-də saxlanır
  if (localStorage.getItem('userId')) return;
  // Throttle: eyni məhsul + eyni kind, 5 dəq ərzində bir dəfə
  try {
    const k = `__dv_anon_${kind}_${productId}`;
    const last = Number(localStorage.getItem(k) || '0');
    if (Date.now() - last < 5 * 60 * 1000) return;
    localStorage.setItem(k, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    const id = `${kind}_${productId}`;
    await setDoc(
      doc(db, ANON_EVENTS_COL, id),
      {
        productId,
        kind,
        productName: meta?.name || '',
        image: meta?.image || '',
        brand: meta?.brand || '',
        count: increment(1),
        lastEvent: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackAnonProductInterest failed:', err);
  }
};

export interface AnonInterestStat {
  productId: string;
  kind: 'cart' | 'wishlist';
  productName: string;
  image: string;
  brand?: string;
  count: number;
  lastEvent?: any;
}

export const getAnonProductInterest = async (kind?: 'cart' | 'wishlist'): Promise<AnonInterestStat[]> => {
  try {
    const snap = await getDocs(collection(db, ANON_EVENTS_COL));
    const all = snap.docs.map((d) => ({ ...(d.data() as any) } as AnonInterestStat));
    const filtered = kind ? all.filter((x) => x.kind === kind) : all;
    return filtered.sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 50);
  } catch {
    return [];
  }
};

// =================================================================
// Kateqoriya baxışları — hansı kateqoriyaya neçə dəfə baxılıb
// Collection: category_view_counts/{slug} → { category, count, lastViewed }
// =================================================================
const CATEGORY_VIEWS_COL = 'category_view_counts';
const CATEGORY_DAILY_COL = 'category_view_daily';
const CATEGORY_VIEW_TTL_MS = 60 * 1000; // eyni kateqoriya 60s ərzində bir dəfə sayılır

export const trackCategoryView = async (category: string): Promise<void> => {
  const name = (category || '').trim();
  if (!name || name.toLowerCase() === 'all') return;
  const id = slugify(name);
  // Throttle by localStorage (per category, per browser)
  try {
    const key = lsKey('view', `cat_${id}`);
    const last = Number(localStorage.getItem(key) || '0');
    if (Date.now() - last < CATEGORY_VIEW_TTL_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    await setDoc(
      doc(db, CATEGORY_VIEWS_COL, id),
      {
        category: name,
        count: increment(1),
        lastViewed: Timestamp.now(),
      },
      { merge: true }
    );
    // Günlük bucket — trend hesablaması üçün (son 7/30 gün)
    await setDoc(
      doc(db, CATEGORY_DAILY_COL, `${id}__${todayId()}`),
      {
        category: name,
        date: todayId(),
        count: increment(1),
        lastViewed: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackCategoryView failed:', err);
  }
};

export interface CategoryViewStat {
  category: string;
  count: number;
  lastViewed?: any;
}

export const getCategoryViews = async (): Promise<CategoryViewStat[]> => {
  try {
    const snap = await getDocs(collection(db, CATEGORY_VIEWS_COL));
    return snap.docs
      .map((d) => ({ ...(d.data() as any) } as CategoryViewStat))
      .filter((c) => c.category)
      .sort((a, b) => (b.count || 0) - (a.count || 0));
  } catch (err) {
    console.warn('getCategoryViews failed:', err);
    return [];
  }
};

// =================================================================
// Kateqoriya trendi — son 7 / 30 gün üzrə artım-azalma
// =================================================================
export interface CategoryTrend {
  category: string;
  last7: number;
  prev7: number;
  last30: number;
  delta7: number; // last7 - prev7
  pct7: number; // faiz dəyişikliyi
}

export const getCategoryTrends = async (): Promise<CategoryTrend[]> => {
  try {
    const snap = await getDocs(collection(db, CATEGORY_DAILY_COL));
    const today = new Date();
    const dayId = (offset: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const last7 = new Set<string>();
    const prev7 = new Set<string>();
    const last30 = new Set<string>();
    for (let i = 0; i < 7; i++) last7.add(dayId(i));
    for (let i = 7; i < 14; i++) prev7.add(dayId(i));
    for (let i = 0; i < 30; i++) last30.add(dayId(i));

    const map: Record<string, CategoryTrend> = {};
    snap.docs.forEach((dref) => {
      const x = dref.data() as any;
      const cat = x.category;
      const date = x.date;
      const cnt = x.count || 0;
      if (!cat || !date) return;
      if (!map[cat]) map[cat] = { category: cat, last7: 0, prev7: 0, last30: 0, delta7: 0, pct7: 0 };
      if (last7.has(date)) map[cat].last7 += cnt;
      if (prev7.has(date)) map[cat].prev7 += cnt;
      if (last30.has(date)) map[cat].last30 += cnt;
    });
    return Object.values(map)
      .map((m) => ({
        ...m,
        delta7: m.last7 - m.prev7,
        pct7: m.prev7 > 0 ? Math.round(((m.last7 - m.prev7) / m.prev7) * 100) : m.last7 > 0 ? 100 : 0,
      }))
      .sort((a, b) => b.last7 - a.last7 || b.last30 - a.last30);
  } catch (err) {
    console.warn('getCategoryTrends failed:', err);
    return [];
  }
};

// =================================================================
// Brend baxışları — hansı brendə neçə dəfə baxılıb (ən çox / ən az)
// Collection: brand_view_counts/{slug} → { brand, count, lastViewed }
// =================================================================
const BRAND_VIEWS_COL = 'brand_view_counts';
const BRAND_VIEW_TTL_MS = 60 * 1000;

export const trackBrandView = async (brand: string): Promise<void> => {
  const name = (brand || '').trim();
  if (!name || name.toLowerCase() === 'all') return;
  const id = slugify(name);
  try {
    const key = lsKey('view', `brand_${id}`);
    const last = Number(localStorage.getItem(key) || '0');
    if (Date.now() - last < BRAND_VIEW_TTL_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    await setDoc(
      doc(db, BRAND_VIEWS_COL, id),
      {
        brand: name,
        count: increment(1),
        lastViewed: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('trackBrandView failed:', err);
  }
};

export interface BrandViewStat {
  brand: string;
  count: number;
  lastViewed?: any;
}

export const getBrandViews = async (): Promise<BrandViewStat[]> => {
  try {
    const snap = await getDocs(collection(db, BRAND_VIEWS_COL));
    return snap.docs
      .map((d) => ({ ...(d.data() as any) } as BrandViewStat))
      .filter((b) => b.brand)
      .sort((a, b) => (b.count || 0) - (a.count || 0));
  } catch (err) {
    console.warn('getBrandViews failed:', err);
    return [];
  }
};

