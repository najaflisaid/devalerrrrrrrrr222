import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useInView } from '../hooks/useInView';
import Tilt3D from './Tilt3D';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const { ref: sectionRef, inView } = useInView<HTMLDivElement>();

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => { loadBestSellers(); }, []);

  useEffect(() => {
    if (!isAutoScrolling || products.length === 0) return;
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScroll - 10) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          container.scrollTo({ left: container.scrollLeft + 260, behavior: 'smooth' });
        }
      }
    }, 3500);
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
      const scrollAmount = 520;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;
      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
    setTimeout(() => setIsAutoScrolling(true), 10000);
  };

  if (loading || products.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 bg-white overflow-hidden"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className={`dv-reveal ${inView ? 'is-in' : ''} flex items-end justify-between mb-10 md:mb-14`}>
          <div>
            <div className="flex items-center mb-4">
              <span className="inline-block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
              <span className="ml-3 text-[10px] uppercase tracking-[0.35em] dv-shimmer font-semibold">
                {t('bestSellers.eyebrow', { defaultValue: 'Curated · Iconic' })}
              </span>
            </div>
            <h2 className="font-playfair text-3xl md:text-5xl font-light text-black tracking-tight leading-[1.05]">
              {t('bestSellers.title')}
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="group w-11 h-11 border border-gray-200 hover:border-black transition-all duration-300 flex items-center justify-center rounded-full"
              aria-label={t('bestSellers.prevProducts')}
              data-testid="dv-bestsellers-prev"
            >
              <ChevronLeft className="h-4 w-4 text-black group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.2} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="group w-11 h-11 border border-black bg-black hover:bg-[#D4AF37] hover:border-[#D4AF37] transition-all duration-300 flex items-center justify-center rounded-full"
              aria-label={t('bestSellers.nextProducts')}
              data-testid="dv-bestsellers-next"
            >
              <ChevronRight className="h-4 w-4 text-white group-hover:translate-x-0.5 transition-transform" strokeWidth={1.2} />
            </button>
          </div>
        </div>

        {/* Scroller */}
        <div
          className="relative"
          onMouseEnter={() => setIsAutoScrolling(false)}
          onMouseLeave={() => setIsAutoScrolling(true)}
        >
          {/* Floating side nav (over the scroller) */}
          <button
            onClick={() => scroll('left')}
            className="group absolute left-1 sm:-left-2 md:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-white/95 backdrop-blur-sm border border-gray-200 hover:border-[#D4AF37] hover:bg-[#D4AF37] shadow-lg hover:shadow-xl flex items-center justify-center rounded-full transition-all duration-300"
            aria-label={t('bestSellers.prevProducts')}
            data-testid="dv-bestsellers-prev-side"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-black group-hover:text-white group-hover:-translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="group absolute right-1 sm:-right-2 md:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-white/95 backdrop-blur-sm border border-gray-200 hover:border-[#D4AF37] hover:bg-[#D4AF37] shadow-lg hover:shadow-xl flex items-center justify-center rounded-full transition-all duration-300"
            aria-label={t('bestSellers.nextProducts')}
            data-testid="dv-bestsellers-next-side"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-black group-hover:text-white group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>

          <div
            ref={scrollContainerRef}
            className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product, idx) => (
              <div
                key={product.id}
                className={`flex-shrink-0 w-[calc(50%-6px)] sm:w-[230px] md:w-[260px] lg:w-[290px] dv-reveal ${inView ? 'is-in' : ''} ${idx < 5 ? `dv-reveal-delay-${idx + 1}` : ''}`}
              >
                <Tilt3D
                  maxTilt={6}
                  className="cursor-pointer group"
                  onClick={() => navigate(`/product/${product.id}`)}
                  testId={`dv-bestseller-card-${product.id}`}
                >
                  <div className="dv-tilt-inner">
                    {/* Product image card */}
                    <div className="relative bg-white overflow-hidden">
                      {/* Gold corner frames (card interior stays white) */}
                      <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      {product.isPersonalizable && (
                        <span className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.3em] text-[#D4AF37] font-medium z-[2]">
                          Personalize
                        </span>
                      )}

                      <div className="aspect-[3/4] flex items-center justify-center p-4 sm:p-6 relative">
                        <img
                          src={product.images?.[0] || product.imageUrl}
                          alt={getProductName(product)}
                          className={`max-w-full max-h-full object-contain transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:-rotate-1 ${
                            product.images?.[1] ? 'group-hover:opacity-0' : ''
                          }`}
                        />
                        {product.images?.[1] && (
                          <img
                            src={product.images[1]}
                            alt={getProductName(product)}
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-contain p-4 sm:p-6 opacity-0 scale-105 transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-1"
                          />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="pt-4 pb-2">
                      <h3 className="text-sm md:text-[15px] text-black font-medium truncate">
                        <span className="dv-gold-line">{getProductName(product)}</span>
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 font-light tracking-wide">
                        <span className="text-black font-medium">
                          {product.price?.toFixed(2)}
                        </span>{' '}
                        ₼
                      </p>
                    </div>
                  </div>
                </Tilt3D>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
