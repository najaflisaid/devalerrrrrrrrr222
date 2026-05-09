import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { productService } from '../services/productService';
import { toBrandSlug } from '../utils/brandSlug';
import { useInView } from '../hooks/useInView';
import { getHomepageSections, DEFAULT_HOMEPAGE_SECTIONS } from '../services/contentService';
import type { Product } from '../types';

interface BrandTile {
  name: string;
  logo: string | null;
  cover: string | null;
}

const BrandShowcase: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { ref, inView } = useInView<HTMLElement>();
  const [tiles, setTiles] = useState<BrandTile[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const [products, sections, brandsSnap] = await Promise.all([
          productService.getAll(),
          getHomepageSections(),
          getDocs(collection(db, 'brands')),
        ]);
        setEnabled(sections.brandShowcase?.enabled ?? true);

        // Brand metadata from Firestore /brands collection (logo + name)
        const brandMeta = new Map<string, { logo: string | null }>();
        brandsSnap.forEach((d) => {
          const data: any = d.data();
          if (data?.name) brandMeta.set(String(data.name), { logo: data.logo || null });
        });

        // Pick a representative product image per brand (first image of any product
        // that has the brand) — used as the cover for the tile when no logo is set.
        const brandCover = new Map<string, string>();
        (products as Product[]).forEach((p) => {
          if (p.brand && !brandCover.has(p.brand) && p.images && p.images[0]) {
            brandCover.set(p.brand, p.images[0]);
          }
        });

        const allBrands = Array.from(
          new Set((products as Product[]).map((p) => p.brand).filter(Boolean) as string[])
        );

        const selected = sections.brandShowcase?.selectedBrands || DEFAULT_HOMEPAGE_SECTIONS.brandShowcase.selectedBrands;
        const max = sections.brandShowcase?.maxBrands ?? DEFAULT_HOMEPAGE_SECTIONS.brandShowcase.maxBrands;

        let names: string[] = [];
        if (selected.length > 0) {
          names = selected.filter((b) => allBrands.includes(b));
        } else {
          const counts = new Map<string, number>();
          (products as Product[]).forEach((p) => {
            if (p.brand) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
          });
          names = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, max)
            .map(([name]) => name);
        }

        const list: BrandTile[] = names.slice(0, max).map((name) => ({
          name,
          logo: brandMeta.get(name)?.logo || null,
          cover: brandCover.get(name) || null,
        }));
        setTiles(list);
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

  if (!enabled || tiles.length === 0) return null;

  return (
    <section
      ref={ref}
      className="relative py-16 md:py-24 overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% 0%, #faf5ec 0%, #f6efde 35%, #f1e7d0 70%, #ebdfc1 100%)',
      }}
      data-testid="dv-brand-showcase"
    >
      {/* Decorative ornamental lines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(184, 145, 76, 0.4) 50%, transparent)' }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(184, 145, 76, 0.3) 50%, transparent)' }} aria-hidden="true" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className={`text-center mb-10 md:mb-16 dv-reveal ${inView ? 'is-in' : ''}`}>
          <div className="inline-flex items-center mb-4">
            <span className="inline-block w-8 h-[1px]" style={{ background: '#b8914c' }} />
            <span className="mx-3 text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-semibold whitespace-nowrap" style={{ color: '#8c6c34', letterSpacing: '0.4em' }}>
              {copy.eyebrow[lang]}
            </span>
            <span className="inline-block w-8 h-[1px]" style={{ background: '#b8914c' }} />
          </div>
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-5" style={{ color: '#2a1f10' }}>
            {copy.title[lang]}
          </h2>
          <p className="text-sm md:text-base font-light leading-relaxed max-w-xl mx-auto px-2" style={{ color: '#5c4a2c' }}>
            {copy.subtitle[lang]}
          </p>
        </div>

        {/* Brand grid — image-driven cards with slow zoom + warm gold theme */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {tiles.map((b, idx) => {
            const img = b.logo || b.cover;
            return (
              <button
                key={b.name}
                onClick={() => navigate(`/brand/${toBrandSlug(b.name)}`)}
                className={`dv-brand-card group relative overflow-hidden rounded-sm aspect-[4/5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8914c] ${inView ? 'dv-brand-in' : ''}`}
                style={{
                  animationDelay: `${120 + idx * 90}ms`,
                  background: 'linear-gradient(180deg, #fffaf0 0%, #f3e8d0 100%)',
                  boxShadow: '0 1px 0 rgba(184, 145, 76, 0.15), 0 8px 24px -16px rgba(60, 40, 12, 0.18)',
                }}
                data-testid={`dv-brand-card-${b.name}`}
              >
                {/* Image (or placeholder) — slow zoom on hover */}
                {img ? (
                  <img
                    src={img}
                    alt={b.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1500ms] ease-[cubic-bezier(0.2,0.6,0.2,1)] group-hover:scale-110"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-playfair text-2xl md:text-3xl font-light tracking-[0.2em] uppercase" style={{ color: '#8c6c34' }}>
                      {b.name.charAt(0)}
                    </span>
                  </div>
                )}

                {/* Always-on subtle warm tint to unify mismatched product photos */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,250,240,0) 35%, rgba(60, 40, 12, 0.55) 100%)' }} />

                {/* Hover wash — warm champagne overlay grows in */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: 'linear-gradient(180deg, rgba(184, 145, 76, 0.18) 0%, rgba(80, 50, 18, 0.65) 100%)' }}
                />

                {/* Brand name */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 z-[2] text-left">
                  <span aria-hidden="true" className="block w-6 h-[1.5px] mb-2 transition-all duration-700 group-hover:w-12" style={{ background: '#e8c98a' }} />
                  <h3
                    className="font-playfair text-base sm:text-lg md:text-xl text-white font-light tracking-[0.04em] leading-tight"
                    style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                  >
                    {b.name}
                  </h3>
                  <span
                    className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.28em] text-white/0 group-hover:text-white/85 transition-colors duration-500"
                  >
                    Kəşf et
                    <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1">→</span>
                  </span>
                </div>

                {/* Inner gold border accent */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-2 border border-[#e8c98a]/0 group-hover:border-[#e8c98a]/55 transition-colors duration-700" />
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className={`mt-12 md:mt-16 text-center dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-5`}>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center justify-center gap-3 px-7 sm:px-9 py-3 sm:py-3.5 border text-[10px] sm:text-[11px] uppercase tracking-[0.32em] font-medium transition-all duration-500 group"
            style={{
              color: '#2a1f10',
              borderColor: '#8c6c34',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2a1f10';
              e.currentTarget.style.color = '#e8c98a';
              e.currentTarget.style.borderColor = '#2a1f10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#2a1f10';
              e.currentTarget.style.borderColor = '#8c6c34';
            }}
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
