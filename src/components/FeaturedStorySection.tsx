import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * FeaturedStorySection — Lüks brendlərin (Omega "Aqua Terra in Black", Cartier "Panthère")
 * istifadə etdiyi editorial half-half split bölmə.
 * Sol tərəfdə tam yüksəklikdə şəkil, sağ tərəfdə eyebrow + başlıq + abzas + CTA.
 *
 * Şəkil sabit — admin sonradan dəyişdirə bilər. Hələlik kuratorlanmış görünüş.
 */
const FeaturedStorySection: React.FC = () => {
  const { i18n } = useTranslation();
  const imgReveal = useReveal<HTMLDivElement>();
  const txtReveal = useReveal<HTMLDivElement>();

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const surtitle =
    lang === 'ru' ? 'ИСТОРИЯ КОЛЛЕКЦИИ' : lang === 'en' ? 'A COLLECTION STORY' : 'KOLLEKSİYA HEKAYƏSİ';
  const title =
    lang === 'ru'
      ? 'Время, рождённое в мастерских'
      : lang === 'en'
      ? 'Time, born in the ateliers'
      : 'Atelyelərdə doğulan zaman';
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
      className="relative bg-white"
      data-testid="dv-featured-story"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[480px] md:min-h-[640px]">
        {/* IMAGE column */}
        <div
          ref={imgReveal.ref}
          className={`relative overflow-hidden bg-[#0F0F0F] dv-scroll-reveal dv-scroll-fade ${
            imgReveal.revealed ? 'dv-scroll-in' : ''
          }`}
          style={{ transitionDuration: '1400ms' }}
        >
          <img
            src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80"
            alt="Luxury timepiece on dark fabric"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1800ms] ease-out hover:scale-[1.04]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* TEXT column */}
        <div
          ref={txtReveal.ref}
          className={`flex items-center bg-white dv-scroll-reveal dv-scroll-right ${
            txtReveal.revealed ? 'dv-scroll-in' : ''
          }`}
          style={{ transitionDelay: '120ms' }}
        >
          <div className="px-6 sm:px-10 md:px-14 lg:px-20 py-14 md:py-20 max-w-[600px]">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium">
                {surtitle}
              </p>
            </div>
            <h2 className="font-playfair text-[28px] sm:text-[34px] md:text-[44px] lg:text-[56px] font-light text-black leading-[1.05] tracking-tight">
              {title}
            </h2>
            <p className="mt-5 md:mt-7 text-sm md:text-base lg:text-[17px] text-black/65 leading-[1.7]">
              {body}
            </p>
            <Link
              to="/products"
              className="group mt-8 md:mt-10 inline-flex items-center gap-3 text-[11px] md:text-[12px] uppercase tracking-[0.28em] font-medium text-black"
              data-testid="featured-story-cta"
            >
              <span className="relative pb-1">
                {cta}
                <span
                  aria-hidden="true"
                  className="absolute left-0 bottom-0 h-px w-full bg-black origin-left transition-transform duration-500"
                />
              </span>
              <ArrowRight
                className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5"
                strokeWidth={1.6}
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedStorySection;
