import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <WishlistProvider>
        <App />
      </WishlistProvider>
    </CartProvider>
  </StrictMode>
);

// Splash screen-i sayt mount olduqdan sonra fade-out edib sil
requestAnimationFrame(() => {
  const splash = document.getElementById('dv-splash');
  if (!splash) return;
  // Minimum görünüş müddəti (qəfil yox olmasın)
  setTimeout(() => {
    splash.classList.add('dv-splash-out');
    setTimeout(() => splash.remove(), 500);
  }, 350);
});
