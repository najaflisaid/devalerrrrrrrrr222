import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getHomepageSections } from '../services/contentService';

interface Tile {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  image_url: string;
  video_url?: string;
  link_url: string;
}

/**
 * CollectionTiles — Omega/Cartier tipli editorial kolleksiya grid-i.
 *  - Desktop: 4 sütunlu grid (geniş portret kartlar)
 *  - Planşet: 2 sütun, mobil: 1 sütun horizontal scroll-snap
 *  - Hər kart: full-bleed media + Ken Burns hover zoom + vignette gradient
 *  - Alt hissədə: gold horizontal accent + Playfair başlıq + "Kəşf et →" CTA
 *    (underline reveal hover-də)
 *  - Üstdə kiçik editorial header "Kolleksiyalar" + eyebrow
 */
const CollectionTiles: React.FC = () => {
  const { i18n } = useTranslation();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const sections = await getHomepageSections();
        const ct = sections.collectionTiles;
        if (!ct) return;
        setEnabled(ct.enabled !== false);
        // Dedupe by lowercased title + filter empty-title tiles.
        // Admin datasında dublikat və başlıqsız element-lər var; təmiz unique
        // kartlar üçün hər ikisini süzürük.
        const raw = ct.tiles || [];
        const seen = new Set<string>();
        const unique = raw.filter((t) => {
          const titleKey = (t.title_az || t.title_en || t.title_ru || '').trim().toLowerCase();
          if (!titleKey) return false; // boş başlıqlı tile-ləri at
          if (seen.has(titleKey)) return false;
          seen.add(titleKey);
          return true;
        });
        setTiles(unique);
      } catch (e) {
        console.error('CollectionTiles load error:', e);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  if (!enabled || tiles.length === 0) return null;

  const eyebrow =
    lang === 'ru' ? 'НАШИ КОЛЛЕКЦИИ' : lang === 'en' ? 'OUR COLLECTIONS' : 'KOLLEKSİYALARIMIZ';
  const heading =
    lang === 'ru' ? 'Категории' : lang === 'en' ? 'Categories' : 'Kateqoriyalar';
  const discoverCta = lang === 'ru' ? 'Открыть' : lang === 'en' ? 'Discover' : 'Kəşf et';

  return (
    <section
      className="relative bg-white pt-16 md:pt-24 pb-16 md:pb-24"
      data-testid="dv-collection-tiles"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Editorial header */}
        <motion.div
          className="flex flex-col items-center text-center mb-10 md:mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-4 md:mb-6">
            <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
            <p className="text-[10px] md:text-[11px] tracking-[0.36em] uppercase text-[#C9A961] font-medium">
              {eyebrow}
            </p>
            <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-[52px] lg:text-[64px] font-light text-black leading-[1.0] tracking-tight">
            {heading}
          </h2>
        </motion.div>

        {/* Grid — desktop 4 cols, tablet 2, mobile horizontal scroll-snap */}
        <motion.div
          className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-10%' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
          }}
          data-testid="collection-tiles-grid"
        >
          {tiles.map((tile, idx) => {
            const titleText =
              (tile as any)[`title_${lang}`] ||
              tile.title_az ||
              tile.title_en ||
              tile.title_ru ||
              '';
            return (
              <motion.div
                key={tile.id || idx}
                variants={{
                  hidden: { opacity: 0, y: 36 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 1.0, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                data-testid={`dv-collection-tile-${tile.id || idx}`}
              >
                <Link
                  to={tile.link_url || '/products'}
                  className="group relative block overflow-hidden bg-[#0A0A0A] aspect-[3/4] lg:aspect-[3/4.2]"
                >
                  {/* Media */}
                  {tile.video_url ? (
                    <video
                      src={tile.video_url}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-[1.08]"
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      controls={false}
                      disablePictureInPicture
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : tile.image_url ? (
                    <img
                      src={tile.image_url}
                      alt={titleText}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-[1.08]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]" />
                  )}

                  {/* Vignette gradient for text legibility */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none"
                  />
                  {/* Subtle top edge fade */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none"
                  />

                  {/* Bottom editorial caption */}
                  <div className="absolute inset-x-0 bottom-0 p-6 lg:p-7 text-white">
                    {/* Gold accent line that grows on hover */}
                    <span
                      aria-hidden="true"
                      className="block h-px w-8 bg-[#C9A961] mb-4 origin-left transition-transform duration-700 ease-out group-hover:scale-x-[2.5]"
                    />

                    <h3
                      className="font-playfair text-[22px] sm:text-[24px] lg:text-[28px] font-light leading-[1.1] tracking-tight"
                      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
                    >
                      {titleText}
                    </h3>

                    {/* Discover CTA — reveal on hover */}
                    <div
                      className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] font-medium overflow-hidden"
                    >
                      <span className="relative inline-flex items-center gap-2 transition-transform duration-500 ease-out -translate-x-1 opacity-80 group-hover:translate-x-0 group-hover:opacity-100">
                        <span className="relative pb-1">
                          {discoverCta}
                          <span
                            aria-hidden="true"
                            className="absolute left-0 bottom-0 h-px bg-white w-full origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
                          />
                        </span>
                        <ArrowRight
                          className="w-3.5 h-3.5 transition-transform duration-500 ease-out group-hover:translate-x-1.5"
                          strokeWidth={1.4}
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Mobile horizontal scroll-snap fallback */}
        <div className="md:hidden -mx-4">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 pb-2"
            style={{ scrollbarWidth: 'none' }}
            data-testid="collection-tiles-track"
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
                  className="group relative block shrink-0 snap-start overflow-hidden bg-[#0A0A0A] aspect-[7/9] w-[38%]"
                  data-testid={`dv-collection-tile-m-${tile.id || idx}`}
                >
                  {tile.video_url ? (
                    <video
                      src={tile.video_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      controls={false}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : tile.image_url ? (
                    <img
                      src={tile.image_url}
                      alt={titleText}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]" />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <span
                      aria-hidden="true"
                      className="block h-px w-7 bg-[#C9A961] mb-3"
                    />
                    <h3
                      className="font-playfair text-xl font-light leading-tight"
                      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
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
          [data-testid="collection-tiles-track"]::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </section>
  );
};

export default CollectionTiles;
