import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const PER_PAGE = 4; // 2 columns × 2 rows

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

  // Chunk tiles into pages of PER_PAGE (2x2)
  const pages: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += PER_PAGE) {
    pages.push(tiles.slice(i, i + PER_PAGE));
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
  }, [tiles.length]);

  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * track.clientWidth;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  if (!enabled || tiles.length === 0) return null;

  const showArrows = pageCount > 1;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <section
      ref={ref}
      className="relative py-6 md:py-8 bg-white overflow-hidden"
      data-testid="dv-collection-tiles"
    >
      {/* Heading row: title centered, arrows top-right (frameless, compact) */}
      <div className={`relative px-1.5 mb-5 md:mb-7 dv-reveal ${inView ? 'is-in' : ''}`}>
        <h2 className="font-playfair text-2xl sm:text-3xl md:text-[30px] font-light tracking-tight text-black text-center">
          {title[lang]}
        </h2>
        {showArrows && (
          <div className="absolute top-1/2 -translate-y-1/2 right-1.5 flex items-center gap-1">
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
        )}
      </div>

      {/* Horizontal scroll: each "page" is a 2×2 grid (4 boxes total).
          Additional tiles beyond 4 slide in from the right as a new page. */}
      <div className="px-1.5">
        <div
          ref={trackRef}
          className="dv-collection-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
          data-testid="collection-tiles-track"
        >
          {pages.map((pageTiles, pIdx) => (
            <div
              key={pIdx}
              className="shrink-0 snap-start w-full grid grid-cols-2 grid-rows-2 gap-1.5"
              data-testid={`collection-tiles-page-${pIdx}`}
            >
              {pageTiles.map((tile, idx) => {
                const titleText =
                  (tile as any)[`title_${lang}`] || tile.title_az || tile.title_en || tile.title_ru || '';
                return (
                  <Link
                    key={tile.id || idx}
                    to={tile.link_url || '/products'}
                    className={`dv-collection-tile group relative block overflow-hidden bg-gray-100 aspect-[4/2.6] md:aspect-[16/8.3] ${inView ? 'dv-brand-in' : ''}`}
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
                    <div className="absolute inset-0 pointer-events-none bg-black/15 group-hover:bg-black/25 transition-colors duration-700" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                  <h3
                    className="font-playfair text-white text-base sm:text-xl md:text-3xl lg:text-4xl font-normal tracking-[0.01em] text-center leading-tight"
                    style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
                  >
                    {titleText}
                  </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .dv-collection-track::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default CollectionTiles;
