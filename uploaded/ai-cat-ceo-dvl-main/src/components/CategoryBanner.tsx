import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getActiveBanners, type Banner } from '../services/contentService';
import Tilt3D from './Tilt3D';
import { useInView } from '../hooks/useInView';

const CategoryBanner: React.FC = () => {
  const { i18n } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const { ref: sectionRef, inView } = useInView<HTMLDivElement>();

  useEffect(() => { loadBanners(); }, []);

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
    }
    return lang === 'az' ? banner.subtitle_az : lang === 'ru' ? banner.subtitle_ru : banner.subtitle_en;
  };

  if (loading || banners.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 bg-white overflow-hidden"
      data-testid="dv-category-banner"
    >
      <div
        className="absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.09) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className={`text-center mb-12 md:mb-16 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-4">
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.4em] dv-shimmer font-semibold">
              Maison · Univers
            </span>
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {banners.map((banner, idx) => (
            <div
              key={banner.id}
              className={`dv-reveal ${inView ? 'is-in' : ''} ${idx === 0 ? 'dv-reveal-delay-1' : 'dv-reveal-delay-2'}`}
            >
              <Tilt3D maxTilt={6} testId={`dv-category-tile-${banner.id}`}>
                <Link
                  to={banner.link_url}
                  className="relative block h-80 md:h-[420px] overflow-hidden group bg-black"
                >
                  <div className="dv-tilt-inner h-full">
                    <img
                      src={banner.image_url}
                      alt={getLocalizedText(banner, 'title')}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] group-hover:scale-110"
                      loading="eager"
                    />

                    {/* overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{
                        background:
                          'radial-gradient(ellipse at 60% 40%, rgba(212,175,55,0.22) 0%, transparent 60%)',
                      }}
                    />

                    {/* Gold frame */}
                    <div className="absolute inset-4 border border-[#D4AF37]/0 group-hover:border-[#D4AF37]/40 transition-colors duration-500 pointer-events-none" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-7 md:p-10 text-white">
                      <div className="flex items-center mb-3">
                        <span className="inline-block w-6 h-[1px] bg-[#D4AF37]" />
                        <span className="ml-3 text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-medium">
                          Univers
                        </span>
                      </div>
                      <h3 className="font-playfair text-2xl md:text-4xl font-light tracking-tight mb-2">
                        {getLocalizedText(banner, 'title')}
                      </h3>
                      {getLocalizedText(banner, 'subtitle') && (
                        <p className="text-sm md:text-base text-white/80 font-light mb-4 max-w-md">
                          {getLocalizedText(banner, 'subtitle')}
                        </p>
                      )}
                      <span className="inline-flex items-center text-xs uppercase tracking-[0.3em] text-white group-hover:text-[#D4AF37] transition-colors duration-300">
                        <span className="dv-gold-line">Kəşf et</span>
                        <span className="ml-3 transition-transform duration-500 group-hover:translate-x-2">→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </Tilt3D>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryBanner;
