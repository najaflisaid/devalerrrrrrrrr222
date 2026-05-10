import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const trackRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? !window.matchMedia('(min-width: 1024px)').matches : false
  );

  // Web: 5 cols × 2 rows = 10 per page · Mobile: 3 cols × 3 rows = 9 per page
  const PER_PAGE_DESKTOP = 10;
  const PER_PAGE_MOBILE = 9;
  const perPage = isMobile ? PER_PAGE_MOBILE : PER_PAGE_DESKTOP;

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name as unknown as string;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    productService
      .getBestSellers(24)
      .then((data) => setProducts(data))
      .catch((e) => console.error('Error loading best sellers:', e))
      .finally(() => setLoading(false));
  }, []);

  // Track viewport changes
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => setIsMobile(!mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Chunk products into pages
  const pages: Product[][] = [];
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage));
  }
  const pageCount = Math.max(1, pages.length);

  // Track active page on scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const compute = () => {
      const w = track.clientWidth;
      if (w > 0) {
        setPageIndex(Math.round(track.scrollLeft / w));
      }
    };
    compute();
    track.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      track.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [products.length, perPage]);

  // Reset to first page when breakpoint changes
  useEffect(() => {
    if (trackRef.current) trackRef.current.scrollTo({ left: 0, behavior: 'auto' });
  }, [perPage]);

  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * track.clientWidth;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  if (loading || products.length === 0) return null;

  const showArrows = pageCount > 1;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <section
      className="relative py-6 md:py-8 bg-white overflow-hidden"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto">
        {/* Top divider */}
        <div className="px-1.5">
          <div className="h-px bg-black/10" />
        </div>

        {/* Heading row: title centered, arrows top-right (frameless, compact) */}
        <div className="relative px-1.5 mt-5 md:mt-7 mb-5 md:mb-7">
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-[30px] font-light tracking-tight text-black text-center">
            {t('bestSellers.title') || 'Sevilən məhsullar'}
          </h2>
          {showArrows && (
            <div className="absolute top-1/2 -translate-y-1/2 right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(pageIndex - 1)}
                aria-label="Previous"
                disabled={!canPrev}
                className="p-1 text-black/70 hover:text-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="bestsellers-prev"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => goToPage(pageIndex + 1)}
                aria-label="Next"
                disabled={!canNext}
                className="p-1 text-black/70 hover:text-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="bestsellers-next"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal slider — each "page" is a 4×2 grid (web) / 2×3 grid (mobile) */}
        <div className="px-1.5">
          <div
            ref={trackRef}
            className="dv-bs-scroll flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
            data-testid="bestsellers-track"
          >
            {pages.map((pageProducts, pIdx) => (
              <div
                key={pIdx}
                className="shrink-0 snap-start w-full grid gap-x-1.5 md:gap-x-3 gap-y-2 md:gap-y-3"
                style={{
                  gridTemplateColumns: isMobile
                    ? 'repeat(3, minmax(0, 1fr))'
                    : 'repeat(5, minmax(0, 1fr))',
                }}
                data-testid={`bestsellers-page-${pIdx}`}
              >
                {pageProducts.map((product) => {
                  const onSale = !!product.salePrice && product.salePrice < product.price;
                  const price = onSale ? product.salePrice! : product.price;
                  const name = getProductName(product);
                  const brand = (product as any).brand || '';

                  return (
                    <button
                      key={product.id}
                      type="button"
                      data-testid={`bestseller-card-${product.id}`}
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="group relative flex flex-col text-left transition-colors duration-300"
                    >
                      {/* Wishlist heart — top right */}
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 md:top-2.5 md:right-2.5 text-black/35 group-hover:text-black/70 transition-colors z-[2]"
                      >
                        <Heart className="w-3 h-3 md:w-[18px] md:h-[18px]" strokeWidth={1.4} />
                      </span>

                      {/* Sale label — top left */}
                      {onSale && (
                        <span className="absolute top-1 left-1 md:top-2.5 md:left-2.5 z-[2] text-[8px] md:text-[11px] tracking-[0.15em] uppercase font-medium text-[#D14545]">
                          {t('bestSellers.sale')}
                        </span>
                      )}

                      {/* Product image — square on every breakpoint, large on desktop */}
                      <div className="relative aspect-square w-full overflow-hidden">
                        <img
                          src={product.images?.[0]}
                          alt={name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-contain p-1 md:p-2 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                        {product.images?.[1] && (
                          <img
                            src={product.images[1]}
                            alt={name}
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 w-full h-full object-contain p-1 md:p-2 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
                          />
                        )}
                      </div>

                      {/* Info — compact on mobile, normal on desktop */}
                      <div className="mt-1 md:mt-2 px-0.5 md:px-1">
                        {brand && (
                          <p className="text-[8px] sm:text-[10px] md:text-[12px] tracking-[0.03em] uppercase text-black font-medium leading-[1.1] truncate">
                            {brand}
                          </p>
                        )}
                        <h3 className="text-[8px] sm:text-[10px] md:text-[12px] font-light text-black/65 leading-[1.15] line-clamp-1 mt-px md:mt-0.5">
                          {name}
                        </h3>
                        <p className="mt-0.5 md:mt-1 text-[9px] sm:text-[11px] md:text-[13px] text-black font-medium tabular-nums leading-tight">
                          {onSale ? (
                            <>
                              <span className="text-black/40 line-through mr-1 font-light">
                                {product.price.toFixed(0)} AZN
                              </span>
                              <span className="text-[#D14545]">{price.toFixed(0)} AZN</span>
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
            ))}
          </div>
        </div>

        {/* Bottom divider */}
        <div className="px-1.5 mt-6 md:mt-8">
          <div className="h-px bg-black/10" />
        </div>
      </div>

      <style>{`
        .dv-bs-scroll { width: 100%; max-width: 100%; }
        .dv-bs-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default BestSellersSection;
