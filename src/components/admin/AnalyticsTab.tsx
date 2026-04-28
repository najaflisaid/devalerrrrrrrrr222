import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Eye,
  Search,
  ShoppingCart,
  Heart,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  getTopViewedProducts,
  getTopSearches,
  type ProductViewStat,
  type SearchStat,
} from '../../services/analyticsService';

interface CustomerCart {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: { productId: string; productName: string; image: string; quantity: number; price: number }[];
  itemCount: number;
  updatedAt?: any;
}

interface CustomerWishlist {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
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

const AnalyticsTab: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'carts' | 'wishlists'>('overview');
  const [topViews, setTopViews] = useState<ProductViewStat[]>([]);
  const [topSearches, setTopSearches] = useState<SearchStat[]>([]);
  const [carts, setCarts] = useState<CustomerCart[]>([]);
  const [wishlists, setWishlists] = useState<CustomerWishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [v, s, cartsSnap, wlSnap] = await Promise.all([
        getTopViewedProducts(20),
        getTopSearches(30),
        getDocs(collection(db, 'customer_carts')),
        getDocs(collection(db, 'customer_wishlists')),
      ]);
      setTopViews(v);
      setTopSearches(s);
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Eye />} label="Ən çox baxılan" value={topViews.length} unit="məhsul" />
        <StatCard icon={<Search />} label="Axtarış sorğuları" value={topSearches.length} unit="unikal" />
        <StatCard icon={<ShoppingCart />} label="Aktiv səbətlər" value={carts.length} unit="müştəri" />
        <StatCard icon={<Heart />} label="Wishlist-lər" value={wishlists.length} unit="müştəri" />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Ümumi statistika' },
          { id: 'carts', label: 'Müştəri səbətləri' },
          { id: 'wishlists', label: 'Wishlist-lər' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
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
              <ol className="space-y-2">
                {topViews.map((v, i) => (
                  <li key={v.productId} className="flex items-center gap-3 text-sm" data-testid={`top-view-${i}`}>
                    <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                    {v.image ? (
                      <img src={v.image} alt="" className="w-8 h-8 object-cover rounded" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded" />
                    )}
                    <span className="flex-1 truncate text-gray-900">{v.productName || v.productId}</span>
                    <span className="text-sm font-bold text-gray-900">{v.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Top searches */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-gray-700" />
              <h3 className="font-semibold text-gray-900">Ən çox axtarılan sözlər</h3>
            </div>
            {topSearches.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Hələ axtarış statistikası yoxdur</p>
            ) : (
              <ol className="space-y-1.5">
                {topSearches.map((s, i) => (
                  <li
                    key={s.query}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg text-sm"
                    data-testid={`top-search-${i}`}
                  >
                    <span className="text-xs font-mono text-gray-400 w-5 text-center">{i + 1}</span>
                    <span className="flex-1 truncate text-gray-900">"{s.query}"</span>
                    <span className="text-sm font-bold text-gray-900">{s.count}</span>
                    <button
                      onClick={() => handleDeleteSearch(s.query)}
                      className="text-gray-300 hover:text-red-600 p-1"
                      title="Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
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
            carts.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`cart-${c.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{c.userName || 'Adsız müştəri'}</p>
                    <p className="text-xs text-gray-500 truncate">{c.userEmail}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-500">Yenilənib: {formatDate(c.updatedAt)}</p>
                    <p className="text-gray-900 font-medium">{c.itemCount} ədəd</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(c.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-9 h-9 object-cover rounded" />
                      ) : (
                        <div className="w-9 h-9 bg-gray-200 rounded" />
                      )}
                      <span className="flex-1 truncate">{item.productName}</span>
                      <span className="text-gray-500 text-xs">×{item.quantity}</span>
                      <span className="font-semibold text-gray-900">
                        {(item.price * item.quantity).toFixed(2)} ₼
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
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
            wishlists.map((w) => (
              <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`wishlist-${w.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{w.userName || 'Adsız müştəri'}</p>
                    <p className="text-xs text-gray-500 truncate">{w.userEmail}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-500">Yenilənib: {formatDate(w.updatedAt)}</p>
                    <p className="text-gray-900 font-medium">{w.count} məhsul</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                  {(w.productIds || []).map((pid) => (
                    <a
                      key={pid}
                      href={`/product/${pid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 rounded font-mono"
                    >
                      {pid.slice(0, 10)}…
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
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
