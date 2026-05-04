import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';
import { productService } from '../services/productService';
import { toBrandSlug } from '../utils/brandSlug';
import type { Product } from '../types';

const BrandPage: React.FC = () => {
  const { brand } = useParams<{ brand: string }>();
  const { i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [resolvedBrandName, setResolvedBrandName] = useState<string>('');

  useEffect(() => {
    if (brand) {
      loadProducts();
    }
  }, [brand]);

  const loadProducts = async () => {
    try {
      const userRole = localStorage.getItem('userRole');
      const isB2B = userRole === 'b2b' || userRole === 'admin';
      const allProducts = await productService.getAll();
      // Brand slug ilə uyğunlaşdırma: ya birbaşa ad, ya da slug formatı
      const brandProducts = allProducts.filter(p => {
        if (!p.brand || !p.isEnabled) return false;
        if (p.brand.toLowerCase() === brand?.toLowerCase()) return true;
        return toBrandSlug(p.brand) === (brand || '').toUpperCase();
      });
      // İlk uyğun məhsulun brendinin tam adını göstərmək üçün saxla
      if (brandProducts.length > 0) {
        setResolvedBrandName(brandProducts[0].brand);
      } else {
        setResolvedBrandName(brand || '');
      }
      const filteredProducts = isB2B ? brandProducts : brandProducts.filter(p => p.comingSoon !== true);
      setProducts(filteredProducts);
    } catch (error) {
      console.error('Error loading brand products:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return (a.salePrice || a.price) - (b.salePrice || b.price);
      case 'price-high':
        return (b.salePrice || b.price) - (a.salePrice || a.price);
      case 'name':
      default:
        return a.name[i18n.language as 'az' | 'ru'].localeCompare(b.name[i18n.language as 'az' | 'ru']);
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-light text-gray-900 mb-2">
              {resolvedBrandName || brand}
            </h1>
            <p className="text-gray-600">
              {products.length} məhsul tapıldı
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="name">Ada görə</option>
              <option value="price-low">Qiymət: Aşağıdan yuxarıya</option>
              <option value="price-high">Qiymət: Yuxarıdan aşağıya</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Bu brend üçün məhsul tapılmadı
            </h3>
            <p className="text-gray-600">
              Zəhmət olmasa başqa brendə baxın
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandPage;