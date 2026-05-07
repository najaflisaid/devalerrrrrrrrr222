import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, Minus, ChevronDown, Check, CreditCard, Apple } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc as fsDoc } from 'firebase/firestore';
import { auth, db as fsDb } from '../lib/firebase';
import { createB2BOrder, sendB2BOrderEmail } from '../services/b2bOrderService';
import { createCustomerOrder } from '../services/customerOrderService';
import { startEpointPayment } from '../services/epointPaymentService';
import { getDeliveryMethods, type DeliveryMethod } from '../services/deliveryMethodService';
import SuccessNotification from '../components/SuccessNotification';
import CreditApplicationForm from '../components/CreditApplicationForm';
import { validatePromoCode, redeemPromoCode } from '../services/promoCodeService';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice, getDiscountAmount, getDiscountedTotal, getUserDiscount } = useCart();
  const [isB2BUser] = useState(() => localStorage.getItem('userRole') === 'b2b');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const initPhone = (localStorage.getItem('userPhone') || '').replace(/^\+?994/, '').replace(/\D/g, '');
  const [phoneDigits, setPhoneDigits] = useState(initPhone);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number } | null>(null);
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
  useEffect(() => {
    if (showCheckout) setIsLoggedIn(!!localStorage.getItem('userId'));
  }, [showCheckout]);
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
    return +(baseItems * (1 - promoApplied.discount / 100)).toFixed(2);
  };

  const getPromoDiscountAmount = (): number => {
    if (!promoApplied) return 0;
    const baseItems = userDiscount > 0 ? getDiscountedTotal() : getTotalPrice();
    return +(baseItems * (promoApplied.discount / 100)).toFixed(2);
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    setPromoError('');
    if (!/^\d{6}$/.test(code)) {
      setPromoError('Promo kod 6 rəqəmli olmalıdır');
      return;
    }
    setPromoLoading(true);
    try {
      const userId = localStorage.getItem('userId') || undefined;
      const res = await validatePromoCode(code, userId);
      if (res.valid) {
        setPromoApplied({ code, discount: res.discount });
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

  const handleEpointCheckout = async () => {
    if (items.length === 0) return;

    let userId = localStorage.getItem('userId');
    let userName = localStorage.getItem('userName') || '';
    let userEmail = localStorage.getItem('userEmail') || '';

    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage('Telefon nömrəsi düzgün deyil. Məs: 50 123 45 67');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }
    const fullPhone = `+994${cleanPhone}`;

    if (!isPickupFlow && !customerAddress.trim()) {
      setErrorMessage('Çatdırılma ünvanını daxil edin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    if (deliveryMethods.length > 0 && !selectedDeliveryId) {
      setErrorMessage('Çatdırılma üsulunu seçin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    if (isPickupFlow && !selectedBranch) {
      setErrorMessage('Hansı filialdan götürəcəyinizi seçin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    setLoading(true);
    try {
      if (!userId) {
        if (!guestName.trim()) {
          setErrorMessage('Adınızı daxil edin.');
          setShowError(true);
          setTimeout(() => setShowError(false), 4000);
          setLoading(false);
          return;
        }
        if (!guestEmail.trim() || !/.+@.+\..+/.test(guestEmail)) {
          setErrorMessage('Düzgün e-poçt daxil edin.');
          setShowError(true);
          setTimeout(() => setShowError(false), 4000);
          setLoading(false);
          return;
        }
        const autoPassword = `dv-${cleanPhone}-${Date.now().toString(36)}`;
        try {
          const cred = await createUserWithEmailAndPassword(auth, guestEmail.trim(), autoPassword);
          userId = cred.user.uid;
          userName = (guestName.trim() + (guestLastName ? ' ' + guestLastName.trim() : '')).trim();
          userEmail = guestEmail.trim();

          await setDoc(fsDoc(fsDb, 'users', userId), {
            id: userId,
            email: userEmail,
            name: userName,
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
            discountPercentage: 0, discountUsageType: 'unlimited', discountUsed: false,
          }));
          sessionStorage.setItem('dv_auto_pw', autoPassword);
        } catch (regErr: any) {
          if (regErr?.code === 'auth/email-already-in-use') {
            setErrorMessage('Bu e-poçt artıq qeydiyyatdadır. Zəhmət olmasa "Daxil ol" düyməsindən giriş edin.');
          } else {
            setErrorMessage('Qeydiyyat xətası: ' + (regErr?.message || 'naməlum'));
          }
          setShowError(true);
          setTimeout(() => setShowError(false), 6000);
          setLoading(false);
          return;
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
        promoDiscountPercent: promoApplied?.discount || 0,
        promoDiscountAmount: promoDiscountAmt,
      } as any);

      sessionStorage.setItem('pending_epoint_order_id', orderId);

      if (promoApplied) {
        redeemPromoCode(promoApplied.code, {
          userId,
          userEmail,
          orderId,
        }).catch((e) => console.warn('Promo kod redeem xətası:', e));
      }

      try {
        await startEpointPayment({ orderId, amount: total });
      } catch (signErr: any) {
        try {
          const { doc: fsDocRef, updateDoc: fsUpdate } = await import('firebase/firestore');
          await fsUpdate(fsDocRef(fsDb, 'customer_orders', orderId), {
            status: 'payment_failed',
            paymentStatus: 'failed',
          });
        } catch { /* ignore */ }
        sessionStorage.removeItem('pending_epoint_order_id');
        throw signErr;
      }

      const watchdog = window.setTimeout(async () => {
        try {
          const { doc: fsDocRef, updateDoc: fsUpdate } = await import('firebase/firestore');
          await fsUpdate(fsDocRef(fsDb, 'customer_orders', orderId), {
            status: 'payment_failed',
            paymentStatus: 'failed',
          });
        } catch { /* ignore */ }
        sessionStorage.removeItem('pending_epoint_order_id');
        setErrorMessage('Ödəniş səhifəsi açıla bilmədi. Zəhmət olmasa internet bağlantınızı yoxlayın və yenidən cəhd edin.');
        setShowError(true);
        setLoading(false);
        setTimeout(() => setShowError(false), 6000);
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

  // Empty cart
  if (items.length === 0) {
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
            <p className="text-xs text-black/55 leading-relaxed">
              Sizi təhlükəsiz ödəniş səhifəsinə yönləndiririk.
            </p>
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
              className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 text-[11px] uppercase tracking-[0.25em] font-medium text-black/70 hover:text-black border border-black/20 hover:border-black transition-colors"
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
                onClick={() => !loading && setShowCheckout(false)}
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
            {/* LEFT — form */}
            <div className="px-5 sm:px-8 lg:pl-12 lg:pr-6 py-8 md:py-12 lg:border-r lg:border-black/10">
              {/* Express checkout — Card / Google Pay / Apple Pay */}
              <div className="mb-8 text-center">
                <p className="text-[12px] text-black/55 mb-3">{t('checkout.expressCheckout')}</p>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleEpointCheckout}
                    disabled={loading}
                    className="h-12 bg-white border border-black text-black text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="checkout-card-btn"
                  >
                    <CreditCard className="w-4 h-4" strokeWidth={1.6} />
                    <span>{t('checkout.cardPay')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEpointCheckout}
                    disabled={loading}
                    className="h-12 bg-black text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:opacity-85 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="checkout-gpay-btn"
                    aria-label={t('checkout.gpay')}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                    </svg>
                    <span>Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEpointCheckout}
                    disabled={loading}
                    className="h-12 bg-black text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:opacity-85 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="checkout-applepay-btn"
                    aria-label={t('checkout.applePay')}
                  >
                    <Apple className="w-4 h-4 fill-white" strokeWidth={0} />
                    <span>Pay</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 h-px bg-black/15" />
                <span className="text-[12px] text-black/55">{t('checkout.or')}</span>
                <div className="flex-1 h-px bg-black/15" />
              </div>

              {/* Contact */}
              <div className="mb-8">
                <div className="flex items-end justify-between mb-4">
                  <h2 className="text-[20px] font-normal text-black">{t('checkout.contact')}</h2>
                  {!isLoggedIn && (
                    <button
                      onClick={() => navigate('/admin-login')}
                      className="text-[13px] text-black underline underline-offset-2 hover:opacity-70"
                      data-testid="checkout-signin-btn"
                    >
                      {t('checkout.signIn')}
                    </button>
                  )}
                </div>

                {isLoggedIn ? (
                  <div className="px-3 py-3 border border-black/15 bg-black/[0.02] text-[13px] text-black/80">
                    {loggedInName || loggedInEmail}
                  </div>
                ) : (
                  <RFInput
                    type="email"
                    label={t('checkout.email')}
                    required
                    value={guestEmail}
                    onChange={(v) => setGuestEmail(v)}
                    testId="checkout-guest-email"
                  />
                )}

                <label className="mt-3 flex items-center gap-2.5 cursor-pointer select-none">
                  <span
                    className={`w-4 h-4 border ${emailOptIn ? 'border-black bg-black' : 'border-black/40 bg-white'} flex items-center justify-center transition-colors`}
                  >
                    {emailOptIn && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={emailOptIn}
                    onChange={(e) => setEmailOptIn(e.target.checked)}
                  />
                  <span className="text-[13px] text-black/70">{t('checkout.emailOptIn')}</span>
                </label>
              </div>

              {/* Delivery */}
              <div className="mb-8">
                <h2 className="text-[20px] font-normal text-black mb-4">{t('checkout.delivery')}</h2>

                {/* Country (read-only Azerbaijan) */}
                <div className="relative mb-3">
                  <RFInput
                    label={t('checkout.countryRegion')}
                    required
                    value="Azerbaijan"
                    onChange={() => undefined}
                    readOnly
                    testId="checkout-country"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50 pointer-events-none" />
                </div>

                {!isLoggedIn && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <RFInput label={t('checkout.firstName')} required value={guestName} onChange={setGuestName} testId="checkout-first-name" />
                    <RFInput label={t('checkout.lastName')} required value={guestLastName} onChange={setGuestLastName} testId="checkout-last-name" />
                  </div>
                )}

                {!isPickupFlow && (
                  <div className="mb-3">
                    <RFInput
                      label={t('checkout.streetHouse')}
                      required
                      value={customerAddress}
                      onChange={setCustomerAddress}
                      testId="checkout-address-input"
                    />
                  </div>
                )}

                {/* Phone */}
                {!(isLoggedIn && phoneDigits.length === 9) && (
                  <div className="mb-3">
                    <RFInput
                      label={t('checkout.phone')}
                      required
                      value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                      onChange={(v) => setPhoneDigits(v.replace(/\D/g, '').slice(0, 9))}
                      testId="checkout-phone-input"
                      inputMode="numeric"
                      placeholder={t('checkout.phonePlaceholder')}
                    />
                  </div>
                )}

                {/* Delivery methods */}
                <div className="mt-5">
                  <p className="text-[13px] text-black mb-2">{t('checkout.shippingMethod')}</p>
                  {deliveryMethods.length === 0 ? (
                    <div className="px-3 py-2.5 border border-black/15 bg-black/[0.02] text-[12px] text-black/60">
                      {t('checkout.loadingMethods')}
                    </div>
                  ) : (
                    <div className="border border-black/15 divide-y divide-black/15" data-testid="delivery-method-list">
                      {deliveryMethods.map((m) => {
                        const selected = m.id === selectedDeliveryId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedDeliveryId(m.id!)}
                            className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${selected ? 'bg-black/[0.03]' : 'hover:bg-black/[0.02]'}`}
                            data-testid={`delivery-method-option-${m.id}`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? 'border-black' : 'border-black/40'}`}
                            >
                              {selected && <span className="w-2 h-2 rounded-full bg-black" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-black truncate">{m.name}</p>
                              {m.estimatedDays && <p className="text-[11px] text-black/55">{m.estimatedDays}</p>}
                            </div>
                            <span className="text-[13px] text-black tabular-nums">
                              {m.price > 0 ? `${m.price.toFixed(2)} AZN` : t('checkout.free')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isPickupFlow && selectedDelivery?.branches && selectedDelivery.branches.length > 0 && (
                    <div className="mt-3" data-testid="pickup-branch-selector">
                      <p className="text-[13px] text-black mb-2">{t('checkout.pickupBranch')}</p>
                      <div className="border border-black/15 divide-y divide-black/15">
                        {selectedDelivery.branches.map((b) => {
                          const selected = b.id === selectedBranchId;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBranchId(b.id)}
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

                {/* Note */}
                <div className="mt-5">
                  <RFInput
                    label={t('checkout.noteOptional')}
                    value={customerNote}
                    onChange={(v) => setCustomerNote(v.slice(0, 200))}
                    testId="checkout-note-input"
                  />
                </div>
              </div>

              {/* Pay button */}
              <button
                onClick={handleEpointCheckout}
                disabled={loading}
                className="w-full h-14 bg-black text-white text-[13px] uppercase tracking-[0.28em] font-medium hover:bg-black/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="checkout-pay-btn"
              >
                {loading ? t('checkout.redirecting') : t('checkout.payNow')}
              </button>
              <p className="text-[11px] text-black/45 text-center mt-3">
                {t('checkout.securePayment')}
              </p>
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
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black text-white text-[11px] flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-black truncate">{productName}</p>
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
                      <span className="text-[12px] text-black/60 whitespace-nowrap">−{promoApplied.discount}%</span>
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
                      inputMode="numeric"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (promoError) setPromoError('');
                      }}
                      placeholder={t('checkout.discountCode')}
                      maxLength={6}
                      className="flex-1 px-3 py-3 text-[13px] bg-transparent outline-none placeholder:text-black/40"
                      data-testid="promo-code-input"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || promoInput.length !== 6}
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
                    <span>{t('checkout.discountCode')} ({promoApplied.discount}%)</span>
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
}> = ({ label, value, onChange, type = 'text', required, readOnly, testId, inputMode, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  const float = focused || filled;
  return (
    <label className="relative block">
      <span
        className={`absolute left-3 transition-all pointer-events-none ${
          float ? 'top-1.5 text-[10px] text-black/55' : 'top-1/2 -translate-y-1/2 text-[13px] text-black/55'
        }`}
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
        className={`w-full h-[52px] px-3 pt-4 pb-1 border border-black/25 focus:border-black outline-none text-[14px] bg-white transition-colors ${readOnly ? 'cursor-default' : ''}`}
      />
    </label>
  );
};

export default CartPage;
