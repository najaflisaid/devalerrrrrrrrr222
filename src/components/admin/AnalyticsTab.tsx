import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Eye,
  Search,
  ShoppingCart,
  Heart,
  Trash2,
  RefreshCw,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Radio,
  Globe,
  Layers,
  Tag,
  TrendingUp,
} from 'lucide-react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  getTopViewedProducts,
  getTopSearches,
  getDailyVisits,
  getAnonProductInterest,
  getCategoryViews,
  getCategoryTrends,
  getBrandViews,
  type ProductViewStat,
  type SearchStat,
  type DailyVisitStat,
  type AnonInterestStat,
  type CategoryViewStat,
  type CategoryTrend,
  type BrandViewStat,
} from '../../services/analyticsService';
import { productService } from '../../services/productService';
import type { Product } from '../../types';
import { useTranslation } from 'react-i18next';
import { subscribeLiveVisitors, type LiveVisitor } from '../../services/presenceService';

interface CustomerCart {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  items: { productId: string; productName: string; image: string; quantity: number; price: number }[];
  itemCount: number;
  updatedAt?: any;
}

interface CustomerWishlist {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  productIds: string[];
  count: number;
  updatedAt?: any;
}

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const relativeTime = (raw: any): string => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}sn əvvəl`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dq əvvəl`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}s əvvəl`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}g əvvəl`;
  return formatDate(raw);
};

