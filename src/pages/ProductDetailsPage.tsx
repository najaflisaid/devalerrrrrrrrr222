import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { useCart } from '../context/CartContext';
import CreditApplicationForm from '../components/CreditApplicationForm';
import type { Product } from '../types';

const ProductDetailsPage: React.FC = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { addToCart, addNotification } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isB2BUser, setIsB2BUser] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    setIsB2BUser(userRole === 'b2b');
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      if (!productId) return;
      const allProducts = await productService.getAll();
      const found = allProducts.find(p => p.id === productId);
      if (found) {
        setProduct(found);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayPrice = () => {
    if (!product) return 0;

    if (isB2BUser) {
      if (product.b2bSalePrice) {
        return product.b2bSalePrice;
      } else if (product.b2bPrice) {
        return product.b2bPrice;
      } else if (product.salePrice) {
        return product.salePrice;
      } else {
        return product.price;
      }
    } else {
      return product.salePrice || product.price;
    }
  };

  const getOriginalPrice = () => {
    if (!product) return null;

    if (isB2BUser) {
      if (product.b2bSalePrice) {
        return product.b2bPrice || product.price;
      }
    } else {
      if (product.salePrice) {
        return product.price;
      }
    }

    return null;
  };

  const handleWhatsAppOrder = async () => {
    if (!product) return;

    const productName = product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en || product.name.az;
    const displayPrice = getDisplayPrice();
    const totalAmount = displayPrice * quantity;
    const productUrl = `${window.location.origin}/product/${product.id}`;

    let message = `Salam! Aşağıdakı məhsulu sifariş etmək istəyirəm:\n\n`;
    message += `Məhsul: ${productName}\n`;
    message += `Brend: ${product.brand}\n`;
    message += `Miqdar: ${quantity}\n`;
    message += `Qiymət: ${displayPrice.toFixed(2)}₼\n`;
    message += `Ümumi: ${totalAmount.toFixed(2)}₼\n`;
    message += `Link: ${productUrl}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/994777577277?text=${encodedMessage}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('product.notFound')}</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-900 transition-colors"
          >
            {t('product.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const displayPrice = getDisplayPrice();
  const originalPrice = getOriginalPrice();
  const isOutOfStock = product.stock === 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          {t('product.backToProducts')}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="bg-gray-50 rounded-lg overflow-hidden mb-6 aspect-square relative">
              {!isOutOfStock && product.salePrice && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-xs px-2 py-1 font-medium z-10">
                  {t('product.sale')}
                </span>
              )}
              <img
                src={product.images[0]}
                alt={product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              {product.images.map((image, idx) => (
                <button
                  key={idx}
                  className="bg-gray-50 rounded-lg overflow-hidden aspect-square border-2 border-transparent hover:border-gray-300 transition-colors"
                >
                  <img src={image} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-6">
              <h1 className="text-4xl font-light text-gray-900 mb-2">
                {product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en || product.name.az}
              </h1>
              <div className="space-y-1">
                <p className="text-gray-600">
                  {product.brand}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">{t('product.gender')}:</span> {t(`category.${product.gender}`)}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="space-y-2">
                {product.salePrice ? (
                  <>
                    <p className="text-sm text-gray-400">{product.price.toFixed(2)}₼</p>
                    <p className="text-4xl font-bold text-gray-900">{product.salePrice.toFixed(2)}₼</p>
                  </>
                ) : (
                  <p className="text-4xl font-bold text-gray-900">{product.price.toFixed(2)}₼</p>
                )}
                {isOutOfStock && (
                  <p className="text-sm text-red-600 font-medium">Bitdi</p>
                )}
              </div>

            </div>

            {isB2BUser && (
              <div className="mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isOutOfStock ? 'bg-red-50 border border-red-200' :
                  product.stock <= 5 ? 'bg-orange-50 border border-orange-200' :
                  'bg-green-50 border border-green-200'
                }`}>
                  <span className={`text-sm font-semibold ${
                    isOutOfStock ? 'text-red-700' :
                    product.stock <= 5 ? 'text-orange-700' :
                    'text-green-700'
                  }`}>
                    {isOutOfStock ? 'Bitdi' : `Mövcud: ${product.stock} ədəd`}
                  </span>
                </div>
              </div>
            )}

            <p className="text-gray-700 mb-8">
              {product.description[i18n.language as 'az' | 'ru']}
            </p>

            {!isOutOfStock && (
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('product.quantity')}
                  </label>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantity(Math.min(Math.max(1, val), product.stock));
                      }}
                      className="w-16 text-center border border-gray-300 rounded px-2 py-2"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(quantity + 1, product.stock))}
                      disabled={quantity >= product.stock}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {t('product.totalPrice')}: {(displayPrice * quantity).toFixed(2)}₼
                  </p>
                </div>
              </div>
            )}

            {!isOutOfStock && (
              <div className="space-y-3">
                <button
                  onClick={handleWhatsAppOrder}
                  className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium tracking-wide uppercase"
                >
                  {t('product.buyNow')}
                </button>

                <button
                  onClick={() => {
                    if (product) {
                      if (product.stock === 0) {
                        addNotification('Bu məhsul bitib', 'error');
                        return;
                      }
                      addToCart(product, quantity);
                    }
                  }}
                  className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium tracking-wide uppercase flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {t('product.addToCart')}
                </button>

                <button
                  onClick={() => setShowCreditForm(true)}
                  className="w-full bg-gray-900 text-white py-4 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium tracking-wide uppercase"
                >
                  {t('product.buyWithCredit')}
                </button>
              </div>
            )}

            <div className="mt-8 space-y-4 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span>✓</span>
                </div>
                <span>{t('product.deliveryInfo')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span>✓</span>
                </div>
                <span>{t('product.whatsappSupport')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreditForm && product && (
        <CreditApplicationForm
          productName={product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en || product.name.az}
          productPrice={displayPrice}
          onClose={() => setShowCreditForm(false)}
        />
      )}
    </div>
  );
};

export default ProductDetailsPage;
