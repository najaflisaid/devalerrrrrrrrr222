import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getHomepageSections, DEFAULT_HOMEPAGE_SECTIONS } from '../services/contentService';
import { useInView } from '../hooks/useInView';

interface Tile {
  id?: string;
  title_az?: string;
  title_ru?: string;
  title_en?: string;
  image_url: string;
  link_url: string;
}

const NewsTiles: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref, inView } = useInView<HTMLElement>();

  const [enabled, setEnabled] = useState<boolean>(true);
  const [title, setTitle] = useState(DEFAULT_HOMEPAGE_SECTIONS.newsTiles!.title!);
  const [tiles, setTiles] = useState<Tile[]>([]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const sections = await getHomepageSections();
        const ns = sections.newsTiles;
        if (!ns) return;
        setEnabled(ns.enabled !== false);
        if (ns.title) setTitle(ns.title);
        setTiles(ns.tiles || []);
      } catch (e) {
        console.error('NewsTiles load error:', e);
      }
    })();
  }, []);

  // Recompute page count + active index on scroll / resize
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const compute = () => {
      const visible = window.matchMedia('(min-width: 768px)').matches ? 4 : 3;
      const pages = Math.max(1, Math.ceil(tiles.length / visible));
      setPageCount(pages);
      const childWidth = track.firstElementChild
        ? (track.firstElementChild as HTMLElement).getBoundingClientRect().width
        : 0;
      const pageWidth = childWidth * visible;
      if (pageWidth > 0) {
        setPageIndex(Math.round(track.scrollLeft / pageWidth));
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

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

  if (!enabled || tiles.length === 0) return null;

  // Scroll one full page (visibleCount cards) at a time
  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const visible = window.matchMedia('(min-width: 768px)').matches ? 4 : 3;
    const childWidth = track.firstElementChild
      ? (track.firstElementChild as HTMLElement).getBoundingClientRect().width
      : 0;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * childWidth * visible;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  return (
    <section
      ref={ref}
      className="relative pt-6 pb-10 md:pt-10 md:pb-16 bg-white overflow-hidden"
      data-testid="dv-news-tiles"
    >
      {/* Centered title */}
      <div className={`text-center mb-6 md:mb-10 dv-reveal ${inView ? 'is-in' : ''}`}>
        <h2 className="font-playfair text-2xl sm:text-3xl md:text-[34px] font-light tracking-tight text-black">
          {title[lang]}
        </h2>
      </div>

      {/* Tile track + side arrows */}
      <div className="relative">
        {/* Left arrow — desktop only */}
        {tiles.length > 4 && pageIndex > 0 && (
          <button
            type="button"
            onClick={() => goToPage(pageIndex - 1)}
            aria-label="Previous"
            className="hidden md:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 lg:w-11 lg:h-11 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-black/10 shadow-md text-black/70 hover:text-black hover:bg-white transition-all"
            data-testid="news-tiles-prev"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}
        {tiles.length > 4 && pageIndex < pageCount - 1 && (
          <button
            type="button"
            onClick={() => goToPage(pageIndex + 1)}
            aria-label="Next"
            className="hidden md:flex absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 lg:w-11 lg:h-11 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-black/10 shadow-md text-black/70 hover:text-black hover:bg-white transition-all"
            data-testid="news-tiles-next"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        )}

        {/*
          Horizontal snap-scroll. Mobile = 3 tiles visible (33.333%),
          desktop (md+) = 4 tiles visible (25%). Tiles are joined together
          (no gap) — true edge-to-edge as in the reference design.
        */}
        <div
          ref={trackRef}
          className="dv-news-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
          data-testid="news-tiles-track"
        >
          {tiles.map((tile, idx) => {
            const titleText =
              (tile as any)[`title_${lang}`] ||
              tile.title_az ||
              tile.title_en ||
              tile.title_ru ||
              '';
            return (
              <Link
                key={tile.id || idx}
                to={tile.link_url || '/products'}
                className={`relative shrink-0 snap-start basis-1/3 md:basis-1/4 group block aspect-[3/5] md:aspect-[1/2] overflow-hidden bg-gray-100 ${inView ? 'dv-brand-in' : ''}`}
                style={{ animationDelay: `${100 + idx * 70}ms` }}
                data-testid={`dv-news-tile-${tile.id || idx}`}
              >
                {tile.image_url && (
                  <img
                    src={tile.image_url}
                    alt={titleText}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                )}
                {/* Gradient overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                {/* Hairline divider (joined-tiles look) */}
                <span className="absolute top-0 right-0 h-full w-px bg-white/15 pointer-events-none" />
                {/* Bottom content: title + Ətraflı CTA */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6 flex flex-col gap-3">
                  <p className="text-white font-playfair text-base sm:text-lg md:text-2xl leading-tight drop-shadow-sm line-clamp-2">
                    {titleText}
                  </p>
                  <span className="self-start inline-flex items-center justify-center px-4 md:px-5 py-1.5 md:py-2 bg-white/0 border border-white/80 text-white text-[11px] md:text-xs uppercase tracking-[0.18em] backdrop-blur-[2px] hover:bg-white hover:text-black transition-colors">
                    Ətraflı
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pagination dots */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5 md:mt-7" data-testid="news-tiles-pagination">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToPage(i)}
              aria-label={`Page ${i + 1}`}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i === pageIndex ? 'w-9 bg-black' : 'w-5 bg-black/20 hover:bg-black/40'
              }`}
              data-testid={`news-tiles-dot-${i}`}
            />
          ))}
        </div>
      )}

      <style>{`
        .dv-news-track::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default NewsTiles;
