import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

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
  // Skip the first sync-to-Firestore right after we hydrate from Firestore (avoids overwriting)
  const skipNextSyncRef = useRef(false);

  // Persist to localStorage + Firestore (for logged-in customers)
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(productIds));
    } catch {
      /* ignore */
    }
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (userId && userRole === 'customer') {
      const userName = localStorage.getItem('userName') || '';
      const userEmail = localStorage.getItem('userEmail') || '';
      const userPhone = localStorage.getItem('userPhone') || '';
      setDoc(
        doc(db, 'customer_wishlists', userId),
        {
          userId,
          userName,
          userEmail,
          userPhone,
          productIds,
          count: productIds.length,
          updatedAt: Timestamp.now(),
        },
        { merge: false }
      ).catch((err) => console.warn('Wishlist sync failed:', err));
    }
  }, [productIds]);

  // Hydrate from Firestore whenever auth state changes (login/logout/page refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Logged out: clear local wishlist so next user starts fresh
        skipNextSyncRef.current = true;
        setProductIds([]);
        try {
          localStorage.removeItem(LS_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      // Wait briefly so Header.tsx can write userRole into localStorage
      const role =
        localStorage.getItem('userRole') ||
        (await new Promise<string>((resolve) => {
          const start = Date.now();
          const tick = () => {
            const r = localStorage.getItem('userRole');
            if (r || Date.now() - start > 1500) resolve(r || '');
            else setTimeout(tick, 100);
          };
          tick();
        }));
      if (role !== 'customer') return;
      try {
        const snap = await getDoc(doc(db, 'customer_wishlists', user.uid));
        const remote: string[] = snap.exists() ? (snap.data() as any).productIds || [] : [];
        // Merge remote + local guest selections (union) so nothing is lost
        setProductIds((prev) => Array.from(new Set([...prev, ...remote])));
      } catch (err) {
        console.warn('Wishlist hydrate failed:', err);
      }
    });
    return () => unsubscribe();
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
