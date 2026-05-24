import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Gift, Copy, Check, ShoppingBag, Share2, Loader2, AlertCircle } from 'lucide-react';
import { getGiftCardByCode, type PromoCode } from '../services/promoCodeService';

/**
 * Public hədiyyə kartı paylaşma səhifəsi.
 *
 * URL: `/gift-card/:code`
 *
 * Müştəri hədiyyə kartı alandan sonra bu URL-ni qarşı tərəfə (WhatsApp / Telegram /
 * istənilən mesajlaşma vasitəsi) göndərə bilər. Qarşı tərəf linki açanda:
 *  - DE VALEUR brendi ilə premium dizaynlı hədiyyə kartı görür
 *  - Göndərənin adı, alıcının adı və şəxsi mesaj görünür
 *  - Kodu kopyalaya və ya birbaşa "İndi istifadə et" düyməsi ilə məhsullar səhifəsinə keçə bilər
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

  const amount = card.amountAZN || 0;
  const isUsed = !!card.used;
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
            {/* Brand */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/80 mb-1">
                  Premium Gift
                </p>
                <p className="text-lg font-semibold tracking-[0.2em] text-white">DE VALEUR</p>
              </div>
              <Gift className="h-8 w-8 text-amber-400" />
            </div>

            {/* Personal message */}
            <div className="text-center mb-6">
              {recipient && (
                <p className="text-amber-200 text-sm mb-2" data-testid="recipient-greeting">
                  Sevgili <span className="font-semibold">{recipient}</span>,
                </p>
              )}
              <p className="text-white/90 text-base leading-relaxed mb-2 italic">
                {message || 'Bu hədiyyə sizə xüsusi bir gün üçün göndərildi.'}
              </p>
              <p className="text-amber-300/80 text-xs">
                — {sender}
              </p>
            </div>

            {/* Amount */}
            <div className="bg-black/40 border border-amber-700/30 rounded-2xl p-6 text-center mb-5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-300/60 mb-1">
                Kart Dəyəri
              </p>
              <p className="text-4xl font-bold text-white" data-testid="gift-card-amount">
                {amount.toFixed(0)} <span className="text-2xl text-amber-300">AZN</span>
              </p>
            </div>

            {/* Code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2 text-center">
                {isUsed ? 'Kod (artıq istifadə olunub)' : 'Hədiyyə Kodu'}
              </p>
              <p className={`font-mono text-2xl tracking-[0.4em] text-center mb-3 ${isUsed ? 'text-white/30 line-through' : 'text-white'}`} data-testid="gift-card-code">
                {card.code}
              </p>
              <button
                onClick={handleCopyCode}
                disabled={isUsed}
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
        {!isUsed && (
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
            Kodu səbət səhifəsindəki "Promo Kod" sahəsinə daxil edin və endirim avtomatik tətbiq olunsun.
            <br />Hər hədiyyə kartı yalnız bir dəfə istifadə oluna bilər.
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
