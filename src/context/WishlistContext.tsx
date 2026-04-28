import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface WishlistContextType {
  productIds: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const LS_KEY = 'wishlist';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [productIds, setProductIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage + Firestore (for logged-in customers)
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(productIds));
    } catch {
      /* ignore */
    }
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (userId && userRole === 'customer') {
      const userName = localStorage.getItem('userName') || '';
      const userEmail = localStorage.getItem('userEmail') || '';
      setDoc(
        doc(db, 'customer_wishlists', userId),
        {
          userId,
          userName,
          userEmail,
          productIds,
          count: productIds.length,
          updatedAt: Timestamp.now(),
        },
        { merge: false }
      ).catch((err) => console.warn('Wishlist sync failed:', err));
    }
  }, [productIds]);

  // Hydrate from Firestore on login (when userId becomes available)
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (!userId || userRole !== 'customer') return;
    getDoc(doc(db, 'customer_wishlists', userId))
      .then((snap) => {
        if (snap.exists()) {
          const remote = (snap.data() as any).productIds || [];
          // Merge remote + local (union)
          setProductIds((prev) => Array.from(new Set([...prev, ...remote])));
        }
      })
      .catch(() => undefined);
  }, []);

  const isFavorite = (id: string) => productIds.includes(id);

  const toggleFavorite = (id: string) => {
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <WishlistContext.Provider value={{ productIds, isFavorite, toggleFavorite, count: productIds.length }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};
