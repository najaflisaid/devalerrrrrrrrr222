/**
 * productMigrationService.ts
 * ---------------------------
 * Excel ilə məhsul miqrasiyası üçün:
 *   1. Smart fuzzy matching (ad + brend əsasında 88%+ oxşarlıq → eyni məhsul).
 *   2. Migration log persistensiyası (Firestore `productMigrationLogs` collection).
 *   3. Rollback (geri qaytarma) — log əsasında bazanın əvvəlki vəziyyətinə qayıdış.
 *
 * Mövcud problemi həll edir: əvvəllər boşluq/karakter fərqi ucbatından bazada
 * mövcud mallar "yoxdur" hesab edilirdi → indi smartNorm + fuzzy threshold ilə
 * dəqiq tapılır.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ───────────────────────────────────────────────────────────────────────────────
// Smart normalization & fuzzy match
// ───────────────────────────────────────────────────────────────────────────────

/**
 * smartNorm — aggressiv normalizasiya.
 * - NFKC normalize (eyni görünən amma fərqli encoding olan hərflər birləşir)
 * - Bütün whitespace (\s, \u00a0, \u200b-\u200f, tabs, newlines) tək boşluğa
 * - Bütün defis növləri (— – − ‒ ﹣ －) standart hyphen-ə
 * - Bütün apostrof növləri (' ' ` ´) sadə apostrofa
 * - Lowercase
 * - Sonra/əvvəl boşluq trim
 */
export const smartNorm = (s: any): string => {
  if (s === null || s === undefined) return '';
  let v = String(s);
  // Unicode normalize (eyni hərflərin müxtəlif encoding-ləri birləşir)
  try {
    v = v.normalize('NFKC');
  } catch {
    /* noop */
  }
  // Bütün dash növlərini standart hyphen-ə
  v = v.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
  // Apostrof variantları
  v = v.replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'");
  // Zero-width və control chars sil
  v = v.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');
  // Bütün whitespace-i (NBSP daxil) tək boşluğa
  v = v.replace(/[\s\u00A0]+/g, ' ');
  // Lowercase + trim
  return v.toLowerCase().trim();
};

/**
 * Levenshtein distance — iki sətrin neçə hərflə fərqlənməsi.
 * Sürətli array-tabanlı implementasiya.
 */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  // Yalnız 2 sıra saxlayırıq (memory-efficient)
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j] + 1,            // deletion
        prev[j - 1] + cost      // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

/**
 * similarity — 0..1 arası oxşarlıq əmsalı (1 = eyni).
 * Levenshtein-i sətrin uzunluğuna görə normallaşdırır.
 */
export const similarity = (a: string, b: string): number => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

/**
 * fuzzyMatchKey — ad + brend birləşməsindən fuzzy match key.
 * Format: "<normalizedName>||<normalizedBrand>"
 */
export const fuzzyMatchKey = (name: string, brand: string): string =>
  `${smartNorm(name)}||${smartNorm(brand)}`;

/**
 * findBestMatch — verilmiş ad+brend üçün məhsullar siyahısından ən yaxşı match.
 *
 * Mərhələ 1: Tam smartNorm match (name + brand) → 100% match.
 * Mərhələ 2: Ad fuzzy similarity >= threshold VƏ brend tam match.
 * Mərhələ 3: Brend boşdursa, yalnız ad fuzzy match.
 *
 * @returns matched product + confidence, və ya null.
 */
export interface MatchCandidate {
  product: { id: string; name: any; brand: string; [k: string]: any };
  confidence: number; // 0..1
  reason: 'exact' | 'fuzzy-name' | 'fuzzy-name-only';
}

export const findBestMatch = (
  rowName: string,
  rowBrand: string,
  products: Array<{ id: string; name: any; brand: string; [k: string]: any }>,
  threshold = 0.88
): MatchCandidate | null => {
  const nName = smartNorm(rowName);
  const nBrand = smartNorm(rowBrand);
  if (!nName) return null;

  // Hər məhsul üçün ən yaxşı ad variantını (az / en / ru) götür
  const getProductNames = (p: any): string[] => {
    const n = p.name || {};
    return [n.az, n.en, n.ru].filter(Boolean).map(smartNorm);
  };

  // 1) EXACT match: smartNorm(name) + smartNorm(brand) eyni
  for (const p of products) {
    const pBrand = smartNorm(p.brand);
    if (nBrand && pBrand !== nBrand) continue;
    const pNames = getProductNames(p);
    if (pNames.some((pn) => pn === nName)) {
      return { product: p, confidence: 1, reason: 'exact' };
    }
  }

  // 2) FUZZY match — brend eynidirsə, ad oxşarlığı >= threshold
  let best: MatchCandidate | null = null;
  for (const p of products) {
    const pBrand = smartNorm(p.brand);
    if (nBrand && pBrand !== nBrand) continue;
    const pNames = getProductNames(p);
    for (const pn of pNames) {
      const score = similarity(nName, pn);
      if (score >= threshold && (!best || score > best.confidence)) {
        best = { product: p, confidence: score, reason: 'fuzzy-name' };
      }
    }
  }
  if (best) return best;

  // 3) Brend boşdursa, yalnız ad ilə fuzzy axtar (daha yüksək threshold)
  if (!nBrand) {
    for (const p of products) {
      const pNames = getProductNames(p);
      for (const pn of pNames) {
        const score = similarity(nName, pn);
        if (score >= Math.max(0.92, threshold + 0.04) && (!best || score > best.confidence)) {
          best = { product: p, confidence: score, reason: 'fuzzy-name-only' };
        }
      }
    }
  }

  return best;
};

// ───────────────────────────────────────────────────────────────────────────────
// Migration log (Firestore: productMigrationLogs)
// ───────────────────────────────────────────────────────────────────────────────

