import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getActiveProductBanners, type ProductBanner } from '../services/contentService';
import ProductBannerSlider from './ProductBannerSlider';
import MiddleBanner from './MiddleBanner';
import Tilt3D from './Tilt3D';

const HomeProductBanners: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<ProductBanner[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => { loadBanners(); }, []);

  const loadBanners = async () => {
    try {
      const data = await getActiveProductBanners();
      setBanners(data);
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

  const heading = i18n.language === 'ru'
    ? 'Детали, добавляющие ценность вашему престижу'
    : i18n.language === 'en'
    ? 'Details that add value to your prestige'
    : 'Prestijinizə dəyər qatan detallar';

  const subheading = i18n.language === 'ru'
    ? 'Оригинальные варианты, сохраняющие свою ценность в каждой детали'
    : i18n.language === 'en'
    ? 'Original choices that preserve their value in every detail'
    : 'Hər detalında dəyərini qoruyan orijinal seçimlər';

  return (
    <>
      <MiddleBanner />

      <section
        className="relative pt-20 md:pt-28 pb-16 md:pb-24 bg-white overflow-hidden"
        data-testid="dv-home-banners"
      >
        {/* Ambient gold orb */}
        <div
          className="dv-orb"
          style={{ width: 540, height: 540, top: '-20%', left: '50%', marginLeft: -270, opacity: 0.08 }}
          aria-hidden="true"
        />

        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Heading */}
          <div className="text-center mb-12 md:mb-16 dv-reveal is-in">
            <div className="inline-flex items-center mb-5">
              <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
              <span className="mx-3 text-[10px] uppercase tracking-[0.4em] dv-shimmer font-semibold">
                Signature Selection
              </span>
              <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
            </div>
            <h2 className="font-playfair text-3xl md:text-5xl lg:text-6xl font-light text-black leading-[1.05] max-w-4xl mx-auto">
              {heading}
            </h2>
          </div>

          {/* Banner grid */}
          {banners.length > 0 && (
            <div
              className={`grid gap-5 md:gap-7 mb-14 md:mb-20 ${
                banners.length === 1
                  ? 'grid-cols-1 max-w-[760px] mx-auto'
                  : banners.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {banners.map((banner, idx) => (
                <div
                  key={banner.id}
                  className={`dv-reveal is-in ${idx === 0 ? 'dv-reveal-delay-1' : 'dv-reveal-delay-2'}`}
                >
                  <Tilt3D
                    maxTilt={5}
                    className="w-full"
                    testId={`dv-home-banner-${banner.id}`}
                  >
                    <Link
                      to={banner.link_url}
                      className="group relative block overflow-hidden bg-black"
                    >
                      <div className="dv-tilt-inner">
                        <div className="aspect-[16/9] md:aspect-[16/8] relative">
                          {banner.content_type === 'video' && banner.video_url ? (
                            <video
                              src={banner.video_url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              preload="auto"
                              className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
                            />
                          ) : (
                            <img
                              src={banner.image_url || ''}
                              alt={getTitle(banner)}
                              className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-110"
                              loading="eager"
                            />
                          )}

                          {/* Cinematic overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                            style={{
                              background:
                                'radial-gradient(ellipse at 30% 30%, rgba(212,175,55,0.25) 0%, transparent 55%)',
                            }}
                          />

                          {/* Gold border sweep */}
                          <div
                            className="absolute inset-0 border border-[#D4AF37]/0 group-hover:border-[#D4AF37]/60 transition-colors duration-500 pointer-events-none"
                          />

                          {/* Content */}
                          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                            <div className="flex items-center mb-3">
                              <span className="inline-block w-6 h-[1px] bg-[#D4AF37]" />
                              <span className="ml-3 text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-medium">
                                Collection
                              </span>
                            </div>
                            <h3 className="text-white font-playfair text-2xl md:text-4xl font-light tracking-tight mb-4 max-w-lg">
                              {getTitle(banner)}
                            </h3>
                            <span className="inline-flex items-center text-xs uppercase tracking-[0.3em] text-white/90 group-hover:text-[#D4AF37] transition-colors duration-300">
                              <span className="dv-gold-line">Kəşf et</span>
                              <span className="ml-3 transition-transform duration-500 group-hover:translate-x-2">
                                →
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </Tilt3D>
                </div>
              ))}
            </div>
          )}

          {/* Sub heading */}
          <div className="text-center mb-10 dv-reveal is-in dv-reveal-delay-3">
            <p className="font-playfair text-xl md:text-3xl text-black/75 font-light italic max-w-3xl mx-auto leading-snug">
              {subheading}
            </p>
          </div>

          {/* Brand slider */}
          <div className="dv-reveal is-in dv-reveal-delay-4">
            <ProductBannerSlider />
          </div>
        </div>
      </section>
    </>
  );
};

export default HomeProductBanners;
