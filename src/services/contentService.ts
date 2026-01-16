import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, orderBy, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface Banner {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  subtitle_az?: string;
  subtitle_ru?: string;
  subtitle_en?: string;
  image_url: string;
  link_url: string;
  order_position: number;
  is_active: boolean;
}

export interface AboutPage {
  id?: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  content_az: string;
  content_ru: string;
  content_en: string;
  mission_az: string;
  mission_ru: string;
  mission_en: string;
  image_url?: string;
}

export interface ProductBanner {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  image_url?: string;
  video_url?: string;
  content_type: 'image' | 'video';
  link_url: string;
  position: number;
  is_active: boolean;
}

export const getActiveBanners = async () => {
  const bannersRef = collection(db, 'home_banners');
  const q = query(bannersRef, where('is_active', '==', true));
  const querySnapshot = await getDocs(q);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Banner[];

  return banners.sort((a, b) => a.order_position - b.order_position);
};

export const getAllBanners = async () => {
  const bannersRef = collection(db, 'home_banners');
  const querySnapshot = await getDocs(bannersRef);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Banner[];

  return banners.sort((a, b) => a.order_position - b.order_position);
};

export const createBanner = async (banner: Omit<Banner, 'id'>) => {
  const bannersRef = collection(db, 'home_banners');
  const docRef = await addDoc(bannersRef, banner);

  return {
    id: docRef.id,
    ...banner
  } as Banner;
};

export const updateBanner = async (id: string, banner: Partial<Banner>) => {
  const bannerRef = doc(db, 'home_banners', id);
  await updateDoc(bannerRef, { ...banner, updated_at: new Date().toISOString() });

  const updatedDoc = await getDoc(bannerRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as Banner;
};

export const deleteBanner = async (id: string) => {
  const bannerRef = doc(db, 'home_banners', id);
  await deleteDoc(bannerRef);
};

export const getAboutPage = async () => {
  const aboutRef = doc(db, 'about', 'main');
  const aboutDoc = await getDoc(aboutRef);

  if (aboutDoc.exists()) {
    return {
      id: aboutDoc.id,
      ...aboutDoc.data()
    } as AboutPage;
  }

  return null;
};

export const updateAboutPage = async (aboutData: Partial<AboutPage>) => {
  const aboutRef = doc(db, 'about', 'main');
  await setDoc(aboutRef, {
    ...aboutData,
    updated_at: new Date().toISOString()
  }, { merge: true });

  const updatedDoc = await getDoc(aboutRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as AboutPage;
};

export const getActiveProductBanners = async () => {
  const bannersRef = collection(db, 'product_banners');
  const q = query(bannersRef, where('is_active', '==', true));
  const querySnapshot = await getDocs(q);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductBanner[];

  return banners.sort((a, b) => a.position - b.position);
};

export const getAllProductBanners = async () => {
  const bannersRef = collection(db, 'product_banners');
  const querySnapshot = await getDocs(bannersRef);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductBanner[];

  return banners.sort((a, b) => a.position - b.position);
};

export const createProductBanner = async (banner: Omit<ProductBanner, 'id'>) => {
  const bannersRef = collection(db, 'product_banners');
  const docRef = await addDoc(bannersRef, banner);

  return {
    id: docRef.id,
    ...banner
  } as ProductBanner;
};

export const updateProductBanner = async (id: string, banner: Partial<ProductBanner>) => {
  const bannerRef = doc(db, 'product_banners', id);
  await updateDoc(bannerRef, { ...banner, updated_at: new Date().toISOString() });

  const updatedDoc = await getDoc(bannerRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as ProductBanner;
};

export const deleteProductBanner = async (id: string) => {
  const bannerRef = doc(db, 'product_banners', id);
  await deleteDoc(bannerRef);
};
