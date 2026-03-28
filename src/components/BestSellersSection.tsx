import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    loadBestSellers();
  }, []);

  // Auto scroll effect
  useEffect(() => {
    if (!isAutoScrolling || products.length === 0) return;

    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        if (container.scrollLeft >= maxScroll - 10) {
          // Reset to start
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          // Scroll right
          container.scrollTo({
            left: container.scrollLeft + 220,
            behavior: 'smooth'
          });
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoScrolling, products]);

  const loadBestSellers = async () => {
    try {
      const data = await productService.getBestSellers(12);
      setProducts(data);
    } catch (error) {
      console.error('Error loading best sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    setIsAutoScrolling(false);
    if (scrollContainerRef.current) {
      const scrollAmount = 440;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
    // Resume auto scroll after 10 seconds
    setTimeout(() => setIsAutoScrolling(true), 10000);
  };

  if (loading || products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 uppercase tracking-wide">
            {t('bestSellers.title')}
          </h2>

          <div className="flex gap-3">
            <button
              onClick={() => scroll('left')}
              className="p-2 hover:bg-gray-100 transition-colors duration-200"
              aria-label={t('bestSellers.prevProducts')}
            >
              <ChevronLeft className="h-6 w-6 text-gray-400" strokeWidth={1} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 hover:bg-gray-100 transition-colors duration-200"
              aria-label={t('bestSellers.nextProducts')}
            >
              <ChevronRight className="h-6 w-6 text-gray-900" strokeWidth={1} />
            </button>
          </div>
        </div>

        <div 
          className="relative"
          onMouseEnter={() => setIsAutoScrolling(false)}
          onMouseLeave={() => setIsAutoScrolling(true)}
        >
          <div
            ref={scrollContainerRef}
            className="flex gap-1 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {products.map((product) => (
              <div 
                key={product.id} 
                className="flex-shrink-0 w-[260px] cursor-pointer group"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                {/* Product Card */}
                <div className="bg-white relative overflow-hidden border border-gray-100">
                  {/* Personalize tag */}
                  {product.isPersonalizable && (
                    <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-gray-500 italic">
                      Personalize
                    </span>
                  )}
                  
                  {/* Product Image */}
                  <div className="aspect-[3/4] flex items-center justify-center p-6">
                    <img
                      src={product.images?.[0] || product.imageUrl}
                      alt={getProductName(product)}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div>
                
                {/* Product Info */}
                <div className="pt-3 pb-4">
                  <h3 className="text-sm text-gray-900 font-normal truncate">
                    {getProductName(product)}
                  </h3>
                  <p className="text-sm text-gray-900 mt-1 font-medium">
                    {product.price?.toFixed(2)} ₼
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
