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
      const visible = window.matchMedia('(min-width: 768px)').matches ? 4 : 2;
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
    const visible = window.matchMedia('(min-width: 768px)').matches ? 4 : 2;
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
      className="relative py-6 md:py-8 bg-white overflow-hidden"
      data-testid="dv-news-tiles"
    >
      {/* Heading row: title centered, arrows top-right */}
      <div className={`relative px-1.5 mb-3 md:mb-4 dv-reveal ${inView ? 'is-in' : ''}`}>
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
              data-testid="news-tiles-prev"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              aria-label="Next"
              disabled={!canNext}
              className="p-1 text-black/70 hover:text-black transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="news-tiles-next"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Divider under title — eyni balans Sevilən məhsullar bölməsi ilə */}
      <div className="px-1.5 mb-5 md:mb-7">
        <div className="h-px bg-black/10" />
      </div>

      {/* Tile track
          Side padding (px-1.5) === inter-card gap (gap-1.5) so the spacing
          on the screen edges matches the gap between cards. */}
      <div className="relative px-1.5 md:px-1.5">

        {/*
          Horizontal snap-scroll. Mobile = 3 visible (33.3%), desktop = 4 visible (25%).
          gap-1.5 = 0.375rem, so basis = (100% - N gaps) / visibleCount.
        */}
        <div
          ref={trackRef}
          className="dv-news-track flex gap-1.5 overflow-x-auto snap-x snap-mandatory scroll-smooth"
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
                /* basis = (100% - sum_of_gaps) / visibleCount.
                   Mobile (2 visible, 1 gap): (100% - 0.375rem) / 2
                   Desktop (4 visible, 3 gaps): (100% - 1.125rem) / 4 */
                className={`relative shrink-0 snap-start group block aspect-[3/4.6] md:aspect-[1/1.6] overflow-hidden bg-gray-100 [flex-basis:calc((100%-0.375rem)/2)] md:[flex-basis:calc((100%-1.125rem)/4)] ${inView ? 'dv-brand-in' : ''}`}
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
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-5 flex flex-col gap-2 md:gap-2.5">
                  <p className="text-white font-semibold text-base sm:text-lg md:text-xl leading-tight drop-shadow-sm line-clamp-2">
                    {titleText}
                  </p>
                  {descText && (
                    <p className="text-white/85 text-[11px] sm:text-xs md:text-[12.5px] leading-snug font-light line-clamp-2 hidden sm:block">
                      {descText}
                    </p>
                  )}
                  {/* 4-corner (square) Ətraflı button — compact yet legible */}
                  <span className="self-start inline-flex items-center justify-center px-3.5 md:px-4 py-1 md:py-1.5 bg-white text-black text-[10px] md:text-[11px] font-medium tracking-wide hover:bg-black hover:text-white transition-colors">
                    Ətraflı
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pagination dots — thin underlines */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 md:mt-5" data-testid="news-tiles-pagination">
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
