import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from '../hooks/useInView';

interface Stat {
  value: number;
  suffix?: string;
  prefix?: string;
  format?: 'plain' | 'comma';
  label: { az: string; ru: string; en: string };
}

const STATS: Stat[] = [
  { value: 2010, format: 'plain', label: { az: 'Təsis olundu', ru: 'Год основания', en: 'Founded' } },
  { value: 12, suffix: '+', format: 'comma', label: { az: 'Premium brend', ru: 'Премиум брендов', en: 'Premium brands' } },
  { value: 10000, suffix: '+', format: 'comma', label: { az: 'Məmnun müştəri', ru: 'Довольных клиентов', en: 'Happy clients' } },
  { value: 99, suffix: '%', format: 'comma', label: { az: 'Orijinallıq zəmanəti', ru: 'Гарантия подлинности', en: 'Authenticity' } },
];

// Count-up hook
function useCountUp(end: number, start = 0, duration = 2000, active = false) {
  const [v, setV] = useState(start);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const startTs = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(start + (end - start) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, end, start, duration]);
  return v;
}

const StatItem: React.FC<{ stat: Stat; active: boolean; lang: 'az' | 'ru' | 'en' }> = ({ stat, active, lang }) => {
  const value = useCountUp(stat.value, 0, 2000, active);
  const displayValue = stat.format === 'plain' ? String(value) : value.toLocaleString();
  return (
    <div className="text-center px-2" data-testid="dv-stat-item">
      <div className="font-playfair text-3xl sm:text-5xl md:text-6xl font-light text-black tracking-tight leading-none">
        {stat.prefix || ''}
        {displayValue}
        {stat.suffix || ''}
      </div>
      <div className="mt-2 flex items-center justify-center">
        <span className="inline-block w-5 h-[1px] bg-[#D4AF37]" />
      </div>
      <p className="mt-3 text-[11px] sm:text-xs uppercase tracking-[0.3em] text-black/60 font-medium">
        {stat.label[lang] || stat.label.en}
      </p>
    </div>
  );
};

const StatsBand: React.FC = () => {
  const { i18n } = useTranslation();
  const { ref, inView } = useInView<HTMLDivElement>();
  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  return (
    <section
      ref={ref}
      className="relative py-16 md:py-24 bg-white overflow-hidden border-y border-black/5"
      data-testid="dv-stats"
    >
      {/* Thin top + bottom gold accent */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-2/3"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-2/3"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)' }}
        aria-hidden="true"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-10 md:mb-14 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-3">
            <span className="inline-block w-8 h-[1px] bg-[#D4AF37]" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.4em] dv-shimmer font-semibold">
              En Chiffres
            </span>
            <span className="inline-block w-8 h-[1px] bg-[#D4AF37]" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className={`dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-${i + 1}`}
            >
              <StatItem stat={stat} active={inView} lang={lang} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsBand;
