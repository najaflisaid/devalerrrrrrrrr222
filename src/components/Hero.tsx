import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const Hero: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);

  const defaultSlides: any[] = [];

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getBanners('home');
      if (data && data.length > 0) setBanners(data);
    } catch (error) {
      console.error('Error loading home banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const slides = banners.length > 0
    ? banners.map(b => ({
        image: b.imageUrl,
        alt: b.title[i18n.language as 'az' | 'ru' | 'en'] || b.title.en || b.title.az || 'Banner',
        title: b.title,
        link: b.link,
        buttonText: (b as any).buttonText,
        mediaType: (b as any).mediaType || 'image',
        videoUrl: (b as any).videoUrl,
        duration: (b as any).duration || 4,
      }))
    : defaultSlides;

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

  // Subtle parallax: track mouse over hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
  }, []);

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
  const handleBannerClick = (link?: string) => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      ref={heroRef}
      className="group relative w-full bg-white overflow-hidden"
      data-testid="dv-hero"
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
            {(slide as any).mediaType === 'video' && (slide as any).videoUrl ? (
              <iframe
                src={(slide as any).videoUrl}
                className="w-full h-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={slide.alt}
              />
            ) : (
              <div
                onClick={() => handleBannerClick(slide.link)}
                className={`absolute inset-0 ${slide.link ? 'cursor-pointer' : ''}`}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            )}

            {/* Subtle bottom shade for arrows/indicators legibility */}
            {(slide as any).mediaType !== 'video' && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            )}
          </div>
        ))}

        {/* Fine gold frame */}
        <div
          className="absolute inset-3 sm:inset-5 border pointer-events-none z-[5]"
          style={{ borderColor: 'rgba(212,175,55,0.22)' }}
          aria-hidden="true"
        />

        {/* Nav arrows — appear on hover (desktop) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/30 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
              aria-label="Previous slide"
              data-testid="dv-hero-prev"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              onClick={nextSlide}
              className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/30 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
              aria-label="Next slide"
              data-testid="dv-hero-next"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
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
                  background:
                    index === currentSlide ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                }}
                aria-label={`Go to slide ${index + 1}`}
                data-testid={`dv-hero-indicator-${index}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
