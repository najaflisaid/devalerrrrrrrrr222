import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Gift, Copy, Check, ShoppingBag, Share2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getGiftCardByCode, type PromoCode } from '../services/promoCodeService';

const DEVALEUR_LOGO = 'https://i.hizliresim.com/tmu65g6.png';

/**
 * Public hədiyyə kartı paylaşma səhifəsi.
 *
 * URL: `/gift-card/:code`
 *
 * Linki açan şəxs:
 *  - DE VALEUR logosu və brendi ilə premium dizaynlı kart görür
 *  - Göndərənin və alıcının adı, şəxsi mesaj
 *  - Kartın **qalan balansı** (qismən istifadə dəstəyi)
 *  - Kodu kopyalama və ya "İndi istifadə et" düyməsi
 */
const GiftCardSharePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<PromoCode | null>(null);
  const [state, setState] = useState<'loading' | 'found' | 'not_found'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      setState('not_found');
      return;
    }
    (async () => {
      const c = await getGiftCardByCode(code);
      if (c) {
        setCard(c);
        setState('found');
      } else {
        setState('not_found');
      }
    })();
  }, [code]);

  const handleCopyCode = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleShare = async () => {
    if (!card) return;
    const url = window.location.href;
    const text = card.giftCardShare?.recipientName
      ? `${card.giftCardShare.recipientName}, sizə DE VALEUR hədiyyə kartı göndərildi! ${url}`
      : `Sizə DE VALEUR hədiyyə kartı göndərildi! ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DE VALEUR Hədiyyə Kartı', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link kopyalandı!');
      }
    } catch {
      /* user dismissed */
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
      </div>
    );
  }

  if (state === 'not_found' || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 px-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-md w-full text-center" data-testid="gift-card-not-found">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Kart tapılmadı</h1>
          <p className="text-white/60 text-sm mb-6">
            Bu link səhvdir və ya kart artıq mövcud deyil.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            Ana səhifəyə qayıt
          </Link>
        </div>
      </div>
    );
  }

  const originalAmount = card.amountAZN || 0;
  const remaining =
    typeof card.remainingAZN === 'number' ? card.remainingAZN : (card.used ? 0 : originalAmount);
  const usedAmount = +Math.max(0, originalAmount - remaining).toFixed(2);
  const isFullyUsed = card.used === true || remaining <= 0;
  const isPartial = !isFullyUsed && usedAmount > 0;

  const sender = card.giftCardShare?.senderName || 'Sizə hədiyyə göndərən';
  const recipient = card.giftCardShare?.recipientName || '';
  const message = card.giftCardShare?.message || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 py-12 px-4 flex items-center justify-center" data-testid="gift-card-share-page">
      <div className="max-w-md w-full">
        {/* Card */}
        <div
          className="relative bg-gradient-to-br from-amber-950 via-stone-900 to-black border border-amber-700/30 rounded-3xl p-8 shadow-[0_30px_60px_-15px_rgba(217,119,6,0.3)] overflow-hidden"
          data-testid="gift-card-design"
        >
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.4),transparent_50%)]" />
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />

          <div className="relative">
            {/* Brand — yalnız mərkəzləşdirilmiş logo, dairəsiz və adsiz */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1 flex justify-center">
                <img
                  src={DEVALEUR_LOGO}
                  alt="DE VALEUR"
                  className="h-12 object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                  data-testid="gift-card-logo"
                />
              </div>
              <Gift className="h-7 w-7 text-amber-400 flex-shrink-0 absolute right-8 top-8" />
            </div>

            {/* "HƏDİYYƏ" başlığı */}
            <p className="text-[11px] tracking-[0.4em] uppercase text-amber-300/80 text-center mb-6">
              Hədiyyə
            </p>

            {/* Personal message */}
            <div className="text-center mb-6">
              {recipient && (
                <p className="text-amber-200 text-sm mb-2" data-testid="recipient-greeting">
                  Hörmətli <span className="font-semibold">{recipient}</span>,
                </p>
              )}
              <p className="text-white/90 text-base leading-relaxed mb-2 italic">
                {message || 'Bu hədiyyə sizə xüsusi bir gün üçün göndərildi.'}
              </p>
              <p className="text-amber-300/80 text-xs">
                — {sender}
              </p>
            </div>

            {/* Amount + qalan balans */}
            <div className="bg-black/40 border border-amber-700/30 rounded-2xl p-6 text-center mb-5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/60 mb-1">
                {isPartial ? 'Qalan Balans' : 'Kart Dəyəri'}
              </p>
              <p className="text-4xl font-bold text-white" data-testid="gift-card-amount">
                {(isPartial ? remaining : originalAmount).toFixed(0)}{' '}
                <span className="text-2xl text-amber-300">AZN</span>
              </p>
              {isPartial && (
                <div
                  className="mt-3 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-200"
                  data-testid="gift-card-partial-usage"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  İstifadə olunub:{' '}
                  <span className="font-semibold text-white">{usedAmount.toFixed(0)} AZN</span>{' '}
                  · Qalan:{' '}
                  <span className="font-semibold text-emerald-300">{remaining.toFixed(0)} AZN</span>
                </div>
              )}
              {isFullyUsed && (
                <div
                  className="mt-3 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-200"
                  data-testid="gift-card-fully-used"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Kart tam istifadə olunub
                </div>
              )}
            </div>

            {/* Code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2 text-center">
                {isFullyUsed ? 'Kod (artıq istifadə olunub)' : 'Hədiyyə Kodu'}
              </p>
              <p
                className={`font-mono text-2xl tracking-[0.4em] text-center mb-3 ${
                  isFullyUsed ? 'text-white/30 line-through' : 'text-white'
                }`}
                data-testid="gift-card-code"
              >
                {card.code}
              </p>
              <button
                onClick={handleCopyCode}
                disabled={isFullyUsed}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="copy-code-btn"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Kodu kopyala
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CTAs */}
        {!isFullyUsed && (
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/products')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
              data-testid="shop-now-btn"
            >
              <ShoppingBag className="h-5 w-5" />
              İndi alış-veriş et və kodu istifadə et
            </button>
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm rounded-xl transition-colors"
              data-testid="share-card-btn"
            >
              <Share2 className="h-4 w-4" />
              Linki paylaş
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-white/40 text-xs leading-relaxed">
            Kodu səbət səhifəsindəki &quot;Promo Kod&quot; sahəsinə daxil edin və balans avtomatik tətbiq olunsun.
            <br />
            Sifariş kartın balansından çoxdursa, qalan məbləği Epoint ilə ödəyə bilərsiniz. Kartın balansı qalsa,
            növbəti sifarişdə eyni kodla yenidən istifadə edə bilərsiniz.
          </p>
          <Link
            to="/"
            className="inline-block mt-4 text-amber-400/80 hover:text-amber-300 text-xs tracking-wider uppercase transition-colors"
          >
            devaleur.az →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GiftCardSharePage;
