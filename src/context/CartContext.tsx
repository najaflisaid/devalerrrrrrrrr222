import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { productService } from '../services/productService';
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
  clearCart: (skipFirestoreMirror?: boolean) => void;
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
  // Skip the next auto-mirror to Firestore (used during logout / hydration to avoid
  // accidentally overwriting the saved customer cart with an empty array).
  const skipNextMirrorRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
    if (skipNextMirrorRef.current) {
      skipNextMirrorRef.current = false;
      return;
    }
    // Mirror to Firestore so admin can see customer carts AND so cart persists across logins
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (userId && userRole === 'customer') {
      const userName = localStorage.getItem('userName') || '';
      const userEmail = localStorage.getItem('userEmail') || '';
      const userPhone = localStorage.getItem('userPhone') || '';
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
          userPhone,
          items: compactItems,
          itemCount: items.reduce((s, it) => s + it.quantity, 0),
          updatedAt: Timestamp.now(),
        },
        { merge: false }
      ).catch((err) => console.warn('Cart mirror to Firestore failed:', err));
    }
  }, [items]);

  // Hydrate cart from Firestore exactly ONCE per session (after first auth state change).
  // Prevents the bug where every page reload doubled quantities by re-summing
  // local + remote (which were the same).
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      // Only hydrate once per session — auth state can fire multiple times
      // (token refresh, reconnect) and re-running the merge keeps multiplying.
      if (hasHydratedRef.current) return;
      // Wait briefly for Header.tsx to write userRole to localStorage
      const start = Date.now();
      let role = localStorage.getItem('userRole');
      while (!role && Date.now() - start < 1500) {
        await new Promise((r) => setTimeout(r, 100));
        role = localStorage.getItem('userRole');
      }
      if (role !== 'customer') return;
      hasHydratedRef.current = true;
      try {
        const snap = await getDoc(doc(db, 'customer_carts', user.uid));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const remoteItems: { productId: string; quantity: number }[] = (data.items || []).map(
          (it: any) => ({ productId: it.productId, quantity: it.quantity })
        );
        if (remoteItems.length === 0) return;
        // Fetch full product data for each remote item
        const products = await Promise.all(
          remoteItems.map((it) => productService.getById(it.productId).catch(() => null))
        );
        const remoteCart: CartItem[] = remoteItems
          .map((it, idx) => {
            const p = products[idx];
            return p ? { product: p, quantity: it.quantity } : null;
          })
          .filter((x): x is CartItem => x !== null);
        // Merge with current (guest) cart using MAX of quantities (not sum) so
        // page refreshes never double the existing quantity. This still allows a
        // guest who added items before login to keep them merged with their
        // previously-saved remote cart.
        setItems((prev) => {
          const map = new Map<string, CartItem>();
          [...remoteCart, ...prev].forEach((ci) => {
            const existing = map.get(ci.product.id);
            if (existing) {
              map.set(ci.product.id, {
                product: ci.product,
                quantity: Math.max(existing.quantity, ci.quantity),
              });
            } else {
              map.set(ci.product.id, ci);
            }
          });
          return Array.from(map.values());
        });
      } catch (err) {
        console.warn('Cart hydrate failed:', err);
      }
    });
    return () => unsubscribe();
  }, []);

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

  const clearCart = (skipFirestoreMirror = false) => {
    if (skipFirestoreMirror) {
      skipNextMirrorRef.current = true;
    }
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
