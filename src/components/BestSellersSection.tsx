import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';
import ProductCarousel from './ProductCarousel';

/**
 * BestSellersSection — Omega "Best Sellers" tipli horizontal məhsul carousel-i.
 *  - Üstdə incə editorial başlıq
 *  - Sağda "Hamısı" CTA (Omega-da prev/next + view all)
 *  - Aşağıda ProductCarousel (snap-x scroll + ox düymələri)
 */
const BestSellersSection: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await productService.getBestSellers(12);
        if (data && data.length > 0) {
          setProducts(data);
        } else {
          const all = await productService.getAll();
          setProducts(all.slice(0, 12));
        }
      } catch (e) {
        console.error('Error loading best sellers:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || products.length === 0) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const surtitle = lang === 'ru' ? 'БЕСТСЕЛЛЕРЫ' : 'BEST SELLERS';
  const title = lang === 'ru' ? 'Лучшие выборы' : lang === 'en' ? 'Best sellers' : 'Ən çox seçilənlər';
  const viewAll = lang === 'ru' ? 'Все' : lang === 'en' ? 'View all' : 'Hamısı';

  return (
    <section className="relative bg-[#FAF9F7] py-16 md:py-24" data-testid="dv-bestsellers">
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <motion.div
          className="flex items-end justify-between gap-6 mb-8 md:mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <div className="mb-3 md:mb-4">
              <p
                className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium"
                data-testid="bestsellers-eyebrow"
              >
                {surtitle}
              </p>
            </div>
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-[42px] lg:text-[52px] font-light text-black leading-[1.05] tracking-tight">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products?sort=bestsellers')}
            className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group whitespace-nowrap pb-2"
            data-testid="bestsellers-view-all-btn"
          >
            <span className="relative pb-1">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </button>
        </motion.div>

        <ProductCarousel products={products} testIdPrefix="bestsellers" variant="minimal" />
      </div>
    </section>
  );
};

export default BestSellersSection;
