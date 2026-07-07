import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, ShoppingCart } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { productService } from '../services/productService';
import type { Product } from '../types';

const ComingSoonPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isB2BUser, setIsB2BUser] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'b2b' && userRole !== 'admin') {
      navigate('/');
      return;
    }
    setIsB2BUser(true);
    loadProducts();
  }, [navigate]);

  const loadProducts = async () => {
    try {
      const allProducts = await productService.getAll(true);
      const comingSoon = allProducts.filter(p => p.comingSoon);
      setProducts(comingSoon);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-[300px] bg-gradient-to-br from-orange-600 to-orange-400 flex items-center justify-center">
        <div className="text-center text-white">
          <Clock className="h-16 w-16 mx-auto mb-4" />
          <h1 className="font-playfair text-5xl md:text-6xl tracking-wide mb-4">
            {t('comingSoon.title')}
          </h1>
          <p className="text-lg text-orange-100">
            {t('comingSoon.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {t('comingSoon.noProducts')}
            </h2>
            <p className="text-gray-600">
              {t('comingSoon.noProductsDesc')}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {products.length} {t('comingSoon.productsCount')}
              </h2>
              <p className="text-gray-600">
                {t('comingSoon.orderNow')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <div key={product.id} className="relative">
                  <div className="absolute top-2 right-2 z-10 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                    {t('comingSoon.title')}
                  </div>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComingSoonPage;
