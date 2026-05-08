import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ShoppingBag, Gift, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import {
  buildCustomGiftCardProduct,
  GIFT_CARD_MIN_AMOUNT,
  GIFT_CARD_MAX_AMOUNT,
} from '../utils/giftCard';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];

const GiftCardsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToCart, addNotification } = useCart();

  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[0]);
  // Free-input field — istifadəçi açıq mətn yaza bilsin (boş, 0, 99 və s. də olacaq).
  // Yalnız `amount` rəqəmi tətbiq olunur, `inputValue` UX üçündür.
  const [inputValue, setInputValue] = useState<string>(String(QUICK_AMOUNTS[0]));

  const error = useMemo(() => {
    if (amount < GIFT_CARD_MIN_AMOUNT) {
      return `Minimum məbləğ: ${GIFT_CARD_MIN_AMOUNT} AZN`;
    }
    if (amount > GIFT_CARD_MAX_AMOUNT) {
      return `Maksimum məbləğ: ${GIFT_CARD_MAX_AMOUNT} AZN`;
    }
    return null;
  }, [amount]);

  const setBoth = (n: number) => {
    setAmount(n);
    setInputValue(String(n));
  };

  const handleInput = (v: string) => {
    // Yalnız rəqəm
    const cleaned = v.replace(/[^\d]/g, '').slice(0, 5);
    setInputValue(cleaned);
    const n = parseInt(cleaned, 10);
    if (!isNaN(n)) setAmount(n);
    else setAmount(0);
  };

  const handleBuy = () => {
    if (error) return;
    const product = buildCustomGiftCardProduct(amount);
    addToCart(product, 1);
    addNotification(`Hədiyyə Kartı (${amount} AZN) səbətə əlavə olundu`, 'success');
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-[#F5EAE2] py-14 md:py-20 px-5 sm:px-8">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 text-[11px] uppercase tracking-[0.32em] text-black/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>De Valeur</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h1
            className="text-[32px] md:text-[44px] leading-[1.05] tracking-tight text-black font-normal mb-4"
            data-testid="gift-cards-title"
          >
            {t('giftCards.title', { defaultValue: 'Hədiyyə Kartı' })}
          </h1>
          <p className="text-[14px] md:text-[16px] text-black/65 max-w-2xl mx-auto leading-relaxed">
            Sevdiklərinizə De Valeur kolleksiyalarından dilədiyini seçmək azadlığını verin.
            Məbləği siz təyin edin — minimum {GIFT_CARD_MIN_AMOUNT} AZN, yuxarı limit yoxdur.
          </p>
        </div>
      </section>

      {/* Configurator */}
      <section className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Visual preview */}
          <div className="order-1 lg:order-1">
            <div className="relative aspect-[16/10] bg-gradient-to-br from-[#1a1410] via-black to-[#2a2218] overflow-hidden rounded-sm shadow-2xl">
              {/* Texture / grain */}
              <div
                className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 20%, rgba(255,210,150,0.15), transparent 60%), radial-gradient(circle at 80% 80%, rgba(120,80,40,0.25), transparent 55%)',
                }}
              />
              <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] opacity-75">De Valeur</p>
                    <p className="text-[22px] md:text-[28px] font-light tracking-tight mt-1">
                      Hədiyyə Kartı
                    </p>
                  </div>
                  <Gift className="w-7 h-7 opacity-60" strokeWidth={1.25} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-65 mb-1">Dəyər</p>
                  <p className="text-[40px] md:text-[56px] font-light leading-none tabular-nums">
                    {amount > 0 ? amount.toLocaleString('az-AZ') : '—'}{' '}
                    <span className="text-[20px] md:text-[24px] opacity-80">AZN</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { n: '01', t: 'Məbləği seç', d: '100 AZN-dən yuxarı istənilən rəqəm' },
                { n: '02', t: 'Ödə', d: 'Təhlükəsiz onlayn ödəniş' },
                { n: '03', t: 'Hədiyyə et', d: 'Promo kod e-poçtuna çatır' },
              ].map((s) => (
                <div key={s.n}>
                  <p className="text-[10px] tracking-[0.32em] text-black/40 mb-1.5">{s.n}</p>
                  <p className="text-[12px] text-black mb-0.5">{s.t}</p>
                  <p className="text-[10px] text-black/50 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Configurator */}
          <div className="order-2 lg:order-2" data-testid="gift-card-configurator">
            <p className="text-[11px] uppercase tracking-[0.28em] text-black/50 mb-3">
              Məbləği seçin
            </p>

            {/* Quick picks */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
              {QUICK_AMOUNTS.map((n) => {
                const active = n === amount;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBoth(n)}
                    className={`h-12 border text-[13px] font-medium tabular-nums transition-all ${
                      active
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-white text-black/80 border-black/15 hover:border-black/45 hover:bg-black/[0.02]'
                    }`}
                    data-testid={`gift-card-quick-${n}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Free input */}
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.28em] text-black/50">
                Və ya öz məbləğinizi yazın
              </span>
              <div
                className={`mt-2 relative flex items-center border bg-white transition-all ${
                  error
                    ? 'border-red-500 ring-2 ring-red-500/25'
                    : 'border-black/25 focus-within:border-black'
                }`}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValue}
                  onChange={(e) => handleInput(e.target.value)}
                  placeholder={`Min ${GIFT_CARD_MIN_AMOUNT}`}
                  className="flex-1 h-14 px-4 outline-none text-[20px] font-medium tabular-nums bg-transparent"
                  data-testid="gift-card-amount-input"
                  aria-label="Gift card məbləği"
                />
                <span className="px-4 text-[14px] tracking-wider text-black/55 border-l border-black/15">
                  AZN
                </span>
              </div>
              {error ? (
                <p className="mt-2 text-[12px] text-red-600" data-testid="gift-card-error">
                  {error}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-black/50">
                  Minimum {GIFT_CARD_MIN_AMOUNT} AZN. Yuxarı limit yoxdur — istəkli məbləği yazın.
                </p>
              )}
            </label>

            {/* Inclusive features list */}
            <ul className="mt-7 space-y-2.5">
              {[
                'Bütün De Valeur məhsullarında istifadə oluna bilər',
                'Unikal promo kod ödənişdən dərhal sonra e-poçtla göndərilir',
                'Müddətsizdir — istənilən vaxt aktivləşdirilə bilər',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[13px] text-black/75">
                  <span className="mt-0.5 w-4 h-4 flex-shrink-0 rounded-full bg-black/[0.06] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-black" strokeWidth={2.5} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={handleBuy}
              disabled={!!error || amount <= 0}
              className="mt-7 w-full h-14 bg-black text-white text-[12px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 disabled:bg-black/40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              data-testid="gift-card-add-to-cart"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              <span>
                Səbətə əlavə et —{' '}
                <span className="tabular-nums">
                  {amount > 0 ? amount.toLocaleString('az-AZ') : '—'} AZN
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GiftCardsPage;
