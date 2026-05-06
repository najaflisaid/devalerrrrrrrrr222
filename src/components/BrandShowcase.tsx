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
    items: { az: 'model', ru: 'моделей', en: 'pieces' },
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

        {/* Brand grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/8 border border-black/8">
          {brands.map((b, idx) => (
            <button
              key={b.name}
              onClick={() => navigate(`/brand/${toBrandSlug(b.name)}`)}
              className={`dv-brand-card group relative bg-white aspect-square sm:aspect-[4/3] md:aspect-square flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-500 hover:bg-black overflow-hidden dv-reveal ${inView ? 'is-in' : ''}`}
              style={{ transitionDelay: `${80 + idx * 50}ms` }}
              data-testid={`dv-brand-card-${b.name}`}
            >
              {/* Subtle gold corner accent */}
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 w-0 h-[1px] bg-[#D4AF37] group-hover:w-full transition-[width] duration-700 ease-out"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 w-0 h-[1px] bg-[#D4AF37] group-hover:w-full transition-[width] duration-700 ease-out"
              />

              {/* Brand name */}
              <span className="font-playfair text-base sm:text-xl md:text-2xl lg:text-3xl font-light tracking-tight text-black group-hover:text-white transition-colors duration-500 text-center leading-tight">
                {b.name}
              </span>

              {/* Count badge */}
              <span className="mt-2 sm:mt-3 text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-black/40 group-hover:text-[#D4AF37] transition-colors duration-500 font-mono">
                {b.count} {copy.items[lang]}
              </span>

              {/* Arrow reveal on hover */}
              <span
                aria-hidden="true"
                className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 text-base sm:text-lg text-white opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500"
              >
                →
              </span>
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
