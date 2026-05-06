import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { productService } from '../services/productService';
import { toBrandSlug } from '../utils/brandSlug';
import { useInView } from '../hooks/useInView';
import type { Product } from '../types';

interface BrandStat {
  name: string;
  count: number;
}

const BrandShowcase: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { ref, inView } = useInView<HTMLElement>();
  const [brands, setBrands] = useState<BrandStat[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const products: Product[] = await productService.getAll();
        const counts = new Map<string, number>();
        products.forEach((p) => {
          if (p.brand) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
        });
        const list = Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        setBrands(list);
      } catch (e) {
        console.error('BrandShowcase load error:', e);
      }
    })();
  }, []);

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const copy = {
    eyebrow: { az: 'Premium kolleksiya', ru: 'Премиум коллекция', en: 'Premium collection' },
    title: { az: 'Dünya brendləri', ru: 'Мировые бренды', en: 'World-class brands' },
    subtitle: {
      az: 'Hər saatın arxasında bir hekayə var. Seçdiyimiz brendlər dünyanın aparıcı saat ustaları tərəfindən yaradılır.',
      ru: 'За каждыми часами стоит история. Бренды, которые мы выбираем, создаются ведущими часовыми мастерами мира.',
      en: 'Behind every timepiece, a story. Our curated brands are crafted by the world\'s leading horologists.',
    },
    cta: { az: 'Bütün brendləri kəşf et', ru: 'Открыть все бренды', en: 'Discover all brands' },
  };

  if (brands.length === 0) return null;

  return (
    <section
      ref={ref}
      className="relative py-12 md:py-20 bg-white overflow-hidden"
      data-testid="dv-brand-showcase"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className={`text-center mb-8 md:mb-14 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-3">
            <span className="inline-block w-6 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="mx-2.5 text-[10px] sm:text-xs uppercase tracking-[0.32em] dv-shimmer font-semibold whitespace-nowrap">
              {copy.eyebrow[lang]}
            </span>
            <span className="inline-block w-6 h-[1px]" style={{ background: '#D4AF37' }} />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-black tracking-tight leading-[1.05] mb-4 md:mb-5">
            {copy.title[lang]}
          </h2>
          <p className="text-black/55 text-sm md:text-base font-light leading-relaxed max-w-xl mx-auto px-2">
            {copy.subtitle[lang]}
          </p>
        </div>

        {/* Brand grid — minimalist typographic */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 md:gap-y-14 gap-x-6">
          {brands.map((b, idx) => (
            <button
              key={b.name}
              onClick={() => navigate(`/brand/${toBrandSlug(b.name)}`)}
              className={`group relative flex flex-col items-center justify-center py-2 transition-opacity duration-500 hover:opacity-100 md:opacity-70 dv-reveal ${inView ? 'is-in' : ''}`}
              style={{ transitionDelay: `${80 + idx * 40}ms` }}
              data-testid={`dv-brand-card-${b.name}`}
            >
              <span className="font-playfair text-base sm:text-lg md:text-xl font-light tracking-wide text-black text-center leading-tight">
                {b.name}
              </span>
              <span
                aria-hidden="true"
                className="mt-2 block h-px w-4 bg-black/15 group-hover:w-10 group-hover:bg-[#D4AF37] transition-[width,background-color] duration-500"
              />
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className={`mt-8 md:mt-12 text-center dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-5`}>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-3 sm:py-3.5 border border-black bg-white hover:bg-black hover:text-white text-[10px] sm:text-[11px] uppercase tracking-[0.3em] font-medium text-black transition-all duration-500 group"
            data-testid="dv-brand-showcase-cta"
          >
            <span>{copy.cta[lang]}</span>
            <span className="transition-transform duration-500 group-hover:translate-x-1.5 text-base leading-none">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default BrandShowcase;
