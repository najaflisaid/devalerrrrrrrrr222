import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus, ShoppingBag, ChevronLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createB2BOrder, sendB2BOrderEmail } from '../services/b2bOrderService';
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
  const userDiscount = getUserDiscount();

  const handleWhatsAppOrder = async () => {
    if (items.length === 0) return;

    if (isB2BUser) {
      await handleB2BOrder();
      return;
    }

    let message = 'Salam! Aşağıdakı məhsulları sifariş etmək istəyirəm:\n\n';

    items.forEach((item, index) => {
      const productName = item.product.name[i18n.language as 'az' | 'ru' | 'en'] || item.product.name.en || item.product.name.az;
      const price = getItemPrice(item);
      const productUrl = `${window.location.origin}/product/${item.product.id}`;

      message += `${index + 1}. ${productName}\n`;
      message += `   Brend: ${item.product.brand}\n`;
      message += `   Miqdar: ${item.quantity}\n`;
      message += `   Qiymət: ${price.toFixed(2)}₼ x ${item.quantity} = ${(price * item.quantity).toFixed(2)}₼\n`;
      message += `   Link: ${productUrl}\n\n`;
    });

    message += `Ümumi məbləğ: ${getTotalPrice().toFixed(2)}₼`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/994777577277?text=${encodedMessage}`, '_blank');

    clearCart();
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 2000);
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
        discountAmount: userDiscountAmount
      };

      console.log('Creating B2B order:', order);
      const createdOrder = await createB2BOrder(order);
      console.log('Order created:', createdOrder);

      console.log('Sending email...');
      await sendB2BOrderEmail(order, createdOrder.id);
      console.log('Email sent successfully');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        if (userData.discountUsageType === 'once' && userDiscount > 0 && userData.id) {
          const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', userData.id)));
          if (!usersSnapshot.empty) {
            await updateDoc(usersSnapshot.docs[0].ref, { discountUsed: true });
            userData.discountUsed = true;
            localStorage.setItem('userData', JSON.stringify(userData));
          }
        }
      }

      clearCart();

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/products');
      }, 3000);
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
    );
  }

  return (
    <>
      {showSuccess && (
        <SuccessNotification
          message={isB2BUser ? t('cart.b2bOrderSentSuccess') : t('cart.orderSentSuccess')}
          onClose={() => setShowSuccess(false)}
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

              <button
                onClick={handleWhatsAppOrder}
                disabled={loading}
                className="w-full bg-black text-white py-4 px-6 rounded-lg hover:bg-gray-900 transition-colors font-medium flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed mb-3"
              >
                <ShoppingBag className="h-5 w-5" />
                {loading ? t('cart.sending') : t('cart.completeOrder')}
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
    </>
  );
};

export default CartPage;
