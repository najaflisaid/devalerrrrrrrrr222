import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { Product } from '../types';
import {
  getCampaign,
  applyCampaignToProduct,
  applyCampaignToProducts,
  isCampaignLive,
  type Campaign,
} from './campaignService';

// Lightweight in-memory cache to avoid hammering Firestore on every product fetch.
let _campaignCache: { data: Campaign | null; at: number } = { data: null, at: 0 };
const CAMPAIGN_TTL_MS = 60_000;

// Cache `getAll()` returns for ~60s. Key includes userRole + includeComingSoon
// because admin/B2B see comingSoon products and B2B/customer have different
// campaign-discount visibility. Invalidate on any mutation (create/update/delete).
const PRODUCTS_TTL_MS = 60_000;
const _productsCache: Map<string, { data: Product[]; at: number }> = new Map();
const productsCacheKey = (role: string | null, includeComingSoon: boolean) =>
  `${role || 'guest'}|${includeComingSoon ? 'cs' : 'nocs'}`;
const invalidateProductsCache = () => _productsCache.clear();

const getCampaignCached = async (): Promise<Campaign | null> => {
  const now = Date.now();
  if (_campaignCache.data && now - _campaignCache.at < CAMPAIGN_TTL_MS) {
    return _campaignCache.data;
  }
  try {
    const c = await getCampaign();
    _campaignCache = { data: c, at: now };
    return c;
  } catch {
    return _campaignCache.data;
  }
};

// Public — admin paneldə kampaniyanı yeniləyəndə cache-i sıfırlayır.
// Eyni zamanda məhsul cache-ni də sıfırlayır, çünki kampaniya endirimi
// məhsulların qiymətlərinə tətbiq olunur — köhnə cache-də endirim
// yanlış görünə bilər.
export const invalidateCampaignCache = () => {
  _campaignCache = { data: null, at: 0 };
  _productsCache.clear();
};

export const productService = {
  async getAll(includeComingSoon: boolean = false): Promise<Product[]> {
    try {
      const userRole = localStorage.getItem('userRole');
      const cacheKey = productsCacheKey(userRole, includeComingSoon);
      const cached = _productsCache.get(cacheKey);
      if (cached && Date.now() - cached.at < PRODUCTS_TTL_MS) {
        return cached.data;
      }
      console.log('ProductService.getAll - userRole:', userRole);
      const isB2BorAdmin = userRole === 'b2b' || userRole === 'admin';

      const querySnapshot = await getDocs(collection(db, 'products'));
      console.log('ProductService.getAll - docs count:', querySnapshot.docs.length);

      let products = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
        };
      }) as Product[];

      console.log('ProductService.getAll - products before filter:', products.length);

      if (userRole !== 'admin') {
        const beforeFilter = products.length;
        products = products.filter(p => {
          const visibleTo = p.visibleTo || 'all';
          if (visibleTo === 'all') return true;
          if (visibleTo === 'b2b' && userRole === 'b2b') return true;
          if (visibleTo === 'customer' && (userRole === 'customer' || !userRole)) return true;
          return false;
        });
        console.log('ProductService.getAll - filtered by visibleTo:', beforeFilter, '->', products.length);
      } else {
        console.log('ProductService.getAll - admin, no visibleTo filter applied');
      }

      if (!isB2BorAdmin) {
        products = products.filter(p => p.comingSoon !== true);
      }

      // Aktiv kampaniya endirimini tətbiq et (yalnız retail/qonaq; B2B və admin
      // istifadəçilərinə kampaniya endirimləri tətbiq olunmur).
      if (userRole !== 'admin' && userRole !== 'b2b') {
        const campaign = await getCampaignCached();
        if (isCampaignLive(campaign)) {
          products = applyCampaignToProducts(products, campaign);
        }
      }

      console.log('ProductService.getAll - final products returned:', products.length);
      _productsCache.set(cacheKey, { data: products, at: Date.now() });
      return products;
    } catch (error) {
      console.error('Error in getAll products:', error);
      throw error;
    }
  },

  async getByCategory(category: string): Promise<Product[]> {
    const userRole = localStorage.getItem('userRole');
    const q = query(
      collection(db, 'products'),
      where('category', '==', category),
      where('isEnabled', '==', true)
    );
    const querySnapshot = await getDocs(q);
    let products = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
      };
    }) as Product[];

    if (userRole !== 'admin') {
      products = products.filter(p => {
        const visibleTo = p.visibleTo || 'all';
        if (visibleTo === 'all') return true;
        if (visibleTo === 'b2b' && userRole === 'b2b') return true;
        if (visibleTo === 'customer' && (userRole === 'customer' || !userRole)) return true;
        return false;
      });

      if (userRole !== 'b2b') {
        const campaign = await getCampaignCached();
        if (isCampaignLive(campaign)) {
          products = applyCampaignToProducts(products, campaign);
        }
      }
    }

    return products;
  },

  async getBestSellers(limit: number = 6): Promise<Product[]> {
    const userRole = localStorage.getItem('userRole');
    const isB2BorAdmin = userRole === 'b2b' || userRole === 'admin';

    const q = query(
      collection(db, 'products'),
      where('isEnabled', '==', true),
      where('isBestseller', '==', true)
    );
    const querySnapshot = await getDocs(q);
    let products = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
      };
    }) as Product[];

    if (userRole !== 'admin') {
      products = products.filter(p => {
        const visibleTo = p.visibleTo || 'all';
        if (visibleTo === 'all') return true;
        if (visibleTo === 'b2b' && userRole === 'b2b') return true;
        if (visibleTo === 'customer' && (userRole === 'customer' || !userRole)) return true;
        return false;
      });
    }

    if (!isB2BorAdmin) {
      products = products.filter(p => !p.comingSoon);
    }

    if (userRole !== 'admin' && userRole !== 'b2b') {
      const campaign = await getCampaignCached();
      if (isCampaignLive(campaign)) {
        products = applyCampaignToProducts(products, campaign);
      }
    }

    return products.slice(0, limit);
  },

  async add(product: Omit<Product, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: new Date()
    });
    invalidateProductsCache();
    return docRef.id;
  },

  async update(id: string, product: Partial<Product>): Promise<void> {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, product);
    invalidateProductsCache();
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'products', id));
    invalidateProductsCache();
  },

  async uploadImage(file: File, productId: string): Promise<string> {
    const imageRef = ref(storage, `products/${productId}/${file.name}`);
    await uploadBytes(imageRef, file);
    return await getDownloadURL(imageRef);
  },

  async getById(id: string): Promise<Product | null> {
    try {
      const snap = await getDoc(doc(db, 'products', id));
      if (!snap.exists()) return null;
      const data = snap.data();
      const product = {
        id: snap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      } as Product;

      const userRole = localStorage.getItem('userRole');
      if (userRole !== 'admin' && userRole !== 'b2b') {
        const campaign = await getCampaignCached();
        if (isCampaignLive(campaign)) {
          return applyCampaignToProduct(product, campaign);
        }
      }
      return product;
    } catch (err) {
      console.error('productService.getById:', err);
      return null;
    }
  }
};