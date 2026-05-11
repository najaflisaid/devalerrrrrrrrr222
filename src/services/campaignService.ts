/**
 * Campaign / Global Discount Service
 *
 * Firestore: campaigns/{current}  — yalnız BİR aktiv kampaniya var.
 *
 * Endirim qaydaları (option C-ə görə):
 *  - Yalnız `salePrice`-ı olmayan məhsullara tətbiq olunur (mövcud endirimlər toxunulmur).
 *  - Brendlər üçün override mümkündür:
 *      type: 'exclude'  → həmin brend tamamilə kənardadır
 *      type: 'custom'   → həmin brend üçün fərqli faiz tətbiq olunur
 *  - Kampaniya yalnız `isActive=true` VƏ tarix aralığında olarsa aktivdir.
 *  - Popup: admin yükləyir, hər ziyarətdə bir dəfə göstərilir (sessiya əsaslı).
 */
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { Product } from '../types';

export type BrandOverrideType = 'exclude' | 'custom';

export interface BrandOverride {
  brand: string;
  type: BrandOverrideType;
  percent?: number;
}

export interface CampaignPopup {
  enabled: boolean;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  delaySec: number;
}

export interface Campaign {
  name: string;
  discountPercent: number;
  brandOverrides: BrandOverride[];
  startDate: string | null; // ISO
  endDate: string | null;   // ISO
  isActive: boolean;
  popup: CampaignPopup;
  updatedAt?: any;
}

const COLLECTION = 'campaigns';
const DOC_ID = 'current';

export const defaultCampaign = (): Campaign => ({
  name: '',
  discountPercent: 0,
  brandOverrides: [],
  startDate: null,
  endDate: null,
  isActive: false,
  popup: {
    enabled: false,
    imageUrl: '',
    title: '',
    subtitle: '',
    buttonText: 'Alış-verişə başla',
    buttonLink: '/products',
    delaySec: 5,
  },
});

export const getCampaign = async (): Promise<Campaign> => {
  try {
    const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
    if (!snap.exists()) return defaultCampaign();
    return { ...defaultCampaign(), ...(snap.data() as Campaign) };
  } catch (e) {
    console.warn('campaignService.getCampaign error:', e);
    return defaultCampaign();
  }
};

export const saveCampaign = async (data: Campaign): Promise<void> => {
  await setDoc(
    doc(db, COLLECTION, DOC_ID),
    { ...data, updatedAt: Timestamp.now() },
    { merge: true }
  );
};

export const subscribeCampaign = (cb: (c: Campaign) => void): (() => void) => {
  const unsub = onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        cb(defaultCampaign());
        return;
      }
      cb({ ...defaultCampaign(), ...(snap.data() as Campaign) });
    },
    () => cb(defaultCampaign())
  );
  return unsub;
};

export const uploadCampaignImage = async (file: File): Promise<string> => {
  const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const r = storageRef(storage, `campaigns/${safeName}`);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
};

/**
 * Kampaniyanın hazırda aktiv olub-olmadığını yoxlayır
 * (admin toggle + tarix aralığı).
 */
export const isCampaignLive = (c: Campaign | null | undefined): boolean => {
  if (!c || !c.isActive) return false;
  const now = Date.now();
  if (c.startDate) {
    const s = new Date(c.startDate).getTime();
    if (!isNaN(s) && now < s) return false;
  }
  if (c.endDate) {
    const e = new Date(c.endDate).getTime();
    if (!isNaN(e) && now > e) return false;
  }
  return true;
};

/**
 * Məhsula kampaniya endirimini tətbiq edir. Yalnız `salePrice`
 * boş olduqda işləyir. Brend override-i ilə fərqli faiz və ya
 * istisna olunma mümkündür.
 *
 * Mənbə məhsulu mutate ETMİR — yenisi qaytarır.
 */
export const applyCampaignToProduct = (
  product: Product,
  campaign: Campaign | null
): Product => {
  if (!isCampaignLive(campaign)) return product;
  if (product.salePrice && product.salePrice > 0) return product; // option C
  if (!product.price || product.price <= 0) return product;

  const brand = (product.brand || '').trim();
  let percent = campaign!.discountPercent || 0;

  if (brand && Array.isArray(campaign!.brandOverrides)) {
    const override = campaign!.brandOverrides.find(
      (o) => (o.brand || '').trim().toLowerCase() === brand.toLowerCase()
    );
    if (override) {
      if (override.type === 'exclude') return product;
      if (override.type === 'custom' && typeof override.percent === 'number') {
        percent = override.percent;
      }
    }
  }

  if (!percent || percent <= 0 || percent >= 100) return product;

  const discounted = +(product.price * (1 - percent / 100)).toFixed(2);
  if (discounted >= product.price) return product;

  return { ...product, salePrice: discounted };
};

export const applyCampaignToProducts = (
  products: Product[],
  campaign: Campaign | null
): Product[] => {
  if (!isCampaignLive(campaign)) return products;
  return products.map((p) => applyCampaignToProduct(p, campaign));
};
