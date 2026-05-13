import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
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
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {current?.mediaType === 'video' && current.videoUrl ? (
            <motion.video
              key={`v-${currentSlide}`}
              src={current.videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              controls={false}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 8, ease: 'linear' }}
            />
          ) : (
            <motion.img
              key={`i-${currentSlide}`}
              src={current?.image}
              alt={current?.title || 'Hero'}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              initial={{ scale: 1.12 }}
              animate={{ scale: 1.0 }}
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

      {/* === Editorial overlay text === */}
      <div className="relative z-[5] h-full flex items-end pb-20 md:pb-28 px-4 sm:px-8 md:px-16 lg:px-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${currentSlide}`}
            className="max-w-2xl text-white"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          >
            {current?.subtitle && (
              <motion.p
                className="text-[10px] sm:text-[11px] md:text-[12px] uppercase tracking-[0.4em] font-light text-white/85 mb-4 md:mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {current.subtitle}
              </motion.p>
            )}
            <motion.h1
              className="font-playfair font-light leading-[0.92] tracking-tight"
              style={{ textShadow: '0 2px 32px rgba(0,0,0,0.35)' }}
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
                    <span className="block text-[28px] sm:text-[40px] md:text-[56px] lg:text-[68px] italic text-white/85">
                      {l1}
                    </span>
                    {l2 && (
                      <span className="block text-[38px] sm:text-[52px] md:text-[78px] lg:text-[96px] mt-1 md:mt-2">
                        {l2}
                      </span>
                    )}
                  </>
                );
              })()}
            </motion.h1>

            <motion.button
              type="button"
              onClick={() => handleLink(current?.link)}
              className="mt-7 md:mt-10 group/btn inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.32em] font-medium text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
              data-testid="dv-hero-cta"
            >
              <span className="relative pb-1.5">
                {current?.buttonText || (lang === 'ru' ? 'Открыть коллекцию' : lang === 'en' ? 'Discover the collection' : 'Kolleksiyaya bax')}
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

      {/* === Slide counter & progress (Editorial, Omega-tipli rafine versiya) === */}
      {slides.length > 1 && (
        <div
          className="absolute bottom-8 md:bottom-14 right-5 md:right-12 z-20 flex flex-col items-end gap-3 md:gap-4 select-none"
          data-testid="dv-hero-counter"
        >
          {/* Big current number + total */}
          <div className="flex items-baseline gap-2">
            <AnimatePresence mode="wait">
              <motion.span
                key={`num-${currentSlide}`}
                className="font-playfair italic text-white leading-none tabular-nums text-[42px] sm:text-[52px] md:text-[64px]"
                style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {String(currentSlide + 1).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            <span className="text-white/45 text-[10px] md:text-[11px] tracking-[0.32em] font-light tabular-nums uppercase">
              / {String(slides.length).padStart(2, '0')}
            </span>
          </div>

          {/* Auto-cycle progress bar (resets per slide) */}
          <div
            className="relative w-[120px] md:w-[180px] h-px bg-white/15 overflow-hidden"
            aria-hidden="true"
          >
            <motion.span
              key={`pb-${currentSlide}`}
              className="absolute inset-y-0 left-0"
              style={{ background: 'linear-gradient(to right, #C9A961, #E8D08F)' }}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: current?.duration || 6, ease: 'linear' }}
            />
          </div>

          {/* Clickable dot pagination */}
          <div className="flex items-center gap-2.5">
            {slides.map((_: any, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="group/dot flex items-center justify-center w-4 h-4"
                aria-label={`Go to slide ${index + 1}`}
                data-testid={`dv-hero-indicator-${index}`}
              >
                <span
                  className="block rounded-full transition-all duration-500 group-hover/dot:scale-125"
                  style={{
                    width: index === currentSlide ? 8 : 4,
                    height: index === currentSlide ? 8 : 4,
                    backgroundColor:
                      index === currentSlide ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                    boxShadow:
                      index === currentSlide
                        ? '0 0 0 4px rgba(212,175,55,0.18)'
                        : 'none',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === Scroll hint — refined editorial mouse-wheel indicator === */}
      <motion.button
        type="button"
        onClick={() => {
          const h = window.innerHeight || 800;
          window.scrollTo({ top: Math.round(h * 0.86), behavior: 'smooth' });
        }}
        className="group/scroll absolute bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center text-white/75 hover:text-white transition-colors"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        aria-label={lang === 'ru' ? 'Прокрутка вниз' : lang === 'en' ? 'Scroll down' : 'Aşağı sürüşdür'}
        data-testid="dv-hero-scroll-hint"
      >
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.42em] mb-3 md:mb-4 font-light text-white/80">
          {lang === 'ru' ? 'Прокрутка' : lang === 'en' ? 'Scroll' : 'Aşağı'}
        </span>

        {/* Vertical track with animated gold dot (mouse-wheel hint) */}
        <span
          className="relative block w-px h-10 md:h-12 overflow-hidden"
          aria-hidden="true"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0.35), rgba(255,255,255,0.05))' }}
        >
          <motion.span
            className="absolute left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-[#D4AF37]"
            style={{ boxShadow: '0 0 8px rgba(212,175,55,0.6)' }}
            animate={{ y: [-2, 44, -2], opacity: [0, 1, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>

        <ChevronDown
          className="w-3.5 h-3.5 md:w-4 md:h-4 mt-2 md:mt-2.5 transition-transform duration-500 group-hover/scroll:translate-y-1"
          strokeWidth={1.1}
        />
      </motion.button>
    </section>
  );
};

export default Hero;
