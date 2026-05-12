import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate, Link } from 'react-router-dom';
import { Product } from '../types';
import {
  getBestSellersBanner,
  defaultBanner,
  type BestSellersBanner,
} from '../services/bestSellersBannerService';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BestSellersBanner>(defaultBanner());

  const trackRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? !window.matchMedia('(min-width: 1024px)').matches : false
  );

  // Web: 3 cols × 3 rows = 9 per page (+ banner sağda) · Mobile: 3 cols × 3 rows = 9 per page
  const PER_PAGE_DESKTOP = 9;
  const PER_PAGE_MOBILE = 9;
  const perPage = isMobile ? PER_PAGE_MOBILE : PER_PAGE_DESKTOP;

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name as unknown as string;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    productService
      .getBestSellers(36)
      .then((data) => setProducts(data))
      .catch((e) => console.error('Error loading best sellers:', e))
      .finally(() => setLoading(false));
    getBestSellersBanner().then(setBanner).catch(() => undefined);
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

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  // Banner sahəsi həmişə desktop-də göstərilir; admin şəkil yükləməyibsə placeholder göstərilir
  const showBannerColumn = !isMobile;
  const bannerActive = banner.enabled && !!banner.imageUrl && !isMobile;
  const bannerTitle = banner.title[lang] || banner.title.az;
  const bannerSubtitle = banner.subtitle[lang] || banner.subtitle.az;
  const bannerBtnText = banner.buttonText[lang] || banner.buttonText.az;
  const posClass =
    banner.textPosition === 'top'
      ? 'items-start pt-8'
      : banner.textPosition === 'center'
      ? 'items-center'
      : 'items-end pb-8';

  return (
    <section
      className="relative pt-1.5 md:pt-2 pb-3 md:pb-4 bg-[#F4F4F4]"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto">
        {/* Arrows-only row */}
        {showArrows && (
          <div className="flex items-center justify-end px-1.5 mb-1.5 md:mb-2">
            <div className="flex items-center gap-1">
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
          </div>
        )}

        {/* Desktop layout: products (left, 3 cols × 3 rows) + sticky banner (right).
            Mobile: products only, 3×3 horizontal pagination. */}
        <div className={`px-1.5 ${showBannerColumn ? 'lg:grid lg:grid-cols-[1fr_minmax(320px,38%)] lg:gap-2 lg:items-start' : ''}`}>
          {/* PRODUCTS column */}
          <div className="min-w-0">
            <div
              ref={trackRef}
              className="dv-bs-scroll flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
              data-testid="bestsellers-track"
            >
              {pages.map((pageProducts, pIdx) => (
                <div
                  key={pIdx}
                  className="shrink-0 snap-start w-full grid gap-1 md:gap-2 bg-[#F4F4F4]"
                  style={{
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
                        className="group relative flex flex-col text-left bg-white hover:shadow-[0_14px_32px_-16px_rgba(0,0,0,0.28)] hover:z-[1] transition-shadow duration-300 ease-out p-2 md:p-3"
                      >
                        {/* Wishlist heart — top right */}
                        <span
                          aria-hidden="true"
                          className="absolute top-2 right-2 md:top-3 md:right-3 text-black/35 group-hover:text-black/70 transition-colors z-[2]"
                        >
                          <Heart className="w-3 h-3 md:w-[18px] md:h-[18px]" strokeWidth={1.4} />
                        </span>

                        {/* Sale badge — top left, circular % */}
                        {onSale && (
                          <span
                            className="absolute top-2 left-2 md:top-3 md:left-3 z-[2] inline-flex items-center justify-center w-7 h-7 md:w-11 md:h-11 rounded-full bg-[#D14545] text-white text-[8.5px] md:text-[12px] font-bold tabular-nums shadow-[0_4px_12px_-3px_rgba(209,69,69,0.55)]"
                            data-testid={`bs-discount-badge-${product.id}`}
                          >
                            −{Math.round(((product.price - product.salePrice!) / product.price) * 100)}%
                          </span>
                        )}

                        {/* Product image */}
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

                        {/* Info */}
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

          {/* BANNER column — sticky on desktop, hidden on mobile.
              Hər zaman görünür (boş halda subtle placeholder).
              max-h ilə banner məhsullar sütunundan qısa olur ki sticky uzun müddət işləsin. */}
          {showBannerColumn && (
            <aside
              className="hidden lg:block lg:sticky lg:top-4 lg:self-start"
              data-testid="bestsellers-banner"
            >
              {bannerActive ? (
                <Link
                  to={banner.buttonLink || '/products'}
                  className="group relative block w-full overflow-hidden bg-black"
                  style={{ height: 'min(calc(100vh - 1.5rem), 720px)' }}
                >
                  <img
                    src={banner.imageUrl}
                    alt={bannerTitle || 'Banner'}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
                  <div
                    className={`absolute inset-0 flex flex-col justify-end ${posClass} p-6 md:p-8 pointer-events-none`}
                    style={{ color: banner.textColor || '#ffffff' }}
                  >
                    {bannerTitle && (
                      <h3
                        className="font-playfair text-2xl md:text-3xl lg:text-[34px] font-normal leading-[1.1] tracking-tight"
                        style={{ textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}
                      >
                        {bannerTitle}
                      </h3>
                    )}
                    {bannerSubtitle && (
                      <p
                        className="mt-2 text-sm md:text-base font-light max-w-[28ch] leading-snug"
                        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
                      >
                        {bannerSubtitle}
                      </p>
                    )}
                    {bannerBtnText && (
                      <span
                        className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.24em] font-medium pointer-events-auto"
                        style={{ borderBottom: `1px solid ${banner.textColor || '#ffffff'}` }}
                      >
                        {bannerBtnText}
                        <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                      </span>
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  className="relative w-full bg-white border border-dashed border-black/15 flex items-center justify-center"
                  style={{ height: 'min(calc(100vh - 1.5rem), 720px)' }}
                  data-testid="bestsellers-banner-placeholder"
                >
                  <div className="text-center px-6 text-black/35">
                    <div className="font-playfair text-2xl mb-2">DE VALEUR</div>
                    <p className="text-[11px] uppercase tracking-[0.24em]">
                      Admin panel — Bestseller Banner
                    </p>
                  </div>
                </div>
              )}
            </aside>
          )}
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
