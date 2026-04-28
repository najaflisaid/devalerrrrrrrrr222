import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus, ShoppingBag, ChevronLeft, Truck, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createB2BOrder, sendB2BOrderEmail } from '../services/b2bOrderService';
import { createCustomerOrder } from '../services/customerOrderService';
import { buildSignedPayment, redirectToEpoint } from '../services/epointPaymentService';
import { getDeliveryMethods, type DeliveryMethod } from '../services/deliveryMethodService';
import SuccessNotification from '../components/SuccessNotification';
import CreditApplicationForm from '../components/CreditApplicationForm';

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
  const [customerPhoneInput, setCustomerPhoneInput] = useState(() => localStorage.getItem('userPhone') || '');
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');
  const userDiscount = getUserDiscount();

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
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName') || '';
    const userEmail = localStorage.getItem('userEmail') || '';

    if (!userId || !userEmail) {
      setErrorMessage('Sifariş üçün giriş etmiş olmalısınız.');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    if (!customerPhoneInput.trim()) {
      setErrorMessage('Zəhmət olmasa telefon nömrənizi daxil edin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    if (!customerAddress.trim()) {
      setErrorMessage('Zəhmət olmasa çatdırılma ünvanını daxil edin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    if (deliveryMethods.length > 0 && !selectedDeliveryId) {
      setErrorMessage('Zəhmət olmasa çatdırılma üsulunu seçin.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    setLoading(true);
    try {
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
      const discount = getDiscountAmount();
      const itemsTotal = userDiscount > 0 ? getDiscountedTotal() : subtotal;
      const total = itemsTotal + deliveryFee;

      const { id: orderId } = await createCustomerOrder({
        userId,
        customerName: userName,
        customerEmail: userEmail,
        customerPhone: customerPhoneInput.trim(),
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
      } as any);

      sessionStorage.setItem('pending_epoint_order_id', orderId);

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
                            {(price * item.quantity).toFixed(2)}₼
                          </p>
                          <p className="text-xs text-gray-500">
                            {price.toFixed(2)}₼ x {item.quantity}
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
                    <span>{getTotalPrice().toFixed(2)}₼</span>
                  </div>
                </div>

                {userDiscount > 0 && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>{t('cart.discount')} ({userDiscount}%)</span>
                    <span>-{getDiscountAmount().toFixed(2)}₼</span>
                  </div>
                )}

                <div className="border-t-2 border-gray-300 pt-3">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>{t('cart.finalTotal')}</span>
                    <span>{(userDiscount > 0 ? getDiscountedTotal() : getTotalPrice()).toFixed(2)}₼</span>
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
          className="fixed inset-x-0 bottom-0 sm:relative sm:inset-auto z-40 sm:z-auto"
          data-testid="inline-checkout-panel"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 sm:pb-10">
            <div className="bg-white sm:bg-gray-50 border-t sm:border border-gray-200 sm:rounded-2xl shadow-xl sm:shadow-sm p-5 sm:p-7 max-h-[85vh] sm:max-h-none overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Sifarişi tamamla</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Çatdırılma və ödəniş üçün məlumatları doldurun</p>
                </div>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-gray-400 hover:text-gray-700 text-sm"
                  data-testid="inline-checkout-close"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT: contact + address */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Telefon nömrəsi *</label>
                    <input
                      type="tel"
                      value={customerPhoneInput}
                      onChange={(e) => setCustomerPhoneInput(e.target.value)}
                      placeholder="+994 XX XXX XX XX"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm bg-white"
                      data-testid="checkout-phone-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Çatdırılma ünvanı *</label>
                    <textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Şəhər, küçə, ev/mənzil"
                      rows={3}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm resize-none bg-white"
                      data-testid="checkout-address-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Qeyd (istəyə bağlı)</label>
                    <textarea
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="Əlavə qeyd..."
                      rows={2}
                      maxLength={500}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm resize-none bg-white"
                    />
                  </div>
                </div>

                {/* RIGHT: delivery + total */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Çatdırılma üsulu *
                    </label>
                    {deliveryMethods.length === 0 ? (
                      <div className="px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        Hələ çatdırılma üsulu əlavə edilməyib. Admin paneldən "Çatdırılma Üsulları" hissəsindən əlavə edə bilərsiniz.
                      </div>
                    ) : (
                      <div className="space-y-2" data-testid="delivery-method-list">
                        {deliveryMethods.map((m) => {
                          const selected = m.id === selectedDeliveryId;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedDeliveryId(m.id!)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                                selected
                                  ? 'border-gray-900 bg-white ring-2 ring-gray-900/10'
                                  : 'border-gray-200 bg-white hover:border-gray-400'
                              }`}
                              data-testid={`delivery-method-option-${m.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                        selected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                                      }`}
                                    >
                                      {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="font-medium text-gray-900 text-sm">{m.name}</span>
                                  </div>
                                  {m.description && (
                                    <p className="text-xs text-gray-500 mt-1 ml-6">{m.description}</p>
                                  )}
                                  {m.estimatedDays && (
                                    <p className="text-[11px] text-gray-400 mt-0.5 ml-6">{m.estimatedDays}</p>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                                  {m.price > 0 ? `${m.price.toFixed(2)} ₼` : 'Pulsuz'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Məhsullar</span>
                      <span>{(userDiscount > 0 ? getDiscountedTotal() : getTotalPrice()).toFixed(2)} ₼</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Çatdırılma</span>
                        <span>{deliveryFee.toFixed(2)} ₼</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-gray-100">
                      <span className="font-semibold">Ödəniləcək məbləğ</span>
                      <span className="text-lg font-bold text-gray-900">
                        {((userDiscount > 0 ? getDiscountedTotal() : getTotalPrice()) + deliveryFee).toFixed(2)} ₼
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleEpointCheckout}
                    disabled={loading}
                    className="w-full px-4 py-3.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    data-testid="checkout-pay-btn"
                  >
                    {loading ? 'Yönləndirilir...' : 'Ödəniş et'}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">
                    Ödəniş təhlükəsiz şəkildə həyata keçirilir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CartPage;
