import React, { useEffect, useRef, useState } from 'react';

/**
 * RevealOnScroll — istənilən elementi/komponenti scroll-trigger fade-up animasiyası ilə göstərir.
 * IntersectionObserver-i daxili olaraq istifadə edir (useReveal hook-undan asılı deyil ki, ref-binding problemi olmasın).
 */
interface RevealOnScrollProps {
  children: React.ReactNode;
  variant?: 'up' | 'left' | 'right' | 'fade' | 'scale';
  delay?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
}

const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  variant = 'up',
  delay = 0,
  threshold = 0.08,
  once = true,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion — dərhal göstər
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setRevealed(true);
      return;
    }

    // Köhnə brauzerlər
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    // Element artıq görünürsə (məsələn səhifə load olarkən viewport-da olarsa) — dərhal aç
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setRevealed(false);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -5% 0px' }
    );

    io.observe(el);

    // Safety failsafe — 1.2s sonra göstər (heç bir vəziyyət gizli qalmasın)
    const failsafe = window.setTimeout(() => setRevealed(true), 1200);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [threshold, once]);

  const variantClass =
    variant === 'left'
      ? 'dv-scroll-left'
      : variant === 'right'
      ? 'dv-scroll-right'
      : variant === 'fade'
      ? 'dv-scroll-fade'
      : variant === 'scale'
      ? 'dv-scroll-scale'
      : 'dv-scroll-up';

  return (
    <div
      ref={ref}
      className={`dv-scroll-reveal ${variantClass} ${revealed ? 'dv-scroll-in' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

export default RevealOnScroll;
