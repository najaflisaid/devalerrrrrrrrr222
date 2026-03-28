import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getActiveProductBanners, type ProductBanner } from '../services/contentService';
import ProductBannerSlider from './ProductBannerSlider';
import MiddleBanner from './MiddleBanner';

const HomeProductBanners: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<ProductBanner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getActiveProductBanners();
      setBanners(data.slice(0, 2));
    } catch (error) {
      console.error('Error loading product banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = (banner: ProductBanner) => {
    const lang = i18n.language;
    if (lang === 'ru') return banner.title_ru;
    if (lang === 'en') return banner.title_en;
    return banner.title_az;
  };

  return (
    <>
      {/* Middle Banner Section */}
      <MiddleBanner />

      <section className="pt-6 pb-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
    
            <h2 className="text-2xl font-bold text-gray-900">
              {i18n.language === 'ru'
                ? 'Детали, добавляющие ценность вашему престижу'
                : i18n.language === 'en'
                ? 'Details that add value to your prestige'
                : 'Prestijinizə dəyər qatan detallar'}
            </h2>
          </div>

          {banners.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {banners.map((banner) => (
                <Link
                  key={banner.id}
                  to={banner.link_url}
                  className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  <div className="aspect-[16/7] relative">
                    {banner.content_type === 'video' && banner.video_url ? (
                      <video
                        src={banner.video_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={banner.image_url || ''}
                        alt={getTitle(banner)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="eager"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <h3 className="text-white text-2xl font-bold drop-shadow-lg">
                        {getTitle(banner)}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="text-center mt-5">
            <p className="text-gray-700 text-2xl font-bold">
              {i18n.language === 'ru'
                ? 'Оригинальные варианты, сохраняющие свою ценность в каждой детали'
                : i18n.language === 'en'
                ? 'Original choices that preserve their value in every detail'
                : 'Hər detalında dəyərini qoruyan orijinal seçimlər'}
            </p>
          </div>

          <ProductBannerSlider />
        </div>
      </section>
    </>
  );
};

export default HomeProductBanners;
