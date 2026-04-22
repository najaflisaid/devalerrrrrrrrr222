import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from '../hooks/useInView';

const MaisonQuote: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref: revealRef, inView } = useInView<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 as user scrolls through it

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when section bottom reaches viewport bottom, 1 when section top leaves viewport top
      const total = rect.height + vh;
      const scrolled = vh - rect.top;
      const p = Math.min(1, Math.max(0, scrolled / total));
      setProgress(p);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const quote =
    i18n.language === 'ru'
      ? { line1: 'Время не меряют.', line2: 'Его носят.' }
      : i18n.language === 'en'
      ? { line1: 'Time is not measured.', line2: 'It is worn.' }
      : { line1: 'Zaman ölçülmür.', line2: 'Zaman daşınır.' };

  // kinetic background word translates based on scroll progress
  const translate = -40 + progress * 80; // -40% to +40%

  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
        revealRef(node);
      }}
      className="relative py-24 md:py-36 bg-white overflow-hidden"
      data-testid="dv-maison-quote"
    >
      {/* Large kinetic background word */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ transform: `translate3d(${translate}%, 0, 0)` }}
        aria-hidden="true"
      >
        <span
          className="font-playfair italic text-[22vw] md:text-[16vw] leading-none font-light whitespace-nowrap"
          style={{
            color: 'transparent',
            WebkitTextStroke: '1px rgba(212,175,55,0.35)',
          }}
        >
          De Valeur · Maison · De Valeur ·
        </span>
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
              style={{ color: '#D4AF37' }}
            >
              “{quote.line2}”
            </span>
          </blockquote>

          <div className={`mt-10 inline-flex items-center dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-3`}>
            <span className="inline-block w-12 h-[1px] bg-black/40" />
            <span className="mx-3 text-[11px] uppercase tracking-[0.35em] text-black/60">
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
