import React, { useEffect, useState } from 'react';
import { Star, Loader2, Send, Trash2 } from 'lucide-react';
import {
  getProductReviews,
  addProductReview,
  deleteProductReview,
  computeAverageRating,
  type ProductReview,
} from '../services/productReviewService';
import CustomerLogin from './auth/CustomerLogin';

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
              className={`${sizes[size]} ${filled ? 'fill-black text-black' : 'text-black/25'}`}
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
  const [showAuthModal, setShowAuthModal] = useState(false);

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
      setShowAuthModal(true);
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
    <div className="bg-white" data-testid="product-reviews-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-black/55 mb-2">Müştəri rəyləri</p>
          <div className="flex items-center gap-3">
            <h3 className="text-[24px] sm:text-[28px] font-light text-black tracking-tight">
              {reviews.length > 0 ? avg.toFixed(1) : '—'}
            </h3>
            <StarRating value={Math.round(avg)} size="md" />
            {reviews.length > 0 && (
              <span className="text-[12px] text-black/50">({reviews.length} rəy)</span>
            )}
          </div>
        </div>
        {!myExistingReview && !showForm && (
          <button
            onClick={() => {
              if (!isLoggedIn) {
                setShowAuthModal(true);
                return;
              }
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center px-5 py-3 bg-black text-white text-[11px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 transition-colors"
            data-testid="review-add-btn"
          >
            Rəy yaz
          </button>
        )}
      </div>

      {/* Stats panel — total + average + star distribution */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 pb-10 border-b border-black/10">
          <div className="border border-black/10 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-black/50 mb-2">Ümumi rəylər</p>
            <p className="text-[28px] font-light text-black tracking-tight">{reviews.length}</p>
          </div>

          <div className="border border-black/10 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-black/50 mb-2">Orta reytinq</p>
            <div className="flex items-baseline gap-2">
              <p className="text-[28px] font-light text-black tracking-tight">{avg.toFixed(1)}</p>
              <span className="text-[12px] text-black/40">/ 5</span>
            </div>
          </div>

          <div className="border border-black/10 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-black/50 mb-3">Ulduz paylanması</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-black/70 w-3 tabular-nums">{star}</span>
                    <Star className="h-2.5 w-2.5 fill-black text-black flex-shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 h-[3px] bg-black/10 overflow-hidden">
                      <div className="h-full bg-black transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-black/50 w-4 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn && null /* "Bu məhsulu qiymətləndirin" prompt removed per
          request — the top "Rəy yaz" button already handles unauthenticated
          users by opening the auth modal. */}

      {showForm && isLoggedIn && (
        <div className="mb-8 p-6 border border-black/15 bg-white space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.28em] text-black/55 mb-2">Reytinq</label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.28em] text-black/55 mb-2">Rəyiniz</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Məhsul haqqında fikrinizi yazın..."
              className="w-full px-3 py-3 border border-black/20 focus:border-black outline-none text-[14px] bg-white resize-none transition-colors"
              data-testid="review-comment-input"
            />
            <p className="text-[10px] text-black/40 mt-1 text-right">{comment.length}/500</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setRating(0);
                setComment('');
              }}
              disabled={submitting}
              className="px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] font-medium border border-black/20 text-black hover:bg-black hover:text-white transition-colors disabled:opacity-60"
            >
              Ləğv et
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white text-[11px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 transition-colors disabled:opacity-60"
              data-testid="review-submit-btn"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Göndər
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-black/40" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-black/15">
          <Star className="w-8 h-8 mx-auto mb-3 text-black/15" strokeWidth={1.5} />
          <p className="text-[14px] text-black/55">Hələ rəy yoxdur. İlk rəyi siz yazın.</p>
        </div>
      ) : (
        <div className="divide-y divide-black/10">
          {reviews.map((r) => (
            <div key={r.id} className="py-6 first:pt-0" data-testid={`review-${r.id}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-[12px] font-medium flex-shrink-0">
                    {r.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-black truncate">{r.userName}</p>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} size="sm" />
                      <span className="text-[11px] text-black/40">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {(isAdmin || r.userId === userId) && (
                  <button
                    onClick={() => handleDelete(r.id!)}
                    className="text-black/40 hover:text-[#D14545] hover:bg-black/[0.04] p-1.5 transition-colors flex-shrink-0"
                    title="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[14px] text-black/75 leading-relaxed pl-12">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
      {showAuthModal && (
        <CustomerLogin
          initialMode="register"
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
};

export default ProductReviews;
