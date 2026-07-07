/**
 * Credit Calculator Service
 *
 * Firestore: creditCalculator/config — tək doc
 *
 * Struktur:
 *  - enabled: kalkulyator məhsul səhifəsində göstərilirmi
 *  - defaultMonths: faiz təyin edilməmiş brendlər üçün göstərilən ay seçimləri
 *      (məs: [6, 9, 12, 15, 18, 24]) — bunlar üçün faiz 0% (faizsiz)
 *  - brandRates: hər brend üçün ay → faiz cədvəli
 *      Brend siyahıda olmazsa → məhsul "faizsiz" hesab olunur (defaultMonths)
 *      Brend siyahıda var, amma rates boşdursa → defaultMonths/0% göstərilir
 *  - installmentCards: "Taksitlə al" bölməsi — bank kartları (faizsiz)
 *      Hər kart üçün ad, loqo şəkli və dəstəklənən aylar
 */
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export interface BrandRate {
  months: number;
  percent: number;
}

export interface BrandCreditConfig {
  brand: string;
  rates: BrandRate[];
}

export interface InstallmentCard {
  id: string;
  name: string;          // məs: "Birbank", "LeoBank"
  logoUrl: string;       // bank kartı loqosu
  months: number[];      // dəstəklənən aylar, məs: [3, 6, 12, 18]
  bgColor?: string;      // loqo arxa fonu (məs: #E30613)
  isActive: boolean;
}

export interface CreditCalculatorConfig {
  enabled: boolean;
  defaultMonths: number[];
  brandRates: BrandCreditConfig[];
  installmentCards: InstallmentCard[];
  updatedAt?: any;
}

const COLLECTION = 'creditCalculator';
const DOC_ID = 'config';

export const defaultConfig = (): CreditCalculatorConfig => ({
  enabled: true,
  defaultMonths: [6, 9, 12, 15, 18, 24],
  brandRates: [],
  installmentCards: [],
});

export const getCreditConfig = async (): Promise<CreditCalculatorConfig> => {
  try {
    const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
    if (!snap.exists()) return defaultConfig();
    return { ...defaultConfig(), ...(snap.data() as CreditCalculatorConfig) };
  } catch (e) {
    console.warn('creditCalculatorService.getCreditConfig error:', e);
    return defaultConfig();
  }
};

export const saveCreditConfig = async (
  data: CreditCalculatorConfig
): Promise<void> => {
  await setDoc(
    doc(db, COLLECTION, DOC_ID),
    { ...data, updatedAt: Timestamp.now() },
    { merge: true }
  );
};

export const subscribeCreditConfig = (
  cb: (c: CreditCalculatorConfig) => void
): (() => void) => {
  const unsub = onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        cb(defaultConfig());
        return;
      }
      cb({ ...defaultConfig(), ...(snap.data() as CreditCalculatorConfig) });
    },
    () => cb(defaultConfig())
  );
  return unsub;
};

export const uploadCardLogo = async (file: File): Promise<string> => {
  const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const r = storageRef(storage, `installmentCards/${safeName}`);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
};

/**
 * Verilən brend üçün effektiv ay/faiz cədvəlini qaytarır.
 * Brend tapılmazsa və ya rates boşdursa → defaultMonths-dan 0% qaytarır.
 */
export const getRatesForBrand = (
  config: CreditCalculatorConfig,
  brand: string
): BrandRate[] => {
  const normalised = (brand || '').trim().toLowerCase();
  if (normalised) {
    const found = config.brandRates.find(
      (b) => (b.brand || '').trim().toLowerCase() === normalised
    );
    if (found && Array.isArray(found.rates) && found.rates.length > 0) {
      return [...found.rates].sort((a, b) => a.months - b.months);
    }
  }
  return (config.defaultMonths || [])
    .slice()
    .sort((a, b) => a - b)
    .map((m) => ({ months: m, percent: 0 }));
};

/**
 * Aylıq ödənişi hesablayır.
 *  - 0% (faizsiz) → price / months
 *  - faiz var → (price * (1 + percent/100)) / months  (sadə model)
 */
export const calcMonthly = (price: number, months: number, percent: number): number => {
  if (!price || !months) return 0;
  const total = percent > 0 ? price * (1 + percent / 100) : price;
  return +(total / months).toFixed(2);
};
