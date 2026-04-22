import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from '../hooks/useInView';
import { getHomepageSections, HomepageSections, DEFAULT_HOMEPAGE_SECTIONS } from '../services/contentService';

const MaisonQuote: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref, inView } = useInView<HTMLElement>();
  const [data, setData] = useState<HomepageSections['quote']>(DEFAULT_HOMEPAGE_SECTIONS.quote);

  useEffect(() => {
    (async () => {
      try {
        const sec = await getHomepageSections();
        setData(sec.quote);
      } catch (err) {
        console.error('MaisonQuote load:', err);
      }
    })();
  }, []);

  if (!data.enabled) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const get = (f: { az: string; ru: string; en: string }) => f[lang] || f.az || f.en;
  const bgText = data.backgroundText || 'De Valeur';

  return (
    <section
      ref={ref}
      className="relative py-24 md:py-40 overflow-hidden bg-white"
      data-testid="dv-maison-quote"
    >
      {/* Auto-animated background marquee: only brand text repeating */}
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
                    WebkitTextStroke: '1px rgba(212,175,55,0.28)',
                  }}
                >
                  {bgText}
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
              {get(data.eyebrow)}
            </span>
            <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
          </div>

          <blockquote className="font-playfair font-light text-black leading-[1.05]">
            <span
              className={`block text-3xl sm:text-5xl md:text-6xl lg:text-7xl dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-1`}
            >
              “{get(data.line1)}”
            </span>
            <span
              className={`block italic text-3xl sm:text-5xl md:text-6xl lg:text-7xl mt-2 md:mt-4 dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-2`}
              style={{ color: '#C99B1F' }}
            >
              “{get(data.line2)}”
            </span>
          </blockquote>

          <div className={`mt-10 inline-flex items-center dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-3`}>
            <span className="inline-block w-12 h-[1px] bg-black/40" />
            <span className="mx-3 text-[11px] uppercase tracking-[0.35em] text-black/65">
              {get(data.signature)}
            </span>
            <span className="inline-block w-12 h-[1px] bg-black/40" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MaisonQuote;
