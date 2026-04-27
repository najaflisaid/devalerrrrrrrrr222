import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Bütün admin paneldəki qorunan bölmələrin və işçi redaktə kilidinin şifrələri.
// Firestore-da `site_content/admin_passwords` sənədində saxlanılır.
//
//  - default      : qorunan bölmələrə (b2b, b2bOrders, b2bNotifications, b2bUsers, users) default şifrə
//  - workers      : "İşçilər" bölməsinə girmək üçün AYRI şifrə
//  - workersEdit  : İşçilər bölməsində redaktə/silmə əməliyyatlarını açmaq üçün AYRI şifrə
//
// Admin bunları admin panelin "Şifrələr" tab-ından dəyişə bilər.

const REF = 'site_content/admin_passwords';

export interface AdminPasswords {
  default: string;
  workers: string;
  workersEdit: string;
}

const DEFAULTS: AdminPasswords = {
  default: '20202025',
  workers: '20202025',
  workersEdit: '20202025',
};

const ref = () => doc(db, 'site_content', 'admin_passwords');

export const getAdminPasswords = async (): Promise<AdminPasswords> => {
  try {
    const snap = await getDoc(ref());
    if (snap.exists()) {
      const data = snap.data() as Partial<AdminPasswords>;
      return {
        default: data.default || DEFAULTS.default,
        workers: data.workers || DEFAULTS.workers,
        workersEdit: data.workersEdit || DEFAULTS.workersEdit,
      };
    }
  } catch (err) {
    console.error('getAdminPasswords:', err);
  }
  return { ...DEFAULTS };
};

export const getAdminPassword = async (key: keyof AdminPasswords): Promise<string> => {
  const all = await getAdminPasswords();
  return all[key] || DEFAULTS[key];
};

export const updateAdminPasswords = async (patch: Partial<AdminPasswords>) => {
  const trimmed: Partial<AdminPasswords> = {};
  (Object.keys(patch) as (keyof AdminPasswords)[]).forEach(k => {
    const v = (patch[k] || '').trim();
    if (v) trimmed[k] = v;
  });
  await setDoc(ref(), { ...trimmed, updated_at: new Date().toISOString() }, { merge: true });
};

// `sectionName` (PasswordProtectedSection) → şifrə açarına map
export const passwordKeyForSection = (sectionName: string): keyof AdminPasswords => {
  if (sectionName === 'workers') return 'workers';
  return 'default';
};

export { DEFAULTS as DEFAULT_ADMIN_PASSWORDS };

// Sadə hash-əvəzinə əsas yoxlama: birbaşa müqayisə (admin paneli istifadə edir, sertifikat deyil).
export const verifyPassword = async (key: keyof AdminPasswords, candidate: string): Promise<boolean> => {
  const stored = await getAdminPassword(key);
  return stored === candidate;
};
