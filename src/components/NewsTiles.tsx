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

  const lang = (i18n.language || 'az') as 'az' | 'ru' | 'en';

  if (!enabled || tiles.length === 0) return null;

  // Scroll one tile (= 1/visibleCount of the track) at a time
  const scrollByOne = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstChild = track.firstElementChild as HTMLElement | null;
    if (!firstChild) return;
    const step = firstChild.getBoundingClientRect().width;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section
      ref={ref}
      className="relative pt-4 pb-10 md:pt-6 md:pb-16 bg-white overflow-hidden"
      data-testid="dv-news-tiles"
    >
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6">
        {/* Heading + arrows on desktop */}
        <div className={`flex items-end justify-between mb-5 md:mb-8 dv-reveal ${inView ? 'is-in' : ''}`}>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] text-black">
            {title[lang]}
          </h2>
          {tiles.length > 4 && (
            <div className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={() => scrollByOne(-1)}
                aria-label="Previous"
                className="p-2 text-black/40 hover:text-black transition-colors"
                data-testid="news-tiles-prev"
              >
                <ChevronLeft className="w-7 h-7" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => scrollByOne(1)}
                aria-label="Next"
                className="p-2 text-black hover:opacity-70 transition-opacity"
                data-testid="news-tiles-next"
              >
                <ChevronRight className="w-7 h-7" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/*
          Horizontal snap-scroll. Mobile = 3 tiles visible (33.333%),
          desktop (md+) = 4 tiles visible (25%). Tiles are joined together
          (no gap) and use scroll-snap so swiping settles on a card edge.
        */}
        <div
          ref={trackRef}
          className="dv-news-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6"
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
                className={`relative shrink-0 snap-start basis-1/3 md:basis-1/4 group block aspect-[4/5] md:aspect-[3/4] overflow-hidden bg-gray-100 ${inView ? 'dv-brand-in' : ''}`}
                style={{ animationDelay: `${100 + idx * 70}ms` }}
                data-testid={`dv-news-tile-${tile.id || idx}`}
              >
                {tile.image_url && (
                  <img
                    src={tile.image_url}
                    alt={titleText}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                )}
                {/* Gradient overlay so text stays legible */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                {/* Hairline divider on the right edge to suggest "joined" tiles */}
                <span className="absolute top-0 right-0 h-full w-px bg-white/20 pointer-events-none" />
                {/* Title */}
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 md:p-5">
                  <p className="text-white font-semibold text-xs sm:text-sm md:text-base leading-tight drop-shadow-sm line-clamp-2">
                    {titleText}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        .dv-news-track::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
};

export default NewsTiles;
