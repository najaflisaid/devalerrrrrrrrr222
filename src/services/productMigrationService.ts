/**
 * productMigrationService.ts
 * ---------------------------
 * Excel ilə məhsul miqrasiyası üçün təkmilləşdirilmiş v2:
 *   1. Dəqiq uyğunlaşdırma — SKU/kod birinci növbədə, ad+brend ikinci (smartNorm ilə).
 *   2. Opsiyonal fuzzy match — yalnız istifadəçi açıq şəkildə açdıqda və yüksək threshold ilə.
 *   3. Firestore writeBatch ilə ATOMIK yazılar (500-lük chunks) — race yoxdur.
 *   4. Cache invalidation — apply/rollback sonrası productService cache-i sıfırlanır.
 *   5. Migration log + təhlükəsiz rollback (conflict detection ilə).
 *
 * Köhnə bug-lar:
 *   - 88% fuzzy threshold "Casio LTP-1094E-1ARDF" və "Casio LTP-1094E-7ARDF" kimi
 *     SKU-da fərqlənən amma çox oxşar adlı malları SƏHV uyğunlaşdırırdı →
 *     miqdar yanlış məhsula gedirdi. İndi default OFF, və threshold 0.95+.
 *   - Promise.all paralel writes → eyni məhsula düşən 2 sətirdə son yazı qalırdı.
 *     İndi writeBatch ilə ardıcıl atomik yazır.
 *   - Cache invalidate olunmurdu → B2B tərəf köhnə miqdarları göstərirdi.
 *     İndi mütləq invalidateProductsCachePublic() çağrılır.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { invalidateProductsCachePublic } from './productService';

// ───────────────────────────────────────────────────────────────────────────────
// Normalize & fuzzy
// ───────────────────────────────────────────────────────────────────────────────

/**
 * smartNorm — aggresiv normalize:
 *  NFKC unicode → bütün whitespace tək boşluğa → bütün defislər `-` → apostroflar `'` →
 *  zero-width hərflər silinir → lowercase → trim.
 */
export const smartNorm = (s: any): string => {
  if (s === null || s === undefined) return '';
  let v = String(s);
  try {
    v = v.normalize('NFKC');
  } catch {
    /* noop */
  }
  v = v.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
  v = v.replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'");
  v = v.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');
  v = v.replace(/[\s\u00A0]+/g, ' ');
  return v.toLowerCase().trim();
};

/**
 * skuNorm — SKU/kod üçün xüsusi normalize:
 *  smartNorm + bütün non-alphanumerik hərflər silinir (— − - / . _ space və.s).
 *  Beləliklə "LTP-1094E-7ARDF" və "ltp 1094 e 7ardf" eyni hesab olunur.
 */
export const skuNorm = (s: any): string => {
  const v = smartNorm(s);
  return v.replace(/[^a-z0-9]/gi, '');
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

export const similarity = (a: string, b: string): number => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

// ───────────────────────────────────────────────────────────────────────────────
// Match strategy
// ───────────────────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  product: { id: string; name: any; brand: string; sku?: string; [k: string]: any };
  confidence: number;
  /**
   * Niyə tapıldı:
   *  - 'sku'           → məhsul kodu eyni (ən güclü)
   *  - 'exact-name'    → smartNorm(ad) + smartNorm(brend) tam eyni
   *  - 'exact-name-no-brand' → fayla brend yazılmayıb, yalnız ad smartNorm tam eyni
   *  - 'fuzzy-name'    → ad fuzzy ≥ threshold (yalnız allowFuzzy=true halında)
   */
  reason: 'sku' | 'exact-name' | 'exact-name-no-brand' | 'fuzzy-name';
}

export interface FindMatchOptions {
  /** Fuzzy match açıqdırmı? Defolt: false. */
  allowFuzzy?: boolean;
  /** Fuzzy threshold — defolt 0.95 (çox yüksək, yalnız aşkar typo-lar üçün). */
  fuzzyThreshold?: number;
}

