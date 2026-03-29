import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CartProvider } from './context/CartContext';
import { WorkerProvider } from './context/WorkerContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <WorkerProvider>
        <App />
      </WorkerProvider>
    </CartProvider>
  </StrictMode>
);
