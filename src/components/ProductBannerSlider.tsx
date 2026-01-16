import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const ProductBannerSlider: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getBanners('products');
      console.log('Loaded products banners:', data);
      if (data && data.length > 0) {
        setBanners(data);
      }
    } catch (error) {
      console.error('Banner error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banners.length === 0) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [banners.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full h-[200px] sm:h-[180px] md:h-[220px] lg:h-[400px] xl:h-[380px] overflow-hidden rounded-2xl my-8">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-1000 mx-auto ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {(banner as any).mediaType === 'video' && (banner as any).videoUrl ? (
            <video
              src={(banner as any).videoUrl}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              style={{ pointerEvents: 'none' }}
            />
          ) : banner.link ? (
            <a href={banner.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img
                src={banner.imageUrl}
                alt={banner.title[i18n.language as 'az' | 'ru' | 'en'] || banner.title.en || banner.title.az}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </a>
          ) : (
            <img
              src={banner.imageUrl}
              alt={banner.title[i18n.language as 'az' | 'ru']}
              className="w-full h-full object-cover"
              loading="eager"
            />
          )}
          {(banner as any).mediaType !== 'video' && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          )}

          {(banner.title[i18n.language as 'az' | 'ru' | 'en'] || banner.title.en || banner.title.az) && (banner as any).mediaType !== 'video' && (
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-white text-2xl font-bold drop-shadow-lg">
                {banner.title[i18n.language as 'az' | 'ru' | 'en'] || banner.title.en || banner.title.az}
              </h3>
            </div>
          )}
        </div>
      ))}

      {banners.length > 1 && (
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
            {banners.map((_, index) => (
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
    </section>
  );
};

export default ProductBannerSlider;