const COLL = 'productMigrationLogs';

export interface MigrationUpdateEntry {
  productId: string;
  productName: string;
  /** Köhnə dəyərlər — rollback üçün */
  oldValues: { stock?: number; visibleTo?: string; [k: string]: any };
  /** Tətbiq olunan yeni dəyərlər */
  newValues: { stock?: number; visibleTo?: string; [k: string]: any };
}

export interface MigrationCreationEntry {
  productId: string;
  productName: string;
  /** Yaradılan tam məhsul snapshot-u (rollback-da yenidən qoymaq üçün lazım deyil, sadəcə silinəcək) */
  data: Record<string, any>;
}

export interface MigrationLogDoc {
  id: string;
  appliedAt: Timestamp | Date | null;
  appliedBy: string;
  fileName: string;
  summary: {
    updatedCount: number;
    createdCount: number;
    skippedCount: number;
    stockMode: 'replace' | 'add';
  };
  updates: MigrationUpdateEntry[];
  creations: MigrationCreationEntry[];
  status: 'applied' | 'rolled_back';
  rolledBackAt?: Timestamp | Date | null;
  rolledBackBy?: string;
}

/**
 * saveMigrationLog — apply uğurlu olduqdan sonra çağrılır.
 * Migration metadata + bütün dəyişiklik snapshot-larını Firestore-da saxlayır.
 */
export const saveMigrationLog = async (
  payload: Omit<MigrationLogDoc, 'id' | 'appliedAt' | 'status'>
): Promise<string> => {
  const ref = await addDoc(collection(db, COLL), {
    ...payload,
    appliedAt: serverTimestamp(),
    status: 'applied',
  });
  return ref.id;
};

/**
 * listMigrationLogs — bütün miqrasiyaların siyahısı, yeni → köhnə sırası ilə.
 */
export const listMigrationLogs = async (): Promise<MigrationLogDoc[]> => {
  const q = query(collection(db, COLL), orderBy('appliedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
};

/**
 * detectRollbackConflicts — rollback etməzdən əvvəl yoxla:
 * əgər hər hansı update entry-nin məhsulu indiki dəyəri ilə fərqlənirsə
 * (yəni miqrasiyadan sonra başqa biri redaktə edib), conflict siyahısına əlavə et.
 */
export interface RollbackConflict {
  productId: string;
  productName: string;
  field: string;
  /** Miqrasiyada tətbiq olunan dəyər */
  expectedCurrent: any;
  /** Bazada indi olan dəyər (sonradan dəyişdirilmiş) */
  actualCurrent: any;
}

export const detectRollbackConflicts = async (
  log: MigrationLogDoc
): Promise<RollbackConflict[]> => {
  const conflicts: RollbackConflict[] = [];
  for (const u of log.updates) {
    const snap = await getDoc(doc(db, 'products', u.productId));
    if (!snap.exists()) continue; // məhsul artıq silinib, conflict yox (skip ediləcək)
    const data = snap.data() as any;
    for (const field of Object.keys(u.newValues)) {
      const expected = u.newValues[field];
      const actual = data[field];
      // Dərin müqayisə sadə tipo üçün
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        conflicts.push({
          productId: u.productId,
          productName: u.productName,
          field,
          expectedCurrent: expected,
          actualCurrent: actual,
        });
      }
    }
  }
  return conflicts;
};

/**
 * rollbackMigration — log əsasında geri qaytarma:
 * 1) Hər update entry-də köhnə dəyərləri (oldValues) bazaya yaz.
 * 2) Hər creation entry-də yaradılmış məhsulu sil.
 * 3) Log-u 'rolled_back' kimi işarələ.
 *
 * @param force — true olarsa, conflict olsa belə davam et (istifadəçi təsdiqindən sonra).
 */
export const rollbackMigration = async (
  log: MigrationLogDoc,
  appliedBy: string,
  force = false
): Promise<{ updatedCount: number; deletedCount: number; skippedCount: number }> => {
  if (log.status === 'rolled_back') {
    throw new Error('Bu miqrasiya artıq geri qaytarılıb.');
  }

  let updatedCount = 0;
  let deletedCount = 0;
  let skippedCount = 0;

  // 1) Updates → köhnə dəyərləri bərpa et
  for (const u of log.updates) {
    const ref = doc(db, 'products', u.productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Məhsul artıq silinib — keçmişdə yaradılmadığı üçün sadəcə skip
      skippedCount++;
      continue;
    }
    if (!force) {
      // Conflict yoxla (sonradan dəyişib?)
      const data = snap.data() as any;
      let hasConflict = false;
      for (const field of Object.keys(u.newValues)) {
        if (JSON.stringify(u.newValues[field]) !== JSON.stringify(data[field])) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) {
        skippedCount++;
        continue;
      }
    }
    await updateDoc(ref, u.oldValues);
    updatedCount++;
  }

  // 2) Creations → məhsulları sil (əgər hələ də mövcuddur)
  for (const c of log.creations) {
    const ref = doc(db, 'products', c.productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      skippedCount++;
      continue;
    }
    await deleteDoc(ref);
    deletedCount++;
  }

  // 3) Log-u rolled_back kimi işarələ
  await setDoc(
    doc(db, COLL, log.id),
    {
      status: 'rolled_back',
      rolledBackAt: serverTimestamp(),
      rolledBackBy: appliedBy,
    },
    { merge: true }
  );

  return { updatedCount, deletedCount, skippedCount };
};

/**
 * deleteMigrationLog — log yazısını tamamilə sil (yalnız artıq rolled_back olanlar üçün).
 */
export const deleteMigrationLog = async (logId: string): Promise<void> => {
  await deleteDoc(doc(db, COLL, logId));
};
