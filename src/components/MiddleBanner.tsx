import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const MiddleBanner: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getBanners('middle');
      if (data && data.length > 0) setBanners(data);
    } catch (error) {
      console.error('Error loading middle banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const slides = banners.map((b) => ({
    image: b.imageUrl,
    alt: b.title[i18n.language as 'az' | 'ru' | 'en'] || b.title.en || b.title.az || 'Banner',
    title: b.title,
    link: b.link,
    duration: b.duration || 5,
  }));

  useEffect(() => {
    if (slides.length === 0) return;
    const currentDuration = (slides[currentSlide]?.duration || 5) * 1000;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, currentDuration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide, slides]);

  if (slides.length === 0) return null;

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
  const handleClick = (link?: string) => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const getTitle = (slide: (typeof slides)[number]) =>
    slide.title[i18n.language as 'az' | 'ru' | 'en'] || slide.title.en || slide.title.az || '';

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-white overflow-hidden"
      data-testid="dv-middle-banner"
    >
      {/* Ambient gold orbs */}
      <div
        className="dv-orb"
        style={{ width: 480, height: 480, top: '-15%', left: '-10%', opacity: 0.18 }}
        aria-hidden="true"
      />
      <div
        className="dv-orb"
        style={{ width: 420, height: 420, bottom: '-20%', right: '-8%', animationDelay: '3s', opacity: 0.18 }}
        aria-hidden="true"
      />

      <div className="relative h-[240px] sm:h-[400px] md:h-[460px] lg:h-[520px] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div
              onClick={() => handleClick(slide.link)}
              className={`absolute inset-0 ${slide.link ? 'cursor-pointer' : ''}`}
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Cinematic gradient for title legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25 pointer-events-none" />

            {/* Title overlay */}
            {getTitle(slide) && (
              <div className="absolute inset-0 flex items-end pointer-events-none z-10">
                <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-14 pb-12 sm:pb-14 md:pb-16">
                  <h2
                    className="text-white font-playfair text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] font-light max-w-3xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]"
                    data-testid={`dv-middle-banner-title-${index}`}
                  >
                    {getTitle(slide)}
                  </h2>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Fine gold frame */}
        <div
          className="absolute inset-3 sm:inset-5 border pointer-events-none z-[5]"
          style={{ borderColor: 'rgba(212,175,55,0.22)' }}
          aria-hidden="true"
        />

        {/* Nav arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/20"
              aria-label="Previous slide"
              data-testid="dv-middle-banner-prev"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.3} />
            </button>

            <button
              onClick={nextSlide}
              className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/20"
              aria-label="Next slide"
              data-testid="dv-middle-banner-next"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.3} />
            </button>
          </>
        )}

        {/* Slide indicator bars */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="group h-[2px] transition-all duration-500"
                style={{
                  width: index === currentSlide ? 48 : 18,
                  background: index === currentSlide ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                }}
                aria-label={`Go to slide ${index + 1}`}
                data-testid={`dv-middle-banner-indicator-${index}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MiddleBanner;
