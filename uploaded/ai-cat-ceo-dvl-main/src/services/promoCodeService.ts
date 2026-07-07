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
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PromoCodeUsage {
  userId?: string;
  userEmail?: string;
  userName?: string;
  orderId?: string;
  /** Gift card üçün — bu konkret istifadədə tutulan AZN məbləği */
  amountUsed?: number;
  usedAt: any;
}

export interface PromoCode {
  code: string;
  discount: number; // percent (0 if amount-based)
  type?: 'percent' | 'amount'; // default 'percent'
  amountAZN?: number; // fixed amount discount in AZN (only when type === 'amount')
  /** Gift card üçün — hələ istifadə olunmamış qalan balans. İlkin = amountAZN.
   * Hər qismən istifadədə azalır. 0-a düşəndə `used: true` olur. */
  remainingAZN?: number;
  isGiftCard?: boolean; // true if generated from a gift-card purchase
  used: boolean;
  // 'single' = klassik birdəfəlik 6 rəqəmli kod (default)
  // 'campaign' = bloger/influencer üçün müddətli, çoxistifadəli kod
  kind?: 'single' | 'campaign';
  // Kampaniya kodu sahələri
  influencerName?: string;
  startsAt?: any; // Timestamp
  expiresAt?: any; // Timestamp
  usageLimit?: number; // 0 və ya undefined = limitsiz
  usageCount?: number; // neçə dəfə istifadə olunub
  active?: boolean; // admin manual aktiv/deaktiv toggle (default true)
  usageHistory?: PromoCodeUsage[]; // kim, nə vaxt, hansı sifariş ilə
  // Admin müəyyən bir müştəriyə kod təyin edə bilər. Boş olarsa hər kəs istifadə edə bilər.
  assignedTo?: {
    userId?: string;
    userEmail?: string;
    userName?: string;
  };
  // Hədiyyə kartı paylaşma metadatası — `/gift-card/[code]` səhifəsində göstərilir
  giftCardShare?: {
    senderName?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    message?: string;
    source?: 'purchase' | 'admin_influencer'; // satınalmadan və ya admin tərəfindən
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
  | { valid: true; type: 'amount'; amountAZN: number; remainingAZN: number; isGiftCard: boolean }
  | { valid: false; reason: string }
> => {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) {
    return { valid: false, reason: 'Promo kod boş ola bilməz' };
  }
  // Kod ya 6 rəqəm (single), ya da 3-20 simvol alphanumeric (campaign) olmalıdır
  if (!/^[A-Z0-9]{3,20}$/.test(trimmed)) {
    return { valid: false, reason: 'Promo kod yalnız hərf və rəqəmlərdən ibarət olmalıdır' };
  }
  const ref = doc(db, COLLECTION, trimmed);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { valid: false, reason: 'Promo kod tapılmadı' };
  }
  const data = snap.data() as PromoCode;

  // Kampaniya kodu yoxlamaları
  if (data.kind === 'campaign') {
    if (data.active === false) {
      return { valid: false, reason: 'Bu promo kod hazırda deaktivdir' };
    }
    const now = Date.now();
    const startsAtMs = data.startsAt?.toMillis ? data.startsAt.toMillis() : data.startsAt ? new Date(data.startsAt).getTime() : 0;
    const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
    if (startsAtMs && now < startsAtMs) {
      return { valid: false, reason: 'Bu promo kod hələ aktiv deyil' };
    }
    if (expiresAtMs && now > expiresAtMs) {
      return { valid: false, reason: 'Bu promo kodun müddəti bitib' };
    }
    const limit = data.usageLimit || 0;
    const count = data.usageCount || 0;
    if (limit > 0 && count >= limit) {
      return { valid: false, reason: 'Bu promo kodun istifadə limiti dolub' };
    }
    return { valid: true, type: 'percent', discount: data.discount };
  }

  // Gift card / amount kod — `used` flag-ı tam istifadəni bildirir, lakin
  // qismən istifadədən sonra `remainingAZN > 0` olsa hələ də etibarlıdır
  if (data.type === 'amount') {
    const remaining =
      typeof data.remainingAZN === 'number' ? data.remainingAZN : (data.amountAZN || 0);
    if (remaining <= 0 || data.used) {
      return { valid: false, reason: 'Bu hədiyyə kartının balansı bitib' };
    }
    // Konkret müştəriyə təyin olunmuş kart yalnız o müştəri üçün
    if (data.assignedTo?.userId) {
      if (!userId || data.assignedTo.userId !== userId) {
        return { valid: false, reason: 'Bu hədiyyə kartı sizə təyin olunmayıb' };
      }
    }
    return {
      valid: true,
      type: 'amount',
      amountAZN: data.amountAZN || 0,
      remainingAZN: remaining,
      isGiftCard: !!data.isGiftCard,
    };
  }

