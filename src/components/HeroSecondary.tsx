import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBanners, Banner } from '../services/bannerService';

/**
 * HeroSecondary — Omega tipli "ikinci kolleksiya" hero banneri.
 *
 *  - Admin tərəfindən idarə olunan "home" banner-lərinin İKİNCİSİNİ (index >= 1)
 *    full-bleed cinematic şəkildə göstərir.
 *  - Omega kimi iki sətirli stacked başlıq: brend / kolleksiya adı.
 *  - Auto-cycle YOXDUR — tək slide. Birdən çox 2-ci+ banner varsa, ox düymələri
 *    ilə dəyişmək olar.
 *  - Heç bir uyğun banner tapılmasa — heç nə render etmir (null).
 */
const HeroSecondary: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getBanners('home');
        if (data && data.length > 1) {
          // İlk banner Hero komponentində istifadə olunur — ikincidən etibarən
          setBanners(data.slice(1));
        }
      } catch (e) {
        console.error('Error loading secondary hero banners:', e);
      }
    })();
  }, []);

  if (banners.length === 0) return null;
  const banner = banners[idx];
  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const title = banner.title[lang] || banner.title.en || banner.title.az || '';
  const buttonText =
    (banner as any).buttonText?.[lang] ||
    (banner as any).buttonText?.az ||
    (lang === 'ru' ? 'Открыть' : lang === 'en' ? 'Discover' : 'Bax');
  const mediaType = (banner as any).mediaType || 'image';
  const videoUrl = (banner as any).videoUrl;

  // Title-i 2 sətrə ayır (Omega stacked: "seamaster | planet ocean")
  const parts = title.split(/\s*[|/]\s*/);
  const line1 = parts[0] || title;
  const line2 = parts.slice(1).join(' ');

  const handleLink = () => {
    if (!banner.link) return;
    if (/^https?:\/\//.test(banner.link)) window.open(banner.link, '_blank', 'noopener,noreferrer');
    else window.location.href = banner.link;
  };

  return (
    <section
      ref={ref}
      className="group relative w-full overflow-hidden bg-black"
      style={{ height: 'clamp(560px, 88vh, 920px)' }}
      data-testid="dv-hero-secondary"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {mediaType === 'video' && videoUrl ? (
            <motion.video
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              initial={{ scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: 10, ease: 'linear' }}
            />
          ) : (
            <motion.img
              src={banner.imageUrl}
              alt={title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 9, ease: 'linear' }}
            />
          )}

          <div
            className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/55 pointer-events-none"
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>

      {/* Editorial text overlay — Omega stacked two-line style */}
      <div className="relative z-[5] h-full flex items-end pb-20 md:pb-28 px-4 sm:px-8 md:px-16 lg:px-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`txt-${idx}`}
            className="text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 1.0, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="flex items-center gap-3 mb-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <span className="h-px w-10 md:w-14 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] uppercase tracking-[0.42em] font-light text-white/90">
                {lang === 'ru' ? 'Новая коллекция' : lang === 'en' ? 'New collection' : 'Yeni kolleksiya'}
              </p>
            </motion.div>

            {/* Stacked two-line title */}
            <h2
              className="font-playfair font-light leading-[0.92] tracking-tight"
              style={{ textShadow: '0 2px 28px rgba(0,0,0,0.35)' }}
            >
              <motion.span
                className="block text-[32px] sm:text-[46px] md:text-[64px] lg:text-[78px] italic text-white/85"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {line1}
              </motion.span>
              {line2 && (
                <motion.span
                  className="block text-[42px] sm:text-[58px] md:text-[88px] lg:text-[108px] mt-1 md:mt-2"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
                >
                  {line2}
                </motion.span>
              )}
            </h2>

            <motion.button
              type="button"
              onClick={handleLink}
              className="mt-9 md:mt-12 group/btn inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.32em] font-medium text-white"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
              data-testid="dv-hero-secondary-cta"
            >
              <span className="relative pb-1.5">
                {buttonText}
                <span
                  aria-hidden="true"
                  className="absolute left-0 bottom-0 h-px w-full bg-white origin-left transition-transform duration-500"
                />
              </span>
              <ArrowRight
                className="w-4 h-4 md:w-[18px] md:h-[18px] transition-transform duration-500 group-hover/btn:translate-x-1.5"
                strokeWidth={1.4}
              />
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrows only if more than one secondary banner */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIdx((idx - 1 + banners.length) % banners.length)}
            className="hidden md:flex absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/70 hover:text-white border border-white/20 hover:border-white/50 transition-all duration-500 z-20 rounded-full backdrop-blur-sm opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
            aria-label="Previous"
            data-testid="dv-hero-secondary-prev"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setIdx((idx + 1) % banners.length)}
            className="hidden md:flex absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/70 hover:text-white border border-white/20 hover:border-white/50 transition-all duration-500 z-20 rounded-full backdrop-blur-sm opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
            aria-label="Next"
            data-testid="dv-hero-secondary-next"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </>
      )}
    </section>
  );
};

export default HeroSecondary;
