import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';

export interface Banner {
  id?: string;
  imageUrl: string;
  title: { az: string; ru: string; en: string };
  link?: string;
  position: 'home' | 'products';
  orderIndex: number;
  active: boolean;
  duration?: number;
  createdAt?: any;
}

export const getBanners = async (position?: 'home' | 'products') => {
  try {
    const bannersRef = collection(db, 'banners');
    const snapshot = await getDocs(bannersRef);

    let banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));

    banners = banners
      .filter(b => b.active === true)
      .filter(b => !position || b.position === position)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    console.log(`Loaded ${banners.length} banners for position: ${position || 'all'}`, banners);
    return banners;
  } catch (error) {
    console.error('Error loading banners from Firebase:', error);
    return [];
  }
};

export const getAllBanners = async () => {
  try {
    const bannersRef = collection(db, 'banners');
    const snapshot = await getDocs(bannersRef);
    const banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
    return banners.sort((a, b) => a.orderIndex - b.orderIndex);
  } catch (error) {
    console.error('Error loading all banners:', error);
    return [];
  }
};

export const createBanner = async (banner: Omit<Banner, 'id' | 'createdAt'>) => {
  try {
    console.log('Creating banner in Firebase:', banner);
    const bannersRef = collection(db, 'banners');
    const docRef = await addDoc(bannersRef, {
      ...banner,
      createdAt: Timestamp.now()
    });
    console.log('Banner created with ID:', docRef.id);
    return { id: docRef.id, ...banner };
  } catch (error) {
    console.error('Error creating banner:', error);
    throw error;
  }
};

export const updateBanner = async (bannerId: string, updates: Partial<Banner>) => {
  try {
    const bannerRef = doc(db, 'banners', bannerId);
    await updateDoc(bannerRef, updates);
    return { id: bannerId, ...updates };
  } catch (error) {
    console.error('Error updating banner:', error);
    throw error;
  }
};

export const deleteBanner = async (bannerId: string) => {
  try {
    const bannerRef = doc(db, 'banners', bannerId);
    await deleteDoc(bannerRef);
  } catch (error) {
    console.error('Error deleting banner:', error);
    throw error;
  }
};
