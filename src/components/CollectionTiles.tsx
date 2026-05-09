import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const [eyebrow, setEyebrow] = useState(DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.eyebrow!);
  const [title, setTitle] = useState(DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.title!);
  const [subtitle, setSubtitle] = useState(DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.subtitle!);

  useEffect(() => {
    (async () => {
      try {
        const sections = await getHomepageSections();
        const ct = sections.collectionTiles;
        if (!ct) return;
        setEnabled(ct.enabled !== false);
        if (ct.eyebrow) setEyebrow(ct.eyebrow);
        if (ct.title) setTitle(ct.title);
        if (ct.subtitle) setSubtitle(ct.subtitle);
        setTiles(ct.tiles || []);
      } catch (e) {
        console.error('CollectionTiles load error:', e);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  if (!enabled || tiles.length === 0) return null;

  return (
    <section
      ref={ref}
      className="relative py-12 md:py-20 bg-white overflow-hidden"
      data-testid="dv-collection-tiles"
    >
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6">
        {/* Heading */}
        <div className={`text-center mb-8 md:mb-14 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-4">
            <span className="inline-block w-8 h-[1px]" style={{ background: '#b8914c' }} />
            <span className="mx-3 text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-semibold whitespace-nowrap" style={{ color: '#8c6c34' }}>
              {eyebrow[lang]}
            </span>
            <span className="inline-block w-8 h-[1px]" style={{ background: '#b8914c' }} />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-3 text-black">
            {title[lang]}
          </h2>
          <p className="text-sm md:text-base font-light leading-relaxed max-w-xl mx-auto px-2 text-black/55">
            {subtitle[lang]}
          </p>
        </div>

        {/* 2-column grid on ALL devices (mobile + desktop) — like the reference design */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
          {tiles.map((tile, idx) => {
            const titleText =
              (tile as any)[`title_${lang}`] || tile.title_az || tile.title_en || tile.title_ru || '';
            return (
              <Link
                key={tile.id || idx}
                to={tile.link_url || '/products'}
                className={`dv-collection-tile group relative block overflow-hidden bg-gray-100 ${inView ? 'dv-brand-in' : ''}`}
                style={{ animationDelay: `${100 + idx * 90}ms`, aspectRatio: '4 / 5' }}
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
    </section>
  );
};

export default CollectionTiles;
