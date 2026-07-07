import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Bütün admin paneldəki qorunan bölmələrin və işçi redaktə kilidinin şifrələri.
// Firestore-da `site_content/admin_passwords` sənədində saxlanılır.
//
//  - default      : qorunan bölmələrə default şifrə
//  - workers      : "İşçilər" bölməsinə girmək üçün AYRI şifrə
//  - workersEdit  : İşçilər bölməsində redaktə/silmə əməliyyatlarını açmaq üçün AYRI şifrə
//  - perSection   : hər bölmə üçün xüsusi şifrə və/və ya şifrəsiz açıqlama
//

const REF = 'site_content/admin_passwords';

export interface SectionPasswordConfig {
  password?: string;       // Bu bölmə üçün xüsusi şifrə (boşdursa default-a düşür)
  noPassword?: boolean;    // True olarsa şifrə tələb edilmir
}

export interface AdminPasswords {
  default: string;
  workers: string;
  workersEdit: string;
  perSection?: Record<string, SectionPasswordConfig>;
}

const DEFAULTS: AdminPasswords = {
  default: '20202025',
  workers: '20202025',
  workersEdit: '20202025',
  perSection: {},
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
        perSection: data.perSection || {},
      };
    }
  } catch (err) {
    console.error('getAdminPasswords:', err);
  }
  return { ...DEFAULTS, perSection: {} };
};

export const getAdminPassword = async (key: keyof AdminPasswords): Promise<string> => {
  const all = await getAdminPasswords();
  const v = all[key];
  return typeof v === 'string' ? v : DEFAULTS[key as 'default'];
};

export const updateAdminPasswords = async (patch: Partial<AdminPasswords>) => {
  const trimmed: Partial<AdminPasswords> = {};
  if (typeof patch.default === 'string' && patch.default.trim()) trimmed.default = patch.default.trim();
  if (typeof patch.workers === 'string' && patch.workers.trim()) trimmed.workers = patch.workers.trim();
  if (typeof patch.workersEdit === 'string' && patch.workersEdit.trim()) trimmed.workersEdit = patch.workersEdit.trim();
  if (patch.perSection !== undefined) trimmed.perSection = patch.perSection;
  await setDoc(ref(), { ...trimmed, updated_at: new Date().toISOString() }, { merge: true });
};

export const updateSectionConfig = async (
  sectionName: string,
  config: SectionPasswordConfig
): Promise<void> => {
  const current = await getAdminPasswords();
  const perSection = { ...(current.perSection || {}) };
  // Trim password
  const cleanPassword = (config.password || '').trim();
  perSection[sectionName] = {
    password: cleanPassword,
    noPassword: !!config.noPassword,
  };
  await setDoc(ref(), { perSection, updated_at: new Date().toISOString() }, { merge: true });
};

export const removeSectionConfig = async (sectionName: string): Promise<void> => {
  const current = await getAdminPasswords();
  const perSection = { ...(current.perSection || {}) };
  delete perSection[sectionName];
  await setDoc(ref(), { perSection, updated_at: new Date().toISOString() }, { merge: true });
};

// `sectionName` (PasswordProtectedSection) → şifrə açarına map
export const passwordKeyForSection = (sectionName: string): keyof AdminPasswords => {
  if (sectionName === 'workers') return 'workers';
  return 'default';
};

// Bəzi bölmələr üçün built-in "boks" şifrə — admin `perSection`-də açıq şifrə
// təyin etməyibsə, bu şifrə istifadə olunur. (AI SEO tabı üçün istifadəçinin
// istəyi ilə default `2345` təyin olunub.)
const DEFAULT_SECTION_PASSWORDS: Record<string, string> = {
  aiSeo: '2345',
};

// Bu bölmələr xüsusi konfiqurasiya yoxdursa AÇIQ qalır (şifrə tələb etmir).
// Admin lazım bilsə, "Şifrələr" bölməsindən hər birinə şifrə təyin edə bilər.
const DEFAULT_OPEN_SECTIONS = new Set([
  'products',
  'reviews',
  'aiKnowledge',
  'banners',
  'productBanners',
  'homeSections',
  'about',
  'privacy',
  'return',
  'delivery',
  'careers',
  'brands',
  'categories',
  'blogs',
  'partners',
  'contactMessages',
  'siteSettings',
  'aiInbox',
]);

export { DEFAULTS as DEFAULT_ADMIN_PASSWORDS };

/**
 * Verify password for a given section.
 * - If section is configured with `noPassword: true` → always returns true (no auth needed)
 * - If section has a custom `password` → match against that
 * - If section is in DEFAULT_OPEN_SECTIONS and no config → open (no password needed)
 * - Otherwise falls back to the global key (default / workers)
 */
export const verifySectionPassword = async (
  sectionName: string,
  candidate: string
): Promise<boolean> => {
  const all = await getAdminPasswords();
  const cfg = all.perSection?.[sectionName];
  if (cfg?.noPassword) return true;
  if (cfg?.password && cfg.password.length > 0) {
    return cfg.password === candidate;
  }
  // Built-in per-section default (e.g. aiSeo → '2345')
  const builtIn = DEFAULT_SECTION_PASSWORDS[sectionName];
  if (builtIn) return builtIn === candidate;
  // No explicit config: open-by-default sections allow access without password
  if (DEFAULT_OPEN_SECTIONS.has(sectionName)) return true;
  // Fallback to global key
  const key = passwordKeyForSection(sectionName);
  const stored = all[key];
  return typeof stored === 'string' && stored === candidate;
};

/**
 * Returns true if the section is unlocked without password (noPassword toggle
 * or in DEFAULT_OPEN_SECTIONS list with no admin-set password).
 */
export const isSectionOpen = async (sectionName: string): Promise<boolean> => {
  const all = await getAdminPasswords();
  const cfg = all.perSection?.[sectionName];
  if (cfg?.noPassword) return true;
  // If admin explicitly set a password, section is locked
  if (cfg?.password && cfg.password.length > 0) return false;
  // Sections with a built-in default password are always locked until entered
  if (DEFAULT_SECTION_PASSWORDS[sectionName]) return false;
  // Otherwise: open if in default-open list
  return DEFAULT_OPEN_SECTIONS.has(sectionName);
};

// Backwards-compat: legacy verifyPassword by global key
export const verifyPassword = async (key: keyof AdminPasswords, candidate: string): Promise<boolean> => {
  const stored = await getAdminPassword(key);
  return stored === candidate;
};
