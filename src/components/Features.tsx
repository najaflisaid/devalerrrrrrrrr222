import React from 'react';
import { useTranslation } from 'react-i18next';

const Features: React.FC = () => {
  const { t } = useTranslation();

  const subtitle = t('features.subtitle', { defaultValue: 'Bizim öhdəliyimiz' });

  const features = [
    {
      number: '01',
      title: t('features.quality'),
      description: t('features.qualityDesc'),
    },
    {
      number: '02',
      title: t('features.authentic'),
      description: t('features.authenticDesc'),
    },
    {
      number: '03',
      title: t('features.service'),
      description: t('features.serviceDesc'),
    },
  ];

  return (
    <section
      className="relative py-16 md:py-24 bg-white"
      data-testid="dv-features"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12 md:mb-20 dv-reveal is-in">
          <span
            className="block text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-black font-medium mb-3"
            data-testid="dv-features-subtitle"
          >
            {subtitle}
          </span>
          <span className="inline-block w-8 h-px bg-black/20" aria-hidden="true" />
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-12 md:gap-y-0 md:gap-x-12 lg:gap-x-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`relative dv-reveal is-in dv-reveal-delay-${index + 1}`}
              data-testid={`dv-feature-${index}`}
            >
              <div className="text-center md:text-left max-w-xs mx-auto md:mx-0">
                <span className="font-playfair text-3xl md:text-4xl font-extralight text-black/25 leading-none block mb-5">
                  {feature.number}
                </span>
                <h3 className="font-playfair text-xl md:text-2xl font-normal text-black tracking-tight leading-tight mb-3">
                  {feature.title}
                </h3>
                <p className="text-black/55 text-sm md:text-[15px] leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
