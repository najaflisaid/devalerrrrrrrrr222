import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * GiftFinderSection — Omega "Find the perfect gift" tipli mərkəzi tip kart.
 *  - Dairəvi gradient illüstrasiya + ikon (mərkəzi)
 *  - Üstdə kiçik eyebrow, böyük başlıq, qısa təsvir, CTA
 *  - Cream lüks fon
 */
const GiftFinderSection: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const eyebrow = lang === 'ru' ? 'ПОДБОР ПОДАРКА' : lang === 'en' ? 'GIFT FINDER' : 'HƏDİYYƏ TAPICI';
  const title =
    lang === 'ru' ? 'Найдите идеальный подарок' : lang === 'en' ? 'Find the perfect gift' : 'Mükəmməl hədiyyəni tapın';
  const body =
    lang === 'ru'
      ? 'Если вы знаете, для кого и зачем — наш помощник подберёт идеальный подарок за несколько кликов.'
      : lang === 'en'
      ? "If you know who you're buying for and why, our Gift Finder will help you find the perfect present in just a few clicks."
      : 'Kimə və niyə hədiyyə axtardığınızı bilirsinizsə, bir neçə kliklə ideal hədiyyəni tapmaqda kömək edəcəyik.';
  const cta = lang === 'ru' ? 'Подобрать подарок' : lang === 'en' ? 'Find your gift' : 'Hədiyyəni tap';

  return (
    <section
      className="relative bg-white py-20 md:py-28 overflow-hidden"
      data-testid="dv-gift-finder"
    >
      {/* Ambient warm orbs */}
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
        {/* Circular illustration */}
        <motion.div
          className="relative mx-auto w-[180px] h-[180px] md:w-[220px] md:h-[220px] mb-8 md:mb-12"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Outer ring */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[#C9A961]/40"
            style={{ animation: 'dv-spin-slow 32s linear infinite' }}
          />
          {/* Inner ring */}
          <span
            aria-hidden="true"
            className="absolute inset-6 rounded-full border border-[#C9A961]/30"
          />
          {/* Center gradient disc */}
          <span
            aria-hidden="true"
            className="absolute inset-10 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(201,169,97,0.22) 0%, rgba(201,169,97,0.05) 60%, transparent 100%)',
            }}
          />
          {/* Gift icon */}
          <span className="absolute inset-0 flex items-center justify-center text-[#C9A961]">
            <Gift className="w-10 h-10 md:w-14 md:h-14" strokeWidth={1.1} />
          </span>
          {/* Subtle dot accents around the ring */}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute w-1.5 h-1.5 rounded-full bg-[#C9A961]/60"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-92px)`,
              }}
            />
          ))}
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-4 md:mb-6">
          <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
          <p className="text-[10px] md:text-[11px] tracking-[0.36em] uppercase text-[#C9A961] font-medium">
            {eyebrow}
          </p>
          <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
        </div>

        <h2 className="font-playfair text-3xl sm:text-4xl md:text-[52px] font-light text-black leading-[1.05] tracking-tight">
          {title}
        </h2>

        <p className="mt-5 md:mt-7 text-sm md:text-base text-black/60 leading-relaxed max-w-xl mx-auto">
          {body}
        </p>

        <Link
          to="/gift-cards"
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
