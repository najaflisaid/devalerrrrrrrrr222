import React, { useEffect, useState } from 'react';
import { Star, Loader2, Send, Trash2 } from 'lucide-react';
import {
  getProductReviews,
  addProductReview,
  deleteProductReview,
  computeAverageRating,
  type ProductReview,
} from '../services/productReviewService';

interface Props {
  productId: string;
}

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const StarRating: React.FC<{ value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const [hover, setHover] = useState(0);
  const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-6 w-6' };
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = (hover || value) >= i;
        return (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onMouseEnter={() => onChange && setHover(i)}
            onMouseLeave={() => onChange && setHover(0)}
            onClick={() => onChange?.(i)}
            className={`${onChange ? 'cursor-pointer' : 'cursor-default'} transition-transform ${onChange ? 'hover:scale-110' : ''}`}
          >
            <Star
              className={`${sizes[size]} ${filled ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
};

const ProductReviews: React.FC<Props> = ({ productId }) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName') || 'Anonim';
  // Allow ANY logged-in user (customer, b2b, etc.) to leave a review
  const isLoggedIn = !!userId;
  const isCustomer = userRole === 'customer' && !!userId;
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const load = async () => {
    setLoading(true);
    try {
      setReviews(await getProductReviews(productId));
    } finally {
      setLoading(false);
    }
  };

  const myExistingReview = reviews.find((r) => r.userId === userId);
  const avg = computeAverageRating(reviews);

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      alert('Rəy yazmaq üçün öncə hesabınıza giriş edin');
      return;
    }
    if (rating < 1) {
      alert('Reytinq verin (1-5 ulduz)');
      return;
    }
    if (!comment.trim()) {
      alert('Rəyinizi yazın');
      return;
    }
    setSubmitting(true);
    try {
      await addProductReview({
        productId,
        userId: userId!,
        userName,
        rating,
        comment: comment.trim(),
      });
      setRating(0);
      setComment('');
      setShowForm(false);
      await load();
    } catch (e) {
      alert('Rəy göndərilmədi: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu rəyi silmək istəyirsiniz?')) return;
    try {
      await deleteProductReview(id);
      await load();
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6" data-testid="product-reviews-section">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Müştəri rəyləri</h3>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={Math.round(avg)} size="sm" />
              <span className="text-sm font-semibold text-gray-900">{avg.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({reviews.length} rəy)</span>
            </div>
          )}
        </div>
        {!myExistingReview && !showForm && (
          <button
            onClick={() => {
              if (!isLoggedIn) {
                alert('Rəy yazmaq üçün öncə hesabınıza giriş edin');
                return;
              }
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
            data-testid="review-add-btn"
          >
            <Star className="h-3.5 w-3.5" />
            Rəy yaz
          </button>
        )}
      </div>

      {/* Stats panel — total + average + star distribution */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 pb-5 border-b border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-gray-900 text-white flex items-center justify-center">
                <Star className="h-3 w-3 fill-white" />
              </div>
              <span className="text-xs text-gray-500">Ümumi rəylər</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{reviews.length}</p>
            <p className="text-[10px] text-gray-400">rəy</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-amber-400 text-white flex items-center justify-center">
                <Star className="h-3 w-3 fill-white" />
              </div>
              <span className="text-xs text-gray-500">Orta reytinq</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avg.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400">5 ulduzdan</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 sm:col-span-1 col-span-1">
            <p className="text-xs text-gray-500 mb-2">Ulduz paylanması</p>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-gray-700 w-3">{star}</span>
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 flex-shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-4 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <div className="mb-4 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
          Rəy yazmaq üçün öncə hesabınıza giriş edin.
        </div>
      )}

      {showForm && isLoggedIn && (
        <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Reytinq</label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Rəyiniz</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Məhsul haqqında fikrinizi yazın..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white resize-none"
              data-testid="review-comment-input"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">{comment.length}/500</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setRating(0);
                setComment('');
              }}
              disabled={submitting}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 disabled:opacity-60"
            >
              Ləğv et
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-60"
              data-testid="review-submit-btn"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Göndər
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          Hələ rəy yoxdur. İlk rəyi siz yazın!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0" data-testid={`review-${r.id}`}>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                    {r.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.userName}</p>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} size="sm" />
                      <span className="text-[11px] text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {(isAdmin || r.userId === userId) && (
                  <button
                    onClick={() => handleDelete(r.id!)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg flex-shrink-0"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed pl-10">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
