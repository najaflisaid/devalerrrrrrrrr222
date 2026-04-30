import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import Tilt3D from './Tilt3D';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => { loadBestSellers(); }, []);

  const loadBestSellers = async () => {
    try {
      const data = await productService.getBestSellers(16);
      setProducts(data);
    } catch (error) {
      console.error('Error loading best sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ox düymələrinin görünürlüyünü yenilə — sola/sağa scroll mümkündürmü?
  const updateScrollButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [products.length]);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = (dir === 'left' ? -1 : 1) * Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (loading || products.length === 0) return null;

  return (
    <section
      className="relative py-12 md:py-20 bg-white overflow-hidden"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header — daha yığcam */}
        <div className="text-center mb-6 md:mb-10">
          <div className="inline-flex items-center mb-2">
            <span className="inline-block w-6 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="mx-2.5 text-[8px] sm:text-[9px] uppercase tracking-[0.22em] sm:tracking-[0.28em] dv-shimmer font-semibold whitespace-nowrap">
              {t('bestSellers.eyebrow', { defaultValue: "De Valeur'da kəşfə çıxın" })}
            </span>
            <span className="inline-block w-6 h-[1px]" style={{ background: '#D4AF37' }} />
          </div>
          <h2 className="font-playfair text-base sm:text-lg md:text-xl lg:text-2xl font-light text-black tracking-tight leading-[1.1]">
            {t('bestSellers.title')}
          </h2>
        </div>

        {/* Sürüşən 1 sıra — sağda/solda ox düymələri ilə idarə olunur */}
        <div className="relative">
          {/* Sol ox düyməsi */}
          <button
            onClick={() => scrollBy('left')}
            disabled={!canScrollLeft}
            aria-label="Sola"
            className={`absolute left-0 sm:-left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-[0_6px_18px_-4px_rgba(0,0,0,0.22)] border border-gray-100 flex items-center justify-center transition-all ${
              canScrollLeft ? 'opacity-100 hover:scale-105 hover:border-[#D4AF37]/40' : 'opacity-0 pointer-events-none'
            }`}
            data-testid="bestseller-scroll-left"
          >
            <ChevronLeft className="h-5 w-5 text-gray-800" />
          </button>

          {/* Sağ ox düyməsi */}
          <button
            onClick={() => scrollBy('right')}
            disabled={!canScrollRight}
            aria-label="Sağa"
            className={`absolute right-0 sm:-right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-[0_6px_18px_-4px_rgba(0,0,0,0.22)] border border-gray-100 flex items-center justify-center transition-all ${
              canScrollRight ? 'opacity-100 hover:scale-105 hover:border-[#D4AF37]/40' : 'opacity-0 pointer-events-none'
            }`}
            data-testid="bestseller-scroll-right"
          >
            <ChevronRight className="h-5 w-5 text-gray-800" />
          </button>

          {/* Kart sırası */}
          <div
            ref={scrollerRef}
            className="dv-bs-scroller flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 px-1"
            style={{ scrollbarWidth: 'none' as any }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                className="shrink-0 snap-start w-[45vw] sm:w-[240px] md:w-[270px] lg:w-[290px]"
              >
                <Tilt3D
                  maxTilt={6}
                  className="cursor-pointer group transition-transform duration-500 ease-out hover:-translate-y-2 hover:scale-[1.04] hover:z-10 relative block"
                  onClick={() => navigate(`/product/${product.id}`)}
                  testId={`dv-bestseller-card-${product.id}`}
                >
                  <div className="dv-tilt-inner">
                    <div className="relative bg-white overflow-hidden rounded-md transition-shadow duration-500 group-hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)] ring-0 group-hover:ring-1 group-hover:ring-[#D4AF37]/30">
                      {product.isPersonalizable && (
                        <span className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.3em] text-[#D4AF37] font-medium z-[2]">
                          Personalize
                        </span>
                      )}

                      <div className="aspect-[3/4] flex items-center justify-center p-2 sm:p-6 relative">
                        <img
                          src={product.images?.[0] || product.imageUrl}
                          alt={getProductName(product)}
                          loading="lazy"
                          decoding="async"
                          className={`max-w-full max-h-full object-contain transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:-rotate-1 ${
                            product.images?.[1] ? 'group-hover:opacity-0' : ''
                          }`}
                        />
                        {product.images?.[1] && (
                          <img
                            src={product.images[1]}
                            alt={getProductName(product)}
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-contain p-2 sm:p-6 opacity-0 scale-105 transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-1"
                          />
                        )}
                      </div>
                    </div>

                    <div className="pt-2 pb-1 sm:pt-3 sm:pb-2 px-1 sm:px-0">
                      <h3 className="text-[11px] sm:text-sm md:text-[15px] text-black font-medium truncate leading-tight">
                        <span className="dv-gold-line">{getProductName(product)}</span>
                      </h3>
                      <p className="text-[11px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1 font-light tracking-wide">
                        <span className="text-black font-medium">{product.price?.toFixed(2)}</span>{' '}
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

      {/* Scrollbarı gizlə */}
      <style>{`
        .dv-bs-scroller::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default BestSellersSection;
