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
      // 3 sıra üçün daha çox məhsul yüklə (hər sıra üçün ən az ~12 məhsul)
      const data = await productService.getBestSellers(36);
      setProducts(data);
    } catch (error) {
      console.error('Error loading best sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || products.length === 0) return null;

  // Split into THREE rows that scroll in alternating directions (left, right, left)
  const third = Math.ceil(products.length / 3);
  const rowA = products.slice(0, third);
  const rowB = products.slice(third, third * 2);
  const rowC = products.slice(third * 2);
  const ensureMin = (arr: Product[]) => arr.length >= 6 ? arr : [...arr, ...products].slice(0, Math.max(6, arr.length));
  const safeRowA = ensureMin(rowA);
  const safeRowB = ensureMin(rowB);
  const safeRowC = ensureMin(rowC);

  const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
    <div className="shrink-0 w-[calc(33.333vw-12px)] sm:w-[230px] md:w-[260px] lg:w-[290px]">
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

          <div className="pt-2 pb-1 sm:pt-4 sm:pb-2 px-1 sm:px-0">
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
  );

  const Row: React.FC<{ items: Product[]; direction: 'left' | 'right' }> = ({ items, direction }) => (
    <div className="dv-bs-row relative overflow-hidden">
      <div className={`dv-bs-track ${direction === 'left' ? 'dv-bs-track-left' : 'dv-bs-track-right'}`}>
        {/* Render twice for seamless loop */}
        {[...items, ...items].map((p, i) => (
          <ProductCard key={`${p.id}-${i}`} product={p} />
        ))}
      </div>
    </div>
  );

  return (
    <section
      className="relative py-20 md:py-28 bg-white overflow-hidden"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center mb-4">
            <span className="inline-block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="mx-3 text-[9px] sm:text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.35em] dv-shimmer font-semibold whitespace-nowrap">
              {t('bestSellers.eyebrow', { defaultValue: "De Valeur'da kəşfə çıxın" })}
            </span>
            <span className="inline-block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
          </div>
          <h2 className="font-playfair text-3xl md:text-5xl font-light text-black tracking-tight leading-[1.05]">
            {t('bestSellers.title')}
          </h2>
        </div>

        {/* Three opposite-direction marquee rows */}
        <div className="space-y-3 sm:space-y-5">
          <Row items={safeRowA} direction="left" />
          <Row items={safeRowB} direction="right" />
          <Row items={safeRowC} direction="left" />
        </div>
      </div>

      {/* Soft side fades for elegance */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 sm:w-24 z-10"
        style={{ background: 'linear-gradient(90deg, white, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 sm:w-24 z-10"
        style={{ background: 'linear-gradient(270deg, white, transparent)' }}
        aria-hidden="true"
      />
    </section>
  );
};

export default BestSellersSection;
