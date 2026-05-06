import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

const PartnersPage: React.FC = () => {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'partners'));
        setPartners(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Partner[]);
      } catch (e) {
        console.error('Error loading partners:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const benefits = [
    t('partners.benefit1'),
    t('partners.benefit2'),
    t('partners.benefit3'),
    t('partners.benefit4'),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black/45 text-sm tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="partners-page">
      {/* Hero / heading */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-10 md:pb-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center mb-3">
            <span className="inline-block w-6 h-px bg-black/30" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.32em] text-black/55 font-medium whitespace-nowrap">
              {t('partners.subtitle')}
            </span>
            <span className="inline-block w-6 h-px bg-black/30" />
          </div>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-light text-black tracking-tight leading-[1.05]">
            {t('partners.pageTitle')}
          </h1>
        </div>
      </div>

      {/* Partner logos — minimalist grid */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-24">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-playfair text-2xl md:text-3xl font-light text-black tracking-tight mb-3">
            {t('partners.ourBrands')}
          </h2>
          <p className="text-black/55 text-sm md:text-[15px] font-light max-w-xl mx-auto leading-relaxed">
            {t('partners.brandsDescription')}
          </p>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-16 text-black/45 text-sm">
            <p>{t('common.noProductsFound')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 border-t border-l border-black/8">
            {partners.map((partner) => (
              <a
                key={partner.id}
                href={partner.website || '#'}
                target={partner.website ? '_blank' : undefined}
                rel={partner.website ? 'noopener noreferrer' : undefined}
                className="group relative aspect-[4/3] flex items-center justify-center p-6 sm:p-8 border-r border-b border-black/8 hover:bg-black/[0.02] transition-colors"
                data-testid={`partner-${partner.id}`}
              >
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="font-playfair text-base sm:text-lg md:text-xl font-light text-black text-center group-hover:text-black/70 transition-colors px-2">
                    {partner.name}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Why us — minimalist 4 numbered points */}
      <div className="border-t border-black/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <div className="text-center mb-10 md:mb-14">
            <span className="block text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-black font-medium mb-3">
              {t('partners.whyUs')}
            </span>
            <span className="inline-block w-8 h-px bg-black/20" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 max-w-3xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center md:text-left">
                <span className="block font-playfair text-2xl md:text-3xl font-extralight text-black/25 leading-none mb-3">
                  0{index + 1}
                </span>
                <p className="text-black/70 text-[14px] md:text-[15px] font-light leading-relaxed">
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* B2B CTA — black band */}
      <div className="border-t border-black/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 text-center">
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-light text-black tracking-tight mb-4">
            {t('partners.b2bTitle')}
          </h2>
          <p className="text-black/55 text-sm md:text-[15px] font-light max-w-2xl mx-auto leading-relaxed mb-8">
            {t('partners.b2bDescription')}
          </p>
          <a
            href="/b2b-login"
            className="group inline-flex items-center justify-center gap-3 px-8 py-3.5 border border-black bg-white hover:bg-black hover:text-white text-[11px] uppercase tracking-[0.3em] font-medium text-black transition-all duration-500"
            data-testid="partners-b2b-cta"
          >
            <span>{t('partners.b2bButton')}</span>
            <span className="transition-transform duration-500 group-hover:translate-x-1.5 text-base leading-none">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default PartnersPage;
