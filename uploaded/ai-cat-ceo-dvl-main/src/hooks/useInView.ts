import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll hook.
 *
 * Strategy (chosen for maximum reliability across browsers / dev StrictMode):
 *  1. When the ref is attached, do an immediate viewport check —
 *     reveal instantly if the element is already on screen.
 *  2. Otherwise listen to window scroll/resize and reveal when the element
 *     enters the viewport (this is more reliable than IntersectionObserver
 *     which we observed missing initial fires under some build/dev conditions).
 *  3. Always release the listener after first reveal.
 *  4. Hard safety: reveal after 5s if nothing else triggered it, so content
 *     can never be permanently hidden.
 */
export function useInView<T extends HTMLElement = HTMLElement>(
  _options?: IntersectionObserverInit
) {
  const [inView, setInView] = useState(false);
  const elementRef = useRef<T | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const ref = useCallback((node: T | null) => {
    // teardown any previous observation
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    elementRef.current = node;
    if (!node) return;

    const REVEAL_MARGIN = 0.05; // 5% of viewport — fire just before fully on screen
    const check = (): boolean => {
      const el = elementRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const visible = r.top < vh * (1 - REVEAL_MARGIN) && r.bottom > 0;
      if (visible) {
        setInView(true);
        return true;
      }
      return false;
    };

    // 1) Immediate check
    if (check()) return;

    // 2) Listen until visible
    const handler = () => {
      if (check()) {
        window.removeEventListener('scroll', handler);
        window.removeEventListener('resize', handler);
        cleanupRef.current = null;
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    cleanupRef.current = () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };

    // 3) Hard safety fallback
    safetyTimerRef.current = setTimeout(() => {
      setInView(true);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  return { ref, inView } as const;
}
