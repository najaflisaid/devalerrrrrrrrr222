import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Heart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';

/**
 * LuxuryGiftCardsSection — Louis Vuitton tərzli asimmetrik məhsul kartları bölməsi.
 *
 * - Scroll edərkən hər kart fərqli istiqamətdən (yuxarı / aşağı / sol / sağ / scale)
 *   yumşaq açılır.
 * - Kartın içindəki məhsul şəkli də fərqli istiqamətdən (yuxarı / sol / sağ) yüngül
 *   gecikmə ilə sürüşərək görünür.
 * - GPU-friendly transform-lar və `cubic-bezier(0.22, 1, 0.36, 1)` easing istifadə
 *   olunur ki, donma / janky effekt yaranmasın.
 * - Məhsullar hələlik bazadan random götürülür (admin idarəetməsi sonradan).
 */

type CardDir = 'up' | 'down' | 'left' | 'right' | 'scale';
type InnerDir = 'up' | 'left' | 'right';

interface CardLayout {
  /** Tailwind row-span class — kartı asimmetrik etmək üçün */
  rowSpan: string;
  /** Kartın özünün gəliş istiqaməti */
  dir: CardDir;
  /** Şəklin kartın içində gəliş istiqaməti */
  innerDir: InnerDir;
  /** Şəklin tutması (object-fit) — bəzi kartlar üçün cover, digərləri üçün contain */
  fit: 'cover' | 'contain';
}

