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
  const [inView, setInView] = useState(false);
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

    // If element is already in viewport at mount time, reveal immediately.
    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
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

    // Final safety: if user never scrolls and element stays below fold,
    // we still want to reveal it eventually so it never gets stuck hidden
    // when navigated to via anchor or back-forward cache.
    fallbackTimerRef.current = setTimeout(() => {
      setInView(true);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      fallbackTimerRef.current = null;
    }, 4000);
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
