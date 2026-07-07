import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll bərpası — istifadəçi məhsul siyahısında scroll edib məhsula girdikdə,
 * sonra geri qayıtdıqda əvvəlki mövqeyə qayıtsın (yenidən yuxarıdan başlamasın).
 */

const SS_KEY = 'dv:scrollPositions';

type PositionMap = Record<string, number>;

const readMap = (): PositionMap => {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeMap = (m: PositionMap) => {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(m));
  } catch {
    /* noop */
  }
};

let __currentPath: string | null = null;
let __skipSaveUntil = 0;
let __restoreUntil = 0;
let __restoreTarget = 0;
let __listenersAttached = false;
let __origScrollTo: typeof window.scrollTo | null = null;

const savePosition = (path: string, y: number) => {
  const m = readMap();
  m[path] = y;
  writeMap(m);
};

const getPosition = (path: string): number | undefined => {
  const m = readMap();
  return typeof m[path] === 'number' ? m[path] : undefined;
};

const attachListeners = () => {
  if (__listenersAttached || typeof window === 'undefined') return;
  __listenersAttached = true;

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (performance.now() >= __skipSaveUntil) {
          const path = window.location.pathname;
          savePosition(path, window.scrollY);
        }
        ticking = false;
      });
    },
    { passive: true }
  );

  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      const anchor = t.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const target = anchor.getAttribute('target');
      if (target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const path = window.location.pathname;
      savePosition(path, window.scrollY);
      __skipSaveUntil = performance.now() + 1200;
    },
    true
  );

  window.addEventListener('pagehide', () => {
    if (performance.now() >= __skipSaveUntil) {
      const path = window.location.pathname;
      savePosition(path, window.scrollY);
    }
  });

  __origScrollTo = window.scrollTo.bind(window);
  const patched = function (this: Window, ...args: unknown[]) {
    if (performance.now() < __restoreUntil) {
      let y: number | undefined;
      if (typeof args[0] === 'object' && args[0] !== null && 'top' in (args[0] as object)) {
        y = (args[0] as ScrollToOptions).top;
      } else if (typeof args[1] === 'number') {
        y = args[1] as number;
      }
      if (y === undefined || y === 0) {
        return __origScrollTo!({ top: __restoreTarget, left: 0, behavior: 'auto' as ScrollBehavior });
      }
    }
    return __origScrollTo!.apply(window, args as unknown as [number, number]);
  } as typeof window.scrollTo;
  (window as unknown as { scrollTo: typeof window.scrollTo }).scrollTo = patched;
};

const instantScrollTo = (y: number) => {
  if (!__origScrollTo) __origScrollTo = window.scrollTo.bind(window);
  try {
    __origScrollTo({ top: y, left: 0, behavior: 'auto' as ScrollBehavior });
  } catch {
    __origScrollTo(0, y);
  }
};

const restoreScroll = (target: number) => {
  __restoreTarget = target;
  __restoreUntil = performance.now() + 700;
  __skipSaveUntil = performance.now() + 1500;

  const html = document.documentElement;
  const prevBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';

  const deadline = performance.now() + 4000;

  const step = () => {
    const now = performance.now();
    const maxY = html.scrollHeight - window.innerHeight;
    if (maxY >= target - 4) {
      instantScrollTo(target);
      const holdUntil = now + 300;
      const hold = () => {
        if (performance.now() >= holdUntil) {
          html.style.scrollBehavior = prevBehavior;
          return;
        }
        const diff = window.scrollY - target;
        if (diff < -4 && diff > -200) {
          instantScrollTo(target);
        }
        requestAnimationFrame(hold);
      };
      requestAnimationFrame(hold);
      return;
    }
    if (now < deadline) {
      setTimeout(() => requestAnimationFrame(step), 40);
    } else {
      instantScrollTo(Math.min(target, Math.max(0, maxY)));
      html.style.scrollBehavior = prevBehavior;
    }
  };
  requestAnimationFrame(step);
};

const ScrollToTop = () => {
  const location = useLocation();
  const navType = useNavigationType();
  const isFirstRun = useRef(true);
  const path = location.pathname;

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    attachListeners();
  }, []);

  useEffect(() => {
    if (navType === 'REPLACE' && !isFirstRun.current && __currentPath === path) {
      return;
    }
    __currentPath = path;

    if (navType === 'POP') {
      const saved = getPosition(path);
      if (typeof saved === 'number' && saved > 0) {
        restoreScroll(saved);
        isFirstRun.current = false;
        return;
      }
    }

    if (!isFirstRun.current || !window.location.hash) {
      instantScrollTo(0);
    }
    isFirstRun.current = false;
  }, [path, navType]);

  return null;
};

export default ScrollToTop;
