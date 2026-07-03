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
    // Route dəyişdiyi anda köhnə route-un scroll dəyərini SON DƏFƏ təzələ,
    // sonra 500ms scroll save-i ignor et — yeni səhifədəki avtomatik scrollTo(0)
    // köhnə açara yazılmasın.
    if (!isFirstRun.current && __currentKey && __currentKey !== key) {
      setScroll(__currentKey, window.scrollY);
    }
    __currentKey = key;
    __ignoreUntil = performance.now() + 500;
    isFirstRun.current = false;

    if (navType === 'POP') {
      const saved = getScroll(key);
      if (typeof saved === 'number' && saved > 0) {
        let attempts = 0;
        const maxAttempts = 60;
        const tryRestore = () => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScroll >= saved - 4) {
            window.scrollTo(0, saved);
            setTimeout(() => window.scrollTo(0, saved), 200);
            setTimeout(() => window.scrollTo(0, saved), 500);
            // Restore olduqdan sonra scroll save-i yenidən aktivləşdir
            setTimeout(() => { __ignoreUntil = 0; }, 700);
            return;
          }
          if (++attempts < maxAttempts) {
            setTimeout(tryRestore, 40);
          } else {
            window.scrollTo(0, Math.min(saved, Math.max(0, maxScroll)));
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
