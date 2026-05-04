import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Share2, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { useCart } from '../context/CartContext';
import CreditApplicationForm from '../components/CreditApplicationForm';
import ProductReviews from '../components/ProductReviews';
import { trackProductView } from '../services/analyticsService';
import type { Product } from '../types';

const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isB2BUser, setIsB2BUser] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showCreditForm, setShowCreditForm] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    setIsB2BUser(userRole === 'b2b');
    if (id) loadProduct(id);
  }, [id]);

  const loadProduct = async (productId: string) => {
    try {
      const products = await productService.getAll();
      const foundProduct = products.find(p => p.id === productId);
      setProduct(foundProduct || null);
      if (foundProduct) {
        const name = foundProduct.name?.az || foundProduct.name?.en || '';
        trackProductView(foundProduct.id, { name, image: foundProduct.images?.[0] }).catch(() => undefined);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppOrder = () => {
    // Removed: customers now use Epoint payment via cart
    if (product) addToCart(product, quantity);
    navigate('/cart');
  };

  const nextImage = () => {
    if (product)
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    if (product)
      setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const handleShare = async () => {
    if (!product) return;

    const productName =
      product.name[i18n.language as 'az' | 'ru' | 'en'] ||
      product.name.en ||
      product.name.az;

    const shareData = {
      title: productName,
      text: `${productName} - De Valeur`,
      url: window.location.href,
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        alert(t("product.linkCopied"));
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );

  if (!product)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t("product.notFound")}
          </h1>
          <Link to="/" className="text-black hover:underline">
            {t("product.returnHome")}
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
          <Link to="/" className="hover:text-gray-900">{t("product.home")}</Link>
          <span>/</span>
          <Link to={`/category/${product.category}`} className="hover:text-gray-900 capitalize">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-gray-900">
            {product.name[i18n.language as 'az' | 'ru' | 'en'] ||
              product.name.en ||
              product.name.az}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden">

              {product.salePrice && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-xs px-3 py-1 font-medium z-10 rounded">
                  {t('product.sale')}
                </span>
              )}

              <img
                src={product.images[currentImageIndex]}
                alt={product.name[i18n.language as 'az' | 'ru' | 'en']}
                className="w-full h-full object-cover"
              />

              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {product.images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      currentImageIndex === index ? 'border-black' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-light text-gray-900 mb-2">
                {product.name[i18n.language as 'az' | 'ru' | 'en']}
              </h1>
              <p className="text-gray-600 capitalize">{product.brand}</p>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-center space-x-3">
                {product.salePrice ? (
                  <>
                    <span className="text-2xl font-medium text-red-500">
                      {product.salePrice.toFixed(2)} AZN
                    </span>
                    <span className="text-xl text-gray-500 line-through">
                      {product.price.toFixed(2)} AZN
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-medium text-gray-900">
                    {product.price.toFixed(2)} AZN
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t("product.description")}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {product.description[i18n.language as 'az' | 'ru' | 'en']}
              </p>
            </div>

            {/* Product Details */}
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">{t("product.brand")}:</span>
                <span className="font-medium">{product.brand}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">{t("product.category")}:</span>
                <span className="font-medium capitalize">{product.category}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">{t("product.gender")}:</span>
                <span className="font-medium capitalize">{product.gender}</span>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("product.quantity")}
              </label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center border border-gray-300 rounded py-2"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  addToCart(product, quantity);
                  alert(t("product.addedToCart"));
                }}
                className="w-full bg-gray-900 text-white py-4 px-6 font-medium tracking-wide uppercase hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {t("product.addToCart")}
              </button>

              <button
                onClick={handleWhatsAppOrder}
                className="w-full bg-white text-gray-900 border-2 border-gray-900 py-4 px-6 font-medium tracking-wide uppercase hover:bg-gray-50"
              >
                {t("product.buyNow")}
              </button>

              {!isB2BUser && (
                <button
                  onClick={() => setShowCreditForm(true)}
                  className="w-full bg-green-600 text-white py-4 px-6 font-medium tracking-wide uppercase hover:bg-green-700"
                >
                  {t("product.buyWithCredit")}
                </button>
              )}

              <button
                onClick={handleShare}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <Share2 className="h-5 w-5" />
                <span>{t("product.share")}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-8">
          <ProductReviews productId={product.id} />
        </div>
      </div>

      {showCreditForm && (
        <CreditApplicationForm
          productName={product.name[i18n.language as 'az' | 'ru' | 'en']}
          productPrice={product.salePrice || product.price}
          onClose={() => setShowCreditForm(false)}
        />
      )}
    </div>
  );
};

export default ProductPage;
