import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getHomepageSections, HomepageSections } from '../services/contentService';

/**
 * GiftFinderSection — Omega "Find the perfect gift" tipli mərkəzi kart.
 * Admin tab-dan idarə olunur (eyebrow, title, body, CTA, link, enabled).
 */
const GiftFinderSection: React.FC = () => {
  const { i18n } = useTranslation();
  const [data, setData] = useState<HomepageSections['giftFinder'] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sec = await getHomepageSections();
        if (sec.giftFinder) setData(sec.giftFinder);
      } catch (e) {
        console.error('GiftFinder load error:', e);
      }
    })();
  }, []);

  if (!data || data.enabled === false) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const eyebrow = data.eyebrow[lang] || data.eyebrow.az;
  const title = data.title[lang] || data.title.az;
  const body = data.body[lang] || data.body.az;
  const cta = data.ctaLabel[lang] || data.ctaLabel.az;
  const link = data.ctaLink || '/gift-cards';

  return (
    <section
      className="relative bg-white py-20 md:py-28 overflow-hidden"
      data-testid="dv-gift-finder"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #C9A961 0%, transparent 70%)' }}
      />

      <motion.div
        className="relative max-w-3xl mx-auto px-6 text-center"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="relative mx-auto w-[180px] h-[180px] md:w-[220px] md:h-[220px] mb-8 md:mb-12"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 border border-[#C9A961]/40"
          />
          <span
            aria-hidden="true"
            className="absolute inset-6 border border-[#C9A961]/30"
          />
          <span
            aria-hidden="true"
            className="absolute inset-10"
            style={{
              background:
                'radial-gradient(circle, rgba(201,169,97,0.22) 0%, rgba(201,169,97,0.05) 60%, transparent 100%)',
            }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[#C9A961]">
            <Gift className="w-10 h-10 md:w-14 md:h-14" strokeWidth={1.1} />
          </span>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute w-1.5 h-1.5 bg-[#C9A961]/60"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-92px)`,
              }}
            />
          ))}
        </motion.div>

        <div className="flex items-center justify-center mb-4 md:mb-6">
          <p className="text-[10px] md:text-[11px] tracking-[0.36em] uppercase text-[#C9A961] font-medium">
            {eyebrow}
          </p>
        </div>

        <h2 className="font-playfair text-3xl sm:text-4xl md:text-[52px] font-light text-black leading-[1.05] tracking-tight whitespace-pre-line">
          {title}
        </h2>

        <p className="mt-5 md:mt-7 text-sm md:text-base text-black/60 leading-relaxed max-w-xl mx-auto">
          {body}
        </p>

        <Link
          to={link}
          className="group mt-9 md:mt-12 inline-flex items-center gap-3 px-8 md:px-10 py-3.5 md:py-4 border border-black text-black hover:bg-black hover:text-white transition-colors duration-500 text-[11px] md:text-[12px] uppercase tracking-[0.28em] font-medium"
          data-testid="gift-finder-cta"
        >
          <span>{cta}</span>
          <ArrowRight
            className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-500 group-hover:translate-x-1.5"
            strokeWidth={1.6}
          />
        </Link>
      </motion.div>
    </section>
  );
};

export default GiftFinderSection;
