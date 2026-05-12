import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Heart } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate, Link } from 'react-router-dom';
import { Product } from '../types';
import {
  getBestSellersBanner,
  defaultBanner,
  type BestSellersBanner,
} from '../services/bestSellersBannerService';

const BestSellersSection: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BestSellersBanner>(defaultBanner());

  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? !window.matchMedia('(min-width: 1024px)').matches : false
  );

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

  // Banner sticky işləməsi üçün məhsullar vertikal grid kimi göstərilir (paginasiya yoxdur).
  // Beləliklə məhsullar sütunu banner-dən xeyli hündür olur və sticky uzun müddət işləyir.
  // Desktop: 3 sütun, Mobil: 2 sütun. Bütün məhsullar (24-ə qədər) tək siyahıda.

  if (loading || products.length === 0) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  // Banner sahəsi həm mobil, həm desktop-də həmişə sağda göstərilir
  const bannerActive = banner.enabled && !!banner.imageUrl;
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
        {/* Mobile: products (2 sütun, vertikal) + sticky banner (45% sağda).
            Desktop: products (3 sütun, vertikal) + sticky banner (~38% sağda).
            Paginasiya yoxdur — məhsullar bütün uzunluqda göstərilir ki, banner uzun müddət sticky qalsın. */}
        <div className="px-1.5 grid grid-cols-[1fr_45%] lg:grid-cols-[1fr_minmax(320px,38%)] gap-1.5 sm:gap-2 items-start">
          {/* PRODUCTS column */}
          <div className="min-w-0">
            <div
              className="grid gap-1 md:gap-2 bg-[#F4F4F4]"
              style={{
                gridTemplateColumns: isMobile
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(3, minmax(0, 1fr))',
              }}
              data-testid="bestsellers-grid"
            >
                  {products.map((product) => {
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
                        className="group relative flex flex-col text-left bg-white hover:shadow-[0_14px_32px_-16px_rgba(0,0,0,0.28)] hover:z-[1] transition-shadow duration-300 ease-out p-1 md:p-3"
                      >
                        {/* Wishlist heart — top right */}
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 md:top-3 md:right-3 text-black/35 group-hover:text-black/70 transition-colors z-[2]"
                        >
                          <Heart className="w-2.5 h-2.5 md:w-[18px] md:h-[18px]" strokeWidth={1.4} />
                        </span>

                        {/* Sale badge — top left, circular % */}
                        {onSale && (
                          <span
                            className="absolute top-1 left-1 md:top-3 md:left-3 z-[2] inline-flex items-center justify-center w-5 h-5 md:w-11 md:h-11 rounded-full bg-[#D14545] text-white text-[7px] md:text-[12px] font-bold tabular-nums shadow-[0_4px_12px_-3px_rgba(209,69,69,0.55)]"
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
                            className="absolute inset-0 w-full h-full object-contain p-0.5 md:p-2 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                          {product.images?.[1] && (
                            <img
                              src={product.images[1]}
                              alt={name}
                              aria-hidden="true"
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-contain p-0.5 md:p-2 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="mt-0.5 md:mt-2 px-0.5 md:px-1">
                          {brand && (
                            <p className="text-[7px] sm:text-[8px] md:text-[12px] tracking-[0.03em] uppercase text-black font-medium leading-[1.1] truncate">
                              {brand}
                            </p>
                          )}
                          <h3 className="text-[7px] sm:text-[8px] md:text-[12px] font-light text-black/65 leading-[1.15] line-clamp-1 mt-px md:mt-0.5">
                            {name}
                          </h3>
                          <p className="mt-0.5 md:mt-1 text-[8px] sm:text-[9px] md:text-[13px] text-black font-medium tabular-nums leading-tight">
                            {onSale ? (
                              <>
                                <span className="text-black/40 line-through mr-0.5 md:mr-1 font-light">
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
          </div>

          {/* BANNER column — sticky on both mobile and desktop.
              Hər zaman görünür (boş halda subtle placeholder). */}
          <aside
            className="sticky top-2 lg:top-4 self-start"
            data-testid="bestsellers-banner"
          >
            {bannerActive ? (
              <Link
                to={banner.buttonLink || '/products'}
                className="group relative block w-full aspect-[3/4] overflow-hidden bg-black"
              >
                <img
                  src={banner.imageUrl}
                  alt={bannerTitle || 'Banner'}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
                <div
                  className={`absolute inset-0 flex flex-col justify-end ${posClass} p-3 md:p-8 pointer-events-none`}
                  style={{ color: banner.textColor || '#ffffff' }}
                >
                  {bannerTitle && (
                    <h3
                      className="font-playfair text-base sm:text-lg md:text-3xl lg:text-[34px] font-normal leading-[1.1] tracking-tight"
                      style={{ textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}
                    >
                      {bannerTitle}
                    </h3>
                  )}
                  {bannerSubtitle && (
                    <p
                      className="mt-1 md:mt-2 text-[10px] sm:text-xs md:text-base font-light max-w-[28ch] leading-snug"
                      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
                    >
                      {bannerSubtitle}
                    </p>
                  )}
                  {bannerBtnText && (
                    <span
                      className="mt-2 md:mt-4 inline-flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.24em] font-medium pointer-events-auto"
                      style={{ borderBottom: `1px solid ${banner.textColor || '#ffffff'}` }}
                    >
                      {bannerBtnText}
                      <ChevronRight className="w-2.5 h-2.5 md:w-3 md:h-3" strokeWidth={1.5} />
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div
                className="relative w-full aspect-[3/4] bg-white border border-dashed border-black/15 flex items-center justify-center"
                data-testid="bestsellers-banner-placeholder"
              >
                <div className="text-center px-3 md:px-6 text-black/35">
                  <div className="font-playfair text-lg md:text-2xl mb-1 md:mb-2">DE VALEUR</div>
                  <p className="text-[8px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.24em]">
                    Admin panel — Bestseller Banner
                  </p>
                </div>
              </div>
            )}
          </aside>
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
