import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2, Download,
  Sparkles, AlertCircle, Layers, Tag,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Product } from '../../types';
import {
  findBestMatch,
  saveMigrationLog,
  applyMigrationBatch,
  skuNorm,
  type MigrationUpdateEntry,
  type MigrationCreationEntry,
} from '../../services/productMigrationService';

interface Props {
  products: Product[];
  onDone?: () => void;
}

// ───── Şablon sütunları (case-insensitive) ─────
const COL = {
  sku: 'Məhsul kodu',
  category: 'Kateqoriya',
  brand: 'Brend',
  name: 'Məhsul adı',
  price: 'Qiymət (AZN)',
  stock: 'Miqdar',
  gender: 'Cins',
  visibility: 'Görünür kim?',
} as const;

// Alternativ sütun adları — istifadəçinin qoya biləcəyi variantlar
const COL_ALIASES: Record<keyof typeof COL, string[]> = {
  sku: ['məhsul kodu', 'mehsul kodu', 'kod', 'sku', 'code', 'article', 'артикул'],
  category: ['kateqoriya', 'category', 'категория'],
  brand: ['brend', 'brand', 'бренд'],
  name: ['məhsul adı', 'mehsul adi', 'ad', 'name', 'наименование', 'название'],
  price: ['qiymət (azn)', 'qiymet (azn)', 'qiymət', 'qiymet', 'price', 'цена'],
  stock: ['miqdar', 'stok', 'stock', 'quantity', 'qty', 'количество'],
  gender: ['cins', 'gender', 'пол'],
  visibility: ['görünür kim?', 'gorunur kim?', 'görünür', 'visibility', 'видимость'],
};

type VisibleTo = 'all' | 'b2b' | 'customer';
const parseVisibility = (raw: any): VisibleTo | null => {
  const v = String(raw ?? '').toLowerCase().trim();
  if (!v) return null;
  if (['a', 'all', 'hamı', 'hami', 'hamısı', 'hamisi'].includes(v)) return 'all';
  if (['b', 'b2b'].includes(v)) return 'b2b';
  if (['c', 'customer', 'müştəri', 'musteri'].includes(v)) return 'customer';
  return null;
};
const visibilityLabel = (v: VisibleTo): string =>
  v === 'all' ? 'Hamı' : v === 'b2b' ? 'Yalnız B2B' : 'Yalnız müştəri';

interface ParsedRow {
  sku: string;
  category: string;
  brand: string;
  name: string;
  price: number;
  hasPrice: boolean;
  stock: number;
  gender: string;
  visibility: VisibleTo | null;
  visibilityRaw: string;
  __row: number;
}

interface UpdatedItem {
  product: Product;
  oldStock: number;
  /** Excel-dən gələn xam stok (rejimə görə tətbiq olunur) */
  stockDelta: number;
  /** Hesablanmış son stok */
  finalStock: number;
  /** Bir məhsula bir neçə Excel sətri düşdüsə — neçə sətr birləşdirilib */
  mergedRowCount: number;
  /** Birinci row + əgər birləşmə olubsa, digər row-lar */
  rows: ParsedRow[];
  oldPrice: number;
  newPrice: number;
  priceChanged: boolean;
  categoryMismatch: boolean;
  oldVisibility: VisibleTo;
  newVisibility: VisibleTo | null;
  visibilityChanged: boolean;
  matchConfidence: number;
  matchReason: 'sku' | 'exact-name' | 'exact-name-no-brand' | 'fuzzy-name';
}

interface CreatedItem {
  /** Birləşmiş ilk row + ümumi miqdar */
  row: ParsedRow;
  totalStock: number;
  mergedRowCount: number;
  rows: ParsedRow[];
}

interface ImportResult {
  updated: UpdatedItem[];
  created: CreatedItem[];
  skipped: { row: ParsedRow; reason: string }[];
  errors: string[];
  /** Excel-də neçə sətir eyni məhsula düşüb (xəbərdarlıq üçün) */
  mergeWarnings: { key: string; count: number; sampleName: string }[];
}

const norm = (s: any) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
const toNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? NaN : n;
};

