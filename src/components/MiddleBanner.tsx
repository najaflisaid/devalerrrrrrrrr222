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
    <section className="relative w-full py-6">
      <div className="relative h-[200px] sm:h-[280px] md:h-[350px] lg:h-[400px] overflow-hidden">
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
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-20 pointer-events-none"></div>

              {slide.title && (
                <div className="absolute bottom-6 left-8 z-10">
                  <h2 className="text-white text-2xl md:text-3xl font-semibold drop-shadow-lg">
                    {slide.title[i18n.language as 'az' | 'ru' | 'en'] || slide.title.en || slide.title.az}
                  </h2>
                </div>
              )}
            </div>
          ))}

          {slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-2 rounded-full transition-all duration-200 z-10"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5 text-gray-900" />
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-2 rounded-full transition-all duration-200 z-10"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5 text-gray-900" />
              </button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === currentSlide
                        ? 'bg-white w-6'
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
    </section>
  );
};

export default MiddleBanner;
