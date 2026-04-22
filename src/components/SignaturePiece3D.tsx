import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { Product } from '../types';
import { useInView } from '../hooks/useInView';
import { getHomepageSections, HomepageSections, DEFAULT_HOMEPAGE_SECTIONS } from '../services/contentService';

const SignaturePiece3D: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { ref: sectionRef, inView } = useInView<HTMLElement>();
  const [product, setProduct] = useState<Product | null>(null);
  const [cfg, setCfg] = useState<HomepageSections['signature']>(DEFAULT_HOMEPAGE_SECTIONS.signature);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [rot, setRot] = useState({ rx: 0, ry: 0 });

  useEffect(() => {
    (async () => {
      try {
        const sections = await getHomepageSections();
        setCfg(sections.signature);

        let p: Product | null = null;
        if (sections.signature.featuredProductId) {
          try {
            p = await productService.getById(sections.signature.featuredProductId);
          } catch (e) {
            console.warn('Signature featured product missing, using fallback');
          }
        }
        if (!p) {
          const list = await productService.getBestSellers(6);
          if (list && list.length > 0) p = list[0];
        }
        setProduct(p);
      } catch (err) {
        console.error('SignaturePiece3D: load error', err);
      }
    })();
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRot({ rx: -y * 18, ry: x * 24 });
  };
  const handleLeave = () => setRot({ rx: 0, ry: 0 });

  if (!cfg.enabled || !product) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const get = (f: { az: string; ru: string; en: string }) => f[lang] || f.az || f.en;

  const getName = (p: Product): string => {
    if (typeof p.name === 'string') return p.name;
    return p.name[lang] || p.name.az || p.name.en || '';
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-32 overflow-hidden bg-white"
      data-testid="dv-signature-3d"
    >
      {/* Subtle gold glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* LEFT: text */}
          <div className={`order-2 md:order-1 dv-reveal ${inView ? 'is-in' : ''}`}>
            <div className="flex items-center mb-5">
              <span className="inline-block w-10 h-[1px] bg-[#D4AF37]" />
              <span className="ml-3 text-[10px] uppercase tracking-[0.4em] dv-shimmer font-semibold">
                {get(cfg.eyebrow)}
              </span>
            </div>
            <h2 className="font-playfair text-4xl md:text-6xl lg:text-7xl font-light text-black leading-[1.05] tracking-tight mb-5">
              {get(cfg.title)}
            </h2>
            <p className="text-black/60 text-base md:text-lg font-light leading-relaxed max-w-md mb-8">
              {get(cfg.subtitle)}
            </p>

            <div className="border-t border-black/10 pt-6">
              <p className="text-[10px] uppercase tracking-[0.35em] text-black/50 mb-2">
                {get(cfg.pickLabel)}
              </p>
              <h3 className="font-playfair text-2xl md:text-3xl font-medium text-black mb-1">
                {getName(product)}
              </h3>
              <p className="text-black text-lg font-light mb-6">
                <span className="font-medium">{product.price?.toFixed(2)}</span>
                <span className="ml-1 text-black/60">₼</span>
              </p>

              <button
                onClick={() => navigate(`/product/${product.id}`)}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-black hover:bg-[#C99B1F] text-white transition-all duration-500 rounded-full text-xs uppercase tracking-[0.3em] font-medium"
                data-testid="dv-signature-cta"
              >
                <span>{get(cfg.ctaLabel)}</span>
                <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>

          {/* RIGHT: 3D stage */}
          <div
            ref={stageRef}
            className={`order-1 md:order-2 relative aspect-square max-w-[520px] mx-auto w-full dv-reveal ${inView ? 'is-in' : ''} dv-reveal-delay-2`}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            style={{ perspective: '1200px' }}
          >
            {/* Soft shadow beneath */}
            <div
              className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[60%] h-8 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(0,0,0,0.18), transparent 70%)',
                filter: 'blur(8px)',
              }}
              aria-hidden="true"
            />

            <div
              className="absolute inset-[18%] flex items-center justify-center"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rot.rx}deg) rotateY(${rot.ry}deg) translateZ(60px)`,
                transition: 'transform 400ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <div className="w-full h-full" style={{ animation: 'dv-float-y 6s ease-in-out infinite alternate' }}>
                <img
                  src={product.images?.[0] || product.imageUrl}
                  alt={getName(product)}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                  style={{
                    filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.28))',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignaturePiece3D;
