import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, ChevronLeft, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { createCustomerOrder } from '../services/customerOrderService';
import { startEpointPayment } from '../services/epointPaymentService';

interface GiftCardMeta {
  amount: number;
  quantity: number;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  buyerName?: string;
  buyerLastName?: string;
  buyerPhone?: string;
}

const formatAzPhone = (digits: string) => {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('994')) return `+${d}`;
  return `+994${d.slice(-9)}`;
};

const GiftCardCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<GiftCardMeta | null>(null);

  // Buyer info (checkout form). Logged-in user-i avtomatik doldur.
  const isLoggedIn = !!localStorage.getItem('userId');
  const loggedInName = localStorage.getItem('userName') || '';
  const loggedInEmail = localStorage.getItem('userEmail') || '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('giftCardMeta');
      if (!raw) {
        navigate('/gift-cards');
        return;
      }
      const parsed = JSON.parse(raw) as GiftCardMeta;
      setMeta(parsed);
      if (parsed.senderName && !firstName) setFirstName(parsed.senderName);
    } catch {
      navigate('/gift-cards');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => (meta ? meta.amount * meta.quantity : 0), [meta]);

  if (!meta) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/60" />
      </div>
    );
  }

  const validate = (): string | null => {
    if (!isLoggedIn) {
      if (!firstName.trim()) return 'Adınızı daxil edin';
      if (!lastName.trim()) return 'Soyadınızı daxil edin';
      if (phoneDigits.length < 9) return 'Telefon nömrəsini daxil edin (9 rəqəm)';
      if (password.length < 6) return 'Şifrə ən azı 6 simvol olmalıdır';
      if (password !== password2) return 'Şifrələr uyğun gəlmir';
    } else {
      if (phoneDigits.length < 9) return 'Telefon nömrəsini daxil edin (9 rəqəm)';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const fullPhone = formatAzPhone('994' + phoneDigits.slice(-9));
      const cleanPhone = fullPhone.replace(/\D/g, '');

      let userId = localStorage.getItem('userId') || '';
      let userEmail = loggedInEmail;
      let buyerName = isLoggedIn ? loggedInName : `${firstName.trim()} ${lastName.trim()}`.trim();

      // Qonaq müştəri qeydiyyatı (telefondan sintetik email)
      if (!isLoggedIn) {
        const syntheticEmail = `customer${cleanPhone}@devaleur.az`;
        try {
          const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
          userId = cred.user.uid;
          userEmail = syntheticEmail;
          // Firestore users dokumentini yarat
          const userDoc = doc(db, 'users', userId);
          const existing = await getDoc(userDoc);
          if (!existing.exists()) {
            await setDoc(userDoc, {
              id: userId,
              email: syntheticEmail,
              name: buyerName,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: fullPhone,
              role: 'customer',
              autoRegistered: true,
              createdAt: Timestamp.now(),
            });
          }
          // localStorage-ə yaz ki, payment-success/-də istifadə olunsun
          localStorage.setItem('userId', userId);
          localStorage.setItem('userEmail', syntheticEmail);
          localStorage.setItem('userName', buyerName);
          localStorage.setItem('userRole', 'customer');
          try { sessionStorage.setItem('dv_auto_pw', password); } catch { /* noop */ }
        } catch (e: any) {
          // Email artıq mövcuddursa istifadəçini sadəcə davam etdir
          if (e?.code === 'auth/email-already-in-use') {
            setError('Bu telefon nömrəsi ilə artıq qeydiyyat var. Zəhmət olmasa daxil olun.');
            setSubmitting(false);
            return;
          }
          throw e;
        }
      }

      const { id: orderId } = await createCustomerOrder({
        userId: userId || `guest-${Date.now()}`,
        customerName: buyerName,
        customerEmail: userEmail,
        customerPhone: fullPhone,
        customerAddress: 'Hədiyyə Kartı (rəqəmsal)',
        notes: [
          `Alıcı: ${meta.recipientName}`,
          `Alıcı telefonu: ${meta.recipientPhone}`,
          meta.message ? `Mesaj: ${meta.message}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        items: [
          {
            productId: `custom-giftcard-${meta.amount}`,
            productName: `Hədiyyə Kartı — ${meta.amount} AZN`,
            image: '',
            quantity: meta.quantity,
            price: meta.amount,
          },
        ],
        subtotal: total,
        discountAmount: 0,
        totalAmount: total,
        deliveryFee: 0,
        paymentMethod: 'epoint',
      } as any);

      sessionStorage.setItem('pending_epoint_order_id', orderId);

      await startEpointPayment({
        orderId,
        amount: total,
        description: `DE VALEUR Hədiyyə Kartı — ${meta.amount} AZN × ${meta.quantity}`,
      });
    } catch (e: any) {
      console.error('Gift card checkout error:', e);
      setError(e?.message || 'Ödənişə keçilmədi. Yenidən cəhd edin.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1120px] mx-auto px-5 sm:px-8 py-10 md:py-14">
        {/* Top bar */}
        <button
          onClick={() => navigate('/gift-cards')}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-black/55 hover:text-black mb-8"
          data-testid="gift-checkout-back"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> Geri
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10 lg:gap-14 items-start">
          {/* LEFT — qeydiyyat / əlaqə */}
          <div className="order-2 lg:order-1">
            <h1 className="text-[24px] md:text-[32px] font-light tracking-tight text-black mb-2">
              {isLoggedIn ? 'Əlaqə təsdiqi' : 'Qeydiyyat'}
            </h1>
            <p className="text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 mb-8">
              Hesabınız avtomatik yaradılır. Sonradan hesabınıza yenidən daxil olmaq üçün şifrə təyin edin.
            </p>

            <div className="space-y-4">
              {!isLoggedIn && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.22em] text-black/55 mb-1.5">Ad *</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        name="given-name"
                        className="w-full h-12 px-3 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                        data-testid="gift-checkout-firstname"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.22em] text-black/55 mb-1.5">Soyad *</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                        name="family-name"
                        className="w-full h-12 px-3 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                        data-testid="gift-checkout-lastname"
                      />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-[11px] uppercase tracking-[0.22em] text-black/55 mb-1.5">Telefon (+994) *</label>
                <div className="flex h-12 border border-black/25 focus-within:border-black bg-white">
                  <span className="inline-flex items-center px-3 text-[14px] text-black/55 border-r border-black/15">+994</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneDigits}
                    onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    autoComplete="tel"
                    placeholder="50 123 45 67"
                    className="flex-1 px-3 outline-none text-[14px] bg-transparent"
                    data-testid="gift-checkout-phone"
                  />
                </div>
              </div>
              {!isLoggedIn && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.22em] text-black/55 mb-1.5">Şifrə *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      name="new-password"
                      placeholder="ən azı 6 simvol"
                      className="w-full h-12 px-3 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                      data-testid="gift-checkout-password"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.22em] text-black/55 mb-1.5">Şifrəni təkrarla *</label>
                    <input
                      type="password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      autoComplete="new-password"
                      name="new-password-confirm"
                      className="w-full h-12 px-3 border border-black/25 focus:border-black outline-none bg-white text-[14px]"
                      data-testid="gift-checkout-password2"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-[12px] text-red-600" data-testid="gift-checkout-error">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-8 w-full h-14 bg-black text-white text-[12px] uppercase tracking-[0.22em] hover:bg-black/85 disabled:bg-black/40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              data-testid="gift-checkout-pay"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Ödəniş başladılır...
                </>
              ) : (
                <>Ödəniş Et — {total.toLocaleString('az-AZ')} AZN</>
              )}
            </button>
          </div>

          {/* RIGHT — gift card visual + total */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-24 space-y-4">
            <div className="relative w-full max-w-[440px] mx-auto aspect-[16/10] bg-gradient-to-br from-[#1a1410] via-black to-[#2a2218] overflow-hidden rounded-sm shadow-2xl">
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
                    {meta.amount.toLocaleString('az-AZ')}{' '}
                    <span className="text-[20px] md:text-[24px] opacity-80">AZN</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-[440px] mx-auto border border-black/15 bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10">
                <span className="text-[11px] uppercase tracking-[0.2em] text-black/55">Alıcı</span>
                <span className="text-[13px]">{meta.recipientName}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10">
                <span className="text-[11px] uppercase tracking-[0.2em] text-black/55">Say</span>
                <span className="text-[13px] tabular-nums">{meta.quantity}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-black text-white">
                <span className="text-[11px] uppercase tracking-[0.2em] opacity-80">Ödəniləcək</span>
                <span className="text-[18px] font-light tabular-nums" data-testid="gift-checkout-total">
                  {total.toLocaleString('az-AZ')} AZN
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardCheckoutPage;
