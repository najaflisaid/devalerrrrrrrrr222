import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from '../hooks/useInView';

const MaisonQuote: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref, inView } = useInView<HTMLElement>();

  const quote =
    i18n.language === 'ru'
      ? { line1: 'Время не меряют.', line2: 'Его носят.' }
      : i18n.language === 'en'
      ? { line1: 'Time is not measured.', line2: 'It is worn.' }
      : { line1: 'Zaman ölçülmür.', line2: 'Zaman daşınır.' };

  return (
    <section
      ref={ref}
      className="relative py-24 md:py-40 overflow-hidden"
      data-testid="dv-maison-quote"
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, #FBF7EE 0%, #F6EFDC 40%, #FAFAF7 100%)',
      }}
    >
      {/* Subtle gold grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dv-grain"
        aria-hidden="true"
      />
      {/* Ambient soft gold glow blobs */}
      <div
        className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 70%)',
          filter: 'blur(10px)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.18) 0%, transparent 70%)',
          filter: 'blur(10px)',
        }}
        aria-hidden="true"
      />

      {/* Auto-animated background marquee: only "De Valeur" repeating */}
      <div
        className="absolute inset-0 flex items-center pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="dv-marquee-track font-playfair italic text-[22vw] md:text-[14vw] leading-none font-light whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center">
              {Array.from({ length: 6 }).map((_, j) => (
                <span
                  key={`${i}-${j}`}
                  className="mx-10 inline-block"
                  style={{
                    color: 'transparent',
                    WebkitTextStroke: '1px rgba(212,175,55,0.32)',
                  }}
                >
                  De Valeur
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="relative max-w-[1440px] mx-auto px-6 sm:px-10 text-center">
        <div className={`dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-6">
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.45em] dv-shimmer font-semibold">
              Philosophie · Depuis 2010
            </span>
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
          </div>

          <blockquote className="font-playfair font-light text-black leading-[1.05]">
            <span
              className={`block text-3xl sm:text-5xl md:text-6xl lg:text-7xl dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-1`}
            >
              “{quote.line1}”
            </span>
            <span
              className={`block italic text-3xl sm:text-5xl md:text-6xl lg:text-7xl mt-2 md:mt-4 dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-2`}
              style={{ color: '#C99B1F' }}
            >
              “{quote.line2}”
            </span>
          </blockquote>

          <div className={`mt-10 inline-flex items-center dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-3`}>
            <span className="inline-block w-12 h-[1px] bg-black/40" />
            <span className="mx-3 text-[11px] uppercase tracking-[0.35em] text-black/65">
              Maison De Valeur
            </span>
            <span className="inline-block w-12 h-[1px] bg-black/40" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MaisonQuote;
