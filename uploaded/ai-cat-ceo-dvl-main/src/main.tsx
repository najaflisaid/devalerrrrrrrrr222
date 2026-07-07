import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

/* === Desktop zoom & horizontal pan blokerləri ===
 * Mobil zoom artıq viewport meta + CSS touch-action ilə söndürülüb.
 * Desktop üçün isə:
 *   - Ctrl/Cmd + wheel  → zoom
 *   - Ctrl/Cmd + = / - / 0 → zoom
 *   - pinch-to-zoom trackpad gestures (gesturestart / gesturechange)
 *   - Üfüqi səhifə scroll-u (saga/sola page swipe / shift+wheel)
 * Hamısını preventDefault edirik.
 *
 * Qeyd: CSS-də body-yə `overflow-x: hidden/clip` qoymadıq, çünki position:
 * sticky (header) sındırır. JS ilə həll edirik — sticky/fixed elementlər
 * problemsiz işləyir. */
(() => {
  if (typeof window === 'undefined') return;

  // Browser-in avtomatik scroll restoration-ını söndür: bəzən route dəyişəndə
  // və ya history navigation zamanı brauzer köhnə scroll mövqeyini (səhifənin
  // aşağısını) bərpa etməyə çalışır → `scroll-behavior: smooth` ilə bu
  // animasiya ilə baş verir və istifadəçiyə "səhifə öz-özünə aşağı atdı"
  // kimi görünür. ScrollToTop komponenti zatən route-da yuxarıya scroll
  // edir, ona görə manual rejim daha proqnozlaşdırılan davranış verir.
  if ('scrollRestoration' in history) {
    try { history.scrollRestoration = 'manual'; } catch { /* noop */ }
  }

  // Cihaz növünü təyin et — mobil/touch cihazlarda (xüsusən iPhone-da
  // Instagram in-app brauzerində) `wheel` və `gesturestart`/`gesturechange`
  // event-ləri ya işə düşmür, ya da tək toxunmada da fire olur. Hər iki
  // halda non-passive preventDefault() klik delegasiyasını zədələyə bilər.
  // Buna görə bu listener-ləri yalnız DESKTOP-da (pointer: fine) qoşuruq.
  const isFinePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: fine)').matches;

  // Ctrl/Cmd + wheel zoom + horizontal page scroll blok — yalnız DESKTOP
  // (touch cihazlarda wheel event-i fire olmur, amma Instagram in-app
  // brauzerində bəzən anomaliyalı şəkildə işə düşür və klikləri blok edə
  // bilər. Mobile-da bu listener-ə ehtiyac yoxdur).
  if (isFinePointer) {
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || (e as any).metaKey) {
        // zoom blok
        e.preventDefault();
        return;
      }
      // Üfüqi səhifə scroll (məs. trackpad iki barmaq sağa/sola, ya da shift+wheel)
      // — yalnız document/body səviyyəsində blok et; daxili overflow-x: auto
      // (carousel) elementlərində icazə ver.
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY) / 2) {
        let allowsHScroll = false;
        let cur: HTMLElement | null = t;
        while (cur && cur !== document.body) {
          const cs = getComputedStyle(cur);
          if (
            (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
            cur.scrollWidth > cur.clientWidth
          ) {
            allowsHScroll = true;
            break;
          }
          cur = cur.parentElement;
        }
        if (!allowsHScroll) {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );
  }

  // Ctrl/Cmd + = / - / 0  zoom blok
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key;
      if (k === '+' || k === '=' || k === '-' || k === '_' || k === '0') {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Safari/macOS pinch gestures — DESKTOP-only.
  // QEYD: Mobil cihazlarda (xüsusən iPhone-da Instagram in-app brauzerində)
  // `gesturestart`/`gesturechange` event-ləri tək toxunmada da fire ola
  // bilər və preventDefault() çağırışı klik hadisəsini blok edir →
  // istifadəçi heç bir düyməyə kliklə bilmir.
  if (isFinePointer) {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
      window.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as any);
    });
  }

  // Hər hansı yolla baş verən üfüqi scroll-u dərhal 0-a qaytar (məs. üfüqi
  // touch swipe səhifəsi). Daxili overflow-scroll elementlər window-da deyil,
  // öz kontekstində scroll edir, ona görə bu rule onlara təsir etmir.
  let scheduled = false;
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollX === 0 || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        window.scrollTo(0, window.scrollY);
        scheduled = false;
      });
    },
    { passive: true }
  );
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <WishlistProvider>
        <App />
      </WishlistProvider>
    </CartProvider>
  </StrictMode>
);
