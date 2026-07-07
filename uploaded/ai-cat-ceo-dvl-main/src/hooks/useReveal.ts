import { useEffect, useRef, useState } from 'react';

/**
 * useReveal — IntersectionObserver tabanlı scroll-reveal hook'u.
 * Etibarlılıq qatları:
 *  - prefers-reduced-motion → dərhal aç
 *  - IntersectionObserver yoxdur → dərhal aç
 *  - Element ilkin olaraq viewport-dadırsa → dərhal aç
 *  - Fallback: 1500ms sonra hər halda aç (animasiya bloklamasın)
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.08, rootMargin = '0px 0px -5% 0px', once = true } = options;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setRevealed(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    // Element artıq görünürsə — dərhal aç
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
      { threshold, rootMargin }
    );

    io.observe(el);

    // Safety fallback: hər halda 1.5s sonra göstər (heç bir vəziyyət gizli qalmasın)
    const failsafe = window.setTimeout(() => setRevealed(true), 1500);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [threshold, rootMargin, once]);

  return { ref, revealed };
}

export default useReveal;
