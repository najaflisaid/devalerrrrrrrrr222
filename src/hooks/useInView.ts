import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * IntersectionObserver hook using a callback ref so it works correctly
 * even when the observed element mounts/unmounts (e.g. after async data loads).
 * Once in view it stays `true`. Includes a safety timeout to ensure content
 * always becomes visible even if IntersectionObserver fails to fire.
 */
export function useInView<T extends HTMLElement = HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0, rootMargin: '0px 0px -10% 0px' }
) {
  // Default to `true` so content is always visible. The IntersectionObserver
  // is kept only as a no-op safeguard — content is never hidden waiting for it.
  const [inView, setInView] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const optsRef = useRef(options);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
            observerRef.current = null;
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current);
              fallbackTimerRef.current = null;
            }
            return;
          }
        }
      },
      optsRef.current
    );
    obs.observe(node);
    observerRef.current = obs;

    // Safety fallback: if IO doesn't fire within 600ms (e.g. due to layout
    // race or browser quirks), reveal anyway so content is never stuck hidden.
    fallbackTimerRef.current = setTimeout(() => {
      setInView(true);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      fallbackTimerRef.current = null;
    }, 600);
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, []);

  return { ref, inView } as const;
}
