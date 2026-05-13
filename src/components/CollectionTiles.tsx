import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from '../hooks/useInView';
import { getHomepageSections, DEFAULT_HOMEPAGE_SECTIONS } from '../services/contentService';

interface Tile {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  image_url: string;
  video_url?: string;
  link_url: string;
}

const CollectionTiles: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref, inView } = useInView<HTMLElement>();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [title, setTitle] = useState(DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.title!);

  const trackRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const sections = await getHomepageSections();
        const ct = sections.collectionTiles;
        if (!ct) return;
        setEnabled(ct.enabled !== false);
        if (ct.title) setTitle(ct.title);
        setTiles(ct.tiles || []);
      } catch (e) {
        console.error('CollectionTiles load error:', e);
      }
    })();
  }, []);

  // Chunk tiles into pages — hər kart bir snap-nöqtəsi olduğundan
  // pageCount = visible-də olmayan ilk kartın indexi qədərdir
  const pageCount = Math.max(1, tiles.length);

  // Track active scroll index
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const compute = () => {
      const first = track.firstElementChild as HTMLElement | null;
      const tileW = first?.clientWidth || track.clientWidth / 3.5;
      const gap = parseInt(getComputedStyle(track).gap || '12', 10);
      const step = tileW + gap;
      if (step > 0) {
        setPageIndex(Math.round(track.scrollLeft / step));
      }
    };
    compute();
    track.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      track.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [tiles.length]);

  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const tileW = first?.clientWidth || track.clientWidth / 3.5;
    const gap = parseInt(getComputedStyle(track).gap || '12', 10);
    const step = tileW + gap;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * step;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  if (!enabled || tiles.length === 0) return null;

  // Arrows yalnız kartların ekrana sığmadığı halda göstərilir
  const showArrows = tiles.length > 3;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <CollectionTilesWithOverlap
      sectionRef={ref}
      showArrows={showArrows}
      canPrev={canPrev}
      canNext={canNext}
      pageIndex={pageIndex}
      goToPage={goToPage}
      tiles={tiles}
      lang={lang}
      inView={inView}
      trackRef={trackRef}
    />
  );
};

interface CollectionTilesInnerProps {
  sectionRef: any;
  showArrows: boolean;
  canPrev: boolean;
  canNext: boolean;
  pageIndex: number;
  goToPage: (p: number) => void;
  tiles: Tile[];
  lang: 'az' | 'ru' | 'en';
  inView: boolean;
  trackRef: React.RefObject<HTMLDivElement>;
}

/**
 * Daxili komponent — scroll-overlap effekti üçün ayrılır.
 *  - Bölmə Hero-nun alt hissəsinə üst-üstə düşür (negative margin-top + rounded-t)
 *  - Framer-motion useScroll ilə scroll edildikcə yumşaq yuxarı qalxır (translateY 80px → 0)
 *  - z-index Hero-dan yuxarıdır, ona görə Hero üzərinə "qapaq" kimi yığılır
 */
const CollectionTilesWithOverlap: React.FC<CollectionTilesInnerProps> = ({
  sectionRef,
  showArrows,
  canPrev,
  canNext,
  pageIndex,
  goToPage,
  tiles,
  lang,
  inView,
  trackRef,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start end', 'start start'],
  });
  // Scroll edildikcə bölmə 80px aşağıdan başlayıb 0-a qədər yuxarı qalxır
  const translateY = useTransform(scrollYProgress, [0, 1], [80, 0]);
  // Eyni vaxtda alt kölgə güclənir ki, Hero-dan ayrıldığı daha hiss olunsun
  const shadowOpacity = useTransform(scrollYProgress, [0, 1], [0, 0.18]);

  return (
    <motion.div
      ref={wrapperRef}
      className="relative z-10 -mt-12 md:-mt-20 lg:-mt-24"
      style={{ y: translateY }}
    >
      {/* Top shadow ribbon — Hero ilə ayrıldığını yumşaq vurğulayır */}
      <motion.div
        aria-hidden="true"
        className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.18), rgba(0,0,0,0))',
          opacity: shadowOpacity,
        }}
      />

      <section
        ref={sectionRef as any}
        className="relative bg-white rounded-t-[28px] md:rounded-t-[40px] pt-6 md:pt-10 overflow-hidden"
        data-testid="dv-collection-tiles"
      >
        {/* İncə qızıl üst xətt — luxury detal */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-12 md:w-16 h-px"
          style={{ background: 'linear-gradient(to right, transparent, #C9A961, transparent)' }}
        />

      {/* Top arrows row (heading text removed per design) */}
      {showArrows && (
        <div className={`flex items-center justify-end px-3 sm:px-5 mb-3 md:mb-4 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              aria-label="Previous"
              disabled={!canPrev}
              className="p-1 text-black/70 hover:text-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="collection-tiles-prev"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              aria-label="Next"
              disabled={!canNext}
              className="p-1 text-black/70 hover:text-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="collection-tiles-next"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Horizontal scroll — hər kart snap nöqtəsi.
          Desktop: ~3.5 kart görünür (4-cü yarımçıq), mobile: ~2.3 kart görünür. */}
      <div className="pl-3 sm:pl-5">
        <div
          ref={trackRef}
          className="dv-collection-track flex gap-2.5 sm:gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pr-3 sm:pr-5 pb-1"
          style={{ scrollbarWidth: 'none' }}
          data-testid="collection-tiles-track"
        >
          {tiles.map((tile, idx) => {
            const titleText =
              (tile as any)[`title_${lang}`] || tile.title_az || tile.title_en || tile.title_ru || '';
            return (
              <Link
                key={tile.id || idx}
                to={tile.link_url || '/products'}
                className={`dv-collection-tile group relative block shrink-0 snap-start overflow-hidden bg-[#e8ddd2] aspect-[3/4] sm:aspect-[3/4.4] w-[44%] sm:w-[28%] ${inView ? 'dv-brand-in' : ''}`}
                style={{ animationDelay: `${100 + idx * 90}ms` }}
                data-testid={`dv-collection-tile-${tile.id || idx}`}
              >
                {tile.video_url ? (
                  <video
                    src={tile.video_url}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] group-hover:scale-[1.06]"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    controls={false}
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate nofullscreen"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : tile.image_url ? (
                  <img
                    src={tile.image_url}
                    alt={titleText}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                )}
                {/* Subtle gradient at bottom for text legibility */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pointer-events-none p-5 sm:p-6 md:p-7">
                  <h3
                    className="font-playfair text-white text-lg sm:text-xl md:text-2xl lg:text-[28px] font-normal tracking-wide text-center leading-tight"
                    style={{ textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}
                  >
                    {titleText}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        .dv-collection-track::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Gray transition strip — extends the BestSellers gray bg upward from
          right where the 2nd row of collection tiles ends */}
      <div className="h-3 md:h-4 bg-[#F4F4F4]" aria-hidden="true" />
      </section>
    </motion.div>
  );
};

export default CollectionTiles;
