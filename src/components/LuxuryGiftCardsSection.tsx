import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Heart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { getHomepageSections, HomepageSections } from '../services/contentService';
import { Product } from '../types';

/**
 * LuxuryGiftCardsSection — Louis Vuitton tərzli sabit 12-slotlu asimmetrik məhsul vitrini.
 *
 *  - 4 sütun × 4 sıra (toplam 16 hüceyrə) — 4 ədəd `row-span-2` "hündür" kart + 8 ədəd kiçik kart.
 *    Top və bottom sıralarının hər ikisi tam doldurulur (kəpənək / simmetrik bitiş).
 *  - Kartlar qarmon (accordion) effekti ilə açılır: `scaleY: 0 → 1`, alternativ transformOrigin
 *    (top/bottom) — açıldıqca real qarmon hissi.
 *  - Kartın içindəki məhsul şəkli kart açılandan sonra yüngül gecikmə ilə yuxarı/sol/sağdan
 *    sürüşərək tam görünür (`object-contain` + daxili padding — saatlar / sneakerlar tam görünür).
 *  - Slotlar admin tərəfindən idarə olunur; boş slotlar üçün enabled+random məhsullar fallback olur.
 */

type CardSize = 'tall' | 'short';
type InnerDir = 'up' | 'left' | 'right';

interface SlotLayout {
  /** Hüceyrənin sütun başlanğıcı (1-based) */
  colStart: number;
  /** Hüceyrənin sıra başlanğıcı (1-based) */
  rowStart: number;
  /** Sıra span — 2 olarsa kart hündürdür */
  rowSpan: 1 | 2;
  size: CardSize;
  /** Kartın açılma istiqaməti (qarmon origin) */
  origin: 'top' | 'bottom';
  /** Daxili şəklin giriş istiqaməti */
  innerDir: InnerDir;
}

/**
 * 12 slot — kəpənək simmetriyası:
 *   ROW 1:  [T0 ][s1 ][s2 ][T3 ]
 *   ROW 2:  [T0 ][s4 ][s5 ][T3 ]
 *   ROW 3:  [s6 ][T7 ][T8 ][s9 ]
 *   ROW 4:  [s10][T7 ][T8 ][s11]
 *
 *   ↑ Top və bottom sıraları tam dolur, hündür kartlar köşədən-mərkəzə miqrasiya edir.
 */
