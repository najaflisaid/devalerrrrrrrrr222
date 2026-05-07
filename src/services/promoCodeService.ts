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
  discount: number; // percent (0 if amount-based)
  type?: 'percent' | 'amount'; // default 'percent'
  amountAZN?: number; // fixed amount discount in AZN (only when type === 'amount')
  isGiftCard?: boolean; // true if generated from a gift-card purchase
  used: boolean;
  // Admin müəyyən bir müştəriyə kod təyin edə bilər. Boş olarsa hər kəs istifadə edə bilər.
  assignedTo?: {
    userId?: string;
    userEmail?: string;
    userName?: string;
  };
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
 * `assignedTo` verilərsə kod yalnız həmin istifadəçi üçün etibarlı olur.
 */
export const createPromoCode = async (
  discount: number,
  createdBy?: string,
  assignedTo?: { userId: string; userEmail?: string; userName?: string }
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
      ...(assignedTo
        ? {
            assignedTo: {
              userId: assignedTo.userId,
              userEmail: assignedTo.userEmail || '',
              userName: assignedTo.userName || '',
            },
          }
        : {}),
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
 *
 * Əgər kod konkret müştəriyə təyin olunubsa (`assignedTo.userId`), yalnız
 * həmin istifadəçi onu istifadə edə bilər. `userId` parametri verilməyibsə
 * və ya uyğun deyilsə, kod rədd olunur.
 */
export const validatePromoCode = async (
  code: string,
  userId?: string
): Promise<
  | { valid: true; type: 'percent'; discount: number }
  | { valid: true; type: 'amount'; amountAZN: number }
  | { valid: false; reason: string }
> => {
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
  // Konkret müştəriyə təyin olunmuş kod yalnız o müştəri üçün
  if (data.assignedTo?.userId) {
    if (!userId || data.assignedTo.userId !== userId) {
      return {
        valid: false,
        reason: 'Bu promo kod sizə təyin olunmayıb',
      };
    }
  }
  if (data.type === 'amount') {
    return { valid: true, type: 'amount', amountAZN: data.amountAZN || 0 };
  }
  return { valid: true, type: 'percent', discount: data.discount };
};

/**
 * Gift card satışı zamanı sabit AZN dəyəri olan unikal promo kod yaradır.
 */
export const createGiftCardPromoCode = async (
  amountAZN: number,
  createdBy?: string,
  assignedTo?: { userId: string; userEmail?: string; userName?: string }
): Promise<PromoCode> => {
  if (!amountAZN || amountAZN <= 0) {
    throw new Error('Gift kart məbləği 0-dan böyük olmalıdır');
  }

  for (let i = 0; i < 5; i++) {
    const code = generate6DigitCode();
    const ref = doc(db, COLLECTION, code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    const data: PromoCode = {
      code,
      discount: 0,
      type: 'amount',
      amountAZN: +amountAZN.toFixed(2),
      isGiftCard: true,
      used: false,
      createdAt: Timestamp.now(),
      createdBy: createdBy || '',
      ...(assignedTo
        ? {
            assignedTo: {
              userId: assignedTo.userId,
              userEmail: assignedTo.userEmail || '',
              userName: assignedTo.userName || '',
            },
          }
        : {}),
    };
    await setDoc(ref, data);
    return data;
  }
  throw new Error('Unikal gift kart kodu yaratmaq mümkün olmadı');
};

/**
 * Müəyyən istifadəçiyə təyin olunmuş, hələ istifadə edilməmiş promo kodları qaytarır.
 * Müştərinin "Sifarişlərim" səhifəsində göstərmək üçün istifadə olunur.
 */
export const getUserAssignedCodes = async (userId: string): Promise<PromoCode[]> => {
  if (!userId) return [];
  const snap = await getDocs(collection(db, COLLECTION));
  const list: PromoCode[] = [];
  snap.forEach((d) => {
    const data = d.data() as PromoCode;
    if (data.assignedTo?.userId === userId && !data.used) {
      list.push(data);
    }
  });
  // Ən yenilər əvvəl
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return list;
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
