import React, { useState, useEffect } from 'react';
import { Award, Users, Globe, TrendingUp, Star, Shield, Crown, Gem } from 'lucide-react';
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
            <img
              src={aboutData?.image_url || 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800'}
              alt="Luxury Store"
              className="w-full h-[400px] object-cover rounded-lg shadow-xl"
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
        {/* MISSION — Couture Manifesto (yeni dizayn) */}
        {/* ─────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-[2px]"
          data-testid="about-mission-section"
          style={{
            background:
              'linear-gradient(135deg, #FBF7EF 0%, #F4ECDC 100%)',
          }}
        >
          {/* Decorative grain / noise overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-multiply"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            }}
          />

          {/* Gold corner frame */}
          <span aria-hidden className="absolute top-6 left-6 w-10 h-10 border-t border-l" style={{ borderColor: '#D4AF37' }} />
          <span aria-hidden className="absolute top-6 right-6 w-10 h-10 border-t border-r" style={{ borderColor: '#D4AF37' }} />
          <span aria-hidden className="absolute bottom-6 left-6 w-10 h-10 border-b border-l" style={{ borderColor: '#D4AF37' }} />
          <span aria-hidden className="absolute bottom-6 right-6 w-10 h-10 border-b border-r" style={{ borderColor: '#D4AF37' }} />

          <div className="relative grid md:grid-cols-12 gap-0">
            {/* LEFT — vertical wordmark + giant quote */}
            <div className="md:col-span-4 relative px-8 md:px-12 py-12 md:py-20 flex md:block items-center gap-6 border-b md:border-b-0 md:border-r border-stone-300/60">
              <div
                className="hidden md:block absolute left-12 top-20 text-[11px] tracking-[0.6em] uppercase text-stone-500 font-light"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Maison · De Valeur · Manifeste
              </div>

              <div className="md:ml-24">
                <span
                  aria-hidden
                  className="block font-playfair leading-none select-none"
                  style={{
                    fontSize: 'clamp(120px, 18vw, 220px)',
                    color: '#D4AF37',
                    fontWeight: 400,
                    lineHeight: 0.7,
                    letterSpacing: '-0.05em',
                  }}
                >
                  &ldquo;
                </span>
                <span
                  className="block mt-2 text-[10px] tracking-[0.4em] uppercase text-stone-500 font-medium"
                  data-testid="about-mission-eyebrow"
                >
                  · Notre Mission ·
                </span>
              </div>
            </div>

            {/* RIGHT — manifesto text */}
            <div className="md:col-span-8 px-8 md:px-14 py-12 md:py-20 relative">
              {/* Top thin gold line */}
              <div className="flex items-center gap-3 mb-6">
                <span className="block w-12 h-[1px]" style={{ background: '#D4AF37' }} />
                <span className="text-[11px] tracking-[0.35em] uppercase text-stone-600 font-medium">
                  Anno · MMX
                </span>
              </div>

              <h2
                className="font-playfair text-4xl md:text-5xl lg:text-6xl font-light text-stone-900 leading-[1.05] tracking-tight mb-8"
                data-testid="about-mission-heading"
              >
                {getField('mission_heading', t('about.ourMission'))}
              </h2>

              <p
                className="font-playfair text-lg md:text-xl leading-[1.7] text-stone-700 italic"
                style={{ fontWeight: 300 }}
                data-testid="about-mission-text"
              >
                <span
                  className="float-left mr-3 mt-1 font-playfair leading-none"
                  style={{
                    fontSize: '4.5rem',
                    color: '#D4AF37',
                    fontWeight: 500,
                    lineHeight: 0.85,
                  }}
                >
                  {(getField('mission', t('about.missionText'))?.[0] || '').toUpperCase()}
                </span>
                {(getField('mission', t('about.missionText')) || '').slice(1)}
              </p>

              {/* Bottom signature line */}
              <div className="mt-10 flex items-center gap-4">
                <span className="block w-20 h-[1px]" style={{ background: '#D4AF37' }} />
                <span
                  className="font-playfair italic text-stone-700 text-lg tracking-wide"
                  style={{ fontWeight: 400 }}
                >
                  De Valeur
                </span>
                <span className="block flex-1 h-[1px]" style={{ background: 'rgba(212,175,55,0.35)' }} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
