/**
 * Best Sellers Banner Service
 *
 * Firestore: bestSellersBanner/config — tək doc
 *
 * Layout: BestSellers bölməsində sağ tərəfdə sticky banner.
 * Admin paneldən şəkil + başlıq + alt-mətn + linki dəyişdirə bilər.
 */
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface BestSellersBanner {
  enabled: boolean;
  imageUrl: string;
  title: { az: string; ru: string; en: string };
  subtitle: { az: string; ru: string; en: string };
  buttonText: { az: string; ru: string; en: string };
  buttonLink: string;
  textColor: string;      // ag fonda qara, qara fonda ağ — admin seçir
  textPosition: 'top' | 'center' | 'bottom';
  updatedAt?: any;
}

const COLLECTION = 'bestSellersBanner';
const DOC_ID = 'config';

export const defaultBanner = (): BestSellersBanner => ({
  enabled: false,
  imageUrl: '',
  title: { az: '', ru: '', en: '' },
  subtitle: { az: '', ru: '', en: '' },
  buttonText: { az: 'Daha çox', ru: 'Подробнее', en: 'Discover' },
  buttonLink: '/products',
  textColor: '#ffffff',
  textPosition: 'bottom',
});

export const getBestSellersBanner = async (): Promise<BestSellersBanner> => {
  try {
    const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
    if (!snap.exists()) return defaultBanner();
    return { ...defaultBanner(), ...(snap.data() as BestSellersBanner) };
  } catch (e) {
    console.warn('bestSellersBannerService.get error:', e);
    return defaultBanner();
  }
};

export const saveBestSellersBanner = async (data: BestSellersBanner): Promise<void> => {
  await setDoc(
    doc(db, COLLECTION, DOC_ID),
    { ...data, updatedAt: Timestamp.now() },
    { merge: true }
  );
};

export const subscribeBestSellersBanner = (
  cb: (b: BestSellersBanner) => void
): (() => void) => {
  const unsub = onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        cb(defaultBanner());
        return;
      }
      cb({ ...defaultBanner(), ...(snap.data() as BestSellersBanner) });
    },
    () => cb(defaultBanner())
  );
  return unsub;
};

export const uploadBestSellersBannerImage = async (file: File): Promise<string> => {
  const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const r = storageRef(storage, `bestSellersBanner/${safeName}`);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
};
