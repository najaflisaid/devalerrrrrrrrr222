import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBanners, Banner } from '../services/bannerService';

const Hero: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const defaultSlides: any[] = [];

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await getBanners('home');
      if (data && data.length > 0) setBanners(data);
    } catch (error) {
      console.error('Error loading home banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const slides = banners.length > 0
    ? banners.map(b => ({
        image: b.imageUrl,
        alt: b.title[i18n.language as 'az' | 'ru' | 'en'] || b.title.en || b.title.az || 'Banner',
        title: b.title,
        link: b.link,
        buttonText: (b as any).buttonText,
        mediaType: (b as any).mediaType || 'image',
        videoUrl: (b as any).videoUrl,
        duration: (b as any).duration || 4,
      }))
    : defaultSlides;

  useEffect(() => {
    if (slides.length === 0) return;
    const currentDuration = (slides[currentSlide]?.duration || 5) * 1000;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, currentDuration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide, slides]);

  // Subtle parallax: track mouse over hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setParallax({ x: x * 14, y: y * 14 });
    };
    const leave = () => setParallax({ x: 0, y: 0 });
    el.addEventListener('mousemove', handler);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', handler);
      el.removeEventListener('mouseleave', leave);
    };
  }, []);

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length);
  const handleBannerClick = (link?: string) => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Kinetic title: split into words/letters for staggered reveal
  const renderKinetic = (text: string) => {
    const words = text.split(' ');
    return words.map((word, i) => (
      <span
        key={`${currentSlide}-${i}`}
        className="dv-kinetic-word mr-[0.35em]"
      >
        <span style={{ animationDelay: `${120 + i * 80}ms` }}>{word}</span>
      </span>
    ));
  };

  const currentTitle = slides[currentSlide]?.title
    ? (slides[currentSlide].title[i18n.language as 'az' | 'ru' | 'en'] ||
        slides[currentSlide].title.en ||
        slides[currentSlide].title.az ||
        '')
    : '';

  return (
    <section
      ref={heroRef}
      className="relative w-full bg-black overflow-hidden"
      data-testid="dv-hero"
    >
      {/* Ambient gold orbs */}
      <div
        className="dv-orb"
        style={{ width: 480, height: 480, top: '-15%', left: '-10%' }}
        aria-hidden="true"
      />
      <div
        className="dv-orb"
        style={{ width: 420, height: 420, bottom: '-20%', right: '-8%', animationDelay: '3s' }}
        aria-hidden="true"
      />

      <div className="relative h-[440px] sm:h-[520px] md:h-[600px] lg:h-[680px] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {(slide as any).mediaType === 'video' && (slide as any).videoUrl ? (
              <iframe
                src={(slide as any).videoUrl}
                className="w-full h-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={slide.alt}
              />
            ) : (
              <div
                onClick={() => handleBannerClick(slide.link)}
                className={`absolute inset-0 ${slide.link ? 'cursor-pointer' : ''}`}
                style={{
                  transform: index === currentSlide
                    ? `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.06)`
                    : 'scale(1.06)',
                  transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)',
                }}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  className={`w-full h-full object-cover ${index === currentSlide ? 'dv-kenburns' : ''}`}
                  loading="eager"
                />
              </div>
            )}

            {/* Cinematic gold-tinted vignette */}
            {(slide as any).mediaType !== 'video' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40 pointer-events-none" />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at 70% 30%, rgba(212,175,55,0.18) 0%, transparent 55%)',
                  }}
                />
              </>
            )}
          </div>
        ))}

        {/* Title overlay */}
        {currentTitle && slides[currentSlide] && (slides[currentSlide] as any).mediaType !== 'video' && (
          <div className="absolute inset-0 flex items-end pointer-events-none z-10">
            <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-14 pb-14 sm:pb-16 md:pb-20">
              <div className="flex items-center mb-5">
                <span className="inline-block w-10 h-[1px]" style={{ background: '#D4AF37' }} />
                <span
                  className="ml-3 text-[10px] md:text-xs uppercase tracking-[0.35em] dv-shimmer font-semibold"
                  data-testid="dv-hero-eyebrow"
                >
                  De Valeur · Maison Horlogère
                </span>
              </div>
              <h1
                key={currentSlide}
                className="text-white font-playfair text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] font-light max-w-4xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
                data-testid="dv-hero-title"
              >
                {renderKinetic(currentTitle)}
              </h1>
            </div>
          </div>
        )}

        {/* Fine gold frame */}
        <div
          className="absolute inset-3 sm:inset-5 border pointer-events-none z-[5]"
          style={{ borderColor: 'rgba(212,175,55,0.22)' }}
          aria-hidden="true"
        />

        {/* Nav arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/20"
              aria-label="Previous slide"
              data-testid="dv-hero-prev"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.3} />
            </button>

            <button
              onClick={nextSlide}
              className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center border border-white/30 hover:border-[#D4AF37] text-white hover:text-[#D4AF37] transition-all duration-300 z-20 rounded-full backdrop-blur-sm bg-black/20"
              aria-label="Next slide"
              data-testid="dv-hero-next"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.3} />
            </button>
          </>
        )}

        {/* Slide counter + indicator bars */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="group h-[2px] transition-all duration-500"
                style={{
                  width: index === currentSlide ? 48 : 18,
                  background:
                    index === currentSlide ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                }}
                aria-label={`Go to slide ${index + 1}`}
                data-testid={`dv-hero-indicator-${index}`}
              />
            ))}
          </div>
        )}

        {/* Slide counter */}
        {slides.length > 1 && (
          <div className="absolute top-6 right-6 z-20 text-white/80 text-xs tracking-[0.3em] font-light">
            <span className="text-[#D4AF37] font-semibold">
              {String(currentSlide + 1).padStart(2, '0')}
            </span>
            <span className="mx-2">—</span>
            <span>{String(slides.length).padStart(2, '0')}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
