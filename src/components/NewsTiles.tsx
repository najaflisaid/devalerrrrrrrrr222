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
  description_az?: string;
  description_ru?: string;
  description_en?: string;
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

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

  if (!enabled || tiles.length === 0) return null;

  // Scroll one full page (visibleCount cards) at a time
  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const visible = window.matchMedia('(min-width: 768px)').matches ? 4 : 3;
    const child = track.firstElementChild as HTMLElement | null;
    if (!child) return;
    const childWidth = child.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
    const stride = childWidth + gap;
    const target = Math.max(0, Math.min(pageCount - 1, page)) * stride * visible;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  const showArrows = pageCount > 1;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <section
      ref={ref}
      className="relative pt-6 pb-10 md:pt-10 md:pb-16 bg-white overflow-hidden"
      data-testid="dv-news-tiles"
    >
      {/* Centered title */}
      <div className={`text-center mb-6 md:mb-9 dv-reveal ${inView ? 'is-in' : ''}`}>
        <h2 className="font-playfair text-2xl sm:text-3xl md:text-[30px] font-light tracking-tight text-black">
          {title[lang]}
        </h2>
      </div>

      {/* Tile track + side arrows */}
      <div className="relative px-3 sm:px-5 md:px-10 lg:px-14">
        {/* Left / Right arrows — square minimal, both always rendered while scrollable.
            Visibility toggles by enabled state so users always see the navigation. */}
        {showArrows && (
          <>
            <button
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={!canPrev}
              aria-label="Previous"
              className={`hidden md:flex absolute left-1 lg:left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-black/15 transition-all ${
                canPrev ? 'text-black/70 hover:text-black hover:border-black/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
              }`}
              data-testid="news-tiles-prev"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.4} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!canNext}
              aria-label="Next"
              className={`hidden md:flex absolute right-1 lg:right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-black/15 transition-all ${
                canNext ? 'text-black/70 hover:text-black hover:border-black/40 cursor-pointer' : 'opacity-30 cursor-not-allowed'
              }`}
              data-testid="news-tiles-next"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.4} />
            </button>
          </>
        )}

        {/*
          Horizontal snap-scroll. Mobile = 3 tiles visible (33.333%),
          desktop (md+) = 4 tiles visible (25%). Cards have small gaps
          between them (italdizain-style breathing room).
        */}
        <div
          ref={trackRef}
          className="dv-news-track flex gap-2 md:gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth"
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
            const descText =
              (tile as any)[`description_${lang}`] ||
              tile.description_az ||
              tile.description_en ||
              tile.description_ru ||
              '';
            return (
              <Link
                key={tile.id || idx}
                to={tile.link_url || '/products'}
                /* basis subtracts the gap so 4 cards + 3 gaps fit perfectly */
                className={`relative shrink-0 snap-start group block aspect-[3/5] md:aspect-[2/3] overflow-hidden bg-gray-100 [flex-basis:calc((100%-1rem)/3)] md:[flex-basis:calc((100%-2.25rem)/4)] ${inView ? 'dv-brand-in' : ''}`}
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
                {/* Gradient for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                {/* Bottom content: title + description + Ətraflı CTA */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6 flex flex-col gap-2.5 md:gap-3">
                  <p className="text-white font-semibold text-base sm:text-lg md:text-xl leading-tight drop-shadow-sm line-clamp-2">
                    {titleText}
                  </p>
                  {descText && (
                    <p className="text-white/85 text-[11px] sm:text-xs md:text-[12.5px] leading-snug font-light line-clamp-2 hidden sm:block">
                      {descText}
                    </p>
                  )}
                  {/* Elegant Ətraflı button — pill-rounded, white background, subtle shadow */}
                  <span className="self-start inline-flex items-center justify-center gap-1.5 px-5 md:px-6 py-2 md:py-2.5 bg-white/95 backdrop-blur-sm text-black text-[11px] md:text-xs font-medium tracking-wide rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-black hover:text-white transition-all duration-300">
                    Ətraflı
                    <ChevronRight className="w-3 h-3" strokeWidth={2} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pagination dots — thin underlines like italdizain */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5 md:mt-7" data-testid="news-tiles-pagination">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToPage(i)}
              aria-label={`Page ${i + 1}`}
              className={`h-[2px] rounded-none transition-all duration-300 ${
                i === pageIndex ? 'w-10 bg-black' : 'w-7 bg-black/20 hover:bg-black/40'
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
