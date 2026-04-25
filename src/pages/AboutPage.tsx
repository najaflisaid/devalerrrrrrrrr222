import React, { useState, useEffect } from 'react';
import { Award, Users, Globe, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAboutPage, type AboutPage as AboutPageData } from '../services/contentService';

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

  const getLocalizedContent = (field: 'title' | 'content' | 'mission') => {
    if (!aboutData) return '';
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return aboutData[`${field}_${lang}`] || aboutData[`${field}_az`] || '';
  };

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
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <h1 className="font-playfair text-3xl md:text-4xl font-light text-black tracking-tight leading-none">
            {aboutData ? getLocalizedContent('title') : t('about.pageTitle')}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="hidden md:inline-block w-8 h-[1px] flex-shrink-0" style={{ background: '#D4AF37' }} />
            <p className="text-gray-500 text-sm font-light leading-snug">
              {t('about.slogan')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12 mb-20">
          <div>
            <h2 className="font-playfair text-3xl mb-6">{t('about.ourStory')}</h2>
            {aboutData ? (
              <div
                className="text-gray-600 leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: getLocalizedContent('content') }}
              />
            ) : (
              <>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('about.story1')}
                </p>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {t('about.story2')}
                </p>
                <p className="text-gray-600 leading-relaxed">
                  {t('about.story3')}
                </p>
              </>
            )}
          </div>
          <div className="relative">
            <img
              src={aboutData?.image_url || "https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800"}
              alt="Luxury Store"
              className="w-full h-[400px] object-cover rounded-lg shadow-xl"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-8 mb-20">
          <div className="text-center p-6 bg-gray-50 rounded-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 text-white rounded-full mb-4">
              <Award className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-xl mb-2">6+ {t('about.years')}</h3>
            <p className="text-gray-600 text-sm">{t('about.experience')}</p>
          </div>
          <div className="text-center p-6 bg-gray-50 rounded-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 text-white rounded-full mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-xl mb-2">25,000+</h3>
            <p className="text-gray-600 text-sm">{t('about.happyCustomers')}</p>
          </div>
          <div className="text-center p-6 bg-gray-50 rounded-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 text-white rounded-full mb-4">
              <Globe className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-xl mb-2">20+</h3>
            <p className="text-gray-600 text-sm">{t('about.worldBrands')}</p>
          </div>
          <div className="text-center p-6 bg-gray-50 rounded-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 text-white rounded-full mb-4">
              <TrendingUp className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-xl mb-2">100%</h3>
            <p className="text-gray-600 text-sm">{t('about.originalProduct')}</p>
          </div>
        </div>

        <div className="bg-gray-900 text-white rounded-2xl p-12">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-playfair text-3xl mb-6">{t('about.ourMission')}</h2>
            <p className="text-gray-300 leading-relaxed text-lg">
              {aboutData && getLocalizedContent('mission')
                ? getLocalizedContent('mission')
                : t('about.missionText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
