import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';

interface CartItem {
  product: Product;
  quantity: number;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getDiscountAmount: () => number;
  getDiscountedTotal: () => number;
  getUserDiscount: () => number;
  notifications: Notification[];
  removeNotification: (id: string) => void;
  addNotification: (message: string, type?: 'success' | 'error') => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
    // Mirror to Firestore so admin can see customer carts
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (userId && userRole === 'customer') {
      // Lazy import to avoid circular deps
      import('../lib/firebase').then(({ db }) =>
        import('firebase/firestore').then(({ doc, setDoc, Timestamp }) => {
          const userName = localStorage.getItem('userName') || '';
          const userEmail = localStorage.getItem('userEmail') || '';
          const compactItems = items.map((it) => ({
            productId: it.product.id,
            productName: it.product.name?.az || it.product.name?.en || '',
            image: it.product.images?.[0] || '',
            quantity: it.quantity,
            price: it.product.salePrice || it.product.price,
          }));
          setDoc(
            doc(db, 'customer_carts', userId),
            {
              userId,
              userName,
              userEmail,
              items: compactItems,
              itemCount: items.reduce((s, it) => s + it.quantity, 0),
              updatedAt: Timestamp.now(),
            },
            { merge: false }
          ).catch((err) => console.warn('Cart mirror to Firestore failed:', err));
        })
      ).catch(() => undefined);
    }
  }, [items]);

  const addNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36);
    setNotifications(prev => [{ id, message, type }, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addToCart = (product: Product, quantity: number) => {
    const isB2BUser = localStorage.getItem('userRole') === 'b2b';

    if (isB2BUser && product.stock !== undefined && product.stock <= 0) {
      addNotification(t('cart.outOfStock'), 'error');
      return;
    }

    const existingItem = items.find(item => item.product.id === product.id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (isB2BUser && product.stock !== undefined && newTotalQuantity > product.stock) {
      addNotification(t('cart.limitedStockAvailable', { stock: product.stock }), 'error');
      return;
    }

    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { product, quantity }];
    });

    addNotification(t('cart.addedToCart'));
  };

  const removeFromCart = (productId: string) => {
    setItems(prevItems => prevItems.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const isB2BUser = localStorage.getItem('userRole') === 'b2b';
    const item = items.find(item => item.product.id === productId);
    if (isB2BUser && item && item.product.stock !== undefined && quantity > item.product.stock) {
      addNotification(t('cart.limitedStockAvailable', { stock: item.product.stock }), 'error');
      return;
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    const isB2BUser = localStorage.getItem('userRole') === 'b2b';

    return items.reduce((total, item) => {
      let price: number;

      if (isB2BUser) {
        price = item.product.b2bSalePrice || item.product.b2bPrice || item.product.salePrice || item.product.price;
      } else {
        price = item.product.salePrice || item.product.price;
      }

      return total + (price * item.quantity);
    }, 0);
  };

  const getUserDiscount = () => {
    const userDataStr = localStorage.getItem('userData');
    if (!userDataStr) return 0;

    try {
      const userData = JSON.parse(userDataStr);
      const discount = userData.discountPercentage || 0;

      if (userData.discountUsageType === 'once' && userData.discountUsed) {
        return 0;
      }

      if (userData.discountUsageType === 'time_limited' && userData.discountExpiresAt) {
        const expiryDate = new Date(userData.discountExpiresAt);
        if (expiryDate < new Date()) {
          return 0;
        }
      }

      return discount;
    } catch {
      return 0;
    }
  };

  const getDiscountAmount = () => {
    const total = getTotalPrice();
    const discountPercentage = getUserDiscount();
    return (total * discountPercentage) / 100;
  };

  const getDiscountedTotal = () => {
    const total = getTotalPrice();
    const discount = getDiscountAmount();
    return total - discount;
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalItems,
      getTotalPrice,
      getDiscountAmount,
      getDiscountedTotal,
      getUserDiscount,
      notifications,
      removeNotification,
      addNotification,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
