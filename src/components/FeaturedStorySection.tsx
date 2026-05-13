import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * FeaturedStorySection — Editorial half-half story bölmə (Omega "Aqua Terra in Black" tipli).
 *  - Scroll-linked parallax: şəkil scroll edildikcə yumşaq yuxarı sürüşür və zoom-in olur
 *  - Mətn sağdan slide-in olur, sonra translate-y reduces (yumşaq qalxma)
 *  - Framer Motion useScroll + useTransform ilə yağ kimi axıcı keçidlər
 */
const FeaturedStorySection: React.FC = () => {
  const { i18n } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Şəkil parallax: bölmə görünməyə başlayanda y:60 → bitəndə y:-60
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.04, 1.0]);
  // Mətn yavaş parallax: əksinə yuxarı
  const textY = useTransform(scrollYProgress, [0, 1], ['8%', '-4%']);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const surtitle =
    lang === 'ru' ? 'ИСТОРИЯ КОЛЛЕКЦИИ' : lang === 'en' ? 'A COLLECTION STORY' : 'KOLLEKSİYA HEKAYƏSİ';
  const title =
    lang === 'ru'
      ? 'Время, рождённое\nв мастерских'
      : lang === 'en'
      ? 'Time, born\nin the ateliers'
      : 'Atelyelərdə doğulan\nzaman';
  const body =
    lang === 'ru'
      ? 'Каждая деталь нашей коллекции — это диалог между традицией и современностью. От швейцарских мануфактур до искусной ручной отделки, каждое изделие создаётся, чтобы прожить с вами поколение.'
      : lang === 'en'
      ? 'Every detail of our collection is a dialogue between tradition and modernity. From Swiss manufactures to artisanal hand-finishing, each piece is crafted to live with you for a generation.'
      : 'Kolleksiyamızın hər detalı ənənə və müasirlik arasında bir dialoqdur. İsveçrə manufakturalarından mahir əl bəzəyinə qədər — hər əsər sizinlə bir nəsil boyu yaşamaq üçün yaradılır.';
  const cta =
    lang === 'ru' ? 'Открыть коллекцию' : lang === 'en' ? 'Discover the collection' : 'Kolleksiyaya bax';

  return (
    <section
      ref={ref}
      className="relative bg-white"
      data-testid="dv-featured-story"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[560px] md:min-h-[720px]">
        {/* IMAGE column — parallax + zoom */}
        <div className="relative overflow-hidden bg-[#0A0A0A]">
          <motion.div
            className="absolute inset-0"
            style={{ y: imgY, scale: imgScale }}
            transition={{ type: 'tween' }}
          >
            <img
              src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=85"
              alt="Luxury timepiece"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </motion.div>
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* TEXT column */}
        <motion.div
          className="flex items-center bg-white"
          style={{ y: textY }}
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="px-6 sm:px-10 md:px-14 lg:px-20 py-16 md:py-24 max-w-[620px]">
            <motion.div
              className="flex items-center gap-3 mb-5 md:mb-7"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] tracking-[0.36em] uppercase text-[#C9A961] font-medium">
                {surtitle}
              </p>
            </motion.div>

            <motion.h2
              className="font-playfair text-[34px] sm:text-[42px] md:text-[56px] lg:text-[68px] font-light text-black leading-[1.0] tracking-tight whitespace-pre-line"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {title}
            </motion.h2>

            <motion.p
              className="mt-6 md:mt-9 text-sm md:text-base lg:text-[17px] text-black/65 leading-[1.75] max-w-[520px]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 1.0, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {body}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to="/products"
                className="group mt-9 md:mt-12 inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.32em] font-medium text-black"
                data-testid="featured-story-cta"
              >
                <span className="relative pb-1.5">
                  {cta}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 bottom-0 h-px w-full bg-black origin-left transition-transform duration-500"
                  />
                </span>
                <ArrowRight
                  className="w-4 h-4 md:w-[18px] md:h-[18px] transition-transform duration-500 group-hover:translate-x-1.5"
                  strokeWidth={1.4}
                />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedStorySection;
