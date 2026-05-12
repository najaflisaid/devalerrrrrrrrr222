import { useEffect, useRef, useState } from 'react';

/**
 * useReveal — IntersectionObserver tabanlı scroll-reveal hook'u.
 * İstifadəsi:
 *   const { ref, revealed } = useReveal<HTMLDivElement>();
 *   <div ref={ref} className={`dv-reveal ${revealed ? 'dv-reveal-in' : ''}`}>...</div>
 *
 * `once: true` (default) — bir dəfə görünəndə animation aktiv olur və daha sönmür.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.12, rootMargin = '0px 0px -8% 0px', once = true } = options;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion — animasiya istəməyən istifadəçilər üçün dərhal aç
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }

    // IntersectionObserver mövcud deyilsə (köhnə brauzerlər) — dərhal aç
    if (typeof IntersectionObserver === 'undefined') {
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
      { threshold, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, revealed };
}

export default useReveal;
