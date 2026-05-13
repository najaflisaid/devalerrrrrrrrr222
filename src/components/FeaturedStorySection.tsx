import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { getHomepageSections, HomepageSections } from '../services/contentService';

/**
 * FeaturedStorySection — Editorial half-half story bölmə (Omega "Aqua Terra in Black" tipli).
 * Admin tab-dan idarə olunur (eyebrow, title, body, image, CTA, link, enabled).
 */
const FeaturedStorySection: React.FC = () => {
  const { i18n } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<HomepageSections['featuredStory'] | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sec = await getHomepageSections();
        if (sec.featuredStory) setData(sec.featuredStory);
      } catch (e) {
        console.error('FeaturedStory load error:', e);
      }
    })();
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.04, 1.0]);
  const textY = useTransform(scrollYProgress, [0, 1], ['8%', '-4%']);

  if (!data || data.enabled === false) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const surtitle = data.eyebrow[lang] || data.eyebrow.az;
  const title = data.title[lang] || data.title.az;
  const body = data.body[lang] || data.body.az;
  const cta = data.ctaLabel[lang] || data.ctaLabel.az;
  const link = data.ctaLink || '/products';
  const imageUrl =
    data.imageUrl ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=85';

  const handleLink = (e: React.MouseEvent) => {
    if (!/^https?:\/\//.test(link)) return; // let React Router handle internal
    e.preventDefault();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <section ref={ref} className="relative bg-white" data-testid="dv-featured-story">
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:min-h-[720px]">
        {/* IMAGE column — desktop-da SAĞDA (lg:order-2), mobil-də üstdə qalır */}
        <div className="relative overflow-hidden bg-white aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto lg:h-auto lg:bg-[#0A0A0A] lg:order-2">
          <motion.div
            className="absolute inset-0"
            style={isMobile ? undefined : { y: imgY, scale: imgScale }}
            transition={{ type: 'tween' }}
          >
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </motion.div>
          <div
            className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-black/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* TEXT column — desktop-da SOLDA (lg:order-1) */}
        <motion.div
          className="flex items-center bg-white lg:order-1"
          style={isMobile ? undefined : { y: textY }}
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="px-5 sm:px-10 md:px-14 lg:px-20 py-10 sm:py-14 md:py-20 lg:py-24 max-w-[620px] w-full">
            <motion.div
              className="flex items-center gap-3 mb-4 md:mb-7"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="h-px w-7 md:w-12 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] tracking-[0.32em] md:tracking-[0.36em] uppercase text-[#C9A961] font-medium">
                {surtitle}
              </p>
            </motion.div>

            <motion.h2
              className="font-playfair text-[26px] sm:text-[38px] md:text-[56px] lg:text-[68px] font-light text-black leading-[1.05] tracking-tight whitespace-pre-line"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {title}
            </motion.h2>

            <motion.p
              className="mt-4 sm:mt-6 md:mt-9 text-[13px] sm:text-sm md:text-base lg:text-[17px] text-black/65 leading-[1.7] md:leading-[1.75] max-w-[520px]"
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
              <a
                href={link}
                onClick={handleLink}
                className="group mt-7 md:mt-12 inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.28em] md:tracking-[0.32em] font-medium text-black"
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
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedStorySection;
