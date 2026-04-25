import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const MiddleBanner: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getBanners('middle');
      if (data && data.length > 0) {
        setBanners(data);
      }
    } catch (error) {
      console.error('Error loading middle banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const slides = banners.map(b => ({
    image: b.imageUrl,
    alt: b.title[i18n.language as 'az' | 'ru' | 'en'] || b.title.en || b.title.az || 'Banner',
    title: b.title,
    link: b.link,
    buttonText: (b as any).buttonText,
    mediaType: (b as any).mediaType || 'image',
    videoUrl: (b as any).videoUrl,
    duration: (b as any).duration || 4
  }));

  useEffect(() => {
    if (slides.length === 0) return;
    
    const currentDuration = (slides[currentSlide]?.duration || 4) * 1000;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, currentDuration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentSlide, slides]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full py-8 md:py-12 bg-white">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="group relative h-[200px] sm:h-[260px] md:h-[330px] lg:h-[380px] overflow-hidden bg-black"
          data-testid="dv-middle-banner"
          style={{ clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)' }}
        >
          {/* Image layer with slow cinematic pan */}
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
                index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div
                onClick={() => slide.link && window.open(slide.link, '_blank', 'noopener,noreferrer')}
                className={`absolute inset-0 ${slide.link ? 'cursor-pointer' : ''}`}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className={`w-full h-full object-cover ${index === currentSlide ? 'dv-cine-pan' : ''}`}
                  loading="lazy"
                />
              </div>

              {/* Cinematic vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
                }}
              />

              {/* Top + bottom letterbox bars (cinema feel) */}
              <div className="absolute top-0 left-0 right-0 h-[10%] md:h-[12%] bg-black pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-[10%] md:h-[12%] bg-black pointer-events-none" />

              {/* Slow gold scanline */}
              <div className="dv-scanline" />
            </div>
          ))}

          {/* Film grain overlay */}
          <div className="dv-grain absolute inset-0 pointer-events-none z-[2]" />

          {/* Gold corner brackets (museum frame) */}
          <span className="pointer-events-none absolute top-[14%] md:top-[16%] left-3 md:left-5 w-5 h-5 md:w-7 md:h-7 border-l-[1.5px] border-t-[1.5px] border-[#D4AF37] z-[3] transition-all duration-700 group-hover:w-7 group-hover:h-7 md:group-hover:w-10 md:group-hover:h-10" />
          <span className="pointer-events-none absolute top-[14%] md:top-[16%] right-3 md:right-5 w-5 h-5 md:w-7 md:h-7 border-r-[1.5px] border-t-[1.5px] border-[#D4AF37] z-[3] transition-all duration-700 group-hover:w-7 group-hover:h-7 md:group-hover:w-10 md:group-hover:h-10" />
          <span className="pointer-events-none absolute bottom-[14%] md:bottom-[16%] left-3 md:left-5 w-5 h-5 md:w-7 md:h-7 border-l-[1.5px] border-b-[1.5px] border-[#D4AF37] z-[3] transition-all duration-700 group-hover:w-7 group-hover:h-7 md:group-hover:w-10 md:group-hover:h-10" />
          <span className="pointer-events-none absolute bottom-[14%] md:bottom-[16%] right-3 md:right-5 w-5 h-5 md:w-7 md:h-7 border-r-[1.5px] border-b-[1.5px] border-[#D4AF37] z-[3] transition-all duration-700 group-hover:w-7 group-hover:h-7 md:group-hover:w-10 md:group-hover:h-10" />

          {/* Vertical decorative ornament — left side */}
          <div className="hidden md:flex pointer-events-none absolute top-[16%] bottom-[16%] left-8 lg:left-12 z-[3] flex-col items-center justify-between">
            <span className="w-[3px] h-[3px] rounded-full bg-[#D4AF37]" />
            <span className="flex-1 my-2 w-[1px] bg-gradient-to-b from-[#D4AF37]/0 via-[#D4AF37]/60 to-[#D4AF37]/0" />
            <span className="w-[3px] h-[3px] rounded-full bg-[#D4AF37]" />
          </div>
          <div className="hidden md:flex pointer-events-none absolute top-[16%] bottom-[16%] right-8 lg:right-12 z-[3] flex-col items-center justify-between">
            <span className="w-[3px] h-[3px] rounded-full bg-[#D4AF37]" />
            <span className="flex-1 my-2 w-[1px] bg-gradient-to-b from-[#D4AF37]/0 via-[#D4AF37]/60 to-[#D4AF37]/0" />
            <span className="w-[3px] h-[3px] rounded-full bg-[#D4AF37]" />
          </div>

          {/* Tiny micro-label centered in top bar */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[10%] md:h-[12%] flex items-center justify-center z-[3]">
            <span className="text-[8px] md:text-[10px] uppercase tracking-[0.5em] text-[#D4AF37]/90 font-medium">
              · DE VALEUR · MAISON ·
            </span>
          </div>

          {slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/20 hover:border-[#D4AF37] hover:bg-black/60 rounded-full transition-all duration-500 z-30 opacity-0 group-hover:opacity-100 hover:scale-110"
                aria-label="Previous slide"
                data-testid="middle-banner-prev"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-white" strokeWidth={1.3} />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/20 hover:border-[#D4AF37] hover:bg-black/60 rounded-full transition-all duration-500 z-30 opacity-0 group-hover:opacity-100 hover:scale-110"
                aria-label="Next slide"
                data-testid="middle-banner-next"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-white" strokeWidth={1.3} />
              </button>

              <div className="absolute bottom-[3%] md:bottom-[4%] left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-[2px] rounded-full transition-all duration-500 ${
                      index === currentSlide
                        ? 'w-8 bg-[#D4AF37]'
                        : 'w-3 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default MiddleBanner;
