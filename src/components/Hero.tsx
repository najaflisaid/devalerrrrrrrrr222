import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const Hero: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultSlides = [
  
  ];

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      console.log('Starting to load home banners...');
      const data = await getBanners('home');
      console.log('Loaded home banners - count:', data?.length, 'data:', data);
      if (data && data.length > 0) {
        console.log('Setting banners to state:', data);
        setBanners(data);
      } else {
        console.log('No banners found, using default slides');
      }
    } catch (error) {
      console.error('Error loading home banners:', error);
    } finally {
      setLoading(false);
      console.log('Banner loading completed. Banners in state:', banners.length);
    }
  };

  const slides = banners.length > 0
    ? banners.map(b => ({
        image: b.imageUrl,
        alt: b.title[i18n.language as 'az' | 'ru' | 'en'] || b.title.en || b.title.az || 'Banner',
        title: b.title,
        link: b.link,
        mediaType: (b as any).mediaType || 'image',
        videoUrl: (b as any).videoUrl
      }))
    : defaultSlides;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden mt-4">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {(slide as any).mediaType === 'video' && (slide as any).videoUrl ? (
            <iframe
              src={(slide as any).videoUrl}
              className="w-full h-full object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : slide.link ? (
            <a href={slide.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img
                src={slide.image}
                alt={slide.alt}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </a>
          ) : (
            <img
              src={slide.image}
              alt={slide.alt}
              className="w-full h-full object-cover"
              loading="eager"
            />
          )}
          {(slide as any).mediaType !== 'video' && (
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          )}

          {slide.title && (slide as any).mediaType !== 'video' && (
            <div className="absolute bottom-6 left-6 right-6 z-10">
              <h2 className="text-white text-3xl md:text-4xl font-bold drop-shadow-lg">
                {slide.title[i18n.language as 'az' | 'ru' | 'en'] || slide.title.en || slide.title.az}
              </h2>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-3 rounded-full transition-all duration-200 z-10"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6 text-gray-900" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-3 rounded-full transition-all duration-200 z-10"
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6 text-gray-900" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentSlide
                ? 'bg-white w-8'
                : 'bg-white bg-opacity-50 hover:bg-opacity-75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
