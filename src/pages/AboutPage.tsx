import React, { useState, useEffect } from 'react';
import { Award, Users, Globe, TrendingUp, Star, Shield, Crown, Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAboutPage, type AboutPage as AboutPageData, type AboutStat } from '../services/contentService';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  users: Users,
  globe: Globe,
  'trending-up': TrendingUp,
  star: Star,
  shield: Shield,
  crown: Crown,
  gem: Gem,
};

// Auto-advancing image slider for the "Our Story" section
const StorySlider: React.FC<{ images: string[]; interval?: number }> = ({ images, interval = 4500 }) => {
  const [index, setIndex] = useState(0);
  const total = images.length;

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, interval);
    return () => clearInterval(timer);
  }, [total, interval]);

  if (total === 0) return null;

  const goTo = (i: number) => setIndex((i + total) % total);

  return (
    <div className="relative w-full h-[400px] rounded-lg shadow-xl overflow-hidden group" data-testid="about-story-slider">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Our Story ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
            i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/70 hover:bg-white text-gray-900 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="about-slider-prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/70 hover:bg-white text-gray-900 rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="about-slider-next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};


const DEFAULT_STATS_BY_LANG = (t: (k: string) => string): AboutStat[] => ([
  { icon: 'award', value_az: '6+', value_ru: '6+', value_en: '6+', label_az: t('about.experience'), label_ru: t('about.experience'), label_en: t('about.experience') },
  { icon: 'users', value_az: '25,000+', value_ru: '25,000+', value_en: '25,000+', label_az: t('about.happyCustomers'), label_ru: t('about.happyCustomers'), label_en: t('about.happyCustomers') },
  { icon: 'globe', value_az: '20+', value_ru: '20+', value_en: '20+', label_az: t('about.worldBrands'), label_ru: t('about.worldBrands'), label_en: t('about.worldBrands') },
  { icon: 'trending-up', value_az: '100%', value_ru: '100%', value_en: '100%', label_az: t('about.originalProduct'), label_ru: t('about.originalProduct'), label_en: t('about.originalProduct') },
]);

const AboutPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [aboutData, setAboutData] = useState<AboutPageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAboutData();
  }, []);

  const loadAboutData = async () => {
    try {
      const data = await getAboutPage();
      setAboutData(data);
    } catch (error) {
      console.error('Error loading about page:', error);
    } finally {
      setLoading(false);
    }
  };

  const lang = i18n.language as 'az' | 'ru' | 'en';

  const getField = (field: string, fallback: string = '') => {
    if (!aboutData) return fallback;
    const localized = (aboutData as any)[`${field}_${lang}`];
    const azFallback = (aboutData as any)[`${field}_az`];
    return localized || azFallback || fallback;
  };

  const getStatField = (stat: AboutStat, field: 'value' | 'label') => {
    return (stat as any)[`${field}_${lang}`] || (stat as any)[`${field}_az`] || '';
  };

  const stats = (aboutData?.stats && aboutData.stats.length > 0)
    ? aboutData.stats
    : DEFAULT_STATS_BY_LANG(t);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="about-page">
      {/* HEADER */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <h1 className="font-playfair text-3xl md:text-4xl font-light text-black tracking-tight leading-none" data-testid="about-title">
            {getField('title', t('about.pageTitle'))}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="hidden md:inline-block w-8 h-[1px] flex-shrink-0" style={{ background: '#D4AF37' }} />
            <p className="text-gray-500 text-sm font-light leading-snug" data-testid="about-slogan">
              {getField('slogan', t('about.slogan'))}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* STORY */}
        <div className="grid md:grid-cols-2 gap-12 mb-20">
          <div>
            <h2 className="font-playfair text-3xl mb-6" data-testid="about-story-heading">
              {getField('story_heading', t('about.ourStory'))}
            </h2>
            {aboutData?.[`content_${lang}` as keyof AboutPageData] || aboutData?.content_az ? (
              <div
                className="text-gray-600 leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: getField('content') }}
              />
            ) : (
              <>
                <p className="text-gray-600 leading-relaxed mb-4">{t('about.story1')}</p>
                <p className="text-gray-600 leading-relaxed mb-4">{t('about.story2')}</p>
                <p className="text-gray-600 leading-relaxed">{t('about.story3')}</p>
              </>
            )}
          </div>
          <div className="relative">
            <StorySlider
              images={
                (aboutData?.story_images && aboutData.story_images.length > 0)
                  ? aboutData.story_images
                  : (aboutData?.image_url ? [aboutData.image_url] : ['https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800'])
              }
            />
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-24">
          {stats.map((stat, idx) => {
            const Icon = ICON_MAP[stat.icon] || Award;
            return (
              <div
                key={idx}
                className="text-center p-6 bg-gray-50 rounded-lg"
                data-testid={`about-stat-${idx}`}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 text-white rounded-full mb-4">
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{getStatField(stat, 'value')}</h3>
                <p className="text-gray-600 text-sm">{getStatField(stat, 'label')}</p>
              </div>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────── */}
        {/* MISSION — Editorial Minimal (sayt konsepti)  */}
        {/* ─────────────────────────────────────────── */}
        <section
          className="relative bg-white"
          data-testid="about-mission-section"
        >
          {/* Top hairline divider with gold mark */}
          <div className="flex items-center gap-4 mb-12 md:mb-16">
            <span className="block flex-1 h-[1px] bg-gray-200" />
            <span className="block w-1.5 h-1.5 rotate-45" style={{ background: '#D4AF37' }} aria-hidden />
            <span className="block flex-1 h-[1px] bg-gray-200" />
          </div>

          <div className="grid md:grid-cols-12 gap-8 md:gap-16 px-2 md:px-0">
            {/* LEFT column — heading */}
            <div className="md:col-span-5">
              <h2
                className="font-playfair text-4xl md:text-5xl lg:text-[3.75rem] font-light text-black leading-[1.05] tracking-tight"
                data-testid="about-mission-heading"
              >
                {getField('mission_heading', t('about.ourMission'))}
                <span style={{ color: '#D4AF37' }}>.</span>
              </h2>
            </div>

            {/* RIGHT column — body text */}
            <div className="md:col-span-7 md:pt-3">
              <p
                className="text-gray-700 text-base md:text-lg leading-[1.85] font-light"
                data-testid="about-mission-text"
              >
                {getField('mission', t('about.missionText'))}
              </p>

              <div className="mt-10 flex items-center">
                <span className="block w-10 h-[1px]" style={{ background: '#D4AF37' }} />
              </div>
            </div>
          </div>

          {/* Bottom hairline */}
          <div className="mt-12 md:mt-16 h-[1px] bg-gray-200" />
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
