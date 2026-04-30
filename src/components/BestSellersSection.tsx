import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import Tilt3D from './Tilt3D';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => { loadBestSellers(); }, []);

  const loadBestSellers = async () => {
    try {
      // 1 sıra infinite-loop marquee — hərəkət üçün kifayət qədər məhsul lazımdır
      const data = await productService.getBestSellers(24);
      setProducts(data);
    } catch (error) {
      console.error('Error loading best sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || products.length === 0) return null;

  // Hərəkət üçün minimum məhsul sayı — azdırsa təkrarlanır
  const safeItems = products.length >= 12 ? products : [...products, ...products, ...products].slice(0, 12);

  const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
    <div
      className="shrink-0 w-[calc(25vw-12px)] sm:w-[calc(20vw-12px)] md:w-[calc(16.666vw-16px)] lg:w-[calc(16.666vw-20px)] xl:w-[calc(16.666vw-22px)]"
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
              <span className="absolute top-2 left-2 text-[8px] uppercase tracking-[0.25em] text-[#D4AF37] font-medium z-[2]">
                Personalize
              </span>
            )}

            <div className="aspect-[3/4] flex items-center justify-center p-1.5 sm:p-3 md:p-4 relative">
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
                  className="absolute inset-0 w-full h-full object-contain p-1.5 sm:p-3 md:p-4 opacity-0 scale-105 transition-all duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-1"
                />
              )}
            </div>
          </div>

          <div className="pt-1.5 pb-1 sm:pt-2 md:pt-3 md:pb-2 px-0.5 sm:px-1">
            <h3 className="text-[10px] sm:text-xs md:text-sm text-black font-medium truncate leading-tight">
              <span className="dv-gold-line">{getProductName(product)}</span>
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 font-light tracking-wide">
              <span className="text-black font-medium">{product.price?.toFixed(2)}</span>{' '}
              ₼
            </p>
          </div>
        </div>
      </Tilt3D>
    </div>
  );

  return (
    <section
      className="relative py-10 md:py-16 bg-white overflow-hidden"
      data-testid="dv-bestsellers"
    >
      {/* Full-width container — Yarımçıq düşmə problemini həll edir (max-w limiti silindi) */}
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 relative">
        {/* Yığcam başlıq */}
        <div className="text-center mb-5 md:mb-8">
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

        {/* Sola doğru avtomatik sürüşən 1 sıra (marquee) */}
        <div className="dv-bs-row relative overflow-hidden">
          <div className="dv-bs-track dv-bs-track-left">
            {/* Seamless loop üçün 2 dəfə render */}
            {[...safeItems, ...safeItems].map((p, i) => (
              <ProductCard key={`${p.id}-${i}`} product={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Soft kənar gradient — elegant bluendinq */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-8 sm:w-16 z-10"
        style={{ background: 'linear-gradient(90deg, white, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-8 sm:w-16 z-10"
        style={{ background: 'linear-gradient(270deg, white, transparent)' }}
        aria-hidden="true"
      />
    </section>
  );
};

export default BestSellersSection;
