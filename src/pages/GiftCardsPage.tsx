import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Gift, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import {
  GIFT_CARD_MIN_AMOUNT,
  GIFT_CARD_MAX_AMOUNT,
} from '../utils/giftCard';

type Step = 1 | 2;

const STEP_LABELS: Record<Step, string> = {
  1: 'Hədiyyə kartınızı seçin',
  2: 'Kart məlumatları',
};

const GiftCardsPage: React.FC = () => {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

  // Step 1
  const [amount, setAmount] = useState<number>(GIFT_CARD_MIN_AMOUNT);
  const [amountInput, setAmountInput] = useState<string>(String(GIFT_CARD_MIN_AMOUNT));
  const [quantity, setQuantity] = useState<number>(1);

  // Step 2 — bütün məlumatlar (e-poçt yoxdur)
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');

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
    if (!recipientPhone.trim()) return 'Alıcının əlaqə nömrəsini daxil edin';
    const digits = recipientPhone.replace(/\D/g, '');
    if (digits.length < 9) return 'Düzgün əlaqə nömrəsi daxil edin (ən azı 9 rəqəm)';
    return null;
  }, [senderName, recipientName, recipientPhone]);

  const handleAmountInput = (v: string) => {
    const cleaned = v.replace(/[^\d]/g, '').slice(0, 5);
    setAmountInput(cleaned);
    const n = parseInt(cleaned, 10);
    setAmount(isNaN(n) ? 0 : n);
  };

  const goNext = () => {
    if (step === 1 && step1Error) return;
    if (step === 1) setStep(2);
  };

  const goPrev = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  /**
   * Hədiyyə kartı ödəniş səhifəsinə yönləndirir. Səbətə əlavə olunmur — hədiyyə kartı
   * adi məhsul deyildir və ayrıca checkout flow istifadə olunur.
   */
  const handlePayDirectly = async () => {
    if (step2Error || step1Error) return;
    setSubmitting(true);
    setPaymentError('');
    try {
      const phoneDigits = recipientPhone.replace(/\D/g, '');
      const fullPhone = phoneDigits.startsWith('994')
        ? `+${phoneDigits}`
        : `+994${phoneDigits.slice(-9)}`;

      try {
        sessionStorage.setItem(
          'giftCardMeta',
          JSON.stringify({
            amount,
            quantity,
            senderName: senderName.trim(),
            recipientName: recipientName.trim(),
            message: message.trim(),
            recipientPhone: fullPhone,
          })
        );
      } catch {
        /* noop */
      }

      navigate('/gift-cards/checkout');
    } catch (e: any) {
      setPaymentError(e?.message || 'Davam edilmədi. Yenidən cəhd edin.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Stepper */}
      <section className="px-5 sm:px-8 pt-12 md:pt-16 pb-6">
        <div className="max-w-[680px] mx-auto">
          <div className="flex items-start justify-between relative">
            {/* progress line */}
            <div className="absolute left-0 right-0 top-5 md:top-6 h-px bg-black/15 mx-[25%]" aria-hidden />
            {([1, 2] as Step[]).map((s) => {
              const active = step === s;
              const done = step > s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
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

      {/* Main content — hədiyyə kartı ortada, formlar altında mərkəzdə */}
      <section className="px-5 sm:px-8 pb-16">
        <div className="max-w-[680px] mx-auto">
          {/* Hədiyyə kartı şəkli — mərkəzdə */}
          <div className="mb-10 md:mb-12">
            <div className="dv-giftcard-hero group relative w-full max-w-[440px] mx-auto aspect-[16/10] bg-gradient-to-br from-[#5a0a0a] via-[#8B0000] to-[#3a0606] overflow-hidden rounded-sm shadow-[0_20px_60px_-15px_rgba(139,0,0,0.55)]">
              {/* warm sheen */}
              <div
                className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 22% 22%, rgba(255,180,160,0.28), transparent 60%), radial-gradient(circle at 78% 82%, rgba(60,0,0,0.55), transparent 55%)',
                }}
              />
              {/* Mirror / shine sweep — looped */}
              <span aria-hidden="true" className="dv-giftcard-hero-shine pointer-events-none absolute inset-y-0 w-[35%] -skew-x-[18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] opacity-80">De Valeur</p>
                    <p className="text-[22px] md:text-[28px] font-light tracking-tight mt-1">
                      Hədiyyə Kartı
                    </p>
                  </div>
                  <Gift className="w-7 h-7 opacity-75" strokeWidth={1.25} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-75 mb-1">Dəyər</p>
                  <p className="text-[40px] md:text-[56px] font-light leading-none tabular-nums">
                    {amount > 0 ? amount.toLocaleString('az-AZ') : '—'}{' '}
                    <span className="text-[20px] md:text-[24px] opacity-85">AZN</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            {step === 1 && (
              <div data-testid="gift-step-1-content">
                <h2 className="text-[24px] md:text-[32px] font-light tracking-tight text-black mb-3">
                  Hədiyyə kartınızı seçin
                </h2>
                <p className="text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-8">
                  De Valeur hədiyyə kartının məbləğini seçin. Hər bir kart xüsusi diqqətlə hazırlanır.
                </p>

                <div className="space-y-7">
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
                      <span
                        className="w-14 text-center text-[16px] tabular-nums"
                        data-testid="gift-card-qty"
                      >
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
                <h2 className="text-[24px] md:text-[32px] font-light tracking-tight text-black mb-3">
                  Kart məlumatları
                </h2>
                <p className="text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-8">
                  Hədiyyə kartı üzərində görünəcək məlumatları və alıcının əlaqə nömrəsini daxil edin.
                </p>

                <div className="space-y-5">
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
                      Alıcının əlaqə nömrəsi
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
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.24em] text-black/55 mb-2">
                      Şəxsi mesaj{' '}
                      <span className="text-black/40 normal-case tracking-normal">(opsional)</span>
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
                  {paymentError && (
                    <p className="text-[12px] text-red-600" data-testid="gift-payment-error">
                      {paymentError}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-10 flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={submitting}
                  className="h-14 px-5 border border-black/25 text-black hover:border-black text-[12px] uppercase tracking-[0.22em] inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                  data-testid="gift-prev-btn"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> Geri
                </button>
              )}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!!step1Error}
                  className="flex-1 h-14 bg-black text-white text-[12px] uppercase tracking-[0.22em] hover:bg-black/85 disabled:bg-black/40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                  data-testid="gift-next-btn"
                >
                  Növbəti <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePayDirectly}
                  disabled={submitting || !!step2Error}
                  className="flex-1 h-14 bg-black text-white text-[12px] uppercase tracking-[0.22em] hover:bg-black/85 disabled:bg-black/40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                  data-testid="gift-pay-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Davam edilir...
                    </>
                  ) : (
                    <>
                      Davam et ({total.toLocaleString('az-AZ')} AZN)
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GiftCardsPage;
