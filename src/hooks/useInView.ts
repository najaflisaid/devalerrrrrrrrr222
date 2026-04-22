import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * IntersectionObserver hook using a callback ref so it works correctly
 * even when the observed element mounts/unmounts (e.g. after async data loads).
 * Once in view it stays `true`.
 */
export function useInView<T extends HTMLElement = HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0, rootMargin: '0px 0px -10% 0px' }
) {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const optsRef = useRef(options);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
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
            return;
          }
        }
      },
      optsRef.current
    );
    obs.observe(node);
    observerRef.current = obs;
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return { ref, inView } as const;
}
