import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  showB2BPrice?: boolean;
  compact?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, showB2BPrice = false, compact = false }) => {
  const { t, i18n } = useTranslation();
  const { addToCart, addNotification } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();
  const isB2BUser = localStorage.getItem('userRole') === 'b2b';
  const fav = isFavorite(product.id);
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product.id);
    addNotification(fav ? 'Wishlist-dən çıxarıldı' : 'Wishlist-ə əlavə olundu', 'success');
  };

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
    // Stok 0 olduqda bütün istifadəçilər üçün səbətə əlavə bloklanır
    if (product.stock === 0) {
      addNotification('Mövcud deyil', 'error');
      return;
    }
    addToCart(product, 1);
  };

  // Stok 0 → bütün istifadəçilərə "Mövcud deyil" göstər
  const isOutOfStock = product.stock === 0;
  const hasSecondImage = !!product.images[1];

  return (
    <div className="group relative">
      <Link to={`/product/${product.id}`} className="cursor-pointer block">
        <div
          className={`relative bg-white border border-black/[0.02] aspect-square rounded-md overflow-hidden ${compact ? 'mb-2' : 'mb-4'} transition-all duration-500 ease-out group-hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)] group-hover:-translate-y-1 group-hover:border-black/10`}
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

          {/* Sale badge — sol üst künc */}
          {originalPrice && displayPrice < originalPrice && !compact && (
            <span
              className="absolute top-2.5 left-2.5 z-[2] inline-flex items-center justify-center min-w-[42px] h-[42px] rounded-full bg-[#D14545] text-white text-[12px] font-bold tracking-tight shadow-[0_4px_12px_-3px_rgba(209,69,69,0.55)]"
              data-testid={`product-discount-badge-${product.id}`}
            >
              -{Math.round(((originalPrice - displayPrice) / originalPrice) * 100)}%
            </span>
          )}

          {!compact && !isB2BUser && (
            <button
              onClick={handleToggleFavorite}
              className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${
                fav
                  ? 'bg-red-500 text-white shadow-[0_4px_12px_-2px_rgba(239,68,68,0.5)]'
                  : 'bg-white/85 hover:bg-white text-gray-700 opacity-0 group-hover:opacity-100 shadow-md'
              }`}
              title={fav ? 'Wishlist-dən çıxar' : 'Wishlist-ə əlavə et'}
              data-testid={`wishlist-toggle-${product.id}`}
            >
              <Heart className={`h-4 w-4 transition-transform ${fav ? 'fill-current scale-110' : ''}`} />
            </button>
          )}

          {!isOutOfStock && !compact && (
            <button
              onClick={handleAddToCart}
              className="absolute bottom-4 right-4 bg-black text-white p-3 rounded-full opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-400 ease-out hover:bg-gray-800 hover:scale-110 active:scale-95 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)]"
              title={t('product.addToCartTitle')}
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="text-center">
          {product.brand && (
            <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.18em] text-gray-500 font-normal mb-0.5`}>
              {product.brand}
            </p>
          )}
          <h3 className={`${compact ? 'text-[13px]' : 'text-[15px]'} font-medium text-gray-900 line-clamp-1 leading-snug transition-colors duration-300 group-hover:text-black`}>
            {product.name[i18n.language as 'az' | 'ru' | 'en'] || product.name.en || product.name.az}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
            {originalPrice ? (
              <>
                <span className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-semibold text-[#D14545] tabular-nums`}>
                  {displayPrice.toFixed(2)} AZN
                </span>
                <span className={`dv-price-strike relative ${compact ? 'text-[11px]' : 'text-[13px]'} font-light text-gray-400 tabular-nums`}>
                  {originalPrice.toFixed(2)} AZN
                </span>
              </>
            ) : (
              <span className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-medium text-gray-900 tabular-nums`}>
                {displayPrice.toFixed(2)} AZN
              </span>
            )}
          </div>
          {isOutOfStock && isB2BUser && (
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