  // Klassik single-use percent kod
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
  return { valid: true, type: 'percent', discount: data.discount };
};

/**
 * Gift card satışı zamanı sabit AZN dəyəri olan unikal promo kod yaradır.
 */
export const createGiftCardPromoCode = async (
  amountAZN: number,
  createdBy?: string,
  assignedTo?: { userId: string; userEmail?: string; userName?: string },
  giftCardShare?: {
    senderName?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    message?: string;
    source?: 'purchase' | 'admin_influencer';
  }
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
      remainingAZN: +amountAZN.toFixed(2),
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
      ...(giftCardShare
        ? {
            giftCardShare: {
              senderName: giftCardShare.senderName || '',
              recipientName: giftCardShare.recipientName || '',
              recipientPhone: giftCardShare.recipientPhone || '',
              recipientEmail: giftCardShare.recipientEmail || '',
              message: giftCardShare.message || '',
              source: giftCardShare.source || 'purchase',
            },
          }
        : {}),
    };
    await setDoc(ref, data);
    return data;
  }
  throw new Error('Unikal gift kart kodu yaratmaq mümkün olmadı');
};

// Hədiyyə kartı kodunu public olaraq oxumaq üçün — `/gift-card/[code]` səhifəsi istifadə edir.
// Yalnız isGiftCard=true olan kodları qaytarır. `used: true` olsa belə qaytarılır
// ki, paylaşma səhifəsində kartın "istifadə olunub" vəziyyəti göstərilsin və
// qismən istifadədən sonra qalan balans görünsün.
export const getGiftCardByCode = async (code: string): Promise<PromoCode | null> => {
  try {
    const ref = doc(db, COLLECTION, code);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as PromoCode;
    if (!data.isGiftCard) return null;
    // Köhnə kartlarda remainingAZN olmaya bilər — backward-compatibility:
    // əgər used=false amma remainingAZN yoxdursa, amountAZN-i qalan kimi qəbul et.
    if (data.remainingAZN === undefined) {
      data.remainingAZN = data.used ? 0 : (data.amountAZN || 0);
    }
    return data;
  } catch (err) {
    console.error('getGiftCardByCode error:', err);
    return null;
  }
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
 *
 * ✅ THREAD-SAFE (Firestore transaction): iki müştəri eyni anda klikləsə,
 * yalnız BİRİ uğurla redeem edir, digərinə "artıq istifadə olunub" və ya
 * "balans kifayət etmir" xətası atılır.
 *
 * Gift card (`type: 'amount'`) üçün qismən istifadəni dəstəkləyir:
 *  - `amountToConsume` verilsə, kartdan həmin qədər tutulur (qalan balans azalır).
 *  - Verilməsə, bütün qalan balans tutulur (default — backward compat).
 *  - Balans 0-a düşəndə `used: true` qoyulur.
 */
export const redeemPromoCode = async (
  code: string,
  redeemedBy: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    orderId?: string;
    /** Yalnız gift card üçün — bu sifarişdə kartdan tutulacaq AZN məbləği.
     * Verilməsə, kartın tam balansı (remainingAZN) tutulur. */
    amountToConsume?: number;
  }
): Promise<{ amountUsed?: number; remainingAfter?: number }> => {
  const trimmed = (code || '').trim().toUpperCase();
  const ref = doc(db, COLLECTION, trimmed);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Promo kod tapılmadı');
    }
    const data = snap.data() as PromoCode;

    // ───── Kampaniya kodu ─────
    if (data.kind === 'campaign') {
      const limit = data.usageLimit || 0;
      const count = data.usageCount || 0;
      if (limit > 0 && count >= limit) {
        throw new Error('Bu promo kodun istifadə limiti dolub');
      }
      const newCount = count + 1;
      const history: PromoCodeUsage[] = Array.isArray(data.usageHistory) ? data.usageHistory : [];
      history.push({
        userId: redeemedBy.userId || '',
        userEmail: redeemedBy.userEmail || '',
        userName: redeemedBy.userName || '',
        orderId: redeemedBy.orderId || '',
        usedAt: Timestamp.now(),
      });
      const update: any = { usageCount: newCount, usageHistory: history };
      if (limit > 0 && newCount >= limit) {
        update.used = true;
      }
      tx.update(ref, update);
      return {};
    }

    // ───── Gift card / amount kod ─────
    if (data.type === 'amount') {
      const currentRemaining =
        typeof data.remainingAZN === 'number'
          ? data.remainingAZN
          : (data.amountAZN || 0);
      if (data.used || currentRemaining <= 0) {
        throw new Error('Bu hədiyyə kartının balansı bitib');
      }
      // Tutulacaq məbləğ: explicit verilibsə onu, yoxsa tam qalan balansı.
      const requested =
        typeof redeemedBy.amountToConsume === 'number'
          ? redeemedBy.amountToConsume
          : currentRemaining;
      if (requested <= 0) {
        throw new Error('Tutulacaq məbləğ 0-dan böyük olmalıdır');
      }
      const consumed = +Math.min(requested, currentRemaining).toFixed(2);
      const newRemaining = +Math.max(0, currentRemaining - consumed).toFixed(2);
      const history: PromoCodeUsage[] = Array.isArray(data.usageHistory) ? data.usageHistory : [];
      history.push({
        userId: redeemedBy.userId || '',
        userEmail: redeemedBy.userEmail || '',
        userName: redeemedBy.userName || '',
        orderId: redeemedBy.orderId || '',
        amountUsed: consumed,
        usedAt: Timestamp.now(),
      });
      const update: any = {
        remainingAZN: newRemaining,
        usageHistory: history,
      };
      if (newRemaining <= 0) {
        update.used = true;
        update.usedBy = {
          userId: redeemedBy.userId || '',
          userEmail: redeemedBy.userEmail || '',
          orderId: redeemedBy.orderId || '',
        };
        update.usedAt = Timestamp.now();
      }
      tx.update(ref, update);
      return { amountUsed: consumed, remainingAfter: newRemaining };
    }

    // ───── Klassik single-use percent kod ─────
    if (data.used) {
      throw new Error('Bu promo kod artıq istifadə olunub');
    }
    tx.update(ref, {
      used: true,
      usedBy: {
        userId: redeemedBy.userId || '',
        userEmail: redeemedBy.userEmail || '',
        orderId: redeemedBy.orderId || '',
      },
      usedAt: Timestamp.now(),
    });
    return {};
  });
};