// ───── Şablon yükləmə ─────
const downloadTemplate = (format: 'xlsx' | 'xls' = 'xlsx') => {
  const headers = [
    COL.sku, COL.category, COL.brand, COL.name, COL.price, COL.stock, COL.gender, COL.visibility,
  ];
  const sampleRows = [
    {
      [COL.sku]: 'LTP-1094E-7ARDF',
      [COL.category]: 'Saatlar',
      [COL.brand]: 'Casio',
      [COL.name]: 'Casio LTP-1094E-7ARDF',
      [COL.price]: 89.9,
      [COL.stock]: 5,
      [COL.gender]: 'women',
      [COL.visibility]: 'a',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  (ws as any)['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');

  const info = [
    ['DE VALEUR — Məhsul miqrasiyası şablonu (v2)'],
    [''],
    ['ƏN VACİB DƏYİŞİKLİK: "Məhsul kodu" sütunu ƏLAVƏ olundu.'],
    ['  Məhsul birinci növbədə kodla tapılır — fərqli kod = fərqli məhsul.'],
    ['  Beləliklə "LTP-1094E-7ARDF" və "LTP-1094E-1ARDF" ayrı-ayrı məhsul kimi tanınır.'],
    [''],
    ['İstifadə qaydaları:'],
    ['1. Sütun başlıqlarını dəyişməyin. Sıra dəyişə bilər.'],
    ['2. Hər sətir 1 məhsul. Boş sətir atlanır.'],
    ['3. Uyğunlaşdırma prioriteti:'],
    ['     a. "Məhsul kodu" sütunu doldurulubsa — yalnız bu kod yoxlanır.'],
    ['     b. Kod boşdursa — "Brend + Məhsul adı" tam uyğunluğu yoxlanır.'],
    ['     c. Heç biri uyğunlaşmırsa — yeni məhsul yaradılır.'],
    ['4. Yenilənmə davranışı:'],
    ['   • Stok: aşağıdakı "Stok rejimi" seçiminizə görə (əvəz / üzərinə əlavə).'],
    ['   • Qiymət: əgər "Qiymət (AZN)" sütunu doldurulubsa — Excel-dəki qiymət yazılır.'],
    ['                Boş qoyularsa — köhnə qiymət saxlanır.'],
    ['   • Görünürlük: əgər "Görünür kim?" doldurulubsa — yenilənir.'],
    ['   • Kateqoriya, brend, ad, şəkillər: DƏYİŞMİR (köhnə məlumatlar qalır).'],
    ['5. Yeni məhsul yaradılarkən:'],
    ['   • Kateqoriya VƏ Brend sistemdə artıq mövcud olmalıdır.'],
    ['   • "Məhsul kodu" sütununa kod yazsanız, gələcəkdə həmin kodla tapılacaq (tövsiyə olunur).'],
    ['6. "Cins": men / women / unisex (boşdursa unisex).'],
    ['7. "Görünür kim?" qısa kodları:'],
    ['     a → Hamı (defolt) · b → Yalnız B2B · c → Yalnız adi müştəri'],
    ['8. Qiymət yalnız rəqəm: 280 və ya 280.50'],
    [''],
    ['Eyni məhsula düşən bir neçə sətir:'],
    ['  Excel-də eyni kod və ya ad+brend ilə 2 sətir varsa, sistem onları birləşdirir:'],
    ['   • "Stoku artır" rejimində → miqdarlar TOPLANIR.'],
    ['   • "Stoku yenilə" rejimində → SON sətrin miqdarı qəbul olunur (xəbərdarlıq verilir).'],
    [''],
    ['Atomik (writeBatch) yazı:'],
    ['  Bütün yenilənmələr Firestore batch ilə atomik aparılır — yarımçıq qalma və ya'],
    ['  miqdarın səhv mala düşməsi xətası baş vermir.'],
  ];
  const infoWs = XLSX.utils.aoa_to_sheet(info);
  (infoWs as any)['!cols'] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, infoWs, 'Təlimat');
  if (format === 'xls') {
    XLSX.writeFile(wb, 'devaleur-mehsul-sablonu.xls', { bookType: 'biff8' });
  } else {
    XLSX.writeFile(wb, 'devaleur-mehsul-sablonu.xlsx');
  }
};

// ───── Fayl parse ─────
const parseFile = async (file: File): Promise<{ rows: ParsedRow[]; errors: string[] }> => {
  const errors: string[] = [];
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => /məhsul|mehsul|product|sheet|товар/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], errors: ['Faylda heç bir vərəq tapılmadı'] };

  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (raw.length === 0) return { rows: [], errors: ['Faylda heç bir sətir yoxdur'] };

  const availableCols = Object.keys(raw[0]);
  const findCol = (key: keyof typeof COL): string | null => {
    const aliases = COL_ALIASES[key];
    return availableCols.find((c) => aliases.includes(norm(c))) || null;
  };

  const map = {
    sku: findCol('sku'),
    category: findCol('category'),
    brand: findCol('brand'),
    name: findCol('name'),
    price: findCol('price'),
    stock: findCol('stock'),
    gender: findCol('gender'),
    visibility: findCol('visibility'),
  };

  // Ən az bir uyğunlaşdırma açarı (sku və ya name) olmalıdır
  if (!map.sku && !map.name) {
    errors.push(`Şablonda "${COL.sku}" və ya "${COL.name}" sütunlarından biri olmalıdır. "Şablonu yüklə" düyməsindən hazır fayl götürün.`);
    return { rows: [], errors };
  }
  if (!map.stock) {
    errors.push(`Şablonda "${COL.stock}" sütunu olmalıdır.`);
    return { rows: [], errors };
  }

  const rows: ParsedRow[] = [];
  raw.forEach((r, idx) => {
    const sku = map.sku ? String(r[map.sku] || '').trim() : '';
    const name = map.name ? String(r[map.name] || '').trim() : '';
    if (!sku && !name) return; // tamamilə boş sətir
    const rawStock = map.stock ? r[map.stock] : '';
    const stock = toNum(rawStock);
    const rawPrice = map.price ? r[map.price] : '';
    const hasPrice = rawPrice !== '' && rawPrice !== null && rawPrice !== undefined;
    const visibilityRaw = map.visibility ? String(r[map.visibility] || '').trim() : '';
    rows.push({
      sku,
      category: map.category ? String(r[map.category] || '').trim() : '',
      brand: map.brand ? String(r[map.brand] || '').trim() : '',
      name,
      price: hasPrice ? (isNaN(toNum(rawPrice)) ? 0 : toNum(rawPrice)) : 0,
      hasPrice,
      stock: isNaN(stock) ? 0 : stock,
      gender: (map.gender ? String(r[map.gender] || '').trim().toLowerCase() : '') || 'unisex',
      visibility: parseVisibility(visibilityRaw),
      visibilityRaw,
      __row: idx + 2,
    });
  });
  return { rows, errors };
};

