import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { Product } from '../types';

export const productService = {
  async getAll(includeComingSoon: boolean = false): Promise<Product[]> {
    try {
      const userRole = localStorage.getItem('userRole');
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

      console.log('ProductService.getAll - final products returned:', products.length);
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

    return products.slice(0, limit);
  },

  async add(product: Omit<Product, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: new Date()
    });
    return docRef.id;
  },

  async update(id: string, product: Partial<Product>): Promise<void> {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, product);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'products', id));
  },

  async uploadImage(file: File, productId: string): Promise<string> {
    const imageRef = ref(storage, `products/${productId}/${file.name}`);
    await uploadBytes(imageRef, file);
    return await getDownloadURL(imageRef);
  }
};