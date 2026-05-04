import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, ShoppingCart, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { productService } from '../services/productService';
import type { Product } from '../types';

const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { productIds, toggleFavorite } = useWishlist();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join(',')]);

  const load = async () => {
    setLoading(true);
    try {
      if (productIds.length === 0) {
        setProducts([]);
        return;
      }
      const all = await productService.getAll();
      const filtered = all.filter((p) => productIds.includes(p.id));
      setProducts(filtered);
    } catch (e) {
      console.error('Load wishlist failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (p: Product) => {
    // CartContext.addToCart already triggers a success notification internally,
    // so we should NOT call addNotification again — that caused duplicates.
    addToCart(p, 1);
  };

  const handleRemove = (id: string) => {
    toggleFavorite(id);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex items-center gap-3">
          <Heart className="h-7 w-7 text-red-500 fill-red-500" />
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">Wishlist</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {products.length > 0
                ? `${products.length} sevimli məhsul`
                : 'Sevimli məhsullarınızı saxlayın'}
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center" data-testid="wishlist-empty">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">Wishlist boşdur</h2>
            <p className="text-gray-500 mb-6">
              Bəyəndiyiniz məhsulların kartında ürək düyməsinə basaraq buraya əlavə edə bilərsiniz.
            </p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              data-testid="wishlist-shop-btn"
            >
              Məhsullara bax
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {products.map((p) => {
              const name = p.name?.[i18n.language as 'az' | 'ru' | 'en'] || p.name?.en || p.name?.az || '';
              const price = p.salePrice || p.price;
              const original = p.salePrice ? p.price : null;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden group"
                  data-testid={`wishlist-product-${p.id}`}
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img
                      src={p.images?.[0]}
                      alt={name}
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => navigate(`/product/${p.id}`)}
                      loading="lazy"
                    />
                    <button
                      onClick={() => handleRemove(p.id)}
                      className="absolute top-2 right-2 bg-white/95 hover:bg-white text-red-500 p-1.5 rounded-full shadow-md transition-all hover:scale-110"
                      title="Wishlist-dən çıxar"
                      data-testid={`wishlist-remove-${p.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-3">
                    <h3
                      className="text-sm font-medium text-gray-900 line-clamp-2 cursor-pointer hover:text-gray-600 mb-1"
                      onClick={() => navigate(`/product/${p.id}`)}
                    >
                      {name}
                    </h3>
                    <div className="flex items-center gap-2 mb-2.5">
                      {original ? (
                        <>
                          <span className="text-xs text-gray-400 line-through">
                            {original.toFixed(2)} AZN
                          </span>
                          <span className="text-sm font-semibold text-red-500">
                            {price.toFixed(2)} AZN
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          {price.toFixed(2)} AZN
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddToCart(p)}
                      disabled={p.stock === 0}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white py-1.5 rounded-md text-xs font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300"
                      data-testid={`wishlist-add-cart-${p.id}`}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      {p.stock === 0 ? 'Bitdi' : 'Səbətə'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