// Stok rejimi
type StockMode = 'replace' | 'add';
// Qiymət rejimi
type PriceMode = 'always' | 'never';

// ───── Komponent ─────
const ProductExcelImport: React.FC<Props> = ({ products, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stockMode, setStockMode] = useState<StockMode>('replace');
  const [priceMode, setPriceMode] = useState<PriceMode>('always');
  const [allowFuzzy, setAllowFuzzy] = useState(false);

  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbBrands, setDbBrands] = useState<string[]>([]);

  const loadDbMeta = async () => {
    const [catSnap, brandSnap] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'brands')),
    ]);
    const cats = catSnap.docs.map((d) => {
      const data = d.data() as any;
      return (typeof data.name === 'object' ? data.name.az : data.name) || '';
    }).filter(Boolean);
    const brands = brandSnap.docs.map((d) => {
      const data = d.data() as any;
      return (typeof data.name === 'object' ? data.name.az : data.name) || '';
    }).filter(Boolean);
    const productBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
    const productCats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    setDbCategories(Array.from(new Set([...cats, ...productCats])));
    setDbBrands(Array.from(new Set([...brands, ...productBrands])));
    return {
      cats: Array.from(new Set([...cats, ...productCats])),
      brands: Array.from(new Set([...brands, ...productBrands])),
    };
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    setProgress(null);
    try {
      const [{ rows, errors }, meta] = await Promise.all([
        parseFile(file),
        loadDbMeta(),
      ]);
      if (errors.length > 0 || rows.length === 0) {
        setResult({
          updated: [], created: [], skipped: [], mergeWarnings: [],
          errors: errors.length > 0 ? errors : ['Sətir tapılmadı'],
        });
        return;
      }

      // ── 1) Hər sətirə qarşı: mövcud məhsul tapırıq, ya yeni kimi qeydiyyat
      type MatchInfo = {
        row: ParsedRow;
        matched: Product | null;
        matchConfidence: number;
        matchReason: 'sku' | 'exact-name' | 'exact-name-no-brand' | 'fuzzy-name' | 'none';
      };
      const matched: MatchInfo[] = rows.map((row) => {
        const m = findBestMatch(
          row.sku,
          row.name,
          row.brand,
          products as any,
          { allowFuzzy, fuzzyThreshold: 0.95 }
        );
        if (m) {
          const found = products.find((p) => p.id === m.product.id);
          return {
            row,
            matched: found || null,
            matchConfidence: m.confidence,
            matchReason: m.reason,
          };
        }
        return { row, matched: null, matchConfidence: 0, matchReason: 'none' };
      });

      // ── 2) Eyni mövcud məhsula düşən sətrlər → birləşdir (deduplikasiya)
      const updatesMap = new Map<string, {
        product: Product;
        items: MatchInfo[];
      }>();
      const newRowsByKey = new Map<string, ParsedRow[]>();
      const skipped: ImportResult['skipped'] = [];
      const mergeWarnings: ImportResult['mergeWarnings'] = [];

      // Yeni məhsullar üçün də deduplikasiya açarı (sku || ad+brend)
      const newKey = (r: ParsedRow): string => {
        const sk = skuNorm(r.sku);
        if (sk) return `sku::${sk}`;
        return `nb::${norm(r.brand)}::${norm(r.name)}`;
      };

      for (const m of matched) {
        // Görünürlük yazılıb amma tanınmırsa skip
        if (m.row.visibilityRaw && m.row.visibility === null) {
          skipped.push({ row: m.row, reason: `"Görünür kim?" sütunu tanınmır: "${m.row.visibilityRaw}". Qəbul: a / b / c (və ya all / b2b / customer).` });
          continue;
        }
        if (m.matched) {
          const key = m.matched.id;
          if (!updatesMap.has(key)) updatesMap.set(key, { product: m.matched, items: [] });
          updatesMap.get(key)!.items.push(m);
        } else {
          // Yeni məhsul üçün ön yoxlama
          if (!m.row.category) {
            skipped.push({ row: m.row, reason: 'Kateqoriya boşdur (yeni məhsul üçün tələb olunur)' });
            continue;
          }
          const catExists = meta.cats.some((c) => norm(c) === norm(m.row.category));
          if (!catExists) {
            skipped.push({ row: m.row, reason: `Kateqoriya sistemdə yoxdur: "${m.row.category}". Əvvəlcə admin panelində yaradın.` });
            continue;
          }
          if (!m.row.brand) {
            skipped.push({ row: m.row, reason: 'Brend boşdur (yeni məhsul üçün tələb olunur)' });
            continue;
          }
          const brandExists = meta.brands.some((b) => norm(b) === norm(m.row.brand));
          if (!brandExists) {
            skipped.push({ row: m.row, reason: `Brend sistemdə yoxdur: "${m.row.brand}". Əvvəlcə admin panelində yaradın.` });
            continue;
          }
          if (!m.row.name) {
            skipped.push({ row: m.row, reason: 'Məhsul adı boşdur (yeni məhsul üçün tələb olunur)' });
            continue;
          }
          const nk = newKey(m.row);
          if (!newRowsByKey.has(nk)) newRowsByKey.set(nk, []);
          newRowsByKey.get(nk)!.push(m.row);
        }
      }

      // ── 3) Updates aqreqasiya
      const updated: UpdatedItem[] = [];
      updatesMap.forEach(({ product, items }) => {
        const rowsArr = items.map((it) => it.row);
        const oldStock = typeof product.stock === 'number' ? product.stock : 0;
        const oldPrice = typeof product.price === 'number' ? product.price : 0;

        // Stok hesablanması
        let finalStock: number;
        if (stockMode === 'add') {
          // Üzərinə əlavə → bütün excel miqdarlarının cəmi köhnə üzərinə
          const totalDelta = rowsArr.reduce((s, r) => s + (r.stock || 0), 0);
          finalStock = Math.max(0, oldStock + totalDelta);
        } else {
          // Əvəz et → SON sətrin miqdarı qəbul olunur
          finalStock = Math.max(0, rowsArr[rowsArr.length - 1].stock || 0);
        }

        // Qiymət hesablanması
        let newPrice = oldPrice;
        if (priceMode === 'always') {
          // Excel-də qiyməti olan ən son sətrin qiyməti
          for (let i = rowsArr.length - 1; i >= 0; i--) {
            if (rowsArr[i].hasPrice) {
              newPrice = rowsArr[i].price;
              break;
            }
          }
        }
        const priceChanged = newPrice !== oldPrice;

        // Görünürlük — son təyin olunmuş
        const oldVisibility: VisibleTo = ((product as any).visibleTo as VisibleTo) || 'all';
        let newVisibility: VisibleTo | null = null;
        for (let i = rowsArr.length - 1; i >= 0; i--) {
          if (rowsArr[i].visibility !== null) {
            newVisibility = rowsArr[i].visibility;
            break;
          }
        }
        const visibilityChanged = newVisibility !== null && newVisibility !== oldVisibility;

        // Kateqoriya mismatch (məlumat — iqnor olunur)
        const firstRow = rowsArr[0];
        const categoryMismatch = !!firstRow.category && norm(firstRow.category) !== norm(product.category);

        const item: UpdatedItem = {
          product,
          oldStock,
          stockDelta: rowsArr.reduce((s, r) => s + (r.stock || 0), 0),
          finalStock,
          mergedRowCount: rowsArr.length,
          rows: rowsArr,
          oldPrice,
          newPrice,
          priceChanged,
          categoryMismatch,
          oldVisibility,
          newVisibility,
          visibilityChanged,
          matchConfidence: items[0].matchConfidence,
          matchReason: items[0].matchReason as any,
        };
        updated.push(item);

        if (rowsArr.length > 1) {
          mergeWarnings.push({
            key: product.id,
            count: rowsArr.length,
            sampleName: product.name?.az || product.name?.en || '—',
          });
        }
      });

      // ── 4) Creations aqreqasiya
      const created: CreatedItem[] = [];
      newRowsByKey.forEach((rowsArr) => {
        const first = rowsArr[0];
        const totalStock = stockMode === 'add'
          ? rowsArr.reduce((s, r) => s + (r.stock || 0), 0)
          : (rowsArr[rowsArr.length - 1].stock || 0);
        created.push({
          row: first,
          totalStock: Math.max(0, totalStock),
          mergedRowCount: rowsArr.length,
          rows: rowsArr,
        });
        if (rowsArr.length > 1) {
          mergeWarnings.push({
            key: `new::${first.name}`,
            count: rowsArr.length,
            sampleName: first.name,
          });
        }
      });

      setResult({ updated, created, skipped, errors: [], mergeWarnings });
    } catch (e) {
      setResult({
        updated: [], created: [], skipped: [], mergeWarnings: [],
        errors: ['Faylı oxumaq xətası: ' + (e as Error).message + '. Yalnız .xlsx / .xls / .csv formatı dəstəklənir.'],
      });
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setApplying(true);
    setProgress({ done: 0, total: result.updated.length + result.created.length });
    try {
      // Migration log üçün snapshot-lar
      const logUpdates: MigrationUpdateEntry[] = [];
      const logCreations: MigrationCreationEntry[] = [];

      // ── 1) Updates → batch patches
      const batchUpdates: Array<{ productId: string; patch: Record<string, any> }> = [];
      for (const m of result.updated) {
        const patch: Record<string, any> = { stock: m.finalStock };
        const oldValues: Record<string, any> = { stock: m.oldStock };
        const newValues: Record<string, any> = { stock: m.finalStock };

        if (m.priceChanged) {
          patch.price = m.newPrice;
          oldValues.price = m.oldPrice;
          newValues.price = m.newPrice;
        }
        if (m.visibilityChanged && m.newVisibility) {
          patch.visibleTo = m.newVisibility;
          oldValues.visibleTo = m.oldVisibility;
          newValues.visibleTo = m.newVisibility;
        }
        // SKU yenilə (əgər məhsulda hələ SKU yoxdursa və Excel-də varsa)
        const excelSku = (m.rows.find((r) => r.sku)?.sku) || '';
        if (excelSku && !(m.product as any).sku) {
          patch.sku = excelSku;
          oldValues.sku = (m.product as any).sku || '';
          newValues.sku = excelSku;
        }

        batchUpdates.push({ productId: m.product.id, patch });
        logUpdates.push({
          productId: m.product.id,
          productName:
            (m.product.name as any)?.az ||
            (m.product.name as any)?.en ||
            String(m.product.name || ''),
          oldValues,
          newValues,
        });
      }

      // ── 2) Creations → batch
      const batchCreations: Array<{ data: Record<string, any> }> = result.created.map((c) => {
        const gender = ['men', 'women', 'unisex'].includes(c.row.gender) ? c.row.gender : 'unisex';
        return {
          data: {
            name: { az: c.row.name, ru: c.row.name, en: c.row.name },
            description: { az: '', ru: '', en: '' },
            price: c.row.hasPrice ? c.row.price : 0,
            salePrice: null,
            b2bPrice: null,
            b2bSalePrice: null,
            images: [],
            brand: c.row.brand,
            category: c.row.category,
            gender,
            sku: c.row.sku || '',
            isEnabled: true,
            isBestseller: false,
            stock: c.totalStock,
            visibleTo: c.row.visibility ?? 'all',
            createdAt: new Date(),
          },
        };
      });

      // ── 3) Atomik batch tətbiqi
      const { createdIds } = await applyMigrationBatch({
        updates: batchUpdates,
        creations: batchCreations,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      // Creations log
      createdIds.forEach((id, idx) => {
        const c = result.created[idx];
        logCreations.push({
          productId: id,
          productName: c.row.name,
          data: batchCreations[idx].data,
        });
      });

      // ── 4) Migration log saxla
      if (logUpdates.length > 0 || logCreations.length > 0) {
        try {
          const appliedBy =
            (typeof window !== 'undefined' && localStorage.getItem('adminEmail')) ||
            (typeof window !== 'undefined' && localStorage.getItem('userEmail')) ||
            'admin';
          await saveMigrationLog({
            appliedBy,
            fileName: fileRef.current?.files?.[0]?.name || 'unknown.xlsx',
            summary: {
              updatedCount: logUpdates.length,
              createdCount: logCreations.length,
              skippedCount: result.skipped.length,
              stockMode,
              priceMode,
            },
            updates: logUpdates,
            creations: logCreations,
          });
        } catch (logErr) {
          console.warn('Migration log saxlamaq alınmadı:', logErr);
        }
      }

      const parts: string[] = [];
      if (logUpdates.length > 0) parts.push(`${logUpdates.length} məhsul yeniləndi`);
      if (logCreations.length > 0) parts.push(`${logCreations.length} yeni məhsul yaradıldı`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} sətir atlandı`);
      if (result.mergeWarnings.length > 0) {
        parts.push(`${result.mergeWarnings.length} məhsul üçün eyni sətrlər birləşdirildi`);
      }
      alert(parts.join('\n') || 'Heç bir dəyişiklik edilmədi');
      setResult(null);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
      onDone?.();
    } catch (e) {
      alert('Tətbiq xətası: ' + (e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  // Sayğaclar
  const counts = useMemo(() => {
    if (!result) return null;
    const totalStockChange = result.updated.reduce((s, m) => s + (m.finalStock - m.oldStock), 0);
    const priceChanges = result.updated.filter((m) => m.priceChanged).length;
    return {
      totalStockChange,
      priceChanges,
      mergedUpdates: result.updated.filter((m) => m.mergedRowCount > 1).length,
    };
  }, [result]);

  return (
    <div
      className="border border-dashed border-gray-300 rounded-xl p-5 bg-gradient-to-br from-amber-50/50 to-white"
      data-testid="product-import-panel"
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="h-6 w-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Excel ilə məhsul miqrasiyası
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold">
                v2 · atomik
              </span>
            </h3>
            <p className="text-xs text-gray-600 mt-0.5 max-w-2xl">
              Birinci növbədə <strong>Məhsul kodu</strong> ilə tapılır, sonra <strong>brend+ad</strong>{' '}
              tam uyğunluğu ilə. Tapılsa — stok, qiymət (seçimə görə) və görünürlük yenilənir.
              Yoxdursa yeni yaradılır. Eyni mala düşən sətrlər avtomatik birləşdirilir.
              Yazılar Firestore <strong>writeBatch</strong> ilə atomik aparılır.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadTemplate('xlsx')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-500 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium"
            data-testid="product-import-template-btn"
          >
            <Download className="h-4 w-4" />
            Şablonu yüklə (.xlsx)
          </button>
          <button
            onClick={() => downloadTemplate('xls')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium"
            data-testid="product-import-template-xls-btn"
            title="Köhnə Excel versiyası (.xls)"
          >
            <Download className="h-4 w-4" />
            (.xls)
          </button>
        </div>
      </div>

      {/* ───── Rejim seçimləri ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-amber-200 bg-white/70 p-3" data-testid="product-import-stock-mode">
          <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Stok rejimi
          </p>
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
                stockMode === 'replace' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              data-testid="stock-mode-replace-label"
            >
              <input
                type="radio" name="stock-mode" value="replace"
                checked={stockMode === 'replace'}
                onChange={() => setStockMode('replace')}
                className="mt-0.5 accent-amber-600"
                data-testid="stock-mode-replace"
              />
              <span>
                <span className="font-medium text-gray-900">Stoku yenilə (əvəz et)</span>
                <span className="block text-[11px] text-gray-600 mt-0.5">
                  Saytdakı miqdar fayldakı dəyərlə əvəz olunur. Saytda 1, faylda 2 → nəticə 2.
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
                stockMode === 'add' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              data-testid="stock-mode-add-label"
            >
              <input
                type="radio" name="stock-mode" value="add"
                checked={stockMode === 'add'}
                onChange={() => setStockMode('add')}
                className="mt-0.5 accent-emerald-600"
                data-testid="stock-mode-add"
              />
              <span>
                <span className="font-medium text-gray-900">Stoku artır (üzərinə əlavə et)</span>
                <span className="block text-[11px] text-gray-600 mt-0.5">
                  Fayldakı miqdar mövcud stokun üzərinə gəlir. Saytda 1, faylda 2 → nəticə 3.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-white/70 p-3" data-testid="product-import-price-mode">
          <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Qiymət rejimi
          </p>
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
                priceMode === 'always' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              data-testid="price-mode-always-label"
            >
              <input
                type="radio" name="price-mode" value="always"
                checked={priceMode === 'always'}
                onChange={() => setPriceMode('always')}
                className="mt-0.5 accent-blue-600"
                data-testid="price-mode-always"
              />
              <span>
                <span className="font-medium text-gray-900">Excel-dəki qiymət ilə yenilə</span>
                <span className="block text-[11px] text-gray-600 mt-0.5">
                  Fayldakı qiymət sütunu doldurulubsa, mövcud qiymət dəyişəcək.
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
                priceMode === 'never' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
              data-testid="price-mode-never-label"
            >
              <input
                type="radio" name="price-mode" value="never"
                checked={priceMode === 'never'}
                onChange={() => setPriceMode('never')}
                className="mt-0.5 accent-gray-600"
                data-testid="price-mode-never"
              />
              <span>
                <span className="font-medium text-gray-900">Qiymətə toxunma</span>
                <span className="block text-[11px] text-gray-600 mt-0.5">
                  Mövcud məhsulun qiyməti saxlanır, yalnız stok yenilənir.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Fuzzy toggle (advanced) */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer" data-testid="allow-fuzzy-label">
          <input
            type="checkbox"
            checked={allowFuzzy}
            onChange={(e) => setAllowFuzzy(e.target.checked)}
            className="accent-indigo-600"
            data-testid="allow-fuzzy"
          />
          <span className="text-gray-700">
            <Sparkles className="inline h-3 w-3 text-indigo-600 mr-0.5" />
            Smart fuzzy match (95%+ oxşar adları da tap)
          </span>
        </label>
        <span className="text-gray-400">
          — defolt söndürülüb. Yalnız adda kiçik typolar varsa açın. SKU/kod ilə işlədikdə lazım deyil.
        </span>
      </div>

      {/* Fayl seç */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
          data-testid="product-import-file"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 text-sm font-medium"
          data-testid="product-import-select-btn"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {parsing ? 'Oxunur...' : 'Faylı seç'}
        </button>
        <span className="text-xs text-gray-500">Qəbul olunur: .xlsx, .xls, .csv</span>
      </div>

      {/* Nəticə paneli */}
      {result && (
        <div className="mt-5 space-y-3" data-testid="product-import-result">
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {/* Xülasə bar */}
          {counts && (result.updated.length > 0 || result.created.length > 0) && (
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs">
              <span className="font-semibold text-gray-900">Xülasə:</span>
              {result.updated.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                  {result.updated.length} yenilənəcək
                </span>
              )}
              {result.created.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {result.created.length} yeni
                </span>
              )}
              {counts.priceChanges > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
                  {counts.priceChanges} qiymət dəyişir
                </span>
              )}
              {counts.mergedUpdates > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                  {counts.mergedUpdates} təkrar sətr birləşdi
                </span>
              )}
              <span className="ml-auto font-mono text-gray-600">
                Ümumi stok dəyişikliyi: {counts.totalStockChange >= 0 ? '+' : ''}{counts.totalStockChange}
              </span>
            </div>
          )}

          {result.mergeWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Excel-də təkrar sətrlər tapıldı ({result.mergeWarnings.length})</p>
                <p>
                  Bu məhsullar üçün bir neçə sətr eyni mala uyğunlaşdı və{' '}
                  <strong>
                    {stockMode === 'add' ? 'miqdarları topldandı' : 'son sətrin miqdarı qəbul olundu'}
                  </strong>:
                </p>
                <ul className="mt-1 list-disc list-inside max-h-24 overflow-y-auto">
                  {result.mergeWarnings.slice(0, 10).map((w, i) => (
                    <li key={i}>
                      {w.sampleName} <span className="text-amber-600">— {w.count} sətr</span>
                    </li>
                  ))}
                  {result.mergeWarnings.length > 10 && (
                    <li className="text-amber-600">+ {result.mergeWarnings.length - 10} daha</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {result.updated.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Yenilənəcək ({result.updated.length})
              </p>
              <div className="max-h-72 overflow-y-auto border border-emerald-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.updated.map((m, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap" data-testid={`import-update-${i}`}>
                    <span className="flex-1 truncate min-w-[200px]">
                      <span className="font-medium">{m.product.name?.az || m.product.name?.en}</span>
                      {m.product.sku && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                          {m.product.sku}
                        </span>
                      )}
                      {m.matchReason === 'sku' && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200" title="SKU/kod ilə tam uyğunluq">
                          <Check className="h-3 w-3" /> kod
                        </span>
                      )}
                      {m.matchReason === 'fuzzy-name' && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200"
                          title={`Smart match (${Math.round(m.matchConfidence * 100)}% oxşar) — fayldakı ad: "${m.rows[0].name}"`}
                          data-testid={`import-update-fuzzy-${i}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {Math.round(m.matchConfidence * 100)}%
                        </span>
                      )}
                      {m.mergedRowCount > 1 && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200" title="Excel-də bir neçə sətr">
                          <Layers className="h-3 w-3" />
                          ×{m.mergedRowCount}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{m.product.category}</span>
                    {m.priceChanged && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                        Qiymət: {m.oldPrice} → <b>{m.newPrice}</b> AZN
                      </span>
                    )}
                    {m.visibilityChanged && m.newVisibility && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200" data-testid={`import-update-vis-${i}`}>
                        Görünür: {visibilityLabel(m.oldVisibility)} → <b>{visibilityLabel(m.newVisibility)}</b>
                      </span>
                    )}
                    <span className="font-mono tabular-nums">
                      Stok: {m.oldStock}
                      {stockMode === 'add' && (
                        <span className="text-emerald-700"> +{m.stockDelta}</span>
                      )}
                      {' → '}
                      <span className={m.finalStock !== m.oldStock ? 'text-amber-700 font-bold' : ''}>
                        {m.finalStock}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.created.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-blue-600" />
                Yeni yaradılacaq ({result.created.length}){' '}
                <span className="text-xs text-gray-500 font-normal">— şəkilsiz; sonradan admin əlavə edər</span>
              </p>
              <div className="max-h-72 overflow-y-auto border border-blue-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.created.map((c, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap" data-testid={`import-create-${i}`}>
                    <span className="flex-1 truncate min-w-[200px]">
                      <span className="font-medium">{c.row.name}</span>
                      {c.row.sku && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                          {c.row.sku}
                        </span>
                      )}
                      {c.mergedRowCount > 1 && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                          <Layers className="h-3 w-3" />
                          ×{c.mergedRowCount}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 text-[11px]">{c.row.category} · {c.row.brand}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {visibilityLabel(c.row.visibility ?? 'all')}
                    </span>
                    <span className="font-mono tabular-nums">{c.row.hasPrice ? c.row.price : 0} AZN · stok: {c.totalStock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Atlandı ({result.skipped.length})
              </p>
              <div className="max-h-40 overflow-y-auto border border-amber-100 rounded-lg divide-y divide-amber-100 bg-amber-50/30">
                {result.skipped.map((s, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs flex items-start gap-3">
                    <span className="flex-1 truncate">
                      <span className="text-gray-900">{s.row.name || s.row.sku || <em className="text-gray-400">(boş)</em>}</span>{' '}
                      <span className="text-gray-400">#{s.row.__row}</span>
                    </span>
                    <span className="text-amber-700 text-[11px]">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {applying && progress && (
            <div className="bg-white border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-700">
                  Atomik batch tətbiq olunur... ({progress.done}/{progress.total})
                </span>
                <span className="font-mono text-emerald-700">
                  {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => { setResult(null); setProgress(null); }}
              disabled={applying}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-60"
              data-testid="product-import-cancel"
            >
              <X className="h-4 w-4 inline mr-1" /> Ləğv et
            </button>
            <button
              onClick={apply}
              disabled={applying || (result.updated.length === 0 && result.created.length === 0)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-60 font-medium"
              data-testid="product-import-apply"
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              {applying ? 'Tətbiq olunur...' : 'Tətbiq et'}
            </button>
          </div>
        </div>
      )}

      {(dbCategories.length > 0 || dbBrands.length > 0) && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 text-[11px] text-gray-500 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="font-medium text-gray-600 mb-1">Sistemdəki kateqoriyalar ({dbCategories.length}):</p>
            <p className="truncate">{dbCategories.slice(0, 20).join(', ')}{dbCategories.length > 20 ? '...' : ''}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600 mb-1">Sistemdəki brendlər ({dbBrands.length}):</p>
            <p className="truncate">{dbBrands.slice(0, 20).join(', ')}{dbBrands.length > 20 ? '...' : ''}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductExcelImport;