// 9 kart üçün stabil asimmetrik layout (LV-yə bənzər)
const LAYOUTS: CardLayout[] = [
  { rowSpan: 'md:row-span-2', dir: 'up',    innerDir: 'up',    fit: 'contain' }, // 1 - tall
  { rowSpan: 'md:row-span-1', dir: 'left',  innerDir: 'left',  fit: 'cover'   }, // 2
  { rowSpan: 'md:row-span-2', dir: 'down',  innerDir: 'up',    fit: 'contain' }, // 3 - tall
  { rowSpan: 'md:row-span-1', dir: 'right', innerDir: 'right', fit: 'cover'   }, // 4
  { rowSpan: 'md:row-span-1', dir: 'scale', innerDir: 'up',    fit: 'contain' }, // 5
  { rowSpan: 'md:row-span-1', dir: 'up',    innerDir: 'right', fit: 'cover'   }, // 6
  { rowSpan: 'md:row-span-2', dir: 'right', innerDir: 'left',  fit: 'contain' }, // 7 - tall
  { rowSpan: 'md:row-span-1', dir: 'left',  innerDir: 'up',    fit: 'cover'   }, // 8
  { rowSpan: 'md:row-span-1', dir: 'down',  innerDir: 'right', fit: 'contain' }, // 9
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const dirToInitial = (dir: CardDir) => {
  switch (dir) {
    case 'up':    return { opacity: 0, y: 64, x: 0, scale: 1 };
    case 'down':  return { opacity: 0, y: -56, x: 0, scale: 1 };
    case 'left':  return { opacity: 0, x: -72, y: 0, scale: 1 };
    case 'right': return { opacity: 0, x: 72, y: 0, scale: 1 };
    case 'scale': return { opacity: 0, x: 0, y: 24, scale: 0.92 };
  }
};

const innerToInitial = (dir: InnerDir) => {
  switch (dir) {
    case 'up':    return { opacity: 0, y: 40, x: 0 };
    case 'left':  return { opacity: 0, x: -44, y: 0 };
    case 'right': return { opacity: 0, x: 44, y: 0 };
  }
};

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LuxuryGiftCardsSection: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await productService.getAll();
        const usable = all.filter(
          (p) => p.isEnabled !== false && !p.isGiftCard && p.images && p.images.length > 0
        );
        setProducts(shuffle(usable).slice(0, 9));
      } catch (e) {
        console.error('LuxuryGiftCards load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const eyebrow = lang === 'ru' ? 'КОЛЛЕКЦИЯ ПОДАРКОВ' : lang === 'en' ? 'GIFT EDIT' : 'HƏDİYYƏ SEÇİMİ';
  const title =
    lang === 'ru'
      ? 'Подобрано с любовью'
      : lang === 'en'
      ? 'Curated with love'
      : 'Sevərək seçildi';
  const subtitle =
    lang === 'ru'
      ? 'Каждая деталь — повод подарить эмоцию.'
      : lang === 'en'
      ? 'Every detail — a reason to gift an emotion.'
      : 'Hər detal — duyğu hədiyyə etmək üçün bir səbəbdir.';
  const viewAll = lang === 'ru' ? 'Все подарки' : lang === 'en' ? 'View all' : 'Hamısına bax';

  // Layout-ları məhsul sayına uyğunlaşdır
  const cards = useMemo(
    () => products.map((p, idx) => ({ product: p, layout: LAYOUTS[idx % LAYOUTS.length] })),
    [products]
  );

  if (loading) {
    return (
      <section className="bg-white py-16 md:py-24" data-testid="dv-luxury-gifts-loading">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="h-[600px] bg-neutral-50 animate-pulse rounded-3xl" />
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section
      className="relative bg-[#fafaf8] py-20 md:py-28 overflow-hidden"
      data-testid="luxury-gifts-section"
    >
      {/* Dekorativ qızılı blur */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #C9A961 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: 'radial-gradient(circle, #1a1a1a 0%, transparent 70%)' }}
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Başlıq */}
        <motion.div
          className="mb-10 md:mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <div>
            <p
              className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium mb-3 md:mb-4"
              data-testid="luxury-gifts-eyebrow"
            >
              {eyebrow}
            </p>
            <h2
              className="font-playfair text-3xl sm:text-4xl md:text-[52px] font-light text-black leading-[1.05] tracking-tight"
              data-testid="luxury-gifts-title"
            >
              {title}
            </h2>
            <p className="mt-3 md:mt-4 text-sm md:text-base text-black/55 max-w-xl font-light">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products')}
            className="hidden md:inline-flex self-end items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group whitespace-nowrap pb-2"
            data-testid="luxury-gifts-view-all-btn"
          >
            <span className="relative pb-1">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </button>
        </motion.div>

        {/* Asimmetrik kart şəbəkəsi */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 md:auto-rows-[260px]"
          data-testid="luxury-gifts-grid"
        >
          {cards.map(({ product, layout }, idx) => {
            const name = product.name[lang] || product.name.az;
            const img = product.images[0];

            return (
              <motion.article
                key={product.id}
                className={`relative bg-white rounded-2xl md:rounded-[28px] overflow-hidden shadow-[0_6px_24px_-12px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_36px_-14px_rgba(0,0,0,0.22)] transition-shadow duration-500 cursor-pointer group ${layout.rowSpan}`}
                style={{ willChange: 'transform, opacity' }}
                initial={dirToInitial(layout.dir)}
                whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-8%' }}
                transition={{
                  duration: 0.95,
                  ease: EASE,
                  delay: (idx % 4) * 0.08,
                }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/product/${product.id}`)}
                data-testid={`luxury-gift-card-${idx}`}
              >
                {/* Heart düyməsi */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute top-3 right-3 z-10 p-2 rounded-full hover:bg-black/5 transition-colors"
                  aria-label="wishlist"
                  data-testid={`luxury-gift-heart-${idx}`}
                >
                  <Heart className="w-4 h-4 md:w-[18px] md:h-[18px] text-black/70" strokeWidth={1.5} />
                </button>

                {/* Şəkil sahəsi */}
                <div className="absolute inset-0 flex items-center justify-center p-6 md:p-8 pb-14 md:pb-16">
                  <motion.div
                    className="relative w-full h-full flex items-center justify-center"
                    style={{ willChange: 'transform, opacity' }}
                    initial={innerToInitial(layout.innerDir)}
                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                    viewport={{ once: true, margin: '-8%' }}
                    transition={{
                      duration: 0.9,
                      ease: EASE,
                      delay: 0.25 + (idx % 4) * 0.08,
                    }}
                  >
                    <img
                      src={img}
                      alt={name}
                      loading="lazy"
                      className={`max-w-full max-h-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] ${
                        layout.fit === 'cover' ? 'w-full h-full object-cover' : 'object-contain'
                      }`}
                      style={{
                        transform: product.imageScale ? `scale(${product.imageScale})` : undefined,
                      }}
                    />
                  </motion.div>
                </div>

                {/* Məhsul adı */}
                <div className="absolute bottom-0 inset-x-0 px-4 md:px-5 pb-3 md:pb-4">
                  <p
                    className="text-center text-[11px] md:text-[13px] text-black/85 font-light tracking-wide line-clamp-1"
                    data-testid={`luxury-gift-name-${idx}`}
                  >
                    {name}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Mobil CTA */}
        <div className="md:hidden mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-medium text-black/80"
            data-testid="luxury-gifts-view-all-mobile-btn"
          >
            <span className="relative pb-1">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default LuxuryGiftCardsSection;
