import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, Star, RefreshCw, MessageSquare, ExternalLink, Search } from 'lucide-react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productService } from '../../services/productService';
import type { Product } from '../../types';
import { useTranslation } from 'react-i18next';

interface ReviewRow {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt?: any;
}

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const StarRow: React.FC<{ value: number }> = ({ value }) => (
  <div className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

const ReviewsTab: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [productMap, setProductMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 0>(0);

  const load = async () => {
    setLoading(true);
    try {
      const [snap, products] = await Promise.all([
        getDocs(collection(db, 'product_reviews')),
        productService.getAll(true).catch(() => [] as Product[]),
      ]);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as ReviewRow))
        .sort((a, b) => {
          const aT = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
          const bT = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
          return bT - aT;
        });
      setReviews(list);
      const pm: Record<string, Product> = {};
      products.forEach((p) => {
        pm[p.id] = p;
      });
      setProductMap(pm);
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

  const handleDelete = async (r: ReviewRow) => {
    if (!confirm(`"${r.userName}" istifadəçisinin rəyini silmək istəyirsiniz?`)) return;
    try {
      await deleteDoc(doc(db, 'product_reviews', r.id));
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const getProductName = (pid: string) => {
    const p = productMap[pid];
    return p ? p.name?.[lang] || p.name?.en || p.name?.az || pid : pid;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter && r.rating !== ratingFilter) return false;
      if (!q) return true;
      const productName = getProductName(r.productId).toLowerCase();
      return (
        r.userName?.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q) ||
        productName.includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, search, ratingFilter, productMap, lang]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg =
      total === 0 ? 0 : Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / total) * 10) / 10;
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
    });
    return { total, avg, counts };
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reviews-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Müştəri Rəyləri</h2>
          <p className="text-sm text-gray-500">Bütün məhsullar üzrə rəylər</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-60"
          data-testid="reviews-refresh-btn"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Ümumi rəylər</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{stats.total}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">rəy</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-white flex items-center justify-center">
              <Star className="h-3.5 w-3.5 fill-white" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Orta reytinq</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{stats.avg.toFixed(1)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">5 ulduzdan</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 col-span-2">
          <p className="text-xs text-gray-500 font-medium mb-1.5">Ulduz paylanması</p>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.counts[star - 1];
              const pct = stats.total ? (count / stats.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-gray-700 font-medium">{star}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-gray-500 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Məhsul adı, müştəri və ya mətnə görə axtarın..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            data-testid="reviews-search-input"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRatingFilter(0)}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${
              ratingFilter === 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hamısı
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              onClick={() => setRatingFilter(s)}
              className={`inline-flex items-center gap-0.5 px-2.5 py-2 rounded-lg text-xs font-medium ${
                ratingFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`reviews-filter-${s}star`}
            >
              {s}
              <Star className={`h-3 w-3 ${ratingFilter === s ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg" data-testid="reviews-empty">
          <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {reviews.length === 0 ? 'Hələ rəy yoxdur' : 'Filtrə uyğun rəy tapılmadı'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const product = productMap[r.productId];
            const productName = getProductName(r.productId);
            const productImage = product?.images?.[0];
            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                data-testid={`review-${r.id}`}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  {/* Product info */}
                  <a
                    href={`/product/${r.productId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 min-w-0 hover:opacity-80"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                      {productImage ? (
                        <img src={productImage} alt={productName} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                        {productName}
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </p>
                      {product?.brand && (
                        <p className="text-[11px] text-gray-500">{product.brand}</p>
                      )}
                    </div>
                  </a>
                  <button
                    onClick={() => handleDelete(r)}
                    className="inline-flex items-center gap-1 text-red-500 hover:text-white hover:bg-red-500 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium"
                    title="Rəyi sil"
                    data-testid={`review-delete-${r.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Sil
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600 flex-shrink-0">
                      {(r.userName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{r.userName || 'Anonim'}</p>
                      <div className="flex items-center gap-2">
                        <StarRow value={r.rating} />
                        <span className="text-[10px] text-gray-400">{formatDate(r.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed pl-9 whitespace-pre-wrap break-words">
                    {r.comment}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewsTab;
