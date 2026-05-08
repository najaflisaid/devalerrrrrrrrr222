import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, ShoppingBag, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import {
  buildCustomGiftCardProduct,
  GIFT_CARD_MIN_AMOUNT,
  GIFT_CARD_MAX_AMOUNT,
} from '../utils/giftCard';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: 'Hədiyyə kartınızı seçin',
  2: 'Kart məlumatları',
  3: 'Çatdırılma məlumatları',
  4: 'Sifariş məbləği',
};

const GiftCardsPage: React.FC = () => {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const { addToCart, addNotification } = useCart();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [amount, setAmount] = useState<number>(GIFT_CARD_MIN_AMOUNT);
  const [amountInput, setAmountInput] = useState<string>(String(GIFT_CARD_MIN_AMOUNT));
  const [quantity, setQuantity] = useState<number>(1);

  // Step 2
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');

  // Step 3
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const total = useMemo(() => amount * quantity, [amount, quantity]);

  const step1Error = useMemo(() => {
    if (amount < GIFT_CARD_MIN_AMOUNT) return `Minimal məbləğ: ${GIFT_CARD_MIN_AMOUNT} AZN`;
    if (amount > GIFT_CARD_MAX_AMOUNT) return `Maksimum məbləğ: ${GIFT_CARD_MAX_AMOUNT} AZN`;
    if (quantity < 1) return 'Kart sayı 1-dən az ola bilməz';
    return null;
  }, [amount, quantity]);

  const step2Error = useMemo(() => {
    if (!senderName.trim()) return 'Göndərənin adını daxil edin';
    if (!recipientName.trim()) return 'Alıcının adını daxil edin';
    return null;
  }, [senderName, recipientName]);

  const step3Error = useMemo(() => {
    if (!recipientEmail.trim() || !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      return 'Düzgün e-poçt daxil edin';
    }
    return null;
  }, [recipientEmail]);

  const handleAmountInput = (v: string) => {
    const cleaned = v.replace(/[^\d]/g, '').slice(0, 5);
    setAmountInput(cleaned);
    const n = parseInt(cleaned, 10);
    setAmount(isNaN(n) ? 0 : n);
  };

  const goNext = () => {
    if (step === 1 && step1Error) return;
    if (step === 2 && step2Error) return;
    if (step === 3 && step3Error) return;
    if (step < 4) setStep((step + 1) as Step);
  };

  const goPrev = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleCheckout = () => {
    if (step1Error || step2Error || step3Error) return;
    const product = buildCustomGiftCardProduct(amount);
    // Store metadata so checkout/email flow can use it later
    try {
      sessionStorage.setItem(
        'giftCardMeta',
        JSON.stringify({
          amount,
          quantity,
          senderName,
          recipientName,
          message,
          recipientEmail,
          recipientPhone,
        })
      );
    } catch {
      /* noop */
    }
    addToCart(product, quantity);
    addNotification(`Hədiyyə Kartı (${amount} AZN × ${quantity}) səbətə əlavə olundu`, 'success');
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Stepper */}
      <section className="px-5 sm:px-8 pt-12 md:pt-16 pb-6">
        <div className="max-w-[980px] mx-auto">
          <div className="flex items-start justify-between relative">
            {/* progress line */}
            <div className="absolute left-0 right-0 top-5 md:top-6 h-px bg-black/15 mx-[10%]" aria-hidden />
            {([1, 2, 3, 4] as Step[]).map((s) => {
              const active = step === s;
              const done = step > s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    // allow navigating only to completed/current steps
                    if (s <= step) setStep(s);
                  }}
                  className="relative z-10 flex flex-col items-center gap-2 sm:gap-3 flex-1 group"
                  data-testid={`gift-step-${s}`}
                >
                  <span
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full border flex items-center justify-center text-[14px] md:text-[16px] font-light transition-all bg-white ${
                      active
                        ? 'border-black text-black scale-110 shadow-sm'
                        : done
                          ? 'border-black bg-black text-white'
                          : 'border-black/25 text-black/45'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" strokeWidth={2} /> : s}
                  </span>
                  <span
                    className={`text-[10px] md:text-[12px] uppercase tracking-[0.18em] text-center leading-tight px-1 ${
                      active ? 'text-black' : 'text-black/45'
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="px-5 sm:px-8 pb-16">
        <div className="max-w-[820px] mx-auto">
          {/* Big card visual (always shown) */}
          <div className="mb-10 md:mb-14">
            <div className="relative max-w-[480px] mx-auto aspect-[16/10] bg-gradient-to-br from-[#1a1410] via-black to-[#2a2218] overflow-hidden rounded-sm shadow-2xl">
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
          </div>

          {/* Step content */}
          {step === 1 && (
            <div data-testid="gift-step-1-content">
              <h2 className="text-center text-[26px] md:text-[34px] font-light tracking-tight text-black mb-3">
                Hədiyyə kartınızı seçin
              </h2>
              <p className="text-center text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-10 max-w-xl mx-auto">
                De Valeur hədiyyə kartının məbləğini seçin. Hər bir kart xüsusi diqqətlə hazırlanır.
              </p>

              <div className="max-w-[520px] mx-auto space-y-7">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Hədiyyə kartının məbləği
                  </label>
                  <div
                    className={`relative flex items-center border bg-white transition-all ${
                      step1Error
                        ? 'border-red-500'
                        : 'border-black/25 focus-within:border-black'
                    }`}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amountInput}
                      onChange={(e) => handleAmountInput(e.target.value)}
                      placeholder={`Min ${GIFT_CARD_MIN_AMOUNT}`}
                      className="flex-1 h-14 px-4 outline-none text-[20px] font-light tabular-nums bg-transparent"
                      data-testid="gift-card-amount-input"
                    />
                    <span className="px-4 text-[14px] tracking-wider text-black/55 border-l border-black/15">
                      AZN
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-black/55">
                    Minimal məbləğ: {GIFT_CARD_MIN_AMOUNT} AZN
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Kartların sayı
                  </label>
                  <div className="inline-flex items-center border border-black/25">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                      data-testid="gift-card-qty-minus"
                      aria-label="Azalt"
                    >
                      −
                    </button>
                    <span className="w-14 text-center text-[16px] tabular-nums" data-testid="gift-card-qty">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(50, quantity + 1))}
                      className="w-12 h-12 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                      data-testid="gift-card-qty-plus"
                      aria-label="Artır"
                    >
                      +
                    </button>
                  </div>
                </div>

                {step1Error && (
                  <p className="text-[12px] text-red-600" data-testid="gift-card-step1-error">
                    {step1Error}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div data-testid="gift-step-2-content">
              <h2 className="text-center text-[26px] md:text-[34px] font-light tracking-tight text-black mb-3">
                Kart məlumatları
              </h2>
              <p className="text-center text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-10 max-w-xl mx-auto">
                Hədiyyə kartı üzərində görünəcək məlumatları daxil edin.
              </p>

              <div className="max-w-[520px] mx-auto space-y-5">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Göndərənin adı
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full h-12 px-4 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                    placeholder="Adınız"
                    data-testid="gift-sender-name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Alıcının adı
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full h-12 px-4 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                    placeholder="Hədiyyə alacaq şəxsin adı"
                    data-testid="gift-recipient-name"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Şəxsi mesaj <span className="text-black/40 normal-case tracking-normal">(opsional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 240))}
                    rows={4}
                    className="w-full px-4 py-3 border border-black/25 focus:border-black outline-none bg-white text-[14px] resize-none"
                    placeholder="Sevdiyiniz şəxsə xüsusi mesaj yazın..."
                    data-testid="gift-message"
                  />
                  <p className="mt-1 text-[11px] text-black/45 text-right">{message.length}/240</p>
                </div>

                {step2Error && (
                  <p className="text-[12px] text-red-600" data-testid="gift-card-step2-error">
                    {step2Error}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div data-testid="gift-step-3-content">
              <h2 className="text-center text-[26px] md:text-[34px] font-light tracking-tight text-black mb-3">
                Çatdırılma məlumatları
              </h2>
              <p className="text-center text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-10 max-w-xl mx-auto">
                Hədiyyə kartı və promo kod alıcının e-poçtuna göndəriləcək.
              </p>

              <div className="max-w-[520px] mx-auto space-y-5">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Alıcının e-poçtu
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full h-12 px-4 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                    placeholder="example@mail.com"
                    data-testid="gift-recipient-email"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                    Telefon <span className="text-black/40 normal-case tracking-normal">(opsional)</span>
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full h-12 px-4 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                    placeholder="+994 ..."
                    data-testid="gift-recipient-phone"
                  />
                </div>

                {step3Error && (
                  <p className="text-[12px] text-red-600" data-testid="gift-card-step3-error">
                    {step3Error}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div data-testid="gift-step-4-content">
              <h2 className="text-center text-[26px] md:text-[34px] font-light tracking-tight text-black mb-3">
                Sifariş məbləği
              </h2>
              <p className="text-center text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-10 max-w-xl mx-auto">
                Sifarişinizi yoxlayın və ödənişə keçin.
              </p>

              <div className="max-w-[520px] mx-auto border border-black/15 bg-white">
                <Row label="Bir kartın məbləği" value={`${amount.toLocaleString('az-AZ')} AZN`} />
                <Row label="Kartların sayı" value={String(quantity)} />
                <Row label="Göndərən" value={senderName || '—'} />
                <Row label="Alıcı" value={recipientName || '—'} />
                <Row label="E-poçt" value={recipientEmail || '—'} />
                {recipientPhone && <Row label="Telefon" value={recipientPhone} />}
                {message && <Row label="Mesaj" value={message} multiline />}
                <div className="flex items-center justify-between px-5 py-5 bg-black text-white">
                  <span className="text-[12px] uppercase tracking-[0.22em] opacity-80">Cəmi</span>
                  <span className="text-[24px] font-light tabular-nums" data-testid="gift-total">
                    {total.toLocaleString('az-AZ')} AZN
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="max-w-[520px] mx-auto mt-10 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goPrev}
                className="h-14 px-5 border border-black/25 text-black hover:border-black text-[12px] uppercase tracking-[0.22em] inline-flex items-center gap-2 transition-colors"
                data-testid="gift-prev-btn"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> Geri
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  (step === 1 && !!step1Error) ||
                  (step === 2 && !!step2Error) ||
                  (step === 3 && !!step3Error)
                }
                className="flex-1 h-14 bg-black text-white text-[12px] uppercase tracking-[0.22em] hover:bg-black/85 disabled:bg-black/40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                data-testid="gift-next-btn"
              >
                Növbəti <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                className="flex-1 h-14 bg-black text-white text-[12px] uppercase tracking-[0.22em] hover:bg-black/85 transition-colors inline-flex items-center justify-center gap-2"
                data-testid="gift-checkout-btn"
              >
                <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                Səbətə əlavə et
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; multiline?: boolean }> = ({
  label,
  value,
  multiline,
}) => (
  <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-black/10 last:border-0">
    <span className="text-[12px] uppercase tracking-[0.18em] text-black/55 flex-shrink-0">
      {label}
    </span>
    <span
      className={`text-[14px] text-black text-right ${multiline ? 'whitespace-pre-wrap' : ''}`}
    >
      {value}
    </span>
  </div>
);

export default GiftCardsPage;
