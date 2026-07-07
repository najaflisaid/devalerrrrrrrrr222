import React, { useState, useEffect } from 'react';
import { Award, Users, Globe, TrendingUp, Star, Shield, Crown, Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAboutPage, type AboutPage as AboutPageData, type AboutStat } from '../services/contentService';

const ICON_MAP: Record<string, React.ElementType> = {
  award: Award,
  users: Users,
  globe: Globe,
  'trending-up': TrendingUp,
  star: Star,
  shield: Shield,
  crown: Crown,
  gem: Gem,
};

// Auto-advancing slider for the "Our Story" section — minimalist controls
const StorySlider: React.FC<{ images: string[]; interval?: number }> = ({ images, interval = 5000 }) => {
  const [index, setIndex] = useState(0);
  const total = images.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), interval);
    return () => clearInterval(t);
  }, [total, interval]);

  if (total === 0) return null;
  const goTo = (i: number) => setIndex((i + total) % total);

  return (
    <div className="relative w-full aspect-[4/5] md:aspect-[3/4] overflow-hidden bg-black/[0.04] group" data-testid="about-story-slider">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Story ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/80 hover:bg-white text-black flex items-center justify-center border border-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="about-slider-prev"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.25} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/80 hover:bg-white text-black flex items-center justify-center border border-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="about-slider-next"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.25} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-px transition-all duration-500 ${
                  i === index ? 'w-10 bg-white' : 'w-4 bg-white/50 hover:bg-white/80'
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
    (async () => {
      try {
        const data = await getAboutPage();
        setAboutData(data);
      } catch (e) {
        console.error('Error loading about page:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black/45 text-sm tracking-wide">Yüklənir...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="about-page">
      {/* Hero — centred, gold hairlines — matches Partners page language */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-10 md:pb-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center mb-3">
            <span className="inline-block w-6 h-px bg-black/30" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.32em] text-black/55 font-medium whitespace-nowrap" data-testid="about-slogan">
              {getField('slogan', t('about.slogan'))}
            </span>
            <span className="inline-block w-6 h-px bg-black/30" />
          </div>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-light text-black tracking-tight leading-[1.05]" data-testid="about-title">
            {getField('title', t('about.pageTitle'))}
          </h1>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* STORY — editorial 2-column */}
        <div className="grid md:grid-cols-12 gap-10 md:gap-14 items-center pb-16 md:pb-24 border-b border-black/10">
          <div className="md:col-span-7 order-2 md:order-1">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-block w-8 h-px bg-black/30" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-black/55 font-medium">
                01 / Hekayəmiz
              </span>
            </div>
            <h2 className="font-playfair text-3xl md:text-4xl font-light text-black tracking-tight leading-[1.1] mb-6" data-testid="about-story-heading">
              {getField('story_heading', t('about.ourStory'))}
            </h2>
            {aboutData?.[`content_${lang}` as keyof AboutPageData] || aboutData?.content_az ? (
              <div
                className="text-black/65 text-[14.5px] md:text-[15px] font-light leading-[1.85] space-y-4 [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: getField('content') }}
              />
            ) : (
              <div className="text-black/65 text-[14.5px] md:text-[15px] font-light leading-[1.85] space-y-4">
                <p>{t('about.story1')}</p>
                <p>{t('about.story2')}</p>
                <p>{t('about.story3')}</p>
              </div>
            )}
          </div>
          <div className="md:col-span-5 order-1 md:order-2">
            <StorySlider
              images={
                (aboutData?.story_images && aboutData.story_images.length > 0)
                  ? aboutData.story_images
                  : (aboutData?.image_url ? [aboutData.image_url] : ['https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800'])
              }
            />
          </div>
        </div>

        {/* STATS — hairline grid, no boxes */}
        <div className="py-14 md:py-20 border-b border-black/10">
          <div className="text-center mb-10 md:mb-14">
            <span className="block text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-black font-medium mb-3">
              02 / Rəqəmlər
            </span>
            <span className="inline-block w-8 h-px bg-black/20" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-black/10">
            {stats.map((stat, idx) => {
              const Icon = ICON_MAP[stat.icon] || Award;
              return (
                <div
                  key={idx}
                  className="relative border-r border-b border-black/10 p-6 md:p-8 text-center md:text-left flex flex-col items-center md:items-start"
                  data-testid={`about-stat-${idx}`}
                >
                  <Icon className="h-5 w-5 text-black/40 mb-4" strokeWidth={1.25} />
                  <p className="font-playfair text-3xl md:text-4xl font-extralight text-black leading-none tracking-tight">
                    {getStatField(stat, 'value')}
                  </p>
                  <p className="mt-2 text-[11px] md:text-[12px] uppercase tracking-[0.22em] text-black/55 font-medium">
                    {getStatField(stat, 'label')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* MISSION — editorial large heading */}
        <section className="py-14 md:py-24" data-testid="about-mission-section">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-block w-8 h-px bg-black/30" />
                <span className="text-[10px] uppercase tracking-[0.32em] text-black/55 font-medium">
                  03 / Missiya
                </span>
              </div>
              <h2
                className="font-playfair text-3xl md:text-4xl lg:text-5xl font-light text-black leading-[1.05] tracking-tight"
                data-testid="about-mission-heading"
              >
                {getField('mission_heading', t('about.ourMission'))}
                <span className="text-black/30">.</span>
              </h2>
            </div>
            <div className="md:col-span-7 md:pt-2">
              <p
                className="text-black/70 text-[14.5px] md:text-[16px] leading-[1.95] font-light"
                data-testid="about-mission-text"
              >
                {getField('mission', t('about.missionText'))}
              </p>
              <div className="mt-10 flex items-center">
                <span className="inline-block w-10 h-px bg-black/30" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