const AnalyticsTab: React.FC = () => {
  const { i18n } = useTranslation();
  const [tab, setTab] = useState<'overview' | 'visits' | 'anonymous' | 'carts' | 'wishlists'>('overview');
  const [topViews, setTopViews] = useState<ProductViewStat[]>([]);
  const [topSearches, setTopSearches] = useState<SearchStat[]>([]);
  const [dailyVisits, setDailyVisits] = useState<DailyVisitStat[]>([]);
  const [anonInterests, setAnonInterests] = useState<AnonInterestStat[]>([]);
  const [categoryViews, setCategoryViews] = useState<CategoryViewStat[]>([]);
  const [categoryTrends, setCategoryTrends] = useState<CategoryTrend[]>([]);
  const [brandViews, setBrandViews] = useState<BrandViewStat[]>([]);
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [wishlists, setWishlists] = useState<CustomerWishlist[]>([]);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [openWishlist, setOpenWishlist] = useState<CustomerWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Live visitor presence — real-time count of people on the site right now
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitor[]>([]);
  useEffect(() => {
    const unsub = subscribeLiveVisitors(setLiveVisitors);
    return () => unsub();
  }, []);
  // "Daha çox" toggles per list to avoid endlessly stretching pages
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const VISIBLE_LIMIT = 5;

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
  const getName = (p?: Product) =>
    p ? p.name?.[lang] || p.name?.en || p.name?.az || '' : '';

  const load = async () => {
    setLoading(true);
    try {
      const [v, s, visits, anons, cartsSnap, wlSnap, products, cats, catTrends, brands] = await Promise.all([
        getTopViewedProducts(20),
        getTopSearches(30),
        getDailyVisits(30),
        getAnonProductInterest(),
        getDocs(collection(db, 'customer_carts')),
        getDocs(collection(db, 'customer_wishlists')),
        productService.getAll(true).catch(() => [] as Product[]),
        getCategoryViews(),
        getCategoryTrends(),
        getBrandViews(),
      ]);
      setTopViews(v);
      setTopSearches(s);
      setDailyVisits(visits);
      setAnonInterests(anons);
      setCategoryViews(cats);
      setCategoryTrends(catTrends);
      setBrandViews(brands);
      const pm: Record<string, Product> = {};
      products.forEach((p) => {
        pm[p.id] = p;
      });
      setProductMap(pm);
      setCarts(
        cartsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as CustomerCart))
          .filter((c) => (c.items || []).length > 0)
          .sort((a, b) => {
            const aT = (a.updatedAt as any)?.toMillis ? (a.updatedAt as any).toMillis() : 0;
            const bT = (b.updatedAt as any)?.toMillis ? (b.updatedAt as any).toMillis() : 0;
            return bT - aT;
          })
      );
      setWishlists(
        wlSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as CustomerWishlist))
          .filter((w) => (w.productIds || []).length > 0)
          .sort((a, b) => {
            const aT = (a.updatedAt as any)?.toMillis ? (a.updatedAt as any).toMillis() : 0;
            const bT = (b.updatedAt as any)?.toMillis ? (b.updatedAt as any).toMillis() : 0;
            return bT - aT;
          })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDeleteSearch = async (query: string) => {
    if (!confirm(`"${query}" axtarış statistikasını silmək istəyirsiniz?`)) return;
    const id = query
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown';
    try {
      await deleteDoc(doc(db, 'search_query_counts', id));
      await load();
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteView = async (productId: string, productName: string) => {    if (!confirm(`"${productName || productId}" baxış statistikasını silmək istəyirsiniz?`)) return;
    try {
      await deleteDoc(doc(db, 'product_view_counts', productId));
      setTopViews((prev) => prev.filter((v) => v.productId !== productId));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteCategoryView = async (category: string) => {
    if (!confirm(`"${category}" kateqoriya baxış statistikasını silmək istəyirsiniz?`)) return;
    const id = category
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown';
    try {
      await deleteDoc(doc(db, 'category_view_counts', id));
      setCategoryViews((prev) => prev.filter((c) => c.category !== category));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteBrandView = async (brand: string) => {
    if (!confirm(`"${brand}" brend baxış statistikasını silmək istəyirsiniz?`)) return;
    const id = brand
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown';
    try {
      await deleteDoc(doc(db, 'brand_view_counts', id));
      setBrandViews((prev) => prev.filter((b) => b.brand !== brand));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteCart = async (cartId: string, userName: string) => {
    if (!confirm(`${userName || 'Bu müştəri'} üçün tüm səbəti silmək istəyirsiniz?`)) return;
    try {
      await deleteDoc(doc(db, 'customer_carts', cartId));
      setCarts((prev) => prev.filter((c) => c.id !== cartId));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteCartItem = async (cartId: string, productId: string, productName: string) => {
    if (!confirm(`Səbətdən "${productName}" silinsin?`)) return;
    const cart = carts.find((c) => c.id === cartId);
    if (!cart) return;
    const newItems = (cart.items || []).filter((it) => it.productId !== productId);
    try {
      if (newItems.length === 0) {
        await deleteDoc(doc(db, 'customer_carts', cartId));
        setCarts((prev) => prev.filter((c) => c.id !== cartId));
      } else {
        const itemCount = newItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
        await updateDoc(doc(db, 'customer_carts', cartId), {
          items: newItems,
          itemCount,
        });
        setCarts((prev) => prev.map((c) => (c.id === cartId ? { ...c, items: newItems, itemCount } : c)));
      }
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteWishlist = async (wishlistId: string, userName: string) => {
    if (!confirm(`${userName || 'Bu müştəri'} üçün bütün wishlist silinsin?`)) return;
    try {
      await deleteDoc(doc(db, 'customer_wishlists', wishlistId));
      setWishlists((prev) => prev.filter((w) => w.id !== wishlistId));
      if (openWishlist?.id === wishlistId) setOpenWishlist(null);
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleDeleteWishlistItem = async (wishlistId: string, productId: string) => {
    if (!confirm(`Wishlist-dən bu məhsul silinsin?`)) return;
    const wl = wishlists.find((w) => w.id === wishlistId);
    if (!wl) return;
    const newIds = (wl.productIds || []).filter((p) => p !== productId);
    try {
      if (newIds.length === 0) {
        await deleteDoc(doc(db, 'customer_wishlists', wishlistId));
        setWishlists((prev) => prev.filter((w) => w.id !== wishlistId));
        if (openWishlist?.id === wishlistId) setOpenWishlist(null);
      } else {
        await updateDoc(doc(db, 'customer_wishlists', wishlistId), {
          productIds: arrayRemove(productId),
          count: newIds.length,
        });
        const updated = { ...wl, productIds: newIds, count: newIds.length };
        setWishlists((prev) => prev.map((w) => (w.id === wishlistId ? updated : w)));
        if (openWishlist?.id === wishlistId) setOpenWishlist(updated);
      }
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analytics-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analitika</h2>
          <p className="text-sm text-gray-500">Sayt fəaliyyəti və müştəri davranışı</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      <LiveVisitorsBanner visitors={liveVisitors} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Eye />}
          label="Ümumi məhsul baxışları"
          value={topViews.reduce((sum, v) => sum + (v.count || 0), 0)}
          unit={`${topViews.length} unikal məhsul`}
        />
        <StatCard
          icon={<Search />}
          label="Ümumi axtarışlar"
          value={topSearches.reduce((sum, s) => sum + (s.count || 0), 0)}
          unit={`${topSearches.length} unikal sorğu`}
        />
        <StatCard
          icon={<ShoppingCart />}
          label="Aktiv səbətlər"
          value={carts.length}
          unit={`${carts.reduce((sum, c) => sum + (c.itemCount || 0), 0)} ümumi məhsul`}
        />
        <StatCard
          icon={<Heart />}
          label="Wishlist-lər"
          value={wishlists.length}
          unit={`${wishlists.reduce((sum, w) => sum + (w.count || 0), 0)} ümumi məhsul`}
        />
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'overview', label: 'Ümumi statistika' },
          { id: 'visits', label: 'Günlük ziyarətçilər' },
          { id: 'anonymous', label: 'Qeydiyyatsız maraq' },
          { id: 'carts', label: 'Müştəri səbətləri' },
          { id: 'wishlists', label: 'Wishlist-lər' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
            data-testid={`analytics-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top viewed products */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Ən çox baxılan məhsullar</h3>
            </div>
            {topViews.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Hələ baxış statistikası yoxdur</p>
            ) : (
              <>
                <ol className="space-y-2">
                  {(expanded['topViews'] ? topViews : topViews.slice(0, VISIBLE_LIMIT)).map((v, i) => (
                    <li key={v.productId} className="flex items-center gap-3 text-sm group" data-testid={`top-view-${i}`}>
                      <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                      {v.image ? (
                        <img src={v.image} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-gray-900">{v.productName || v.productId}</p>
                        {v.lastViewed && (
                          <p className="text-[10px] text-gray-400 truncate">son: {relativeTime(v.lastViewed)}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{v.count}</span>
                      <button
                        onClick={() => handleDeleteView(v.productId, v.productName)}
                        className="text-gray-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Sil"
                        data-testid={`delete-view-${v.productId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>
                {topViews.length > VISIBLE_LIMIT && (
                  <button
                    onClick={() => toggle('topViews')}
                    className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
                    data-testid="toggle-top-views"
                  >
                    {expanded['topViews'] ? (
                      <><ChevronUp className="h-3.5 w-3.5" /> Daha az göstər</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5" /> Daha çox göstər ({topViews.length - VISIBLE_LIMIT})</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Top searches */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Ən son axtarılan sözlər</h3>
            </div>
            {topSearches.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Hələ axtarış statistikası yoxdur</p>
            ) : (
              <>
                <ol className="space-y-1.5">
                  {(expanded['topSearches'] ? topSearches : topSearches.slice(0, VISIBLE_LIMIT)).map((s, i) => (
                    <li
                      key={s.query}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg text-sm group"
                      data-testid={`top-search-${i}`}
                    >
                      <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-gray-900">"{s.query}"</p>
                        {s.lastSearched && (
                          <p className="text-[10px] text-gray-400">son: {relativeTime(s.lastSearched)}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{s.count}</span>
                      <button
                        onClick={() => handleDeleteSearch(s.query)}
                        className="text-gray-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Sil"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ol>
                {topSearches.length > VISIBLE_LIMIT && (
                  <button
                    onClick={() => toggle('topSearches')}
                    className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
                    data-testid="toggle-top-searches"
                  >
                    {expanded['topSearches'] ? (
                      <><ChevronUp className="h-3.5 w-3.5" /> Daha az göstər</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5" /> Daha çox göstər ({topSearches.length - VISIBLE_LIMIT})</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Category views — most / least viewed categories */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2" data-testid="category-views-card">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Kateqoriya baxışları</h3>
              <span className="ml-auto text-xs text-gray-400">
                Cəmi {categoryViews.reduce((s, c) => s + (c.count || 0), 0)} baxış · {categoryViews.length} kateqoriya
              </span>
            </div>
            {categoryViews.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Hələ kateqoriya baxış statistikası yoxdur</p>
            ) : (
              <>
                {(() => {
                  const max = Math.max(1, ...categoryViews.map((c) => c.count || 0));
                  const most = categoryViews[0];
                  const least = categoryViews[categoryViews.length - 1];
                  const list = expanded['categoryViews'] ? categoryViews : categoryViews.slice(0, VISIBLE_LIMIT);
                  return (
                    <>
                      {/* Highlight: most vs least */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" data-testid="category-most-viewed">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-0.5">Ən çox baxılan</p>
                          <p className="text-sm font-bold text-emerald-900 truncate">{most.category}</p>
                          <p className="text-xs text-emerald-700 mt-0.5">{most.count} dəfə baxılıb</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="category-least-viewed">
                          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-0.5">Ən az baxılan</p>
                          <p className="text-sm font-bold text-amber-900 truncate">{least.category}</p>
                          <p className="text-xs text-amber-700 mt-0.5">{least.count} dəfə baxılıb</p>
                        </div>
                      </div>

                      <ol className="space-y-2.5">
                        {list.map((c, i) => {
                          const pct = Math.round(((c.count || 0) / max) * 100);
                          return (
                            <li key={c.category} className="group" data-testid={`category-view-${i}`}>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-gray-900">{c.category}</p>
                                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                                      {c.count} <span className="text-[10px] font-normal text-gray-400">dəfə</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteCategoryView(c.category)}
                                  className="text-gray-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Sil"
                                  data-testid={`delete-category-view-${i}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ol>

                      {categoryViews.length > VISIBLE_LIMIT && (
                        <button
                          onClick={() => toggle('categoryViews')}
                          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
                          data-testid="toggle-category-views"
                        >
                          {expanded['categoryViews'] ? (
                            <><ChevronUp className="h-3.5 w-3.5" /> Daha az göstər</>
                          ) : (
                            <><ChevronDown className="h-3.5 w-3.5" /> Daha çox göstər ({categoryViews.length - VISIBLE_LIMIT})</>
                          )}
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* Brand views — most / least viewed brands */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2" data-testid="brand-views-card">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Brend baxışları</h3>
              <span className="ml-auto text-xs text-gray-400">
                Cəmi {brandViews.reduce((s, b) => s + (b.count || 0), 0)} baxış · {brandViews.length} brend
              </span>
            </div>
            {brandViews.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Hələ brend baxış statistikası yoxdur</p>
            ) : (
              <>
                {(() => {
                  const max = Math.max(1, ...brandViews.map((b) => b.count || 0));
                  const most = brandViews[0];
                  const least = brandViews[brandViews.length - 1];
                  const list = expanded['brandViews'] ? brandViews : brandViews.slice(0, VISIBLE_LIMIT);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" data-testid="brand-most-viewed">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold mb-0.5">Ən çox baxılan</p>
                          <p className="text-sm font-bold text-emerald-900 truncate">{most.brand}</p>
                          <p className="text-xs text-emerald-700 mt-0.5">{most.count} dəfə baxılıb</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="brand-least-viewed">
                          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-0.5">Ən az baxılan</p>
                          <p className="text-sm font-bold text-amber-900 truncate">{least.brand}</p>
                          <p className="text-xs text-amber-700 mt-0.5">{least.count} dəfə baxılıb</p>
                        </div>
                      </div>
                      <ol className="space-y-2.5">
                        {list.map((b, i) => {
                          const pct = Math.round(((b.count || 0) / max) * 100);
                          return (
                            <li key={b.brand} className="group" data-testid={`brand-view-${i}`}>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-gray-900">{b.brand}</p>
                                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                                      {b.count} <span className="text-[10px] font-normal text-gray-400">dəfə</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteBrandView(b.brand)}
                                  className="text-gray-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Sil"
                                  data-testid={`delete-brand-view-${i}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                      {brandViews.length > VISIBLE_LIMIT && (
                        <button
                          onClick={() => toggle('brandViews')}
                          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
                          data-testid="toggle-brand-views"
                        >
                          {expanded['brandViews'] ? (
                            <><ChevronUp className="h-3.5 w-3.5" /> Daha az göstər</>
                          ) : (
                            <><ChevronDown className="h-3.5 w-3.5" /> Daha çox göstər ({brandViews.length - VISIBLE_LIMIT})</>
                          )}
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* Category trend — last 7 / 30 days */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2" data-testid="category-trend-card">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Kateqoriya trendi</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Son 7 günün əvvəlki 7 günə nisbəti · son 30 gün cəmi</p>
            {categoryTrends.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                Trend məlumatı hələ toplanır (bu funksiya əlavə olunandan sonrakı günlər üçün)
              </p>
            ) : (
              <>
                <ol className="space-y-2">
                  {(expanded['categoryTrends'] ? categoryTrends : categoryTrends.slice(0, VISIBLE_LIMIT)).map((c, i) => {
                    const up = c.delta7 > 0;
                    const flat = c.delta7 === 0;
                    return (
                      <li
                        key={c.category}
                        className="flex items-center gap-3 text-sm px-2 py-1.5 hover:bg-gray-50 rounded-lg"
                        data-testid={`category-trend-${i}`}
                      >
                        <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                        <p className="flex-1 min-w-0 truncate text-gray-900">{c.category}</p>
                        <div className="text-right w-12">
                          <p className="text-[10px] text-gray-400 leading-none">7 gün</p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{c.last7}</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full min-w-[64px] justify-center ${
                            flat
                              ? 'bg-gray-100 text-gray-500'
                              : up
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {flat ? '—' : up ? '↑' : '↓'}{' '}
                          {c.prev7 > 0 ? `${c.pct7 >= 0 ? '+' : ''}${c.pct7}%` : c.last7 > 0 ? 'yeni' : '0'}
                        </span>
                        <div className="text-right w-14">
                          <p className="text-[10px] text-gray-400 leading-none">30 gün</p>
                          <p className="text-sm font-semibold text-gray-700 tabular-nums">{c.last30}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {categoryTrends.length > VISIBLE_LIMIT && (
                  <button
                    onClick={() => toggle('categoryTrends')}
                    className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
                    data-testid="toggle-category-trends"
                  >
                    {expanded['categoryTrends'] ? (
                      <><ChevronUp className="h-3.5 w-3.5" /> Daha az göstər</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5" /> Daha çox göstər ({categoryTrends.length - VISIBLE_LIMIT})</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-700" />
                Son 30 günün ziyarətçi sayı
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Hər sessiya unikal sayılır. Cəmi {dailyVisits.reduce((s, v) => s + v.count, 0)} ziyarət
              </p>
            </div>
            {(() => {
              const last7 = dailyVisits.slice(-7).reduce((s, v) => s + v.count, 0);
              const prev7 = dailyVisits.slice(-14, -7).reduce((s, v) => s + v.count, 0);
              const diff = last7 - prev7;
              const pct = prev7 > 0 ? Math.round((diff / prev7) * 100) : 0;
              return (
                <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  diff >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  Son 7 gün: {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} ({pct >= 0 ? '+' : ''}{pct}%)
                </div>
              );
            })()}
          </div>

          {/* Bar chart — pure SVG, no lib */}
          {dailyVisits.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">Hələ ziyarət statistikası yoxdur</p>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
              <div className="min-w-[600px]">
                {(() => {
                  const max = Math.max(1, ...dailyVisits.map((v) => v.count));
                  const W = 760, H = 220, P = 30;
                  const bw = (W - P * 2) / dailyVisits.length;
                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
                      {/* Y axis ticks */}
                      {[0, 0.5, 1].map((r) => {
                        const y = H - P - r * (H - P * 2);
                        const val = Math.round(max * r);
                        return (
                          <g key={r}>
                            <line x1={P} x2={W - P} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
                            <text x={4} y={y + 3} fontSize="10" fill="#9ca3af">{val}</text>
                          </g>
                        );
                      })}
                      {/* Bars */}
                      {dailyVisits.map((v, i) => {
                        const h = (v.count / max) * (H - P * 2);
                        const x = P + i * bw + 2;
                        const y = H - P - h;
                        const isToday = i === dailyVisits.length - 1;
                        return (
                          <g key={v.date}>
                            <rect
                              x={x}
                              y={y}
                              width={Math.max(2, bw - 4)}
                              height={h}
                              fill={isToday ? '#111827' : '#9ca3af'}
                              rx={2}
                              data-testid={`daily-visit-bar-${v.date}`}
                            >
                              <title>{v.date}: {v.count} ziyarət</title>
                            </rect>
                            {(i % 5 === 0 || isToday) && (
                              <text x={x + bw / 2 - 2} y={H - 8} fontSize="9" fill="#6b7280" textAnchor="middle">
                                {v.date.slice(5)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Detailed daily list */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            {dailyVisits.slice(-10).reverse().map((v) => (
              <div key={v.date} className="bg-gray-50 rounded-lg p-2 border border-gray-100" data-testid={`visit-day-${v.date}`}>
                <p className="text-[10px] text-gray-400">{v.date.slice(5)}</p>
                <p className="text-base font-bold text-gray-900">{v.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'anonymous' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-700" />
              Qeydiyyatsız istifadəçilərin marağı
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Sayta giriş etmədən səbətə və ya wishlist-ə əlavə edilən məhsullar (anonim, məhsul ID + kind əsasında qruplaşır)
            </p>
          </div>
          {anonInterests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">Hələ qeydiyyatsız maraq qeydi yoxdur</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {anonInterests.map((a) => (
                <div
                  key={`${a.kind}_${a.productId}`}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  data-testid={`anon-interest-${a.kind}-${a.productId}`}
                >
                  {a.image ? (
                    <img src={a.image} alt="" className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-md flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        a.kind === 'cart' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                      }`}>
                        {a.kind === 'cart' ? 'Səbət' : 'Wishlist'}
                      </span>
                      {a.brand && <span className="text-[10px] text-gray-500 truncate">{a.brand}</span>}
                    </div>
                    <p className="text-sm text-gray-900 truncate">{a.productName || a.productId}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">son: {relativeTime(a.lastEvent)}</p>
                  </div>
                  <span className="text-base font-bold text-gray-900 tabular-nums flex-shrink-0">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'carts' && (
        <div className="space-y-3">
          {carts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <ShoppingCart className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Heç bir müştərinin səbətində məhsul yoxdur</p>
            </div>
          ) : (
            <>
              {(expanded['carts'] ? carts : carts.slice(0, VISIBLE_LIMIT)).map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`cart-${c.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{c.userName || 'Adsız müştəri'}</p>
                    <p className="text-xs text-gray-500 truncate">{c.userEmail}</p>
                    {c.userPhone && (
                      <p className="text-xs text-gray-500" data-testid={`cart-phone-${c.id}`}>{c.userPhone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-gray-500">Yenilənib: {formatDate(c.updatedAt)}</p>
                      <p className="text-gray-900 font-medium">{c.itemCount} ədəd</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCart(c.id, c.userName)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Bütün səbəti sil"
                      data-testid={`delete-cart-${c.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(c.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm group">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-9 h-9 object-cover rounded" />
                      ) : (
                        <div className="w-9 h-9 bg-gray-200 rounded" />
                      )}
                      <span className="flex-1 truncate">{item.productName}</span>
                      <span className="text-gray-500 text-xs">×{item.quantity}</span>
                      <span className="font-semibold text-gray-900">
                        {(item.price * item.quantity).toFixed(2)} AZN
                      </span>
                      <button
                        onClick={() => handleDeleteCartItem(c.id, item.productId, item.productName)}
                        className="text-gray-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Bu məhsulu sil"
                        data-testid={`delete-cart-item-${c.id}-${item.productId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {carts.length > VISIBLE_LIMIT && (
              <button
                onClick={() => toggle('carts')}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2.5 border border-dashed border-gray-200 transition-colors"
                data-testid="toggle-carts"
              >
                {expanded['carts'] ? (
                  <><ChevronUp className="h-4 w-4" /> Daha az göstər</>
                ) : (
                  <><ChevronDown className="h-4 w-4" /> Daha çox göstər ({carts.length - VISIBLE_LIMIT})</>
                )}
              </button>
            )}
            </>
          )}
        </div>
      )}

      {tab === 'wishlists' && (
        <div className="space-y-3">
          {wishlists.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Heart className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Heç bir müştərinin wishlist-ində məhsul yoxdur</p>
            </div>
          ) : (
            <>
              {(expanded['wishlists'] ? wishlists : wishlists.slice(0, VISIBLE_LIMIT)).map((w) => (
              <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`wishlist-${w.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{w.userName || 'Adsız müştəri'}</p>
                    <p className="text-xs text-gray-500 truncate">{w.userEmail}</p>
                    {w.userPhone && (
                      <p className="text-xs text-gray-500" data-testid={`wishlist-phone-${w.id}`}>{w.userPhone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-gray-500">Yenilənib: {formatDate(w.updatedAt)}</p>
                      <p className="text-gray-900 font-medium">{w.count} məhsul</p>
                    </div>
                    <button
                      onClick={() => handleDeleteWishlist(w.id, w.userName)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Bütün wishlist-i sil"
                      data-testid={`delete-wishlist-${w.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {(w.productIds || []).map((pid) => {
                    const p = productMap[pid];
                    const img = p?.images?.[0];
                    const name = getName(p) || pid;
                    return (
                      <div key={pid} className="relative group">
                        <button
                          onClick={() => setOpenWishlist(w)}
                          title={name}
                          className="block w-12 h-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200 hover:border-gray-900 hover:shadow-md transition-all"
                          data-testid={`wishlist-thumb-${w.id}-${pid}`}
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400 font-mono px-1 text-center">
                              {pid.slice(0, 6)}
                            </div>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWishlistItem(w.id, pid);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                          title="Bu məhsulu sil"
                          data-testid={`delete-wishlist-item-${w.id}-${pid}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {wishlists.length > VISIBLE_LIMIT && (
              <button
                onClick={() => toggle('wishlists')}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2.5 border border-dashed border-gray-200 transition-colors"
                data-testid="toggle-wishlists"
              >
                {expanded['wishlists'] ? (
                  <><ChevronUp className="h-4 w-4" /> Daha az göstər</>
                ) : (
                  <><ChevronDown className="h-4 w-4" /> Daha çox göstər ({wishlists.length - VISIBLE_LIMIT})</>
                )}
              </button>
            )}
            </>
          )}
        </div>
      )}

      {/* Wishlist details modal */}
      {openWishlist && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setOpenWishlist(null)}
          data-testid="wishlist-modal"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Heart className="h-4 w-4 fill-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base truncate">
                    {openWishlist.userName || 'Adsız müştəri'} — Wishlist
                  </h3>
                  <p className="text-xs text-white/70 truncate">
                    {openWishlist.userEmail} · {openWishlist.count} məhsul
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpenWishlist(null)}
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex-shrink-0"
                data-testid="wishlist-modal-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(openWishlist.productIds || []).map((pid) => {
                const p = productMap[pid];
                const img = p?.images?.[0];
                const name = getName(p);
                const price = p?.salePrice || p?.price;
                const original = p?.salePrice ? p?.price : null;
                return (
                  <div
                    key={pid}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                    data-testid={`wishlist-modal-item-${pid}`}
                  >
                    <a
                      href={`/product/${pid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                        {img ? (
                          <img src={img} alt={name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-mono">
                            N/A
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {name || <span className="font-mono text-xs text-gray-500">{pid}</span>}
                        </p>
                        {p?.brand && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{p.brand}</p>
                        )}
                        {price !== undefined && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {original ? (
                              <>
                                <span className="text-[11px] text-gray-400 line-through">
                                  {original.toFixed(2)} AZN
                                </span>
                                <span className="text-xs font-semibold text-red-500">
                                  {price.toFixed(2)} AZN
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-gray-900">
                                {price.toFixed(2)} AZN
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-900 transition-colors flex-shrink-0" />
                    </a>
                    <button
                      onClick={() => handleDeleteWishlistItem(openWishlist.id, pid)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                      title="Sil"
                      data-testid={`wishlist-modal-delete-${pid}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LiveVisitorsBanner: React.FC<{ visitors: LiveVisitor[] }> = ({ visitors }) => {
  const count = visitors.length;
  // Group by simplified path so we can show the busiest 3 pages
  const pageBuckets: Record<string, number> = {};
  visitors.forEach((v) => {
    const p = (v.path || '/').split('?')[0].replace(/\/+$/, '') || '/';
    pageBuckets[p] = (pageBuckets[p] || 0) + 1;
  });
  const topPages = Object.entries(pageBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
      data-testid="live-visitors-banner"
    >
      {/* Ambient dots */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.55) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.35) 0%, transparent 40%)',
      }} />
      <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-5">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
            <Radio className="h-6 w-6" strokeWidth={2.2} />
            <span aria-hidden="true" className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white">
              <span className="absolute inset-0 rounded-full bg-emerald-300 animate-ping" />
              <span className="absolute inset-[3px] rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold tracking-[0.14em] text-white/80">Canlı ziyarətçilər</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums" data-testid="live-visitors-count">{count}</span>
              <span className="text-sm text-white/85">{count === 1 ? 'nəfər saytdadır' : 'nəfər hazırda saytdadır'}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {topPages.length > 0 ? (
            <div>
              <div className="text-[11px] uppercase font-semibold tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Ən çox baxılan səhifələr
              </div>
              <div className="flex flex-wrap gap-1.5">
                {topPages.map(([path, n]) => (
                  <span
                    key={path}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm text-[11px] font-medium border border-white/20"
                    title={path}
                  >
                    <span className="font-bold tabular-nums">{n}</span>
                    <span className="opacity-90 truncate max-w-[180px]">{path === '/' ? 'Ana səhifə' : path}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/80 italic">
              Hazırda heç kim yoxdur — real-time olaraq yenilənəcək.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; unit: string }> = ({
  icon,
  label,
  value,
  unit,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-3.5">
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
    <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
    <p className="text-[10px] text-gray-400 mt-0.5">{unit}</p>
  </div>
);

export default AnalyticsTab;
