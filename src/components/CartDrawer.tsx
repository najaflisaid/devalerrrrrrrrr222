import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCart();

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const lang = i18n.language;
  const getName = (n: any) => (typeof n === 'string' ? n : n?.[lang] || n?.az || n?.en || '');

  const subtotal = getTotalPrice();

  const handleCheckout = () => {
    onClose();
    navigate('/cart');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black transition-opacity duration-300 ${
          open ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
        data-testid="cart-drawer-backdrop"
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-[61] h-full w-full max-w-[440px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Cart"
        data-testid="cart-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
          <h2 className="text-[18px] font-light tracking-wide text-black" data-testid="cart-drawer-title">
            Səbət{items.length > 0 && <span className="text-black/50 ml-2 text-[14px]">({items.length})</span>}
          </h2>
          <button
            onClick={onClose}
            className="p-1 -m-1 hover:bg-black/[0.04] rounded-full transition-colors"
            aria-label="Close"
            data-testid="cart-drawer-close"
          >
            <X className="h-5 w-5" strokeWidth={1.25} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-black/[0.04] flex items-center justify-center mb-5">
                <ShoppingBag className="h-7 w-7 text-black/40" strokeWidth={1.25} />
              </div>
              <p className="text-[15px] text-black/70 mb-1">Səbətiniz boşdur</p>
              <p className="text-[12px] text-black/45 mb-6">
                Bəyəndiyiniz məhsulları səbətə əlavə edin.
              </p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/products');
                }}
                className="px-6 h-11 bg-black text-white text-[12px] uppercase tracking-[0.2em] hover:bg-black/85 transition-colors"
                data-testid="cart-drawer-shop-btn"
              >
                Alış-verişə başla
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.07]">
              {items.map((item) => {
                const product = item.product;
                const name = getName(product.name) || (product as any).productName || '';
                const image = product.images?.[0] || (item as any).image || '';
                const lineTotal = (product.price || 0) * item.quantity;
                return (
                  <li
                    key={product.id}
                    className="px-6 py-5 flex gap-4"
                    data-testid={`cart-drawer-item-${product.id}`}
                  >
                    <div className="w-20 h-20 flex-shrink-0 bg-[#F8F4EE] overflow-hidden">
                      {image ? (
                        <img src={image} alt="" className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/30">
                          <ShoppingBag className="w-6 h-6" strokeWidth={1.25} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] text-black leading-snug pr-2" data-testid={`cart-drawer-item-name-${product.id}`}>
                          {name}
                        </p>
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="text-black/40 hover:text-black transition-colors flex-shrink-0"
                          aria-label="Remove"
                          data-testid={`cart-drawer-item-remove-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.25} />
                        </button>
                      </div>
                      <p className="text-[12px] text-black/55 mt-0.5">
                        {(product.price || 0).toFixed(2)} AZN
                      </p>

                      <div className="flex items-end justify-between mt-auto pt-3">
                        <div className="inline-flex items-center border border-black/15">
                          <button
                            onClick={() => updateQuantity(product.id, Math.max(1, item.quantity - 1))}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                            aria-label="Decrease"
                            data-testid={`cart-drawer-item-minus-${product.id}`}
                          >
                            <Minus className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          <span className="w-8 text-center text-[12px] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/[0.04] transition-colors"
                            aria-label="Increase"
                            data-testid={`cart-drawer-item-plus-${product.id}`}
                          >
                            <Plus className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                        </div>
                        <p className="text-[13px] font-medium text-black tabular-nums">
                          {lineTotal.toFixed(2)} AZN
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-black/10 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] uppercase tracking-[0.18em] text-black/65">Cəmi</span>
              <span className="text-[20px] font-light text-black tabular-nums" data-testid="cart-drawer-subtotal">
                {subtotal.toFixed(2)} AZN
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full h-12 bg-black text-white text-[12px] uppercase tracking-[0.28em] hover:bg-black/85 transition-colors"
              data-testid="cart-drawer-checkout"
            >
              Sifarişi tamamla
            </button>
            <p className="text-[11px] text-black/45 text-center">
              Pulsuz çatdırılma 60 AZN-dən yuxarı sifarişlərə
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

export default CartDrawer;
