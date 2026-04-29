/**
 * Promo Code Service
 *
 * Collection: promo_codes/{code}
 *  - code: 6-digit string
 *  - discount: 5 | 10 | 15 | 20  (percent)
 *  - used: boolean (false until customer redeems)
 *  - usedBy: { userId?, userEmail?, orderId? }
 *  - usedAt: Timestamp
 *  - createdAt: Timestamp
 *  - createdBy: admin email/id (optional)
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PromoCode {
  code: string;
  discount: number; // percent
  used: boolean;
  usedBy?: {
    userId?: string;
    userEmail?: string;
    orderId?: string;
  };
  usedAt?: any;
  createdAt: any;
  createdBy?: string;
}

const COLLECTION = 'promo_codes';

const generate6DigitCode = (): string => {
  // 6 rəqəmli kod (000000 ehtimalı az, kifayət qədər unikal)
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Yeni promo kod yaradır. Dublikatdan qaçınmaq üçün 5 dəfəyə qədər təkrarlayır.
 */
export const createPromoCode = async (
  discount: number,
  createdBy?: string
): Promise<PromoCode> => {
  if (![5, 10, 15, 20].includes(discount)) {
    throw new Error('Endirim faizi yalnız 5, 10, 15 və ya 20 ola bilər');
  }

  for (let i = 0; i < 5; i++) {
    const code = generate6DigitCode();
    const ref = doc(db, COLLECTION, code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const data: PromoCode = {
      code,
      discount,
      used: false,
      createdAt: Timestamp.now(),
      createdBy: createdBy || '',
    };
    await setDoc(ref, data);
    return data;
  }
  throw new Error('Unikal promo kod yaratmaq mümkün olmadı, yenidən cəhd edin');
};

/**
 * Bütün promo kodları qaytarır (admin panel üçün), ən yenilər əvvəl.
 */
export const listPromoCodes = async (): Promise<PromoCode[]> => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as any) } as PromoCode));
};

export const deletePromoCode = async (code: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, code));
};

/**
 * Müştəri kodu səbətdə yoxlayır (mark-etmir, sadəcə validate edir).
 * Ok varsa { valid: true, discount } qaytarır.
 */
export const validatePromoCode = async (
  code: string
): Promise<{ valid: true; discount: number } | { valid: false; reason: string }> => {
  const trimmed = (code || '').trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, reason: 'Promo kod 6 rəqəmli olmalıdır' };
  }
  const ref = doc(db, COLLECTION, trimmed);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { valid: false, reason: 'Promo kod tapılmadı' };
  }
  const data = snap.data() as PromoCode;
  if (data.used) {
    return { valid: false, reason: 'Bu promo kod artıq istifadə olunub' };
  }
  return { valid: true, discount: data.discount };
};

/**
 * Sifariş zamanı kodu istifadə olundu kimi qeyd edir.
 * Yarış vəziyyətinə (race condition) qarşı: əvvəlcə oxuyur, sonra yenidən yoxlayır və yazır.
 */
export const redeemPromoCode = async (
  code: string,
  redeemedBy: { userId?: string; userEmail?: string; orderId?: string }
): Promise<void> => {
  const trimmed = (code || '').trim();
  const ref = doc(db, COLLECTION, trimmed);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Promo kod tapılmadı');
  }
  const data = snap.data() as PromoCode;
  if (data.used) {
    throw new Error('Bu promo kod artıq istifadə olunub');
  }
  await updateDoc(ref, {
    used: true,
    usedBy: {
      userId: redeemedBy.userId || '',
      userEmail: redeemedBy.userEmail || '',
      orderId: redeemedBy.orderId || '',
    },
    usedAt: Timestamp.now(),
  });
};