/**
 * findBestMatch — verilmiş row (sku/ad/brend) üçün məhsul siyahısından ən yaxşı match.
 *
 * Prioritet sırası:
 *   1) SKU eyni (skuNorm) → exact match (confidence=1)
 *   2) smartNorm(ad)+smartNorm(brend) eyni → exact-name match
 *   3) Brend boşdursa, yalnız smartNorm(ad) eyni → exact-name-no-brand
 *   4) (opsional) ad fuzzy ≥ threshold (DEFAULT OFF)
 */
export const findBestMatch = (
  rowSku: string,
  rowName: string,
  rowBrand: string,
  products: Array<{ id: string; name: any; brand: string; sku?: string; [k: string]: any }>,
  options: FindMatchOptions = {}
): MatchCandidate | null => {
  const { allowFuzzy = false, fuzzyThreshold = 0.95 } = options;
  const nSku = skuNorm(rowSku);
  const nName = smartNorm(rowName);
  const nBrand = smartNorm(rowBrand);

  // 1) SKU exact match — ən güclü, ad/brend nəzərə alınmır
  if (nSku) {
    for (const p of products) {
      const pSku = skuNorm(p.sku || '');
      if (pSku && pSku === nSku) {
        return { product: p, confidence: 1, reason: 'sku' };
      }
    }
  }

  if (!nName) return null;

  const getProductNames = (p: any): string[] => {
    const n = p.name || {};
    return [n.az, n.en, n.ru].filter(Boolean).map(smartNorm);
  };

  // 2) Tam ad+brend match
  if (nBrand) {
    for (const p of products) {
      if (smartNorm(p.brand) !== nBrand) continue;
      const pNames = getProductNames(p);
      if (pNames.some((pn) => pn === nName)) {
        return { product: p, confidence: 1, reason: 'exact-name' };
      }
    }
  } else {
    // 3) Brend yoxdur — yalnız ad
    for (const p of products) {
      const pNames = getProductNames(p);
      if (pNames.some((pn) => pn === nName)) {
        return { product: p, confidence: 1, reason: 'exact-name-no-brand' };
      }
    }
  }

  // 4) Opsiyonal fuzzy (defolt OFF — yanlış uyğunlaşdırmanın qarşısını alır)
  if (allowFuzzy) {
    let best: MatchCandidate | null = null;
    for (const p of products) {
      const pBrandN = smartNorm(p.brand);
      if (nBrand && pBrandN !== nBrand) continue;
      const pNames = getProductNames(p);
      for (const pn of pNames) {
        const score = similarity(nName, pn);
        if (score >= fuzzyThreshold && (!best || score > best.confidence)) {
          best = { product: p, confidence: score, reason: 'fuzzy-name' };
        }
      }
    }
    if (best) return best;
  }

  return null;
};

// ───────────────────────────────────────────────────────────────────────────────
// Migration log (Firestore: productMigrationLogs)
// ───────────────────────────────────────────────────────────────────────────────

const COLL = 'productMigrationLogs';
// Firestore writeBatch atomik amma 500 əməliyyat limiti var.
const BATCH_LIMIT = 450; // təhlükəsiz marja

export interface MigrationUpdateEntry {
  productId: string;
  productName: string;
  oldValues: { stock?: number; price?: number; visibleTo?: string; [k: string]: any };
  newValues: { stock?: number; price?: number; visibleTo?: string; [k: string]: any };
}

export interface MigrationCreationEntry {
  productId: string;
  productName: string;
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
    /** v2: hansı qiymət rejimi (defolt 'always') istifadə olunub */
    priceMode?: 'always' | 'never';
  };
  updates: MigrationUpdateEntry[];
  creations: MigrationCreationEntry[];
  status: 'applied' | 'rolled_back';
  rolledBackAt?: Timestamp | Date | null;
  rolledBackBy?: string;
}

