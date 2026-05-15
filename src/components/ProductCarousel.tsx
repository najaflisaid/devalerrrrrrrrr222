import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '../types';

/**
 * ProductCarousel — Omega tipli horizontal məhsul carousel-i.
 *  - Native CSS scroll-snap horizontal scroller
 *  - Sol/sağ ox düymələri ilə bir görünən sahə qədər sürüşür
 *  - Hər kart: şəkil canvası + brend etiketi + ad + qiymət
 *  - Hover-də şəkil 2-yə keçid + alt-line accent
 */
interface ProductCarouselProps {
  products: Product[];
  testIdPrefix?: string;
  /** Override per-card flex-basis at each breakpoint. */
  cardBasis?: string;
  /** 'default' shows "Bax" link; 'minimal' hides it for catalog-style cards */
  variant?: 'default' | 'minimal';
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({
  products,
  testIdPrefix = 'pc',
  // Mobil: 2 kart + 3-cünün yarısı görünür (basis ~36%, gap-5 nəzərə alınmaqla).
  cardBasis = 'basis-[36%] sm:basis-[46%] md:basis-[31%] lg:basis-[24%]',
  variant = 'default',
}) => {
  const { i18n } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const detailsLabel = lang === 'ru' ? 'Посмотреть' : lang === 'en' ? 'View' : 'Bax';

  const getName = (p: Product): string => {
    if (typeof p.name === 'string') return p.name as unknown as string;
    return p.name[lang] || p.name.az || p.name.en || '';
  };

  const updateButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      window.removeEventListener('resize', updateButtons);
    };
  }, [products.length]);

  const step = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth * 0.88;
    el.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  return (
    <div className="relative" data-testid={`${testIdPrefix}-wrapper`}>
      {/* Prev / Next overlay buttons (desktop) */}
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={!canPrev}
        aria-label="Previous"
        data-testid={`${testIdPrefix}-prev`}
        className={`hidden md:flex absolute -left-2 lg:-left-4 top-[34%] -translate-y-1/2 z-[3] w-12 h-12 lg:w-14 lg:h-14 items-center justify-center rounded-full bg-white border border-black/10 hover:border-black transition-all duration-300 ${
          canPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ArrowLeft className="w-4 h-4 text-black" strokeWidth={1.4} />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={!canNext}
        aria-label="Next"
        data-testid={`${testIdPrefix}-next`}
        className={`hidden md:flex absolute -right-2 lg:-right-4 top-[34%] -translate-y-1/2 z-[3] w-12 h-12 lg:w-14 lg:h-14 items-center justify-center rounded-full bg-white border border-black/10 hover:border-black transition-all duration-300 ${
          canNext ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ArrowRight className="w-4 h-4 text-black" strokeWidth={1.4} />
      </button>

      {/* Scroller */}
      <motion.div
        ref={scrollerRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-5 md:gap-8 pb-2 scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        data-testid={`${testIdPrefix}-scroller`}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        {products.map((product) => {
          const name = getName(product);
          const brand = product.brand || '';
          const onSale = !!product.salePrice && product.salePrice < product.price;
          const price = onSale ? product.salePrice! : product.price;

          return (
            <div
              key={product.id}
              className={`snap-start shrink-0 ${cardBasis}`}
              data-testid={`${testIdPrefix}-card-${product.id}`}
            >
              <Link
                to={`/product/${product.id}`}
                className="group block bg-white rounded-sm transition-shadow duration-500 hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.35)]"
              >
                {/* Image canvas */}
                <div className={`relative w-full overflow-hidden ${variant === 'minimal' ? 'aspect-[3/4] bg-white' : 'aspect-square bg-[#FAFAFA]'}`}>
                  <span
                    aria-hidden="true"
                    className="absolute top-3 right-3 md:top-4 md:right-4 z-[2] text-black/30 group-hover:text-black/80 transition-colors"
                  >
                    <Heart className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={1.4} />
                  </span>

                  <img
                    src={product.images?.[0]}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.08] ${variant === 'minimal' ? 'p-4 md:p-6' : 'p-6 md:p-10'}`}
                  />
                  {product.images?.[1] && (
                    <img
                      src={product.images[1]}
                      alt={name}
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-contain opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-hover:delay-[1500ms] group-hover:scale-[1.08] [transition-property:opacity,transform] ${variant === 'minimal' ? 'p-4 md:p-6' : 'p-6 md:p-10'}`}
                    />
                  )}

                  {variant !== 'minimal' && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 h-px w-full bg-black scale-x-0 origin-left transition-transform duration-700 ease-out group-hover:scale-x-100"
                    />
                  )}
                </div>

                {/* Meta — minimal (catalog) variant */}
                {variant === 'minimal' ? (
                  <div className="dv-card-text pt-3 md:pt-4 px-2 pb-4 text-left leading-tight">
                    {brand && (
                      <p className="text-[13px] md:text-[15px] tracking-[0.14em] uppercase text-gray-900 font-semibold leading-tight">
                        {brand}
                      </p>
                    )}
                    {product.category && (
                      <p className="mt-0.5 text-[10px] md:text-[11px] tracking-[0.16em] uppercase text-gray-500 font-medium leading-tight">
                        {product.category}
                      </p>
                    )}
                    <h3 className="mt-1 text-[12px] md:text-[13px] font-normal text-gray-600 leading-tight line-clamp-1">
                      {name}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2 tabular-nums">
                      {onSale ? (
                        <>
                          <span className="text-[14px] md:text-[16px] font-semibold text-black leading-tight">
                            {price.toFixed(0)} AZN
                          </span>
                          <span className="text-[11px] md:text-[12px] text-gray-400 line-through font-light">
                            {product.price.toFixed(0)} AZN
                          </span>
                        </>
                      ) : (
                        <span className="text-[14px] md:text-[16px] font-semibold text-black leading-tight">
                          {price.toFixed(0)} AZN
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Meta — default variant (with "Bax" link) */
                  <div className="pt-3 md:pt-3.5 px-2 pb-3">
                    {brand && (
                      <p className="text-[10px] md:text-[11px] tracking-[0.18em] uppercase text-black font-semibold">
                        {brand}
                      </p>
                    )}
                    <h3 className="mt-0.5 text-[12px] md:text-[13.5px] font-light text-black/65 leading-snug line-clamp-2 min-h-[2.6em]">
                      {name}
                    </h3>
                    <div className="mt-0.5 flex items-baseline gap-2 tabular-nums">
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
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.22em] font-semibold text-black/80 group-hover:text-black">
                      <span className="relative pb-0.5">
                        {detailsLabel}
                        <span
                          aria-hidden="true"
                          className="absolute left-0 bottom-0 h-px w-full bg-black/70"
                        />
                      </span>
                      <ArrowRight
                        className="w-3 h-3 transition-transform duration-500 group-hover:translate-x-1"
                        strokeWidth={1.6}
                      />
                    </span>
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ProductCarousel;
