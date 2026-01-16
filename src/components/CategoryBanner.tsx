import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getActiveBanners, type Banner } from '../services/contentService';

const CategoryBanner: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getActiveBanners();
      setBanners(data);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalizedText = (banner: Banner, field: 'title' | 'subtitle') => {
    const lang = i18n.language;
    if (field === 'title') {
      return lang === 'az' ? banner.title_az : lang === 'ru' ? banner.title_ru : banner.title_en;
    } else {
      return lang === 'az' ? banner.subtitle_az : lang === 'ru' ? banner.subtitle_ru : banner.subtitle_en;
    }
  };

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {banners.map((banner) => (
            <Link
              key={banner.id}
              to={banner.link_url}
              className="relative h-80 rounded-2xl overflow-hidden group"
            >
              <img
                src={banner.image_url}
                alt={getLocalizedText(banner, 'title')}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <h3 className="text-3xl font-bold mb-2">{getLocalizedText(banner, 'title')}</h3>
                {getLocalizedText(banner, 'subtitle') && (
                  <p className="text-lg opacity-90">{getLocalizedText(banner, 'subtitle')}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryBanner;
