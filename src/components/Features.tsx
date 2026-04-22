import React from 'react';
import { Award, Shield, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInView } from '../hooks/useInView';

const Features: React.FC = () => {
  const { t } = useTranslation();
  const { ref, inView } = useInView<HTMLDivElement>();

  const features = [
    { icon: Award,       title: t('features.quality'),    description: t('features.qualityDesc') },
    { icon: Shield,      title: t('features.authentic'),  description: t('features.authenticDesc') },
    { icon: CheckCircle, title: t('features.service'),    description: t('features.serviceDesc') },
  ];

  return (
    <section
      ref={ref}
      className="relative py-20 md:py-28 bg-white overflow-hidden"
      data-testid="dv-features"
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
        }}
        aria-hidden="true"
      />
      <div
        className="dv-orb"
        style={{ width: 380, height: 380, top: '20%', right: '-5%', opacity: 0.08 }}
        aria-hidden="true"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className={`text-center mb-14 md:mb-20 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-4">
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.4em] dv-shimmer font-semibold">
              Notre Engagement
            </span>
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
          </div>
          <h2 className="font-playfair text-3xl md:text-5xl font-light text-black tracking-tight">
            {t('features.heading', { defaultValue: 'The De Valeur Promise' })}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`relative text-center px-6 md:px-10 py-8 dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-${index + 1} group`}
                data-testid={`dv-feature-${index}`}
              >
                {/* Vertical gold separator (desktop, not on last) */}
                {index < features.length - 1 && (
                  <span
                    className="hidden md:block absolute top-8 right-0 w-[1px] h-[calc(100%-4rem)]"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)' }}
                    aria-hidden="true"
                  />
                )}

                {/* Icon */}
                <div className="relative inline-flex items-center justify-center w-20 h-20 mb-7">
                  {/* Rotating gold ring */}
                  <span
                    className="absolute inset-0 rounded-full border border-[#D4AF37]/40 transition-all duration-700 group-hover:scale-110 group-hover:border-[#D4AF37]"
                    style={{ animation: 'dv-float 8s ease-in-out infinite alternate' }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-2 rounded-full border border-[#D4AF37]/25 transition-transform duration-700 group-hover:rotate-45"
                    aria-hidden="true"
                  />
                  <Icon className="h-7 w-7 text-[#D4AF37] relative z-10 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.2} />
                </div>

                <h3 className="font-playfair text-xl md:text-2xl font-light text-black mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-black/55 text-sm leading-relaxed max-w-xs mx-auto font-light">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