const LAYOUT: SlotLayout[] = [
  { colStart: 1, rowStart: 1, rowSpan: 2, size: 'tall',  origin: 'top',    innerDir: 'left'  }, // 0
  { colStart: 2, rowStart: 1, rowSpan: 1, size: 'short', origin: 'top',    innerDir: 'up'    }, // 1
  { colStart: 3, rowStart: 1, rowSpan: 1, size: 'short', origin: 'top',    innerDir: 'up'    }, // 2
  { colStart: 4, rowStart: 1, rowSpan: 2, size: 'tall',  origin: 'top',    innerDir: 'right' }, // 3
  { colStart: 2, rowStart: 2, rowSpan: 1, size: 'short', origin: 'bottom', innerDir: 'right' }, // 4
  { colStart: 3, rowStart: 2, rowSpan: 1, size: 'short', origin: 'bottom', innerDir: 'left'  }, // 5
  { colStart: 1, rowStart: 3, rowSpan: 1, size: 'short', origin: 'top',    innerDir: 'right' }, // 6
  { colStart: 2, rowStart: 3, rowSpan: 2, size: 'tall',  origin: 'bottom', innerDir: 'up'    }, // 7
  { colStart: 3, rowStart: 3, rowSpan: 2, size: 'tall',  origin: 'bottom', innerDir: 'up'    }, // 8
  { colStart: 4, rowStart: 3, rowSpan: 1, size: 'short', origin: 'top',    innerDir: 'left'  }, // 9
  { colStart: 1, rowStart: 4, rowSpan: 1, size: 'short', origin: 'bottom', innerDir: 'left'  }, // 10
  { colStart: 4, rowStart: 4, rowSpan: 1, size: 'short', origin: 'bottom', innerDir: 'right' }, // 11
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SLOT_COUNT = 12;

const innerInitial = (dir: InnerDir) => {
  switch (dir) {
    case 'up':    return { opacity: 0, y: 36, x: 0 };
    case 'left':  return { opacity: 0, x: -40, y: 0 };
    case 'right': return { opacity: 0, x: 40, y: 0 };
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

  const [sections, setSections] = useState<HomepageSections | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sec, all] = await Promise.all([getHomepageSections(), productService.getAll()]);
        setSections(sec);
        setProducts(all.filter((p) => p.isEnabled !== false && !p.isGiftCard && p.images?.length > 0));
      } catch (e) {
        console.error('LuxuryGifts load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cfg = sections?.luxuryGifts;
  const slots = cfg?.slots ?? [];

  /** Hər slota məhsul təyin et: admin seçdiyini götür, boş olsa random fallback. */
  const slotProducts: (Product | null)[] = useMemo(() => {
    if (!products.length) return new Array(SLOT_COUNT).fill(null);

    const byId = new Map(products.map((p) => [p.id, p]));
    const usedIds = new Set<string>();

    // 1) Admin-in seçdiyi məhsullar
    const adminResolved: (Product | null)[] = new Array(SLOT_COUNT).fill(null);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const id = slots[i];
      if (id && byId.has(id)) {
        adminResolved[i] = byId.get(id)!;
        usedIds.add(id);
      }
    }

    // 2) Boş slotları random məhsulla doldur (istifadə olunmamışlardan)
    const remaining = shuffle(products.filter((p) => !usedIds.has(p.id)));
    let ri = 0;
    return adminResolved.map((p) => {
      if (p) return p;
      return remaining[ri++] || null;
    });
  }, [products, slots]);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  // Multi-lang field-lər (admin-dən və ya default)
  const eyebrow = cfg?.eyebrow?.[lang] || cfg?.eyebrow?.az || 'HƏDİYYƏ SEÇİMİ';
  const title = cfg?.title?.[lang] || cfg?.title?.az || 'Sevərək seçildi';
  const subtitle = cfg?.subtitle?.[lang] || cfg?.subtitle?.az || '';
  const viewAll = cfg?.ctaLabel?.[lang] || cfg?.ctaLabel?.az || 'Hamısına bax';
  const ctaLink = cfg?.ctaLink || '/products';

  if (loading) {
    return (
      <section className="bg-[#fafaf8] py-16 md:py-24" data-testid="luxury-gifts-loading">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="h-[800px] bg-neutral-100 animate-pulse rounded-3xl" />
        </div>
      </section>
    );
  }

  // Admin tərəfindən bağlanıb və ya heç bir məhsul tapılmayıbsa, ümumiyyətlə render etmə
  if (cfg && cfg.enabled === false) return null;
  if (slotProducts.every((p) => p === null)) return null;

  return (
    <section
      className="relative py-20 md:py-28 overflow-hidden"
      style={{
        background:
          'linear-gradient(to bottom, #ffffff 0%, #fafaf8 14%, #fafaf8 86%, #ffffff 100%)',
      }}
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
            {subtitle ? (
              <p className="mt-3 md:mt-4 text-sm md:text-base text-black/55 max-w-xl font-light">
                {subtitle}
              </p>
            ) : null}
          </div>
        </motion.div>

        {/* Mobil — sadə 2-sütunlu masonry üslubu */}
        <div
          className="md:hidden grid grid-cols-2 gap-3"
          data-testid="luxury-gifts-grid-mobile"
        >
          {LAYOUT.map((slot, idx) => {
            const product = slotProducts[idx];
            if (!product) return null;
            return (
              <CardItem
                key={product.id + ':' + idx}
                idx={idx}
                slot={slot}
                product={product}
                lang={lang}
                onClick={() => navigate(`/product/${product.id}`)}
                isMobile
              />
            );
          })}
        </div>

        {/* Desktop — sabit 4 × 4 grid (12 slot, "kəpənək" simmetriyası) */}
        <div
          className="hidden md:grid grid-cols-4 gap-5"
          style={{ gridTemplateRows: 'repeat(4, 280px)' }}
          data-testid="luxury-gifts-grid"
        >
          {LAYOUT.map((slot, idx) => {
            const product = slotProducts[idx];
            if (!product) return null;
            return (
              <CardItem
                key={product.id + ':' + idx}
                idx={idx}
                slot={slot}
                product={product}
                lang={lang}
                onClick={() => navigate(`/product/${product.id}`)}
              />
            );
          })}
        </div>

        {/* CTA — həmişə aşağıda, ortada (desktop + mobil) */}
        <div className="mt-10 md:mt-14 flex justify-center">
          <button
            type="button"
            onClick={() => navigate(ctaLink)}
            className="inline-flex items-center gap-2 text-[11px] md:text-[12px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group"
            data-testid="luxury-gifts-view-all-btn"
          >
            <span className="relative pb-1">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight
              className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────── */

interface CardItemProps {
  idx: number;
  slot: SlotLayout;
  product: Product;
  lang: 'az' | 'ru' | 'en';
  onClick: () => void;
  isMobile?: boolean;
}

const CardItem: React.FC<CardItemProps> = ({ idx, slot, product, lang, onClick, isMobile }) => {
  const name = product.name[lang] || product.name.az;
  const img = product.images[0];

  // Desktop-da sabit yerləşmə, mobildə natural flow
  const gridStyle: React.CSSProperties = isMobile
    ? slot.rowSpan === 2
      ? { gridRow: 'span 2', minHeight: 280 }
      : { minHeight: 200 }
    : {
        gridColumnStart: slot.colStart,
        gridRowStart: slot.rowStart,
        gridRowEnd: `span ${slot.rowSpan}`,
      };

  // Qarmon (accordion) açılışı — alternativ origin
  const transformOrigin = slot.origin === 'top' ? 'top center' : 'bottom center';

  return (
    <motion.article
      style={{ ...gridStyle, transformOrigin, willChange: 'transform, opacity' }}
      className="relative bg-white rounded-2xl md:rounded-[28px] overflow-hidden shadow-[0_6px_22px_-12px_rgba(0,0,0,0.10)] hover:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.22)] transition-shadow duration-500 cursor-pointer group"
      initial={{ scaleY: 0, opacity: 0 }}
      whileInView={{ scaleY: 1, opacity: 1 }}
      viewport={{ once: true, margin: '20% 0px 20% 0px', amount: 0.05 }}
      transition={{
        duration: 0.55,
        ease: EASE,
        delay: (idx % 4) * 0.04,
      }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      data-testid={`luxury-gift-card-${idx}`}
    >
      {/* Heart düyməsi */}
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-10 p-2 rounded-full hover:bg-black/5 transition-colors"
        aria-label="wishlist"
        data-testid={`luxury-gift-heart-${idx}`}
      >
        <Heart className="w-4 h-4 md:w-[18px] md:h-[18px] text-black/70" strokeWidth={1.5} />
      </button>

      {/* Şəkil sahəsi — həmişə object-contain, kart ölçüsündən asılı olmayaraq məhsul tam görünür */}
      <div className="absolute inset-0 flex items-center justify-center p-5 md:p-7 pt-9 md:pt-11 pb-12 md:pb-14">
        <motion.div
          className="relative w-full h-full flex items-center justify-center"
          style={{ willChange: 'transform, opacity' }}
          initial={innerInitial(slot.innerDir)}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true, margin: '20% 0px 20% 0px', amount: 0.05 }}
          transition={{
            duration: 0.55,
            ease: EASE,
            delay: 0.2 + (idx % 4) * 0.04,
          }}
        >
          <img
            src={img}
            alt={name}
            loading="lazy"
            className="max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
            style={{
              transform: product.imageScale ? `scale(${product.imageScale})` : undefined,
            }}
          />
        </motion.div>
      </div>

      {/* Məhsul adı */}
      <div className="absolute bottom-0 inset-x-0 px-4 md:px-5 pb-3 md:pb-4 pointer-events-none">
        <p
          className="text-center text-[11px] md:text-[13px] text-black/85 font-light tracking-wide line-clamp-1"
          data-testid={`luxury-gift-name-${idx}`}
        >
          {name}
        </p>
      </div>
    </motion.article>
  );
};

export default LuxuryGiftCardsSection;
