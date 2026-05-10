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
  const [pageCount, setPageCount] = useState(1);

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

  // Recompute page count + active index on scroll / resize
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const compute = () => {
      // 2 visible per page on every breakpoint (matches the previous grid look)
      const visible = 2;
      const pages = Math.max(1, Math.ceil(tiles.length / visible));
      setPageCount(pages);
      const child = track.firstElementChild as HTMLElement | null;
      if (!child) return;
      const childWidth = child.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
      const stride = childWidth + gap;
      const pageStride = stride * visible;
      if (pageStride > 0) {
        setPageIndex(Math.round(track.scrollLeft / pageStride));
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
    const visible = 2;
    const child = track.firstElementChild as HTMLElement | null;
    if (!child) return;
    const childWidth = child.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
    const stride = childWidth + gap;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * stride * visible;
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
      {/* Heading row: title centered, arrows top-right */}
      <div className={`relative px-1.5 mb-5 md:mb-7 dv-reveal ${inView ? 'is-in' : ''}`}>
        <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] text-black text-center">
          {title[lang]}
        </h2>
        {showArrows && (
          <div className="absolute top-0 right-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              aria-label="Previous"
              disabled={!canPrev}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white border border-black/15 text-black/80 hover:text-black hover:border-black/40 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="collection-tiles-prev"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" strokeWidth={1.4} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              aria-label="Next"
              disabled={!canNext}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white border border-black/15 text-black/80 hover:text-black hover:border-black/40 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="collection-tiles-next"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" strokeWidth={1.4} />
            </button>
          </div>
        )}
      </div>

      {/* Horizontal scroll slider — 2 tiles visible per page on every breakpoint.
          New tiles slide in from the right instead of wrapping to a new row.
          Side padding (px-1.5) === inter-card gap (gap-1.5) for visual symmetry. */}
      <div className="px-1.5">
        <div
          ref={trackRef}
          className="dv-collection-track flex gap-1.5 overflow-x-auto snap-x snap-mandatory scroll-smooth"
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
                /* basis = (100% - 1 gap) / 2 = (100% - 0.375rem) / 2 */
                className={`dv-collection-tile shrink-0 snap-start group relative block overflow-hidden bg-gray-100 aspect-[4/4.6] md:aspect-[16/8.3] [flex-basis:calc((100%-0.375rem)/2)] ${inView ? 'dv-brand-in' : ''}`}
                style={{ animationDelay: `${100 + idx * 90}ms` }}
                data-testid={`dv-collection-tile-${tile.id || idx}`}
              >
                {tile.image_url ? (
                  <img
                    src={tile.image_url}
                    alt={titleText}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                )}

                {/* Soft darken so the centered title is always readable */}
                <div className="absolute inset-0 pointer-events-none bg-black/15 group-hover:bg-black/25 transition-colors duration-700" />

                {/* Centered title — playfair, white, with subtle text-shadow */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                  <h3
                    className="font-playfair text-white text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-normal tracking-[0.01em] text-center leading-tight"
                    style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
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
    </section>
  );
};

export default CollectionTiles;
