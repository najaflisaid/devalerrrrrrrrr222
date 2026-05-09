import React, { useEffect, useRef, useState } from 'react';
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
  const trackRef = useRef<HTMLDivElement | null>(null);

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name as unknown as string;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    productService.getBestSellers(24)
      .then((data) => setProducts(data))
      .catch((e) => console.error('Error loading best sellers:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-rf-card]');
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.6;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section
      className="relative pt-4 pb-6 md:pt-6 md:pb-10 bg-white"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 md:px-12">
        {/* Header — title removed per request, only nav arrows */}
        <div className="flex items-center justify-end mb-3 md:mb-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Previous"
              className="text-black/30 hover:text-black transition-colors"
              data-testid="bestsellers-prev"
            >
              <ChevronLeft className="w-7 h-7 md:w-9 md:h-9" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Next"
              className="text-black hover:opacity-70 transition-opacity"
              data-testid="bestsellers-next"
            >
              <ChevronRight className="w-7 h-7 md:w-9 md:h-9" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          className="rf-track flex gap-2.5 sm:gap-3.5 md:gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {products.map((product) => {
            const onSale = !!product.salePrice && product.salePrice < product.price;
            const price = onSale ? product.salePrice! : product.price;
            const name = getProductName(product);

            return (
              <button
                key={product.id}
                type="button"
                data-rf-card
                data-testid={`bestseller-card-${product.id}`}
                onClick={() => navigate(`/product/${product.id}`)}
                className="group flex-none snap-start text-left w-[29vw] sm:w-[30vw] md:w-[24vw] lg:w-[18vw] xl:w-[16vw] max-w-[260px]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-white border border-black/10 transition-colors duration-300 group-hover:border-white">
                  {/* Sale label only */}
                  {onSale && (
                    <span className="absolute top-2.5 left-2.5 z-[2] text-[10px] md:text-[11px] tracking-[0.22em] uppercase font-medium text-[#D14545]">
                      {t('bestSellers.sale')}
                    </span>
                  )}

                  <img
                    src={product.images?.[0]}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-contain p-3 sm:p-5 md:p-7 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />

                  {product.images?.[1] && (
                    <img
                      src={product.images[1]}
                      alt={name}
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-contain p-3 sm:p-5 md:p-7 opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
                    />
                  )}
                </div>

                <div className="pt-3 md:pt-4">
                  <h3 className="text-[12px] sm:text-[13px] md:text-[15px] text-black font-normal tracking-tight truncate">
                    {name}
                  </h3>
                  <p className="mt-0.5 md:mt-1 text-[12px] sm:text-[13px] md:text-[15px] text-black tabular-nums">
                    {onSale ? (
                      <>
                        <span className="text-black/40 line-through mr-1.5">
                          {product.price.toFixed(0)} AZN
                        </span>
                        <span className="text-[#D14545] font-medium">
                          {price.toFixed(2)} AZN
                        </span>
                      </>
                    ) : (
                      <span>{price.toFixed(0)} AZN</span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        .rf-track::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default BestSellersSection;
