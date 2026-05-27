import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, Minus, Check, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc as fsDoc, getDoc as fsGetDoc } from 'firebase/firestore';
import { auth, db as fsDb } from '../lib/firebase';
import { createB2BOrder, sendB2BOrderEmail } from '../services/b2bOrderService';
import { createCustomerOrder } from '../services/customerOrderService';
import { startEpointPayment, getEpointRedirectUrl } from '../services/epointPaymentService';
import { getDeliveryMethods, type DeliveryMethod } from '../services/deliveryMethodService';
import SuccessNotification from '../components/SuccessNotification';
import CreditApplicationForm from '../components/CreditApplicationForm';
import CustomerLogin from '../components/auth/CustomerLogin';
import { validatePromoCode, redeemPromoCode } from '../services/promoCodeService';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice, getDiscountAmount, getDiscountedTotal, getUserDiscount } = useCart();
  const [isB2BUser] = useState(() => localStorage.getItem('userRole') === 'b2b');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Hansı sahə boşdur — pulsing red ring üçün istifadə olunur
  const [missingField, setMissingField] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const initPhone = (localStorage.getItem('userPhone') || '').replace(/^\+?994/, '').replace(/\D/g, '');
  const [phoneDigits, setPhoneDigits] = useState(initPhone);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Inline Epoint widget — embedded in the checkout page (no redirect, no modal)
  const [inlineWidgetUrl, setInlineWidgetUrl] = useState<string | null>(null);
  const [inlineWidgetLoading, setInlineWidgetLoading] = useState(false);
  // Auth mode toggle inside the checkout — 'register' (new customer) | 'login' (existing)
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [loginPassword, setLoginPassword] = useState('');
  // True once we've detected the entered phone already has an account
  // (auto-suggests switching to login mode).
  const [phoneAlreadyRegistered, setPhoneAlreadyRegistered] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);

  // Device detection (reserved for future use)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestPassword2, setGuestPassword2] = useState('');
  const [emailOptIn] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<
    | { code: string; type: 'percent'; discount: number }
    | { code: string; type: 'amount'; amountAZN: number }
    | null
  >(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const userDiscount = getUserDiscount();

  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('userId'));
  useEffect(() => {
    const sync = () => setIsLoggedIn(!!localStorage.getItem('userId'));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // Epoint-dən geri qayıdanda (back button / bfcache) loading state sıfırlansın
  // və sayt firlandı vəziyyətdə qalmasın
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      // bfcache-dən bərpa olunduqda və ya səhifə yenidən görünəndə
      if (e.persisted || sessionStorage.getItem('pending_epoint_order_id')) {
        setLoading(false);
        setWidgetUrl(null);
        // Epoint-ə getmişdi amma ödəniş tamamlanmadı — sessiyanı təmizlə
        sessionStorage.removeItem('pending_epoint_order_id');
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && sessionStorage.getItem('pending_epoint_order_id')) {
        // Səhifə yenidən görünür və Epoint sessiyası açıq qalıb — loading-i sıfırla
        setLoading(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  useEffect(() => {
    if (showCheckout) setIsLoggedIn(!!localStorage.getItem('userId'));
  }, [showCheckout]);

  // Auto-detect: if user types a phone that already has an account, switch to
  // login mode and tell them they don't need to re-register.
  useEffect(() => {
    if (isLoggedIn) return;
    const clean = phoneDigits.replace(/\D/g, '');
    if (clean.length !== 9) {
      setPhoneAlreadyRegistered(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const fullPhone = `+994${clean}`;
        const snap = await getDocs(
          query(collection(fsDb, 'users'), where('phone', '==', fullPhone), limit(1))
        );
        if (cancelled) return;
        if (!snap.empty) {
          setPhoneAlreadyRegistered(true);
          // Auto-switch to login mode so customer sees password field next.
          setAuthMode((prev) => {
            if (prev === 'register') {
              setLoginPassword('');
              return 'login';
            }
            return prev;
          });
        } else {
          setPhoneAlreadyRegistered(false);
        }
      } catch {
        // If rules block the read, fall back silently — the order flow will
        // still surface auth/email-already-in-use error.
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phoneDigits, isLoggedIn]);

  // Listen for Epoint inline-iframe postMessage results
  useEffect(() => {
    if (!inlineWidgetUrl) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (typeof data.status !== 'string') return;
      const status = String(data.status).toLowerCase();
      if (status === 'success') {
        const orderId = sessionStorage.getItem('pending_epoint_order_id') || '';
        setInlineWidgetUrl(null);
        navigate(`/payment/success${orderId ? `?orderId=${orderId}` : ''}`);
      } else if (status === 'error' || status === 'failed' || status === 'declined') {
        const msg = data?.payment?.message || data?.message || 'Ödəniş tamamlanmadı. Yenidən cəhd edin.';
        setInlineWidgetUrl(null);
        setLoading(false);
        setErrorMessage(String(msg));
        setShowError(true);
        setTimeout(() => setShowError(false), 5000);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [inlineWidgetUrl, navigate]);

  // Auto-open checkout if redirected from cart drawer with ?checkout=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === '1' && items.length > 0 && !isB2BUser) {
      setShowCheckout(true);
    }
  }, [location.search, items.length, isB2BUser]);
  const loggedInName = localStorage.getItem('userName') || '';
  const loggedInEmail = localStorage.getItem('userEmail') || '';

  useEffect(() => {
    if (!isB2BUser) {
      getDeliveryMethods(true).then((methods) => {
        setDeliveryMethods(methods);
        if (methods.length > 0 && !selectedDeliveryId) {
          setSelectedDeliveryId(methods[0].id!);
        }
      }).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isB2BUser]);

  const selectedDelivery = deliveryMethods.find((m) => m.id === selectedDeliveryId);
  const deliveryFee = selectedDelivery?.price || 0;
  const isPickupFlow = !!(selectedDelivery?.isPickup && selectedDelivery?.branches?.length);
  const selectedBranch = selectedDelivery?.branches?.find((b) => b.id === selectedBranchId) || null;

  useEffect(() => {
    if (selectedDelivery?.isPickup && selectedDelivery.branches && selectedDelivery.branches.length > 0) {
      if (!selectedBranchId || !selectedDelivery.branches.some((b) => b.id === selectedBranchId)) {
        setSelectedBranchId(selectedDelivery.branches[0].id);
      }
    } else if (selectedBranchId) {
      setSelectedBranchId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeliveryId]);

  const getItemsAfterAllDiscounts = (): number => {
    const baseItems = userDiscount > 0 ? getDiscountedTotal() : getTotalPrice();
    if (!promoApplied) return baseItems;
    if (promoApplied.type === 'amount') {
      return Math.max(0, +(baseItems - promoApplied.amountAZN).toFixed(2));
    }
    return +(baseItems * (1 - promoApplied.discount / 100)).toFixed(2);
  };

  const getPromoDiscountAmount = (): number => {
    if (!promoApplied) return 0;
    const baseItems = userDiscount > 0 ? getDiscountedTotal() : getTotalPrice();
    if (promoApplied.type === 'amount') {
      return Math.min(promoApplied.amountAZN, baseItems);
    }
    return +(baseItems * (promoApplied.discount / 100)).toFixed(2);
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    setPromoError('');
    if (!/^[A-Z0-9]{3,20}$/.test(code)) {
      setPromoError('Promo kod 3-20 simvol arası hərf və rəqəmlərdən ibarət olmalıdır');
      return;
    }
    setPromoLoading(true);
    try {
      const userId = localStorage.getItem('userId') || undefined;
      const res = await validatePromoCode(code, userId);
      if (res.valid) {
        if (res.type === 'amount') {
          setPromoApplied({ code, type: 'amount', amountAZN: res.amountAZN });
        } else {
          setPromoApplied({ code, type: 'percent', discount: res.discount });
        }
        setPromoError('');
      } else {
        setPromoApplied(null);
        setPromoError(res.reason);
      }
    } catch (e: any) {
      setPromoError('Yoxlama alınmadı: ' + (e?.message || ''));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(null);
    setPromoInput('');
    setPromoError('');
  };

  const openCheckout = async () => {
    if (items.length === 0) return;
    if (isB2BUser) { await handleB2BOrder(); return; }
    setShowCheckout(true);
  };

  const handleEpointCheckout = async (mode: 'redirect' | 'widget' = 'widget') => {
    if (items.length === 0) return;

    let userId = localStorage.getItem('userId');
    let userName = localStorage.getItem('userName') || '';
    let userEmail = localStorage.getItem('userEmail') || '';

    // Validation helper — boş sahəni göstər, scroll et, qırmızı diqqət ringi qoy
    const flagMissing = (testId: string, message: string, durationMs = 4500) => {
      // Only override the error toast if a non-empty message is supplied.
      // (Callers may pre-set errorMessage with custom text and pass '' here
      // just to trigger the red ring + scroll.)
      if (message) {
        setErrorMessage(message);
        setShowError(true);
        setTimeout(() => setShowError(false), durationMs);
      }
      setMissingField(testId);
      // Növbəti tick-də scroll + focus (input render olduqdan sonra)
      setTimeout(() => {
        try {
          const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = (el as HTMLElement).tagName === 'INPUT' || (el as HTMLElement).tagName === 'TEXTAREA'
              ? (el as HTMLInputElement)
              : el.querySelector<HTMLInputElement>('input, textarea');
            input?.focus({ preventScroll: true });
          }
        } catch {
          /* ignore */
        }
      }, 50);
      // Diqqət ringi 5 saniyə sonra söndür
      setTimeout(() => setMissingField((c) => (c === testId ? null : c)), 5000);
    };

    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (cleanPhone.length !== 9) {
      flagMissing('checkout-phone-input', 'Telefon nömrəsini tam daxil edin (9 rəqəm). Məs: 50 123 45 67');
      return;
    }
    const fullPhone = `+994${cleanPhone}`;
    const syntheticEmail = `phone994${cleanPhone}@devaleur.az`;

    if (!userId) {
      if (authMode === 'login') {
        // Existing customer flow — phone + password only
        if (loginPassword.length < 6) {
          flagMissing('checkout-login-password', 'Şifrə ən azı 6 simvol olmalıdır.');
          return;
        }
      } else {
        // New registration flow
        if (!guestName.trim()) {
          flagMissing('checkout-first-name', 'Adınızı daxil edin.');
          return;
        }
        if (!guestLastName.trim()) {
          flagMissing('checkout-last-name', 'Soyadınızı daxil edin.');
          return;
        }
        if (guestPassword.length < 6) {
          flagMissing('checkout-password', 'Şifrə ən azı 6 simvol olmalıdır.');
          return;
        }
        if (guestPassword !== guestPassword2) {
          flagMissing('checkout-password2', 'Şifrələr uyğun gəlmir. Yenidən yoxlayın.');
          return;
        }
      }
    }

    if (deliveryMethods.length > 0 && !selectedDeliveryId) {
      flagMissing('delivery-method-list', 'Çatdırılma üsulunu seçin.');
      return;
    }

    if (isPickupFlow && !selectedBranch) {
      flagMissing('pickup-branch-selector', 'Hansı filialdan götürəcəyinizi seçin.');
      return;
    }

    if (!isPickupFlow && !customerAddress.trim()) {
      flagMissing('checkout-address-input', 'Çatdırılma ünvanını daxil edin.');
      return;
    }

    setMissingField(null);
    setLoading(true);
    try {
      if (!userId) {
        if (authMode === 'login') {
          // Sign in existing customer
          try {
            const cred = await signInWithEmailAndPassword(auth, syntheticEmail, loginPassword);
            userId = cred.user.uid;
            const userDoc = await fsGetDoc(fsDoc(fsDb, 'users', userId));
            const userData = userDoc.exists() ? (userDoc.data() as any) : {};
            userName = (userData.name || '') + (userData.surname ? ' ' + userData.surname : '');
            userName = userName.trim() || fullPhone;
            userEmail = cred.user.email || syntheticEmail;

            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', userData.role || 'customer');
            localStorage.setItem('userName', userName);
            localStorage.setItem('userEmail', userEmail);
            localStorage.setItem('userPhone', userData.phone || fullPhone);
            if (userData.surname) localStorage.setItem('userSurname', userData.surname);
            localStorage.setItem('userData', JSON.stringify({
              id: userId, email: userEmail, name: userName, role: userData.role || 'customer',
              phone: userData.phone || fullPhone, surname: userData.surname || '',
              discountPercentage: userData.discountPercentage || 0,
              discountUsageType: userData.discountUsageType || 'unlimited',
              discountUsed: userData.discountUsed || false,
            }));
            setIsLoggedIn(true);
          } catch (loginErr: any) {
            const code = loginErr?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
              setErrorMessage('Nömrə və ya şifrə yanlışdır. Yenidən cəhd edin və ya "Yeni qeydiyyat" seçin.');
            } else if (code === 'auth/too-many-requests') {
              setErrorMessage('Çox cəhd oldu. Bir az sonra yenidən cəhd edin.');
            } else {
              setErrorMessage('Giriş alınmadı: ' + (loginErr?.message || 'naməlum xəta'));
            }
            setShowError(true);
            setTimeout(() => setShowError(false), 6000);
            setLoading(false);
            flagMissing('checkout-login-password', '');
            return;
          }
        } else {
          // Register new user — check duplicate first
          try {
            const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
            const dupSnap = await getDocs(
              query(collection(fsDb, 'users'), where('phone', '==', fullPhone), limit(1))
            );
            if (!dupSnap.empty) {
              setErrorMessage('Bu nömrə artıq qeydiyyatdadır. "Hesabım var" seçərək şifrənizi daxil edin.');
              setShowError(true);
              setTimeout(() => setShowError(false), 6000);
              setLoading(false);
              setAuthMode('login');
              setPhoneAlreadyRegistered(true);
              return;
            }
          } catch { /* if rules block read, just continue and let auth handle duplicates */ }

          const autoPassword = guestPassword;
          try {
            const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, autoPassword);
            userId = cred.user.uid;
            userName = (guestName.trim() + (guestLastName ? ' ' + guestLastName.trim() : '')).trim();
            userEmail = syntheticEmail;

            await setDoc(fsDoc(fsDb, 'users', userId), {
              id: userId,
              email: syntheticEmail,
              name: userName,
              surname: guestLastName.trim(),
              phone: fullPhone,
              role: 'customer',
              discountPercentage: 0,
              discountUsageType: 'unlimited',
              discountUsed: false,
              autoRegistered: true,
              emailOptIn,
              createdAt: new Date().toISOString(),
            });

            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', 'customer');
            localStorage.setItem('userName', userName);
            localStorage.setItem('userEmail', userEmail);
            localStorage.setItem('userPhone', fullPhone);
            localStorage.setItem('userData', JSON.stringify({
              id: userId, email: userEmail, name: userName, role: 'customer',
              phone: fullPhone, surname: guestLastName.trim(),
              discountPercentage: 0, discountUsageType: 'unlimited', discountUsed: false,
            }));
            sessionStorage.setItem('dv_auto_pw', autoPassword);
          } catch (regErr: any) {
            if (regErr?.code === 'auth/email-already-in-use') {
              setErrorMessage('Bu nömrə artıq qeydiyyatdadır. "Hesabım var" seçərək şifrənizi daxil edin.');
              setAuthMode('login');
              setPhoneAlreadyRegistered(true);
            } else {
              setErrorMessage('Qeydiyyat xətası: ' + (regErr?.message || 'naməlum'));
            }
            setShowError(true);
            setTimeout(() => setShowError(false), 6000);
            setLoading(false);
            return;
          }
        }
      } else {
        localStorage.setItem('userPhone', fullPhone);
      }

      const orderItems = items.map((item) => {
        const price = item.product.salePrice || item.product.price;
        const productName =
          item.product.name[i18n.language as 'az' | 'ru' | 'en'] ||
          item.product.name.en ||
          item.product.name.az;
        return {
          productId: item.product.id,
          productName,
          image: item.product.images?.[0] || '',
          quantity: item.quantity,
          price,
        };
      });

      const subtotal = getTotalPrice();
      const userDiscountAmt = getDiscountAmount();
      const promoDiscountAmt = getPromoDiscountAmount();
      const discount = userDiscountAmt + promoDiscountAmt;
      const itemsTotal = getItemsAfterAllDiscounts();
      const total = itemsTotal + deliveryFee;

      const { id: orderId } = await createCustomerOrder({
        userId,
        customerName: userName,
        customerEmail: userEmail,
        customerPhone: fullPhone,
        customerAddress: isPickupFlow && selectedBranch
          ? `${selectedBranch.name} — ${selectedBranch.address}`
          : customerAddress.trim(),
        notes: customerNote.trim() || '',
        items: orderItems,
        subtotal,
        discountAmount: discount,
        totalAmount: total,
        deliveryMethodId: selectedDelivery?.id || '',
        deliveryMethodName: selectedDelivery?.name || '',
        deliveryFee,
        ...(isPickupFlow && selectedBranch
          ? {
              isPickup: true,
              pickupBranchId: selectedBranch.id,
              pickupBranchName: selectedBranch.name,
              pickupBranchAddress: selectedBranch.address,
            }
          : {}),
        paymentMethod: 'epoint',
        promoCode: promoApplied?.code || '',
        promoDiscountPercent:
          promoApplied?.type === 'percent' ? promoApplied.discount : 0,
        promoDiscountAmount: promoDiscountAmt,
      } as any);

      sessionStorage.setItem('pending_epoint_order_id', orderId);

      if (promoApplied) {
        redeemPromoCode(promoApplied.code, {
          userId,
          userEmail,
          userName,
          orderId,
        }).catch((e) => console.warn('Promo kod redeem xətası:', e));
      }

      try {
        if (mode === 'widget') {
          // Inline payment — fetch hosted-checkout URL from Epoint and render
          // it in an iframe right inside the checkout page (no redirect, no
          // popup modal). The hosted page renders the card form (and Apple
          // Pay / Google Pay buttons where supported). Customer scrolls in
          // place and pays.
          setInlineWidgetLoading(true);
          const url = await getEpointRedirectUrl({
            orderId,
            amount: total,
            description: `DE VALEUR sifariş #${orderId.slice(0, 10)}`,
          });
          setInlineWidgetUrl(url);
          setInlineWidgetLoading(false);
          setLoading(false);
          // Scroll the widget into view so customer sees the payment form.
          setTimeout(() => {
            const el = document.querySelector('[data-testid="inline-epoint-widget"]');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
          return;
        }
        await startEpointPayment({ orderId, amount: total });
      } catch (signErr: any) {
        // Ödəniş başlatma uğursuzdursa belə, sifariş "pending_payment" statusunda qalır
        // və müştəri "Sifarişlərim" hissəsindən yenidən ödəyə bilər. Statusu "payment_failed"
        // qoymuruq ki, müştəri yenidən ödəmə imkanını itirməsin.
        sessionStorage.removeItem('pending_epoint_order_id');
        setInlineWidgetLoading(false);
        throw signErr;
      }

      if ((mode as string) === 'widget') {
        return; // Widget mode handled inline above
      }

      const watchdog = window.setTimeout(() => {
        // Ödəniş səhifəsi açıla bilmədi — istifadəçiyə xəbər ver, amma sifariş
        // bazada "pending_payment" statusunda qalır ki, "Sifarişlərim"-dən yenidən ödəyə bilsin
        sessionStorage.removeItem('pending_epoint_order_id');
        setErrorMessage('Ödəniş səhifəsi açıla bilmədi. Sifarişiniz "Sifarişlərim" bölməsində ödəniş gözləyir — istənilən vaxt yenidən cəhd edə bilərsiniz.');
        setShowError(true);
        setLoading(false);
        setTimeout(() => setShowError(false), 7000);
      }, 8000);
      const cancelWatchdog = () => window.clearTimeout(watchdog);
      window.addEventListener('beforeunload', cancelWatchdog, { once: true });
      window.addEventListener('pagehide', cancelWatchdog, { once: true });
    } catch (error: any) {
      console.error('Epoint checkout error:', error);
      setErrorMessage(error.message || 'Ödəniş başladıla bilmədi. Zəhmət olmasa yenidən cəhd edin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 6000);
      setLoading(false);
    }
  };

  const handleB2BOrder = async () => {
    setLoading(true);
    try {
      const userName = localStorage.getItem('userName') || 'B2B Müştəri';
      const userEmail = localStorage.getItem('userEmail') || '';
      const userPhone = localStorage.getItem('userPhone') || '';
      if (!userEmail) throw new Error('İstifadəçi email tapılmadı');

      const orderItems = items.map(item => {
        const regularPrice = isB2BUser
          ? (item.product.b2bSalePrice || item.product.b2bPrice || item.product.salePrice || item.product.price)
          : (item.product.salePrice || item.product.price);
        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          regularPrice
        };
      });

      const userDiscountAmount = getDiscountAmount();
      const finalTotal = getDiscountedTotal();

      const userDataStr = localStorage.getItem('userData');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;

      const order = {
        customerName: userName,
        customerLastname: userData?.surname || '',
        customerEmail: userEmail,
        customerPhone: userPhone,
        companyName: userData?.companyName || '',
        items: orderItems,
        totalAmount: finalTotal,
        discountAmount: userDiscountAmount,
        notes: customerNote.trim() || ''
      };

      const createdOrder = await createB2BOrder(order);

      clearCart();
      setCustomerNote('');
      setShowSuccess(true);
      setLoading(false);

      sendB2BOrderEmail(order, createdOrder.id, createdOrder.orderNumber)
        .catch((emailError) => console.warn('Email göndərilə bilmədi:', emailError));

      if (userDataStr) {
        const ud = JSON.parse(userDataStr);
        if (ud.discountUsageType === 'once' && userDiscount > 0 && ud.id) {
          (async () => {
            try {
              const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', ud.id)));
              if (!usersSnapshot.empty) {
                await updateDoc(usersSnapshot.docs[0].ref, { discountUsed: true });
                ud.discountUsed = true;
                localStorage.setItem('userData', JSON.stringify(ud));
              }
            } catch (e) { console.warn('Discount update failed:', e); }
          })();
        }
      }

      setTimeout(() => {
        setShowSuccess(false);
        navigate('/products');
      }, 2500);
      return;
    } catch (error: any) {
      console.error('Order error:', error);
      let message = 'Sifariş göndərilə bilmədi. ';
      if (error.message) message += error.message;
      else if (error.code === 'permission-denied') message += 'İcazə xətası. Zəhmət olmasa yenidən daxil olun.';
      else message += 'Zəhmət olmasa yenidən cəhd edin.';
      setErrorMessage(message);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getItemPrice = (item: typeof items[0]) => {
    if (isB2BUser) {
      return item.product.b2bSalePrice || item.product.b2bPrice || item.product.salePrice || item.product.price;
    }
    return item.product.salePrice || item.product.price;
  };

  // Show a full-screen "preparing payment" loader if checkout is in progress
  // AND the cart is empty (post-order, pre-redirect). Avoids the brief
  // "cart is empty" flash on slow mobile connections before Epoint opens.
  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6" data-testid="checkout-redirect-loader">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-5" />
        <p className="text-sm font-medium text-gray-900">Ödəniş səhifəsi açılır...</p>
        <p className="text-xs text-gray-500 mt-1">Zəhmət olmasa gözləyin</p>
      </div>
    );
  }

  // Empty cart — but DON'T show this while a checkout/payment is in progress
  // (items can briefly be empty between order-creation and the Epoint redirect
  // on slow mobile connections, causing a flash of the empty-cart screen).
  if (items.length === 0 && !loading) {
    return (
      <>
        {showSuccess && (
          <SuccessNotification
            message={isB2BUser ? t('cart.b2bOrderSentSuccess') : t('cart.orderSentSuccess')}
            onClose={() => setShowSuccess(false)}
            duration={2500}
          />
        )}
        {showError && (
          <SuccessNotification
            message={errorMessage}
            type="error"
            onClose={() => setShowError(false)}
            duration={5000}
          />
        )}
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
          <div className="text-center max-w-md mx-auto">
            <h2 className="text-2xl md:text-3xl font-light text-black tracking-tight mb-3">
              {t('cart.emptyCart')}
            </h2>
            <p className="text-black/55 text-sm font-light mb-8">{t('cart.noProducts')}</p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-black text-white text-[12px] uppercase tracking-[0.25em] font-medium hover:bg-black/85 transition-colors"
              data-testid="cart-empty-shop-btn"
            >
              {t('cart.viewProducts')}
            </button>
          </div>
        </div>
      </>
    );
  }

  const subtotal = userDiscount > 0 ? getDiscountedTotal() : getTotalPrice();

  // Rosefield-style CART (drawer-like centered column)
  return (
    <>
      {showSuccess && (
        <SuccessNotification
          message={isB2BUser ? t('cart.b2bOrderSentSuccess') : t('cart.orderSentSuccess')}
          onClose={() => setShowSuccess(false)}
          duration={2500}
        />
      )}

      {showError && (
        <SuccessNotification
          message={errorMessage}
          type="error"
          onClose={() => setShowError(false)}
          duration={5000}
        />
      )}

      {loading && !isB2BUser && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          data-testid="payment-loading-overlay"
        >
          <div className="bg-white px-8 py-7 max-w-sm mx-4 flex flex-col items-center text-center">
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-gray-100"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-black animate-spin"></div>
            </div>
            <h3 className="font-medium text-black text-base mb-1">Ödəniş hazırlanır...</h3>
            <p className="text-xs text-black/55 leading-relaxed mb-4">
              Sizi təhlükəsiz ödəniş səhifəsinə yönləndiririk.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(false);
                setWidgetUrl(null);
                sessionStorage.removeItem('pending_epoint_order_id');
              }}
              className="text-[11px] uppercase tracking-[0.18em] text-black/45 hover:text-black/80 transition-colors underline-offset-2 hover:underline"
              data-testid="payment-loading-cancel-btn"
            >
              Ləğv et
            </button>
          </div>
        </div>
      )}

      {/* CART PAGE — Rosefield-style centered column */}
      <div className="min-h-screen bg-white">
        <div className="max-w-[640px] mx-auto px-5 sm:px-8 py-8 md:py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-[26px] md:text-[28px] font-normal text-black" data-testid="cart-title">
              {t('cart.emptyCart')}
            </h1>
            <button
              onClick={() => navigate(-1)}
              aria-label="Close"
              className="text-black hover:opacity-60 transition-opacity"
              data-testid="cart-close-btn"
            >
              <X className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </div>

          {/* Items */}
          <div className="space-y-6 mb-10">
            {items.map((item) => {
              const price = getItemPrice(item);
              const productName = item.product.name[i18n.language as 'az' | 'ru' | 'en'] || item.product.name.en || item.product.name.az;

              return (
                <div key={item.product.id} className="flex gap-5" data-testid={`cart-item-${item.product.id}`}>
                  {/* Image tile */}
                  <div className="w-[110px] h-[140px] flex-shrink-0 bg-white border border-black/10 flex items-center justify-center overflow-hidden">
                    <img
                      src={item.product.images?.[0]}
                      alt={productName}
                      className="max-w-full max-h-full object-contain p-3"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] text-black font-normal leading-tight truncate">
                          {productName}
                        </h3>
                        <p className="text-[14px] text-black/80 mt-1.5">
                          {(price * item.quantity).toFixed(2)} AZN
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-black/50 hover:text-black transition-colors"
                        aria-label="Remove"
                        data-testid={`cart-remove-${item.product.id}`}
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="inline-flex items-center border border-black/30">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                          aria-label="Decrease"
                          data-testid={`cart-qty-minus-${item.product.id}`}
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <span className="w-10 text-center text-[14px] select-none border-x border-black/30 leading-9">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                          aria-label="Increase"
                          data-testid={`cart-qty-plus-${item.product.id}`}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-black/15"></div>

          {/* Subtotal */}
          <div className="flex items-center justify-between py-7">
            <span className="text-[15px] text-black">{t('checkout.subtotal')}</span>
            <span className="text-[15px] text-black tabular-nums" data-testid="cart-subtotal">
              {subtotal.toFixed(2)} AZN
            </span>
          </div>

          {/* Checkout button */}
          <button
            onClick={openCheckout}
            disabled={loading}
            className="w-full h-14 bg-black text-white text-[13px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="cart-checkout-btn"
          >
            {loading ? t('cart.sending') : isB2BUser ? t('cart.completeOrder') : t('cart.checkOut')}
          </button>

          {/* Secondary actions */}
          <div className="mt-5 flex items-center justify-between text-[12px]">
            <button
              onClick={() => navigate('/products')}
              className="text-black/60 hover:text-black underline-offset-4 hover:underline transition-colors"
              data-testid="cart-continue-shopping"
            >
              {t('cart.continueShopping')}
            </button>
            <button
              onClick={() => clearCart()}
              className="text-black/60 hover:text-black underline-offset-4 hover:underline transition-colors"
              data-testid="cart-clear-all"
            >
              {t('cart.removeAll')}
            </button>
          </div>

          {!isB2BUser && (
            <button
              onClick={() => setShowCreditForm(true)}
              className="mt-8 w-full inline-flex items-center justify-center px-5 py-3.5 text-[12px] uppercase tracking-[0.25em] font-medium bg-black text-white hover:bg-black/85 transition-colors"
              data-testid="cart-credit-btn"
            >
              {t('cart.buyWithCredit')}
            </button>
          )}

          {isB2BUser && (
            <div className="mt-6">
              <label htmlFor="customer-note" className="block text-[11px] uppercase tracking-[0.25em] text-black/55 mb-2">
                Qeyd əlavə et
              </label>
              <textarea
                id="customer-note"
                data-testid="b2b-cart-customer-note"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Əlavə qeyd yazın..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 text-sm border border-black/20 focus:border-black outline-none resize-none transition-colors bg-white"
              />
              <p className="text-[10px] text-black/40 mt-1 text-right">{customerNote.length}/500</p>
            </div>
          )}
        </div>
      </div>

      {showCreditForm && items.length > 0 && (
        <CreditApplicationForm
          productName={t('cart.cartItems', { count: items.length })}
          productPrice={getTotalPrice()}
          onClose={() => setShowCreditForm(false)}
        />
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[80]">
          <CustomerLogin
            onClose={() => {
              setShowLoginModal(false);
              setIsLoggedIn(!!localStorage.getItem('userId'));
            }}
          />
        </div>
      )}

      {/* Epoint widget is now rendered INLINE inside the checkout panel (no modal) */}

      {/* CHECKOUT — Rosefield-style two-column */}
      {showCheckout && !isB2BUser && (
        <div
          id="inline-checkout"
          className="fixed inset-0 z-50 bg-white overflow-y-auto"
          data-testid="inline-checkout-panel"
        >
          {/* Logo header */}
          <div className="border-b border-black/10">
            <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
              <button
                onClick={() => {
                  if (loading) return;
                  setShowCheckout(false);
                  // Signal Header to reopen cart drawer
                  try { sessionStorage.setItem('reopenCartDrawer', '1'); } catch { /* noop */ }
                  navigate('/');
                }}
                className="text-[12px] uppercase tracking-[0.2em] text-black hover:opacity-60 transition-opacity"
                data-testid="inline-checkout-close"
              >
                ← {t('checkout.back')}
              </button>
              <img
                src="https://i.hizliresim.com/tmu65g6.png"
                alt="De Valeur"
                className="h-8 md:h-10"
              />
              <div className="w-12" />
            </div>
          </div>

          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-12">
            {/* LEFT — form (simplified) */}
            <div className="px-5 sm:px-8 lg:pl-12 lg:pr-6 py-8 md:py-12 lg:border-r lg:border-black/10">
              {/* QEYDIYYAT / GİRİŞ */}
              <div className="mb-8">
                <h2 className="text-[14px] uppercase tracking-[0.22em] text-black/65 mb-4" data-testid="checkout-section-title">
                  {isLoggedIn ? 'Hesab' : (authMode === 'login' ? 'Daxil ol' : 'Qeydiyyat')}
                </h2>

                {!isLoggedIn && (
                  <div className="flex border-b border-black/15 mb-5" data-testid="checkout-auth-tabs">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('register'); setMissingField(null); }}
                      className={`flex-1 pb-3 text-[11px] uppercase tracking-[0.22em] transition-colors ${
                        authMode === 'register'
                          ? 'border-b-2 border-black -mb-px text-black font-medium'
                          : 'text-black/45 hover:text-black/70'
                      }`}
                      data-testid="checkout-auth-tab-register"
                    >
                      Yeni qeydiyyat
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setMissingField(null); }}
                      className={`flex-1 pb-3 text-[11px] uppercase tracking-[0.22em] transition-colors ${
                        authMode === 'login'
                          ? 'border-b-2 border-black -mb-px text-black font-medium'
                          : 'text-black/45 hover:text-black/70'
                      }`}
                      data-testid="checkout-auth-tab-login"
                    >
                      Hesabım var
                    </button>
                  </div>
                )}

                {!isLoggedIn && phoneAlreadyRegistered && authMode === 'login' && (
                  <div
                    className="mb-3 px-3 py-2.5 border border-black/15 bg-black/[0.03] text-[12px] text-black/75"
                    data-testid="checkout-existing-account-hint"
                  >
                    Bu nömrə artıq qeydiyyatdadır. Şifrənizi daxil edib davam edin — yenidən qeydiyyatdan keçməyə ehtiyac yoxdur.
                  </div>
                )}

                {!isLoggedIn && authMode === 'register' ? (
                  <div className="space-y-3 mb-3">
                    <div className="grid grid-cols-2 gap-3">
                      <RFInput
                        label={t('checkout.firstName')}
                        required
                        value={guestName}
                        onChange={(v) => { setGuestName(v); if (missingField === 'checkout-first-name') setMissingField(null); }}
                        testId="checkout-first-name"
                        error={missingField === 'checkout-first-name'}
                        name="given-name"
                        autoComplete="given-name"
                      />
                      <RFInput
                        label={t('checkout.lastName')}
                        required
                        value={guestLastName}
                        onChange={(v) => { setGuestLastName(v); if (missingField === 'checkout-last-name') setMissingField(null); }}
                        testId="checkout-last-name"
                        error={missingField === 'checkout-last-name'}
                        name="family-name"
                        autoComplete="family-name"
                      />
                    </div>
                    <RFInput
                      label={t('checkout.phone')}
                      required
                      value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                      onChange={(v) => { setPhoneDigits(v.replace(/\D/g, '').slice(0, 9)); if (missingField === 'checkout-phone-input') setMissingField(null); }}
                      testId="checkout-phone-input"
                      inputMode="numeric"
                      placeholder={t('checkout.phonePlaceholder')}
                      error={missingField === 'checkout-phone-input'}
                      name="tel"
                      autoComplete="tel"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <RFInput
                        label="Şifrə"
                        type="password"
                        required
                        value={guestPassword}
                        onChange={(v) => { setGuestPassword(v); if (missingField === 'checkout-password') setMissingField(null); }}
                        testId="checkout-password"
                        placeholder="ən azı 6 simvol"
                        error={missingField === 'checkout-password'}
                        name="new-password"
                        autoComplete="new-password"
                      />
                      <RFInput
                        label="Şifrəni təkrarla"
                        type="password"
                        required
                        value={guestPassword2}
                        onChange={(v) => { setGuestPassword2(v); if (missingField === 'checkout-password2') setMissingField(null); }}
                        testId="checkout-password2"
                        error={missingField === 'checkout-password2'}
                        name="new-password-confirm"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                ) : !isLoggedIn ? (
                  // LOGIN MODE — only phone + password
                  <div className="space-y-3 mb-3" data-testid="checkout-login-form">
                    <RFInput
                      label={t('checkout.phone')}
                      required
                      value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                      onChange={(v) => { setPhoneDigits(v.replace(/\D/g, '').slice(0, 9)); if (missingField === 'checkout-phone-input') setMissingField(null); }}
                      testId="checkout-phone-input"
                      inputMode="numeric"
                      placeholder={t('checkout.phonePlaceholder')}
                      error={missingField === 'checkout-phone-input'}
                      name="tel"
                      autoComplete="tel"
                    />
                    <RFInput
                      label="Şifrə"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(v) => { setLoginPassword(v); if (missingField === 'checkout-login-password') setMissingField(null); }}
                      testId="checkout-login-password"
                      placeholder="şifrəniz"
                      error={missingField === 'checkout-login-password'}
                      name="current-password"
                      autoComplete="current-password"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setShowLoginModal(true)}
                        className="text-[11px] text-black/55 hover:text-black underline underline-offset-2"
                        data-testid="checkout-forgot-password"
                      >
                        Şifrəni unutmusuz?
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('register')}
                        className="text-[11px] text-black/55 hover:text-black underline underline-offset-2"
                        data-testid="checkout-switch-register"
                      >
                        Yeni qeydiyyat
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-3 mb-3 border border-black/15 bg-black/[0.02] text-[13px] text-black/80">
                      {loggedInName || loggedInEmail}
                    </div>
                    {!(phoneDigits.length === 9) && (
                      <div className="mb-3">
                        <RFInput
                          label={t('checkout.phone')}
                          required
                          value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                          onChange={(v) => { setPhoneDigits(v.replace(/\D/g, '').slice(0, 9)); if (missingField === 'checkout-phone-input') setMissingField(null); }}
                          testId="checkout-phone-input"
                          inputMode="numeric"
                          placeholder={t('checkout.phonePlaceholder')}
                          error={missingField === 'checkout-phone-input'}
                          name="tel"
                          autoComplete="tel"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ÇATDIRILMA MƏLUMATLARI */}
              <div className="mb-8">
                <h2 className="text-[14px] uppercase tracking-[0.22em] text-black/65 mb-4">
                  Çatdırılma
                </h2>

                {!isPickupFlow && (
                  <div className="mb-3">
                    <RFInput
                      label={t('checkout.streetHouse')}
                      required
                      value={customerAddress}
                      onChange={(v) => { setCustomerAddress(v); if (missingField === 'checkout-address-input') setMissingField(null); }}
                      testId="checkout-address-input"
                      error={missingField === 'checkout-address-input'}
                      name="street-address"
                      autoComplete="street-address"
                    />
                  </div>
                )}

                {/* Delivery methods — side by side */}
                <div className="mt-5">
                  {deliveryMethods.length === 0 ? (
                    <div className="px-3 py-2.5 border border-black/15 bg-black/[0.02] text-[12px] text-black/60">
                      {t('checkout.loadingMethods')}
                    </div>
                  ) : (
                    <div
                      className={`grid gap-2 transition-all ${
                        deliveryMethods.length >= 3 ? 'grid-cols-3' : deliveryMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                      } ${
                        missingField === 'delivery-method-list'
                          ? 'ring-2 ring-red-500/30 animate-pulse rounded'
                          : ''
                      }`}
                      data-testid="delivery-method-list"
                    >
                      {deliveryMethods.map((m) => {
                        const selected = m.id === selectedDeliveryId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => { setSelectedDeliveryId(m.id!); if (missingField === 'delivery-method-list') setMissingField(null); }}
                            className={`flex flex-col items-start gap-0.5 px-2.5 py-2 border text-left transition-colors ${
                              selected ? 'border-black bg-black/[0.03]' : 'border-black/15 hover:border-black/40'
                            }`}
                            data-testid={`delivery-method-option-${m.id}`}
                          >
                            <p className="text-[12px] text-black truncate w-full">{m.name}</p>
                            {m.estimatedDays && <p className="text-[10px] text-black/55">{m.estimatedDays}</p>}
                            <span className="text-[11px] text-black tabular-nums">
                              {m.price > 0 ? `${m.price.toFixed(2)} AZN` : 'Ödənişsiz'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isPickupFlow && selectedDelivery?.branches && selectedDelivery.branches.length > 0 && (
                    <div className="mt-3" data-testid="pickup-branch-selector">
                      <p className="text-[13px] text-black mb-2">{t('checkout.pickupBranch')}</p>
                      <div className={`border divide-y transition-all ${
                        missingField === 'pickup-branch-selector'
                          ? 'border-red-500 ring-2 ring-red-500/30 animate-pulse divide-red-200'
                          : 'border-black/15 divide-black/15'
                      }`}>
                        {selectedDelivery.branches.map((b) => {
                          const selected = b.id === selectedBranchId;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => { setSelectedBranchId(b.id); if (missingField === 'pickup-branch-selector') setMissingField(null); }}
                              className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors ${selected ? 'bg-black/[0.03]' : 'hover:bg-black/[0.02]'}`}
                              data-testid={`pickup-branch-option-${b.id}`}
                            >
                              <span
                                className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? 'border-black' : 'border-black/40'}`}
                              >
                                {selected && <span className="w-2 h-2 rounded-full bg-black" />}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-black">{b.name}</p>
                                <p className="text-[11px] text-black/55">{b.address}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pay button — opens inline Epoint widget on this page */}
              <button
                onClick={() => handleEpointCheckout('widget')}
                disabled={loading || inlineWidgetLoading || !!inlineWidgetUrl}
                className="w-full h-12 bg-black text-white text-[12px] uppercase tracking-[0.24em] font-medium hover:bg-black/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="checkout-pay-btn"
              >
                {inlineWidgetLoading || loading
                  ? 'Ödəniş hazırlanır...'
                  : inlineWidgetUrl
                    ? 'Ödəniş açıqdır — aşağı sürüşdürün'
                    : 'Ödənişə keç'}
              </button>

              {/* Inline Epoint widget — embedded right here on the page */}
              {inlineWidgetUrl && (
                <div
                  className="mt-6 border border-black/15 bg-white"
                  data-testid="inline-epoint-widget"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-black/[0.02]">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={1.6} />
                      <span className="text-[11px] uppercase tracking-[0.18em] text-black/70 truncate">
                        Təhlükəsiz ödəniş — Epoint
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineWidgetUrl(null);
                        sessionStorage.removeItem('pending_epoint_order_id');
                      }}
                      aria-label="Ödənişi bağla"
                      className="text-[11px] uppercase tracking-[0.16em] text-black/55 hover:text-black transition-colors flex items-center gap-1"
                      data-testid="inline-epoint-close"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Geri
                    </button>
                  </div>
                  <iframe
                    src={inlineWidgetUrl}
                    title="Epoint Payment"
                    className="w-full bg-white border-0 block"
                    style={{ height: '780px' }}
                    allow="payment *; publickey-credentials-get *; clipboard-write"
                    data-testid="inline-epoint-iframe"
                    onLoad={(e) => {
                      // After Epoint completes the payment it redirects the
                      // iframe to our success_redirect_url / error_redirect_url
                      // (same origin). When that happens, break out of the
                      // iframe and navigate the parent window to that URL so
                      // the customer lands on the proper success/error page.
                      try {
                        const ifr = e.currentTarget as HTMLIFrameElement;
                        const href = ifr.contentWindow?.location?.href || '';
                        if (!href) return;
                        if (
                          href.includes('/payment/success') ||
                          href.includes('/payment/error') ||
                          href.includes('/payment/result')
                        ) {
                          window.location.href = href;
                        }
                      } catch {
                        // Cross-origin while still on epoint.az — ignore.
                      }
                    }}
                  />
                  <div className="px-4 py-2.5 border-t border-black/10 text-center bg-black/[0.02]">
                    <p className="text-[10px] text-black/45 uppercase tracking-[0.18em]">
                      Apple Pay · Google Pay · Visa · Mastercard
                    </p>
                  </div>
                </div>
              )}

              {!inlineWidgetUrl && (
                <p className="text-[11px] text-black/45 text-center mt-3">
                  {t('checkout.securePayment')}
                </p>
              )}
            </div>

            {/* RIGHT — order summary */}
            <div className="bg-[#FAFAFA] lg:bg-white px-5 sm:px-8 lg:pr-12 lg:pl-6 py-8 md:py-12">
              {/* Items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => {
                  const price = getItemPrice(item);
                  const productName = item.product.name[i18n.language as 'az' | 'ru' | 'en'] || item.product.name.en || item.product.name.az;
                  return (
                    <div key={item.product.id} className="flex items-center gap-4">
                      <div className="relative w-[64px] h-[64px] flex-shrink-0 bg-white border border-black/10 flex items-center justify-center overflow-hidden">
                        <img src={item.product.images?.[0]} alt={productName} className="max-w-full max-h-full object-contain p-1.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-black truncate">{productName}</p>
                        <p className="text-[12px] text-black/55 mt-0.5">
                          Miqdar: <span className="text-black font-medium">{item.quantity}</span>
                        </p>
                      </div>
                      <span className="text-[13px] text-black tabular-nums">
                        {(price * item.quantity).toFixed(2)} AZN
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Discount code */}
              <div className="mb-6">
                {promoApplied ? (
                  <div
                    className="flex items-center justify-between px-3 py-3 border border-black/20 bg-black/[0.03]"
                    data-testid="promo-applied-box"
                  >
                    <div className="text-[13px] text-black flex items-center gap-2 min-w-0">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono truncate">{promoApplied.code}</span>
                      <span className="text-[12px] text-black/60 whitespace-nowrap">
                        {promoApplied.type === 'amount'
                          ? `−${promoApplied.amountAZN.toFixed(2)} AZN`
                          : `−${promoApplied.discount}%`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-[12px] text-black underline underline-offset-2 hover:opacity-70"
                      data-testid="promo-remove-btn"
                    >
                      {t('checkout.remove')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-stretch border border-black/20 focus-within:border-black transition-colors">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20));
                        if (promoError) setPromoError('');
                      }}
                      placeholder={t('checkout.discountCode')}
                      maxLength={20}
                      className="flex-1 px-3 py-3 text-[13px] uppercase tracking-wider bg-transparent outline-none placeholder:text-black/40 placeholder:normal-case placeholder:tracking-normal"
                      data-testid="promo-code-input"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || promoInput.length < 3}
                      className="px-5 text-[12px] uppercase tracking-[0.18em] text-black/70 disabled:text-black/30 hover:text-black transition-colors"
                      data-testid="promo-apply-btn"
                    >
                      {promoLoading ? '...' : t('checkout.apply')}
                    </button>
                  </div>
                )}
                {promoError && <p className="text-[11px] text-[#D14545] mt-1.5" data-testid="promo-error">{promoError}</p>}
              </div>

              {/* Totals */}
              <div className="space-y-3 text-[14px] py-4 border-t border-black/10">
                <div className="flex items-center justify-between">
                  <span className="text-black/70">{t('checkout.subtotal')}</span>
                  <span className="text-black tabular-nums">{getTotalPrice().toFixed(2)} AZN</span>
                </div>
                {userDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>{t('cart.discount')} ({userDiscount}%)</span>
                    <span className="tabular-nums">−{getDiscountAmount().toFixed(2)} AZN</span>
                  </div>
                )}
                {promoApplied && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>
                      {t('checkout.discountCode')}{' '}
                      {promoApplied.type === 'amount'
                        ? `(${promoApplied.amountAZN.toFixed(0)} AZN)`
                        : `(${promoApplied.discount}%)`}
                    </span>
                    <span className="tabular-nums">−{getPromoDiscountAmount().toFixed(2)} AZN</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-black/70">{t('checkout.shipping')}</span>
                  <span className="text-black/55 text-[13px]">
                    {selectedDelivery
                      ? deliveryFee > 0 ? `${deliveryFee.toFixed(2)} AZN` : t('checkout.free')
                      : t('checkout.enterShippingAddress')}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between py-4 border-t border-black/10">
                <span className="text-[18px] font-medium text-black">{t('checkout.total')}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-medium text-black tabular-nums" data-testid="checkout-total">
                    {(getItemsAfterAllDiscounts() + deliveryFee).toFixed(2)} AZN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Floating-label Rosefield-style input
const RFInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  testId?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  placeholder?: string;
  error?: boolean;
  autoComplete?: string;
  name?: string;
}> = ({ label, value, onChange, type = 'text', required, readOnly, testId, inputMode, placeholder, error, autoComplete, name }) => {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  const float = focused || filled;
  return (
    <label className="relative block">
      <span
        className={`absolute left-3 transition-all pointer-events-none ${
          float ? 'top-1.5 text-[10px]' : 'top-1/2 -translate-y-1/2 text-[13px]'
        } ${error ? 'text-red-600' : 'text-black/55'}`}
      >
        {label}{required && ' *'}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        placeholder={float ? placeholder : ''}
        data-testid={testId}
        name={name}
        autoComplete={autoComplete}
        className={`w-full h-[52px] px-3 pt-4 pb-1 outline-none text-[14px] bg-white transition-colors border ${
          error
            ? 'border-red-500 ring-2 ring-red-500/30 animate-pulse'
            : 'border-black/25 focus:border-black'
        } ${readOnly ? 'cursor-default' : ''}`}
      />
    </label>
  );
};

export default CartPage;
