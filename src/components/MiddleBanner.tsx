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
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="group relative h-[180px] sm:h-[230px] md:h-[300px] lg:h-[340px] overflow-hidden rounded-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
          data-testid="dv-middle-banner"
        >
          {/* Subtle animated gold border accent */}
          <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl border border-[#D4AF37]/0 group-hover:border-[#D4AF37]/50 transition-colors duration-500" />

          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div
                onClick={() => slide.link && window.open(slide.link, '_blank', 'noopener,noreferrer')}
                className={`w-full h-full ${slide.link ? 'cursor-pointer' : ''}`}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className={`w-full h-full object-cover transition-transform duration-[6000ms] ease-out ${
                    index === currentSlide ? 'scale-110' : 'scale-100'
                  } group-hover:scale-[1.15]`}
                  loading="lazy"
                />
              </div>

              {/* Cinematic gradient overlay (subtle) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

              {/* Gold radial glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 25% 50%, rgba(212,175,55,0.18) 0%, transparent 60%)',
                }}
              />
            </div>
          ))}

          {slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-md hover:bg-white p-1.5 md:p-2 rounded-full transition-all duration-300 z-30 opacity-0 group-hover:opacity-100 hover:scale-110 ring-1 ring-white/40"
                aria-label="Previous slide"
                data-testid="middle-banner-prev"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-900" />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-md hover:bg-white p-1.5 md:p-2 rounded-full transition-all duration-300 z-30 opacity-0 group-hover:opacity-100 hover:scale-110 ring-1 ring-white/40"
                aria-label="Next slide"
                data-testid="middle-banner-next"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-900" />
              </button>

              <div className="absolute bottom-3 md:bottom-4 right-4 md:right-6 flex items-center space-x-1.5 z-30">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-[3px] rounded-full transition-all duration-500 ${
                      index === currentSlide
                        ? 'w-7 bg-[#D4AF37]'
                        : 'w-3 bg-white/60 hover:bg-white'
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
