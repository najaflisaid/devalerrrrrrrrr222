import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Scroll pozisiyalarını sessionStorage-də saxla — açar: pathname.
// Səbəb: bir çox səhifə arasında geri-irəli edərkən brauzer restart-larından da
// sağ qalır (yalnız tab bağlanana qədər).
const SS_KEY = 'dv:scrollPositions';
const readMap = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const writeMap = (m: Record<string, number>) => {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(m)); } catch { /* noop */ }
};
const setScroll = (key: string, y: number) => {
  const m = readMap();
  m[key] = y;
  writeMap(m);
};
const getScroll = (key: string): number | undefined => {
  const m = readMap();
  return typeof m[key] === 'number' ? m[key] : undefined;
};

// Qlobal scroll listener — yalnız 1 dəfə qoşulur, cari route açarını ref ilə oxuyur.
// Bu, route dəyişəndə race condition-ları aradan qaldırır: yeni səhifənin scrollTo(0)
// çağırışı köhnə route-un saxlanmış scroll dəyərinin üzərinə yazmır.
let __globalListenerAttached = false;
let __currentKey: string | null = null;
let __ignoreUntil = 0; // ms — bu vaxta qədər gələn scroll event-ləri saxlanmır

const attachGlobalScrollListener = () => {
  if (__globalListenerAttached || typeof window === 'undefined') return;
  __globalListenerAttached = true;
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // Route yenicə dəyişib — qısa müddət scroll saxlamağı ignor et
        if (__currentKey && performance.now() >= __ignoreUntil) {
          setScroll(__currentKey, window.scrollY);
        }
        ticking = false;
      });
    },
    { passive: true }
  );
  // Klik zamanı — link tıklanan anda cari route-un scroll-unu SON DƏFƏ yaz
  // və hər hansı ProductPage-in scrollTo(0) çağırışının override etməməsi üçün
  // qısa müddət scroll save-i ignor et.
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const anchor = t.closest ? (t.closest('a[href]') as HTMLAnchorElement | null) : null;
    if (anchor && __currentKey) {
      setScroll(__currentKey, window.scrollY);
      __ignoreUntil = performance.now() + 1000;
    }
  }, true);
  // Səhifə bağlanan zaman da son mövqe yazılsın
  window.addEventListener('pagehide', () => {
    if (__currentKey) setScroll(__currentKey, window.scrollY);
  });
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const key = pathname;
  const isFirstRun = useRef(true);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    attachGlobalScrollListener();
  }, []);

  useEffect(() => {
    // Route dəyişdi. Əgər click-based save yeni deyilsə (ignoreUntil-də vaxt qalmayıb),
    // köhnə route-un cari scroll dəyərini yaz. Klik ilə navigation olduqda click handler
    // artıq düzgün dəyəri yazıb — burada təkrar yazsaq, sonrakı frame-lərdə dəyişilmiş
    // scrollY-i saxlaya bilərik ki, düzgün olmaz.
    const now0 = performance.now();
    if (!isFirstRun.current && __currentKey && __currentKey !== key && now0 >= __ignoreUntil) {
      setScroll(__currentKey, window.scrollY);
    }
    __currentKey = key;
    // Yalnız click-based ignoreUntil hələ aktivdirsə saxla — əks halda 500ms
    // qoy. Kliklə naviqasiyada click handler zamanı 1000ms verilib, onu qoruyaq.
    if (now0 >= __ignoreUntil) {
      __ignoreUntil = now0 + 500;
    }
    isFirstRun.current = false;

    if (navType === 'POP') {
      const saved = getScroll(key);
      if (typeof saved === 'number' && saved > 0) {
        const origScrollTo = window.scrollTo.bind(window);
        (window as any).__dvOrigScrollTo = origScrollTo;
        (window as any).__dvRestoring = true;
        const restoreDeadline = performance.now() + 8000;
        // Sürətli, instant scroll — CSS scroll-behavior: smooth-i keçir
        const instantScroll = (y: number) => {
          try {
            origScrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
          } catch {
            origScrollTo(0, y);
          }
        };
        // Restore döngüsündə istənilən scrollTo(0)/instant scroll cəhdlərini SAVED-ə yönləndir
        (window as any).scrollTo = function (...args: any[]) {
          try {
            let y: number | undefined;
            if (typeof args[0] === 'object' && args[0] !== null && 'top' in args[0]) y = (args[0] as any).top;
            else if (typeof args[1] === 'number') y = args[1];
            const now = performance.now();
            if (now < restoreDeadline && (y === 0 || y === undefined)) {
              instantScroll(saved);
              return;
            }
          } catch { /* noop */ }
          return origScrollTo.apply(window, args as any);
        };
        // Smooth scrolling-i restore müddətində müvəqqəti söndür
        const htmlEl = document.documentElement;
        const prevScrollBehavior = htmlEl.style.scrollBehavior;
        htmlEl.style.scrollBehavior = 'auto';

        let attempts = 0;
        const maxAttempts = 200; // 8 saniyəyə qədər content-i gözlə
        const tryRestore = () => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScroll >= saved - 4) {
            instantScroll(saved);
            // rAF-əsaslı davamlı bərpa — 3.5 saniyəyə qədər hər frame-də saved-ə qayıt
            const rafHold = () => {
              if (performance.now() >= restoreDeadline) {
                (window as any).scrollTo = origScrollTo;
                (window as any).__dvRestoring = false;
                htmlEl.style.scrollBehavior = prevScrollBehavior;
                __ignoreUntil = 0;
                return;
              }
              if (Math.abs(window.scrollY - saved) > 4) {
                instantScroll(saved);
              }
              requestAnimationFrame(rafHold);
            };
            requestAnimationFrame(rafHold);
            return;
          }
          if (++attempts < maxAttempts) {
            setTimeout(tryRestore, 40);
          } else {
            instantScroll(Math.min(saved, Math.max(0, maxScroll)));
            (window as any).scrollTo = origScrollTo;
            (window as any).__dvRestoring = false;
            htmlEl.style.scrollBehavior = prevScrollBehavior;
            __ignoreUntil = 0;
          }
        };
        requestAnimationFrame(tryRestore);
        return;
      }
    }
    // Yeni səhifə — yuxarıya
    window.scrollTo(0, 0);
  }, [key, navType]);

  return null;
};

export default ScrollToTop;
