import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';
import ProductCarousel from './ProductCarousel';

/**
 * RedCarpetSection — Omega "Red Carpet Ready" tipli ikinci tematik məhsul carousel-i.
 *  - Lüks / yüksək qiymətli məhsullardan seçim göstərir
 *  - Üstdə minimal başlıq, alt yazı yox (Omega kimi)
 *  - Cream/işıqlı arxa fon
 */
const RedCarpetSection: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await productService.getAll();
        // Lüks seçim: ən yüksək qiymətli 12 məhsul (qızılı/lüks hissi)
        const sorted = [...all].sort((a, b) => (b.price || 0) - (a.price || 0));
        setProducts(sorted.slice(0, 12));
      } catch (e) {
        console.error('Error loading red carpet products:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || products.length === 0) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const surtitle = lang === 'ru' ? 'ВЫБОР РЕДАКЦИИ' : lang === 'en' ? "EDITOR'S PICK" : 'REDAKSİYANIN SEÇİMİ';
  const title = lang === 'ru' ? 'Готовы к красной дорожке' : lang === 'en' ? 'Red carpet ready' : 'Qırmızı xalçaya hazır';
  const viewAll = lang === 'ru' ? 'Все' : lang === 'en' ? 'View all' : 'Hamısı';

  return (
    <section className="relative bg-white py-16 md:py-24" data-testid="dv-red-carpet">
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <motion.div
          className="flex items-end justify-between gap-6 mb-8 md:mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium">
                {surtitle}
              </p>
            </div>
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-[42px] lg:text-[52px] font-light text-black leading-[1.05] tracking-tight">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products')}
            className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group whitespace-nowrap pb-2"
            data-testid="redcarpet-view-all"
          >
            <span className="relative pb-1">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" strokeWidth={1.6} />
          </button>
        </motion.div>

        <ProductCarousel products={products} testIdPrefix="redcarpet" />
      </div>
    </section>
  );
};

export default RedCarpetSection;
