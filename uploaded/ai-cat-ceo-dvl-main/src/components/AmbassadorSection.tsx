import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';
import { getHomepageSections, HomepageSections } from '../services/contentService';
import ProductCarousel from './ProductCarousel';

/**
 * AmbassadorSection — Omega tipli editorial split + mini product carousel.
 * Admin tab-dan idarə olunur (eyebrow, title, body, image, CTA, link,
 * productIds (manual seçim), enabled).
 */
const AmbassadorSection: React.FC = () => {
  const { i18n } = useTranslation();
  const [data, setData] = useState<HomepageSections['ambassador'] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [sec, all] = await Promise.all([getHomepageSections(), productService.getAll()]);
        if (sec.ambassador) {
          setData(sec.ambassador);
          const ids = sec.ambassador.productIds || [];
          if (ids.length > 0) {
            // Admin-selected products, sıra seçim sırası ilə
            const byId = new Map(all.map((p) => [p.id, p]));
            setProducts(ids.map((id) => byId.get(id)).filter(Boolean) as Product[]);
          } else {
            // Fallback: bestsellers
            const bs = await productService.getBestSellers(8);
            setProducts(bs && bs.length > 0 ? bs : all.slice(0, 6));
          }
        }
      } catch (e) {
        console.error('Ambassador load error:', e);
      }
    })();
  }, []);

  if (!data || data.enabled === false) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const eyebrow = data.eyebrow[lang] || data.eyebrow.az;
  const title = data.title[lang] || data.title.az;
  const body = data.body[lang] || data.body.az;
  const cta = data.ctaLabel[lang] || data.ctaLabel.az;
  const link = data.ctaLink || '/products';
  const imageUrl =
    data.imageUrl ||
    'https://images.unsplash.com/photo-1507081323647-4d250478b919?auto=format&fit=crop&w=1400&q=85';

  return (
    <section className="relative bg-white" data-testid="dv-ambassador">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <motion.div
          className="relative lg:col-span-6 min-h-[480px] md:min-h-[640px] overflow-hidden bg-[#0A0A0A]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 2.0, ease: 'linear' }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </motion.div>

        <div className="lg:col-span-6 px-6 sm:px-10 md:px-14 lg:px-16 py-14 md:py-20 lg:py-24 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-5 md:mb-7">
              <p className="text-[10px] md:text-[11px] tracking-[0.36em] uppercase text-[#C9A961] font-medium">
                {eyebrow}
              </p>
            </div>
            <h2 className="font-playfair text-[34px] sm:text-[42px] md:text-[56px] lg:text-[64px] font-light text-black leading-[1.0] tracking-tight whitespace-pre-line">
              {title}
            </h2>
            <p className="mt-5 md:mt-7 text-sm md:text-base text-black/65 leading-[1.75] max-w-[520px]">
              {body}
            </p>
            <Link
              to={link}
              className="group mt-7 md:mt-9 inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.32em] font-medium text-black"
              data-testid="ambassador-cta"
            >
              <span className="relative pb-1.5">
                {cta}
                <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black origin-left transition-transform duration-500" />
              </span>
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" strokeWidth={1.4} />
            </Link>
          </motion.div>

          {products.length > 0 && (
            <div className="mt-10 md:mt-14">
              <ProductCarousel
                products={products.slice(0, 6)}
                testIdPrefix="ambassador"
                variant="minimal"
                cardBasis="basis-[36%] sm:basis-[48%] md:basis-[36%] lg:basis-[32%]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AmbassadorSection;
