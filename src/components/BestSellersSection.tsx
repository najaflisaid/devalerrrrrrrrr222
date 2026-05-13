import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useReveal } from '../hooks/useReveal';

/**
 * BestSellersSection — Premium, editorial-style "Best Sellers" bloku.
 *
 * Dəyişikliklər:
 *  - Sağdakı banner şəkli tamamilə silindi.
 *  - Tam genişlikdə (full-width) məhsul grid-i: mobil 2, planşet 3, desktop 4 sütun.
 *  - Yuxarıda "BEST SELLERS" editorial başlığı və alt-yazı.
 *  - Scroll-trigger animasiya (fade-up + stagger) `useReveal` hook-u ilə.
 *  - Kartlar hover-də şəkil-2-yə yumşaq keçir, "Detallar" underline-li CTA.
 */
const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll-reveal ref-ləri (grid framer-motion-a keçirildi)
  const header = useReveal<HTMLDivElement>();
  const footer = useReveal<HTMLDivElement>();

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name as unknown as string;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await productService.getBestSellers(12);
        if (data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback: əgər heç bir məhsul "isBestseller=true" deyilsə,
          // bütün məhsullardan ilk 12-ni göstər ki, bölmə boş qalmasın.
          const all = await productService.getAll();
          setProducts(all.slice(0, 12));
        }
      } catch (e) {
        console.error('Error loading best sellers:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || products.length === 0) return null;

  const surtitle =
    i18n.language === 'ru'
      ? 'БЕСТСЕЛЛЕРЫ'
      : i18n.language === 'en'
      ? 'BEST SELLERS'
      : 'BEST SELLERS';

  const title = t('bestSellers.title', { defaultValue: 'Sevilən məhsullar' });
  const subtitle = t('bestSellers.subtitle', {
    defaultValue: 'Müştərilərimizin ən çox seçdiyi məhsullar',
  });
  const viewAll =
    i18n.language === 'ru'
      ? 'Смотреть все'
      : i18n.language === 'en'
      ? 'View all'
      : 'Hamısına bax';
  const detailsLabel =
    i18n.language === 'ru' ? 'Подробнее' : i18n.language === 'en' ? 'Details' : 'Detallar';

  return (
    <section
      className="relative bg-[#FAF9F7] py-16 md:py-28 overflow-hidden"
      data-testid="dv-bestsellers"
    >
      {/* Ambient gold orb decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: 'radial-gradient(circle, #C9A961 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full opacity-[0.05] blur-3xl"
        style={{ background: 'radial-gradient(circle, #C9A961 0%, transparent 70%)' }}
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* === EDITORIAL HEADER === */}
        <div
          ref={header.ref}
          className={`dv-scroll-reveal dv-scroll-up text-center mb-10 md:mb-16 ${
            header.revealed ? 'dv-scroll-in' : ''
          }`}
          data-testid="bestsellers-header"
        >
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-4 md:mb-6">
            <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
            <p className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium">
              {surtitle}
            </p>
            <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
          </div>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-[42px] lg:text-[52px] font-light text-black leading-[1.05] tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-3 md:mt-5 text-xs sm:text-sm md:text-base text-black/55 max-w-xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* === PRODUCTS GRID (framer-motion stagger reveal + zoom) === */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10 md:gap-x-8 md:gap-y-16"
          data-testid="bestsellers-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-10%' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
        >
          {products.map((product) => {
            const onSale = !!product.salePrice && product.salePrice < product.price;
            const price = onSale ? product.salePrice! : product.price;
            const name = getProductName(product);
            const brand = (product as any).brand || '';
            const discount = onSale
              ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
              : 0;

            return (
              <motion.div
                key={product.id}
                data-testid={`bestseller-card-${product.id}`}
                variants={{
                  hidden: { opacity: 0, y: 32, scale: 0.96 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="group relative flex flex-col text-left w-full bg-white"
                >
                  {/* Image canvas */}
                  <div className="relative aspect-square w-full overflow-hidden bg-[#FAFAFA]">
                    {/* Wishlist heart */}
                    <span
                      aria-hidden="true"
                      className="absolute top-3 right-3 md:top-4 md:right-4 z-[2] text-black/30 group-hover:text-black/80 transition-colors duration-300"
                    >
                      <Heart className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={1.4} />
                    </span>

                    {/* Sale badge */}
                    {onSale && (
                      <span
                        className="absolute top-3 left-3 md:top-4 md:left-4 z-[2] inline-flex items-center justify-center min-w-[40px] h-7 md:h-8 px-2 rounded-full bg-black text-white text-[10px] md:text-[11px] font-medium tabular-nums tracking-wider"
                        data-testid={`bs-discount-badge-${product.id}`}
                      >
                        −{discount}%
                      </span>
                    )}

                    {/* Primary image */}
                    <img
                      src={product.images?.[0]}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-contain p-6 md:p-10 transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
                    />
                    {/* Hover swap image */}
                    {product.images?.[1] && (
                      <img
                        src={product.images[1]}
                        alt={name}
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-contain p-6 md:p-10 opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
                      />
                    )}

                    {/* Bottom hover line — Omega-style subtle accent */}
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 h-px w-full bg-black scale-x-0 origin-left transition-transform duration-700 ease-out group-hover:scale-x-100"
                    />
                  </div>

                  {/* Info block */}
                  <div className="pt-4 md:pt-6 px-1 md:px-2 flex flex-col flex-1">
                    {brand && (
                      <p className="text-[10px] md:text-[12px] tracking-[0.18em] uppercase text-black font-semibold leading-tight">
                        {brand}
                      </p>
                    )}
                    <h3 className="mt-1 md:mt-1.5 text-[12px] md:text-[14px] font-light text-black/65 leading-snug line-clamp-2 min-h-[2.6em]">
                      {name}
                    </h3>

                    {/* Price */}
                    <div className="mt-2 md:mt-3 flex items-baseline gap-2 tabular-nums">
                      {onSale ? (
                        <>
                          <span className="text-[13px] md:text-[15px] font-medium text-[#C9A961]">
                            {price.toFixed(0)} AZN
                          </span>
                          <span className="text-[11px] md:text-[12px] text-black/35 line-through font-light">
                            {product.price.toFixed(0)} AZN
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] md:text-[15px] font-medium text-black">
                          {price.toFixed(0)} AZN
                        </span>
                      )}
                    </div>

                    {/* Details CTA — underline reveals on hover */}
                    <span
                      className="mt-3 md:mt-4 inline-flex items-center gap-1.5 self-start text-[10px] md:text-[11px] uppercase tracking-[0.22em] font-semibold text-black/80 group-hover:text-black"
                    >
                      <span className="relative pb-1">
                        {detailsLabel}
                        <span
                          aria-hidden="true"
                          className="absolute left-0 bottom-0 h-px w-full bg-black/70 origin-left scale-x-100 transition-transform duration-500"
                        />
                      </span>
                      <ArrowRight
                        className="w-3 h-3 md:w-3.5 md:h-3.5 transition-transform duration-500 group-hover:translate-x-1"
                        strokeWidth={1.6}
                      />
                    </span>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* === BOTTOM CTA === */}
        <div
          ref={footer.ref}
          className={`dv-scroll-reveal dv-scroll-up mt-12 md:mt-20 flex justify-center ${
            footer.revealed ? 'dv-scroll-in' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => navigate('/products?sort=bestsellers')}
            className="group relative inline-flex items-center gap-3 px-7 md:px-10 py-3.5 md:py-4 border border-black text-black hover:bg-black hover:text-white transition-colors duration-500 text-[11px] md:text-[12px] uppercase tracking-[0.28em] font-medium"
            data-testid="bestsellers-view-all-btn"
          >
            <span>{viewAll}</span>
            <ArrowRight
              className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