/**
 * saveMigrationLog — apply uğurlu olduqdan sonra çağrılır.
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

export interface RollbackConflict {
  productId: string;
  productName: string;
  field: string;
  expectedCurrent: any;
  actualCurrent: any;
}

export const detectRollbackConflicts = async (
  log: MigrationLogDoc
): Promise<RollbackConflict[]> => {
  const conflicts: RollbackConflict[] = [];
  for (const u of log.updates) {
    const snap = await getDoc(doc(db, 'products', u.productId));
    if (!snap.exists()) continue;
    const data = snap.data() as any;
    for (const field of Object.keys(u.newValues)) {
      const expected = u.newValues[field];
      const actual = data[field];
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
 * applyMigrationBatch — Firestore writeBatch ilə atomik tətbiq.
 *
 * Çağırılır ProductExcelImport-dan: updates + creations massivləri verilir,
 * 450-lik chunks-da atomik commit olunur.
 *
 * @returns yaradılmış məhsulların productId massivi (creations sırası ilə) və
 *   apply olunmuş updates sayı.
 */
export const applyMigrationBatch = async (params: {
  updates: Array<{
    productId: string;
    patch: Record<string, any>;
  }>;
  creations: Array<{
    /** id: əgər verilibsə həmin id ilə yaradılır, yoxdursa avtomatik generate olunur */
    id?: string;
    data: Record<string, any>;
  }>;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ createdIds: string[]; updatedCount: number }> => {
  const { updates, creations, onProgress } = params;
  const total = updates.length + creations.length;
  let done = 0;
  const createdIds: string[] = [];

  // 1) Updates — chunks of BATCH_LIMIT
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const chunk = updates.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const u of chunk) {
      batch.update(doc(db, 'products', u.productId), u.patch);
    }
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total);
  }

  // 2) Creations — writeBatch ilə (yeni doc id-lərini biz seçirik ki, log-da saxlayaq)
  for (let i = 0; i < creations.length; i += BATCH_LIMIT) {
    const chunk = creations.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    const chunkIds: string[] = [];
    for (const c of chunk) {
      const ref = c.id ? doc(db, 'products', c.id) : doc(collection(db, 'products'));
      batch.set(ref, c.data);
      chunkIds.push(ref.id);
    }
    await batch.commit();
    createdIds.push(...chunkIds);
    done += chunk.length;
    onProgress?.(done, total);
  }

  // 3) Cache invalidation — B2B/customer/admin tərəfdə güncəl miqdarlar görünsün
  invalidateProductsCachePublic();

  return { createdIds, updatedCount: updates.length };
};

/**
 * rollbackMigration — log əsasında atomik geri qaytarma (writeBatch).
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

  // 1) Updates rollback — köhnə dəyərləri qaytar
  // Conflict yoxlaması: əgər force=false və indi olan dəyər miqrasiyada qoyulandan
  // fərqlənirsə (sonradan biri redaktə edib), həmin malı atla.
  const updatesToApply: Array<{ productId: string; oldValues: Record<string, any> }> = [];
  for (const u of log.updates) {
    const ref = doc(db, 'products', u.productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      skippedCount++;
      continue;
    }
    if (!force) {
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
    updatesToApply.push({ productId: u.productId, oldValues: u.oldValues });
  }

  // Atomik batch commit
  for (let i = 0; i < updatesToApply.length; i += BATCH_LIMIT) {
    const chunk = updatesToApply.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const u of chunk) {
      batch.update(doc(db, 'products', u.productId), u.oldValues);
    }
    await batch.commit();
    updatedCount += chunk.length;
  }

  // 2) Creations rollback — yaradılmış malları sil
  const creationsToDelete: string[] = [];
  for (const c of log.creations) {
    const ref = doc(db, 'products', c.productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      skippedCount++;
      continue;
    }
    creationsToDelete.push(c.productId);
  }
  for (let i = 0; i < creationsToDelete.length; i += BATCH_LIMIT) {
    const chunk = creationsToDelete.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, 'products', id));
    }
    await batch.commit();
    deletedCount += chunk.length;
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

  // 4) Cache invalidation
  invalidateProductsCachePublic();

  return { updatedCount, deletedCount, skippedCount };
};

export const deleteMigrationLog = async (logId: string): Promise<void> => {
  await deleteDoc(doc(db, COLL, logId));
};
