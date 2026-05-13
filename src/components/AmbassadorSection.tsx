import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';
import ProductCarousel from './ProductCarousel';

/**
 * AmbassadorSection — Omega "Aaron Taylor-Johnson wears a Moonwatch" tipli
 * editorial split + alt məhsul carousel.
 *
 *  - Sol: tam yüksəklikdə ambassador şəkli (parallax-sız, sadə)
 *  - Sağ: kiçik etiket + böyük Playfair başlıq + qısa təsvir + 3 məhsul mini-carousel
 *  - Arxa fon: dərin işıqlı krem; lüks editorial hiss
 */
const AmbassadorSection: React.FC = () => {
  const { i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await productService.getBestSellers(8);
        let list = data;
        if (!list || list.length === 0) {
          const all = await productService.getAll();
          list = all.slice(0, 8);
        }
        setProducts(list);
      } catch (e) {
        console.error('Error loading ambassador products:', e);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const eyebrow = lang === 'ru' ? 'АМБАССАДОР' : lang === 'en' ? 'AMBASSADOR' : 'BREND SİMASI';
  const title =
    lang === 'ru'
      ? 'Время носить\nсвой характер'
      : lang === 'en'
      ? 'Wear your\ncharacter'
      : 'Xarakterini\ngöstər';
  const body =
    lang === 'ru'
      ? 'Часы — больше, чем аксессуар. Это — отражение того, кем вы являетесь, и обещание того, кем вы становитесь. Каждое изделие в нашей коллекции — это история, которая ждёт своего автора.'
      : lang === 'en'
      ? 'A timepiece is more than an accessory. It is a reflection of who you are — and a promise of who you are becoming. Every piece in our collection is a story waiting for its author.'
      : 'Saat — yalnız aksesuar deyil. O, sizin kim olduğunuzun əksi və kim olacağınızın vədidir. Kolleksiyamızdakı hər əsər müəllifini gözləyən bir hekayədir.';
  const cta = lang === 'ru' ? 'Смотреть коллекцию' : lang === 'en' ? 'View collection' : 'Kolleksiyaya bax';

  return (
    <section className="relative bg-[#F4ECE0]" data-testid="dv-ambassador">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* IMAGE column */}
        <motion.div
          className="relative lg:col-span-6 min-h-[480px] md:min-h-[640px] overflow-hidden bg-[#0A0A0A]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src="https://images.unsplash.com/photo-1507081323647-4d250478b919?auto=format&fit=crop&w=1400&q=85"
            alt="Brand ambassador"
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

        {/* TEXT + MINI CAROUSEL column */}
        <div className="lg:col-span-6 px-6 sm:px-10 md:px-14 lg:px-16 py-14 md:py-20 lg:py-24 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-5 md:mb-7">
              <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
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
              to="/products"
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

          {/* Mini carousel of 3 picks */}
          {products.length > 0 && (
            <div className="mt-10 md:mt-14">
              <ProductCarousel products={products.slice(0, 6)} testIdPrefix="ambassador" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AmbassadorSection;
