import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  showB2BPrice?: boolean;
  compact?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, showB2BPrice = false, compact = false }) => {
  const { t, i18n } = useTranslation();
  const { addToCart, addNotification } = useCart();
  const isB2BUser = localStorage.getItem('userRole') === 'b2b';

  let displayPrice: number;
  let originalPrice: number | null = null;

  if (isB2BUser) {
    if (product.b2bSalePrice) {
      displayPrice = product.b2bSalePrice;
      originalPrice = product.b2bPrice || product.price;
    } else if (product.b2bPrice) {
      displayPrice = product.b2bPrice;
    } else if (product.salePrice) {
      displayPrice = product.salePrice;
      originalPrice = product.price;
    } else {
      displayPrice = product.price;
    }
  } else {
    if (product.salePrice) {
      displayPrice = product.salePrice;
      originalPrice = product.price;
    } else {
      displayPrice = product.price;
    }
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Out-of-stock only blocks B2B users; customers can always add
    if (isB2BUser && product.stock === 0) {
      addNotification('Bu məhsul bitib', 'error');
      return;
    }
    addToCart(product, 1);
  };

  // "Bitdi" göstəricisi yalnız B2B istifadəçilərə görünür
  const isOutOfStock = isB2BUser && product.stock === 0;
  const hasSecondImage = !!product.images[1];

  return (
    <div className="group relative">
      <Link to={`/product/${product.id}`} className="cursor-pointer block">
        <div
          className={`relative bg-gray-50 aspect-square rounded-lg overflow-hidden ${compact ? 'mb-2' : 'mb-4'} shadow-sm hover:shadow-lg transition-shadow duration-300`}
        >
          <img
            src={product.images[0]}
            alt={product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 ${
              hasSecondImage ? 'group-hover:opacity-0' : ''
            }`}
          />
          {hasSecondImage && (
            <img
              src={product.images[1]}
              alt={product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en}
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-105"
            />
          )}

          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>

          {!isOutOfStock && !compact && (
            <button
              onClick={handleAddToCart}
              className="absolute bottom-4 right-4 bg-black text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-gray-800 shadow-lg"
              title={t('product.addToCartTitle')}
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="text-center space-y-1">
          <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 line-clamp-2 ${compact ? 'min-h-[2rem]' : 'min-h-[2.5rem]'}`}>
            {product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en || product.name.az}
          </h3>
          <div className="flex items-center justify-center space-x-2">
            {originalPrice ? (
              <>
                <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-400`}>
                  {originalPrice.toFixed(2)}₼
                </span>
                <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-red-500`}>
                  {displayPrice.toFixed(2)}₼
                </span>
              </>
            ) : (
              <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900`}>
                {displayPrice.toFixed(2)}₼
              </span>
            )}
          </div>
          {isOutOfStock && (
            <span className="text-xs text-red-600 font-medium">Bitdi</span>
          )}
          {isB2BUser && !compact && !isOutOfStock && (
            <p className={`text-xs font-medium mt-1 ${
              product.stock <= 5 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {`Mövcud: ${product.stock}`}
            </p>
          )}


        </div>
      </Link>
    </div>
  );
};

export default ProductCard;