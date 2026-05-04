import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus, ShoppingBag, ChevronLeft, Truck, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc as fsDoc } from 'firebase/firestore';
import { auth, db as fsDb } from '../lib/firebase';
import { createB2BOrder, sendB2BOrderEmail } from '../services/b2bOrderService';
import { createCustomerOrder } from '../services/customerOrderService';
import { buildSignedPayment, redirectToEpoint } from '../services/epointPaymentService';
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
  // Phone input — only digits after +994
  const initPhone = (localStorage.getItem('userPhone') || '').replace(/^\+?994/, '').replace(/\D/g, '');
  const [phoneDigits, setPhoneDigits] = useState(initPhone);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  // Guest registration fields (only used when no userId)
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  // Promo kod state-ləri (yalnız müştəri Epoint checkout-da istifadə olunur)
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const userDiscount = getUserDiscount();
  // Reactive login state (refreshes when localStorage changes or on each render)
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
  // Re-check when checkout panel opens (login may have happened in another tab)
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

  // Promo endirimdən sonra məhsulların dəyəri (userDiscount + promo tətbiq olunur)
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
      const res = await validatePromoCode(code);
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

  const handleWhatsAppOrder = async () => {
    if (items.length === 0) return;

    if (isB2BUser) {
      await handleB2BOrder();
      return;
    }

    // Toggle inline checkout panel
    setShowCheckout((v) => !v);
    if (!showCheckout) {
      // scroll into view smoothly
      setTimeout(() => {
        document.getElementById('inline-checkout')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };

  const handleEpointCheckout = async () => {
    if (items.length === 0) return;

    let userId = localStorage.getItem('userId');
    let userName = localStorage.getItem('userName') || '';
    let userEmail = localStorage.getItem('userEmail') || '';

    // Validate phone (digits-only check, expecting 9 digits like 501234567)
    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage('Telefon nömrəsi düzgün deyil. Məs: 50 123 45 67');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }
    const fullPhone = `+994${cleanPhone}`;

    if (!customerAddress.trim()) {
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

    setLoading(true);
    try {
      // Auto-register guest if not logged in
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
        // Auto-generated password (user can request reset later)
        const autoPassword = `dv-${cleanPhone}-${Date.now().toString(36)}`;
        try {
          const cred = await createUserWithEmailAndPassword(auth, guestEmail.trim(), autoPassword);
          userId = cred.user.uid;
          userName = guestName.trim();
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
          // Stash auto password in session so we can email user later if needed
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
        // Save updated phone for future
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
        customerAddress: customerAddress.trim(),
        notes: customerNote.trim() || '',
        items: orderItems,
        subtotal,
        discountAmount: discount,
        totalAmount: total,
        deliveryMethodId: selectedDelivery?.id || '',
        deliveryMethodName: selectedDelivery?.name || '',
        deliveryFee,
        paymentMethod: 'epoint',
        promoCode: promoApplied?.code || '',
        promoDiscountPercent: promoApplied?.discount || 0,
        promoDiscountAmount: promoDiscountAmt,
      } as any);

      sessionStorage.setItem('pending_epoint_order_id', orderId);

      // Promo kodu istifadə olunmuş kimi qeyd et (birdəfəlik istifadə qaydası).
      // Ödəniş uğursuz olsa belə, kod təkrar istifadəyə buraxılmır — admin istəsə
      // silib yenisini yarada bilər.
      if (promoApplied) {
        redeemPromoCode(promoApplied.code, {
          userId,
          userEmail,
          orderId,
        }).catch((e) => console.warn('Promo kod redeem xətası:', e));
      }

      const signed = await buildSignedPayment({
        orderId,
        amount: total,
      });

      redirectToEpoint(signed);
    } catch (error: any) {
      console.error('Epoint checkout error:', error);
      setErrorMessage(
        error.message || 'Ödəniş başladıla bilmədi. Zəhmət olmasa yenidən cəhd edin.'
      );
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

      if (!userEmail) {
        throw new Error('İstifadəçi email tapılmadı');
      }

      let totalDiscount = 0;
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

      console.log('Creating B2B order:', order);
      const createdOrder = await createB2BOrder(order);
      console.log('Order created:', createdOrder);

      // Sifariş Firestore-da yarandı — istifadəçiyə dərhal uğur bildirişi göstər.
      // Email göndərilməsi və endirim yenilənməsi fonda baş versin (gözlətmə yoxdur).
      clearCart();
      setCustomerNote('');
      setShowSuccess(true);
      setLoading(false);

      // Fonda: admin-ə email
      sendB2BOrderEmail(order, createdOrder.id, createdOrder.orderNumber)
        .then(() => console.log('Email sent successfully'))
        .catch((emailError) => console.warn('Email göndərilə bilmədi (sifariş yaradılıb):', emailError));

      // Fonda: birdəfəlik endirim istifadəçidə qeyd et
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData.discountUsageType === 'once' && userDiscount > 0 && userData.id) {
          (async () => {
            try {
              const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', userData.id)));
              if (!usersSnapshot.empty) {
                await updateDoc(usersSnapshot.docs[0].ref, { discountUsed: true });
                userData.discountUsed = true;
                localStorage.setItem('userData', JSON.stringify(userData));
              }
            } catch (e) { console.warn('Discount update failed:', e); }
          })();
        }
      }

      // Müştəri uğur bildirişini görüb məhsullara qayıtsın deyə 2.5s gözlə
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/products');
      }, 2500);
      return;
    } catch (error: any) {
      console.error('Order error:', error);
      let message = 'Sifariş göndərilə bilmədi. ';

      if (error.message) {
        message += error.message;
      } else if (error.code === 'permission-denied') {
        message += 'İcazə xətası. Zəhmət olmasa yenidən daxil olun.';
      } else {
        message += 'Zəhmət olmasa yenidən cəhd edin.';
      }

      setErrorMessage(message);
      setShowError(true);
      setTimeout(() => {
        setShowError(false);
      }, 5000);
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <ShoppingBag className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.emptyCart')}</h2>
            <p className="text-gray-600 mb-6">{t('cart.noProducts')}</p>
            <button
              onClick={() => navigate('/products')}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors"
            >
              {t('cart.viewProducts')}
            </button>
          </div>
        </div>
      </>
    );
  }

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

      {/* Tam ekran "Ödəniş hazırlanır" overlay — ödəniş zamanı donmuş hissini aradan qaldırır */}
      {loading && !isB2BUser && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          data-testid="payment-loading-overlay"
        >
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 max-w-sm mx-4 flex flex-col items-center text-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gray-900 animate-spin"></div>
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Ödəniş hazırlanır...</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Sizi təhlükəsiz ödəniş səhifəsinə yönləndiririk.<br />
              Zəhmət olmasa gözləyin və səhifəni bağlamayın.
            </p>
            <div className="flex items-center gap-1.5 mt-4">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          {t('cart.backButton')}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {t('cart.cartItems', { count: items.length })}
                </h1>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  {t('cart.removeAll')}
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const price = getItemPrice(item);
                  const productName = item.product.name[i18n.language as 'az' | 'ru' | 'en'] || item.product.name.en || item.product.name.az;

                  return (
                    <div
                      key={item.product.id}
                      className="relative p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="absolute top-3 right-3 text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex gap-4 mb-4">
                        <img
                          src={item.product.images[0]}
                          alt={productName}
                          className="w-24 h-24 object-cover rounded-lg"
                        />

                        <div className="flex-1 pr-8">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {productName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {item.product.brand}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-12 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {(price * item.quantity).toFixed(2)} AZN
                          </p>
                          <p className="text-xs text-gray-500">
                            {price.toFixed(2)} AZN x {item.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('cart.orderSummary')}</h2>


              {userDiscount > 0 && (
                <div className="">
                 
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.productsLabel')}</span>
                  <span>{items.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.totalQuantity')}</span>
                  <span>{items.reduce((total, item) => total + item.quantity, 0)}</span>
                </div>


                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-gray-600">
                    <span>{t('cart.totalAmount')}</span>
                    <span>{getTotalPrice().toFixed(2)} AZN</span>
                  </div>
                </div>

                {userDiscount > 0 && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>{t('cart.discount')} ({userDiscount}%)</span>
                    <span>-{getDiscountAmount().toFixed(2)} AZN</span>
                  </div>
                )}

                <div className="border-t-2 border-gray-300 pt-3">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>{t('cart.finalTotal')}</span>
                    <span>{(userDiscount > 0 ? getDiscountedTotal() : getTotalPrice()).toFixed(2)} AZN</span>
                  </div>

                </div>
              </div>

              {isB2BUser && (
                <div className="mb-4">
                  <label htmlFor="customer-note" className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{customerNote.length}/500</p>
                </div>
              )}

              <button
                onClick={handleWhatsAppOrder}
                disabled={loading}
                className="w-full bg-black text-white py-4 px-6 rounded-lg hover:bg-gray-900 transition-colors font-medium flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
                data-testid="cart-checkout-btn"
              >
                <ShoppingBag className="h-5 w-5" />
                {loading
                  ? t('cart.sending')
                  : isB2BUser
                  ? t('cart.completeOrder')
                  : showCheckout
                  ? 'Bağla'
                  : 'Ödəniş et'}
              </button>

              <button
                onClick={() => navigate('/products')}
                className="w-full bg-gray-100 text-gray-900 py-4 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium mb-3"
              >
                {t('cart.continueShopping')}
              </button>

              {!isB2BUser && (
                <button
                  onClick={() => setShowCreditForm(true)}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  {t('cart.buyWithCredit')}
                </button>
              )}

              <p className="text-xs text-gray-500 text-center mt-4">
                {isB2BUser ? '' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>

      {showCreditForm && items.length > 0 && (
        <CreditApplicationForm
          productName={t('cart.cartItems', { count: items.length })}
          productPrice={getTotalPrice()}
          onClose={() => setShowCreditForm(false)}
        />
      )}

      {showCheckout && !isB2BUser && (
        <div
          id="inline-checkout"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !loading && setShowCheckout(false)}
          data-testid="inline-checkout-panel"
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Sifarişi tamamla</h2>
                <p className="text-[11px] text-gray-500">Bütün sahələri doldurun</p>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-400 hover:text-gray-700 w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-gray-100"
                data-testid="inline-checkout-close"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-3">
              {/* Guest registration */}
              {!isLoggedIn && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Şəxsi məlumatlar</p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white"
                    data-testid="checkout-guest-name"
                  />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="E-poçt ünvanı"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white"
                    data-testid="checkout-guest-email"
                  />
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Sifariş tamamlananda hesabınız avtomatik yaradılacaq. Şifrəni e-poçtunuzdan
                    "Şifrəni unutdum" ilə təyin edə bilərsiniz.
                  </p>
                </div>
              )}

              {/* Logged-in user banner */}
              {isLoggedIn && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
                  <Check className="h-3.5 w-3.5 text-green-700 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-green-900 truncate">{loggedInName || loggedInEmail || 'Hesab aktiv'}</p>
                    {loggedInEmail && loggedInName && (
                      <p className="text-green-700 truncate">{loggedInEmail}</p>
                    )}
                    {phoneDigits.length === 9 && (
                      <p className="text-green-700 truncate">+994 {phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Phone with locked +994 prefix - hide if logged-in user has phone saved */}
              {!(isLoggedIn && phoneDigits.length === 9) && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Telefon nömrəsi *</label>
                  <div className="flex items-stretch border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent overflow-hidden bg-white">
                    <span className="px-3 flex items-center bg-gray-50 text-sm text-gray-700 font-medium border-r border-gray-200 select-none">
                      +994
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                      onChange={(e) => {
                        const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setPhoneDigits(onlyDigits);
                      }}
                      placeholder="50 123 45 67"
                      maxLength={13}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                      data-testid="checkout-phone-input"
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Çatdırılma ünvanı *</label>
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Şəhər, küçə, ev/mənzil"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm resize-none bg-white"
                  data-testid="checkout-address-input"
                />
              </div>

              {/* Delivery methods */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Truck className="h-3 w-3" />
                  Çatdırılma üsulu *
                </label>
                {deliveryMethods.length === 0 ? (
                  <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    Yüklənir... Əgər boş qalırsa, admin paneldən "Çatdırılma Üsulları" hissəsinə əlavə edin.
                  </div>
                ) : (
                  <div className="space-y-1.5" data-testid="delivery-method-list">
                    {deliveryMethods.map((m) => {
                      const selected = m.id === selectedDeliveryId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedDeliveryId(m.id!)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                            selected
                              ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                              : 'border-gray-200 bg-white hover:border-gray-400'
                          }`}
                          data-testid={`delivery-method-option-${m.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                                }`}
                              >
                                {selected && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 text-xs leading-tight truncate">{m.name}</p>
                                {m.estimatedDays && (
                                  <p className="text-[10px] text-gray-500 leading-tight">{m.estimatedDays}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Qeyd (istəyə bağlı)</label>
                <input
                  type="text"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Əlavə qeyd..."
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white"
                />
              </div>

              {/* Promo kod */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">
                  Endirim kodu (istəyə bağlı)
                </label>
                {promoApplied ? (
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200"
                    data-testid="promo-applied-box"
                  >
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Check className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                      <span className="font-mono font-semibold text-emerald-900 truncate">
                        {promoApplied.code}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                        -{promoApplied.discount}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
                      data-testid="promo-remove-btn"
                    >
                      Sil
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                          if (promoError) setPromoError('');
                        }}
                        placeholder="6 rəqəmli kod"
                        maxLength={6}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white tabular-nums tracking-widest"
                        data-testid="promo-code-input"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={promoLoading || promoInput.length !== 6}
                        className="px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="promo-apply-btn"
                      >
                        {promoLoading ? '...' : 'Tətbiq et'}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-[11px] text-red-600 mt-1" data-testid="promo-error">
                        {promoError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer with summary + CTA */}
            <div className="border-t border-gray-100 px-5 py-3.5 bg-gray-50 sticky bottom-0">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] text-gray-500">
                  {(userDiscount > 0 ? getDiscountedTotal() : getTotalPrice()).toFixed(2)} AZN
                  {promoApplied && (
                    <span className="text-emerald-600 font-medium"> −{getPromoDiscountAmount().toFixed(2)} AZN</span>
                  )}
                  {deliveryFee > 0 && <span> + {deliveryFee.toFixed(2)} AZN</span>}
                </div>
                <div className="text-base font-bold text-gray-900">
                  {(getItemsAfterAllDiscounts() + deliveryFee).toFixed(2)} AZN
                </div>
              </div>
              {promoApplied && (
                <div className="text-[10px] text-emerald-700 font-medium mb-1.5">
                  Promo {promoApplied.code} · {promoApplied.discount}% endirim tətbiq edildi
                </div>
              )}
              <button
                onClick={handleEpointCheckout}
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold disabled:opacity-60"
                data-testid="checkout-pay-btn"
              >
                {loading ? 'Yönləndirilir...' : 'Ödəniş et'}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-1.5">
                Ödəniş təhlükəsiz şəkildə həyata keçirilir.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CartPage;
