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
 * Hamısını preventDefault edirik.  */
(() => {
  if (typeof window === 'undefined') return;

  // Ctrl/Cmd + wheel zoom blok
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || (e as any).metaKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

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

  // Safari/macOS pinch gestures
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => {
    window.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as any);
  });
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
