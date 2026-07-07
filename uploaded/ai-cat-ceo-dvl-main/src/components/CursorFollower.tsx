import React, { useEffect, useRef } from 'react';

/**
 * Custom gold cursor follower with smooth lag (desktop only).
 * Auto-disables on touch devices via CSS (see index.css).
 *
 * Reads `data-cursor="hover"` or targets `a, button, [role="button"]` for the expand effect.
 */
const CursorFollower: React.FC = () => {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Skip on touch / coarse pointer devices
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    if (!mq.matches) return;

    document.body.classList.add('dv-home-active');

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const onOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !ringRef.current) return;
      const hover = el.closest(
        'a, button, [role="button"], [data-cursor="hover"], input[type="submit"]'
      );
      ringRef.current.classList.toggle('is-hover', !!hover);
    };

    const tick = () => {
      ring.current.x += (target.current.x - ring.current.x) * 0.18;
      ring.current.y += (target.current.y - ring.current.y) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0)`;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });

    return () => {
      document.body.classList.remove('dv-home-active');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="dv-cursor" aria-hidden="true" data-testid="dv-cursor-ring" />
      <div ref={dotRef} className="dv-cursor-dot" aria-hidden="true" data-testid="dv-cursor-dot" />
    </>
  );
};

export default CursorFollower;
