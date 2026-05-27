import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { getBanners, Banner } from '../services/bannerService';

/**
 * Hero — Lüks brend tipli cinematic hero slider.
 *  - Tam yüksəklikdə (min-h 80vh) full-bleed video / şəkil
 *  - Ken Burns yumşaq zoom effekti (passiv parallax)
 *  - Mərkəzdə editorial typography overlay: surtitle + böyük Playfair başlıq + CTA
 *  - "Discover" CTA hover-də underline animation
 *  - Slide indicator: incə qızılı xətt + ortada slide № / sayı
 *  - Framer Motion ilə yumşaq keçidlər (cubic ease)
 */
const Hero: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getBanners('home');
        if (data && data.length > 0) setBanners(data);
      } catch (e) {
        console.error('Error loading home banners:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const slides = banners.length > 0
    ? banners.map((b) => ({
        image: b.imageUrl,
        title: b.title[lang] || b.title.en || b.title.az || '',
        link: b.link,
        buttonText: (b as any).buttonText?.[lang] || (b as any).buttonText?.az || '',
        mediaType: (b as any).mediaType || 'image',
        videoUrl: (b as any).videoUrl,
        duration: (b as any).duration || 6,
      }))
    : [];

  useEffect(() => {
    if (slides.length === 0) return;
    const dur = (slides[currentSlide]?.duration || 6) * 1000;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSlide((p) => (p + 1) % slides.length);
    }, dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide, slides.length]);

  // Növbəti slayd-ı əvvəlcədən yüklə — keçid anında qaralma və ləngimə olmasın
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(currentSlide + 1) % slides.length] as any;
    if (!next) return;
    if (next.mediaType === 'video' && next.videoUrl) {
      const v = document.createElement('video');
      v.src = next.videoUrl;
      v.preload = 'auto';
      v.muted = true;
      // Load metadata + frames to memory; browser cache will serve instantly when slide swaps
      try { v.load(); } catch { /* noop */ }
    } else if (next.image) {
      const img = new Image();
      img.src = next.image;
    }
  }, [currentSlide, slides]);

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
  const handleLink = (link?: string) => {
    if (!link) return;
    if (/^https?:\/\//.test(link)) window.open(link, '_blank', 'noopener,noreferrer');
    else window.location.href = link;
  };

  const current: any = slides[currentSlide];

  // Bannerlər yüklənənə qədər və ya admin heç bir banner əlavə etmədikdə —
  // boş tünd bir bölmə göstər (heç bir placeholder şəkil/mətn YOXDUR).
  if (!current) {
    return (
      <section
        ref={heroRef}
        className="relative w-full bg-black"
        data-testid="dv-hero"
        style={{ height: 'clamp(560px, 88vh, 920px)' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <section
      ref={heroRef}
      className="group relative w-full overflow-hidden bg-black"
      data-testid="dv-hero"
      style={{ height: 'clamp(560px, 88vh, 920px)' }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
          }}
          style={{ willChange: 'opacity' }}
        >
          {current?.mediaType === 'video' && current.videoUrl ? (
            <motion.video
              key={`v-${currentSlide}`}
              src={current.videoUrl}
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ objectPosition: 'center center' }}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              controls={false}
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 8, ease: 'linear' }}
            />
          ) : (
            <motion.img
              key={`i-${currentSlide}`}
              src={current?.image}
              alt={current?.title || 'Hero'}
              className="absolute inset-0 w-full h-full object-cover object-center md:object-cover"
              style={{ objectPosition: 'center center' }}
              loading="eager"
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
              transition={{ duration: (current?.duration || 7), ease: 'linear' }}
            />
          )}

          {/* Cinematic gradient overlays */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65 pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>

      {/* === Editorial overlay text — BOTTOM-CENTER (LV-style) === */}
      <div className="relative z-[5] h-full flex items-end justify-center pb-10 md:pb-12 lg:pb-14 px-4 sm:px-8 md:px-16 lg:px-24">
        <AnimatePresence initial={false}>
          <motion.div
            key={`text-${currentSlide}`}
            className="max-w-4xl text-white text-center flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            {current?.subtitle && (
              <motion.p
                className="font-futura text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-light text-white/90 mb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {current.subtitle}
              </motion.p>
            )}
            <motion.h1
              className="font-futura font-light uppercase tracking-[0.08em] leading-[0.95]"
              style={{ textShadow: '0 2px 32px rgba(0,0,0,0.4)' }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {(() => {
                const t = current?.title || '';
                const parts = t.split(/\s*[|/]\s*/);
                const l1 = parts[0] || '';
                const l2 = parts.slice(1).join(' ');
                return (
                  <>
                    <span className="block text-[20px] sm:text-[26px] md:text-[32px] lg:text-[40px]">
                      {l1}
                    </span>
                    {l2 && (
                      <span className="block text-[20px] sm:text-[26px] md:text-[32px] lg:text-[40px]">
                        {l2}
                      </span>
                    )}
                  </>
                );
              })()}
            </motion.h1>

            {current?.buttonText && (
              <motion.button
                type="button"
                onClick={() => handleLink(current?.link)}
                className="mt-4 md:mt-5 group/btn inline-flex items-center gap-3 text-[10px] md:text-[11px] uppercase tracking-[0.32em] font-medium text-white font-futura"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
                data-testid="dv-hero-cta"
              >
                <span className="relative pb-1.5">
                  {current.buttonText}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 bottom-0 h-px w-full bg-white origin-left transition-transform duration-500"
                  />
                </span>
                <ArrowRight
                  className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-500 group-hover/btn:translate-x-1.5"
                  strokeWidth={1.4}
                />
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="hidden md:flex absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/70 hover:text-white border border-white/20 hover:border-white/50 transition-all duration-500 z-20 rounded-full backdrop-blur-sm opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
            aria-label="Previous slide"
            data-testid="dv-hero-prev"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={nextSlide}
            className="hidden md:flex absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center text-white/70 hover:text-white border border-white/20 hover:border-white/50 transition-all duration-500 z-20 rounded-full backdrop-blur-sm opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
            aria-label="Next slide"
            data-testid="dv-hero-next"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </>
      )}
    </section>
  );
};

export default Hero;