/**
 * Bloger/influencer üçün müddətli, çoxistifadəli kampaniya kodu yaradır.
 * Kod custom (məs: BLOGER10) və alphanumeric (3-20 simvol) olmalıdır.
 */
export const createCampaignPromoCode = async (params: {
  code: string;
  discount: number;
  startsAt: Date;
  expiresAt: Date;
  usageLimit?: number; // 0 = limitsiz
  influencerName?: string;
  createdBy?: string;
}): Promise<PromoCode> => {
  const code = (params.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    throw new Error('Kod 3-20 simvol arası hərf və rəqəmlərdən ibarət olmalıdır');
  }
  if (!params.discount || params.discount < 1 || params.discount > 99) {
    throw new Error('Endirim faizi 1-99 arası olmalıdır');
  }
  if (!params.startsAt || !params.expiresAt) {
    throw new Error('Başlama və bitmə tarixi mütləqdir');
  }
  if (params.expiresAt.getTime() <= params.startsAt.getTime()) {
    throw new Error('Bitmə tarixi başlama tarixindən sonra olmalıdır');
  }

  const ref = doc(db, COLLECTION, code);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error(`"${code}" kodu artıq mövcuddur, başqa kod seçin`);
  }

  const data: PromoCode = {
    code,
    discount: params.discount,
    kind: 'campaign',
    type: 'percent',
    used: false,
    active: true,
    influencerName: (params.influencerName || '').trim(),
    startsAt: Timestamp.fromDate(params.startsAt),
    expiresAt: Timestamp.fromDate(params.expiresAt),
    usageLimit: params.usageLimit && params.usageLimit > 0 ? params.usageLimit : 0,
    usageCount: 0,
    usageHistory: [],
    createdAt: Timestamp.now(),
    createdBy: params.createdBy || '',
  };
  await setDoc(ref, data);
  return data;
};

/**
 * Kampaniya kodunun aktiv/deaktiv vəziyyətini dəyişir.
 */
export const setPromoCodeActive = async (code: string, active: boolean): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, code), { active });
};

/**
 * Müddəti bitmiş kampaniya kodlarını avtomatik silir.
 * Admin paneldə tab açıldıqda çağırılır.
 */
export const cleanupExpiredCampaignCodes = async (): Promise<number> => {
  const snap = await getDocs(collection(db, COLLECTION));
  const now = Date.now();
  let deleted = 0;
  for (const d of snap.docs) {
    const data = d.data() as PromoCode;
    if (data.kind !== 'campaign') continue;
    const expMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0;
    if (expMs && now > expMs) {
      await deleteDoc(d.ref);
      deleted += 1;
    }
  }
  return deleted;
};
