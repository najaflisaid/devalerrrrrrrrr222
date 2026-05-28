import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2, Download, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Product } from '../../types';
import {
  findBestMatch,
  saveMigrationLog,
  type MigrationUpdateEntry,
  type MigrationCreationEntry,
} from '../../services/productMigrationService';

interface Props {
  products: Product[];
  onDone?: () => void;
}

// Şablon sütunları — tam eyni ad ilə qəbul olunur (case-insensitive).
const COL = {
  category: 'Kateqoriya',
  brand: 'Brend',
  name: 'Məhsul adı',
  price: 'Qiymət (AZN)',
  stock: 'Miqdar',
  gender: 'Cins',
  visibility: 'Görünür kim?',
} as const;

// Görünürlük (visibleTo) qısa kodları — Excel-də sadə yazmaq üçün:
//   a → all      (qonaq + müştəri + B2B — defolt)
//   b → b2b      (yalnız B2B müştərilər)
//   c → customer (yalnız adi müştərilər: qeydiyyatsız + normal)
// Tam adlar da qəbul olunur (all / b2b / customer).
type VisibleTo = 'all' | 'b2b' | 'customer';
const parseVisibility = (raw: any): VisibleTo | null => {
  const v = String(raw ?? '').toLowerCase().trim();
  if (!v) return null;
  if (v === 'a' || v === 'all' || v === 'hamı' || v === 'hami' || v === 'hamısı' || v === 'hamisi') return 'all';
  if (v === 'b' || v === 'b2b') return 'b2b';
  if (v === 'c' || v === 'customer' || v === 'müştəri' || v === 'musteri') return 'customer';
  return null;
};
const visibilityLabel = (v: VisibleTo): string =>
  v === 'all' ? 'Hamı' : v === 'b2b' ? 'Yalnız B2B' : 'Yalnız müştəri';

interface ParsedRow {
  category: string;
  brand: string;
  name: string;
  price: number;
  stock: number;
  gender: string;
  visibility: VisibleTo | null; // null → toxunma (mövcud məhsul üçün) / yeni məhsul üçün 'all' qəbul olunur
  visibilityRaw: string;        // istifadəçi nə yazıb (xəta üçün)
  __row: number;
}

interface ImportResult {
  updated: {
    product: Product;
    oldStock: number;
    newStock: number;
    row: ParsedRow;
    categoryMismatch: boolean;
    oldVisibility: VisibleTo;
    visibilityChanged: boolean;
    /** Fuzzy match olduğu zaman 0..1 confidence (1 = tam eyni) */
    matchConfidence: number;
    /** Match səbəbi: 'exact' tam normalize match, 'fuzzy-name' brend eyni amma ad fuzzy */
    matchReason: 'exact' | 'fuzzy-name' | 'fuzzy-name-only';
  }[];
  created: ParsedRow[];
  skipped: { row: ParsedRow; reason: string }[];
  errors: string[];
}

const norm = (s: any) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
const toNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// ───── Şablon yükləmə ─────
const downloadTemplate = (format: 'xlsx' | 'xls' = 'xlsx') => {
  const headers = [
    COL.category,
    COL.brand,
    COL.name,
    COL.price,
    COL.stock,
    COL.gender,
    COL.visibility,
  ];
  const sampleRows = [
    { [COL.category]: '', [COL.brand]: '', [COL.name]: '', [COL.price]: '', [COL.stock]: '', [COL.gender]: '', [COL.visibility]: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  (ws as any)['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');

  const info = [
    ['DE VALEUR — Məhsul miqrasiyası şablonu'],
    [''],
    ['İstifadə qaydaları:'],
    ['1. Yuxarıdakı sütun başlıqlarını DƏYİŞMƏYİN. Sıra da eynilə qalsın.'],
    ['2. Hər sətir 1 məhsul. Boş sətir atlanır.'],
    ['3. Məhsul ad-a görə tapılır (case-insensitive). Məhsul kodu adın içində olmalıdır, məs: "Casio LTP-1094E-7ARDF".'],
    ['4. Sistemdə həmin ad ilə məhsul varsa, miqdar yenilənir. Kateqoriya, brend və qiymət DƏYİŞMİR (köhnə məlumatlar qalır).'],
    ['   "Görünür kim?" sütunu doldurulubsa — mövcud məhsulun görünürlüyü də yenilənir; boşdursa toxunulmur.'],
    ['5. Sistemdə məhsul yoxdursa yeni yaradılır. Amma bu halda:'],
    ['   • "Kateqoriya" sistemdə artıq mövcud olmalıdır (əks halda sətir atlanır).'],
    ['   • "Brend" sistemdə artıq mövcud olmalıdır (əks halda sətir atlanır).'],
    ['   Yeni kateqoriya/brend yaratmaq üçün admin panelinə keçin → Kateqoriyalar / Brendlər.'],
    ['6. "Cins" sütununda: men / women / unisex (boşdursa unisex qəbul olunur).'],
    ['7. "Görünür kim?" sütunu — qısa kodla yazın:'],
    ['     a  →  Hamı görür: qonaq + müştəri + B2B (defolt — boş qoymaq olar)'],
    ['     b  →  Yalnız B2B müştərilər'],
    ['     c  →  Yalnız adi müştərilər (qeydiyyatsız + normal)'],
    ['   Tam adlar da qəbul olunur: all / b2b / customer.'],
    ['8. Qiymət yalnız rəqəm: məsələn 280 və ya 280.50'],
    ['9. Şəkillər şablona daxil deyil — yeni məhsullar üçün sonradan admin panelindən əlavə edirsiniz.'],
    [''],
    ['Stok yenilənməsi nümunəsi:'],
    ['  Saytda: "Casio LTP-1094E-7ARDF" stoku 3 ədəd, görünürlük: hamı'],
    ['  Faylda: miqdar 4, "Görünür kim?" = b'],
    ['  Nəticə: stok 4 olur, məhsul artıq yalnız B2B müştəriləri üçün görünür.'],
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
  const sheetName = wb.SheetNames.find((n) => /məhsul|product|sheet/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], errors: ['Faylda heç bir vərəq tapılmadı'] };

  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (raw.length === 0) return { rows: [], errors: ['Faylda heç bir sətir yoxdur'] };

  const firstRow = raw[0];
  const availableCols = Object.keys(firstRow);
  const findCol = (target: string): string | null => {
    const t = norm(target);
    return availableCols.find((c) => norm(c) === t) || null;
  };

  const map = {
    category: findCol(COL.category),
    brand: findCol(COL.brand),
    name: findCol(COL.name),
    price: findCol(COL.price),
    stock: findCol(COL.stock),
    gender: findCol(COL.gender),
    visibility: findCol(COL.visibility),
  };

  const missing = Object.entries(map)
    .filter(([k, v]) => !v && (k === 'name' || k === 'stock'))
    .map(([k]) => (COL as any)[k]);
  if (missing.length > 0) {
    errors.push(`Şablonun sütunları tapılmadı: ${missing.join(', ')}. "Şablonu yüklə" düyməsindən hazır fayl götürün.`);
    return { rows: [], errors };
  }

  const rows: ParsedRow[] = [];
  raw.forEach((r, idx) => {
    const name = map.name ? String(r[map.name] || '').trim() : '';
    const stock = map.stock ? toNum(r[map.stock]) : 0;
    if (!name) return;
    const visibilityRaw = map.visibility ? String(r[map.visibility] || '').trim() : '';
    rows.push({
      category: map.category ? String(r[map.category] || '').trim() : '',
      brand: map.brand ? String(r[map.brand] || '').trim() : '',
      name,
      price: map.price ? toNum(r[map.price]) : 0,
      stock,
      gender: (map.gender ? String(r[map.gender] || '').trim().toLowerCase() : '') || 'unisex',
      visibility: parseVisibility(visibilityRaw),
      visibilityRaw,
      __row: idx + 2,
    });
  });
  return { rows, errors };
};

// Stok tətbiq rejimi:
//   'replace' → fayldakı miqdar saytdakı stoku tam əvəz edir (köhnə davranış)
//   'add'     → fayldakı miqdar mövcud stokun ÜZƏRİNƏ gəlir (artırır)
type StockMode = 'replace' | 'add';

// ───── Komponent ─────
const ProductExcelImport: React.FC<Props> = ({ products, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stockMode, setStockMode] = useState<StockMode>('replace');
  // Sistemdəki kateqoriya və brendlər (parse zamanı yoxlamaq üçün)
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
    // Məhsullardan da gəlmə brendləri qeydə al
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
    try {
      const [{ rows, errors }, meta] = await Promise.all([
        parseFile(file),
        loadDbMeta(),
      ]);
      if (errors.length > 0 || rows.length === 0) {
        setResult({ updated: [], created: [], skipped: [], errors: errors.length > 0 ? errors : ['Sətir tapılmadı'] });
        return;
      }

      const updated: ImportResult['updated'] = [];
      const created: ParsedRow[] = [];
      const skipped: ImportResult['skipped'] = [];

      for (const row of rows) {
        // Görünürlük yazılıb amma tanınmırsa atla
        if (row.visibilityRaw && row.visibility === null) {
          skipped.push({ row, reason: `"Görünür kim?" sütunu tanınmır: "${row.visibilityRaw}". Qəbul olunan: a / b / c (və ya all / b2b / customer).` });
          continue;
        }

        // Match: ad + brend birlikdə, smart fuzzy (≥88% oxşarlıq) — boşluq/karakter
        // fərqlərinə tolerantdır. Köhnə yalnız tam-match məntiqi mövcud malları
        // "yoxdur" hesab edirdi; indi bu problem həll olunur.
        const match = findBestMatch(
          row.name,
          row.brand,
          products as any,
          0.88
        );
        const found = match
          ? (products.find((p) => p.id === match.product.id) as Product | undefined)
          : undefined;

        if (found && match) {
          // Köhnə kateqoriya qorunur — fayldakı kateqoriya iqnor edilir
          const fileCatNorm = norm(row.category);
          const productCatNorm = norm(found.category);
          const categoryMismatch = !!row.category && fileCatNorm !== productCatNorm;
          const oldVisibility: VisibleTo = ((found as any).visibleTo as VisibleTo) || 'all';
          const visibilityChanged = row.visibility !== null && row.visibility !== oldVisibility;
          updated.push({
            product: found,
            oldStock: typeof found.stock === 'number' ? found.stock : 0,
            newStock: row.stock,
            row,
            categoryMismatch,
            oldVisibility,
            visibilityChanged,
            matchConfidence: match.confidence,
            matchReason: match.reason,
          });
        } else {
          // Yeni məhsul — kateqoriya və brend sistemdə olmalıdır
          if (!row.category) {
            skipped.push({ row, reason: 'Kateqoriya boşdur (yeni məhsul üçün tələb olunur)' });
            continue;
          }
          const catExists = meta.cats.some((c) => norm(c) === norm(row.category));
          if (!catExists) {
            skipped.push({ row, reason: `Kateqoriya sistemdə yoxdur: "${row.category}". Əvvəlcə admin panelində yaradın.` });
            continue;
          }
          if (!row.brand) {
            skipped.push({ row, reason: 'Brend boşdur (yeni məhsul üçün tələb olunur)' });
            continue;
          }
          const brandExists = meta.brands.some((b) => norm(b) === norm(row.brand));
          if (!brandExists) {
            skipped.push({ row, reason: `Brend sistemdə yoxdur: "${row.brand}". Əvvəlcə admin panelində yaradın.` });
            continue;
          }
          created.push(row);
        }
      }

      setResult({ updated, created, skipped, errors: [] });
    } catch (e) {
      setResult({
        updated: [],
        created: [],
        skipped: [],
        errors: ['Faylı oxumaq xətası: ' + (e as Error).message + '. Yalnız .xlsx / .xls / .csv formatı dəstəklənir.'],
      });
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      // Migration log üçün hər dəyişikliyin "köhnə + yeni" snapshot-unu toplayırıq.
      // Rollback bu məlumatdan istifadə edib bazanı əvvəlki vəziyyətə qaytaracaq.
      const logUpdates: MigrationUpdateEntry[] = [];
      const logCreations: MigrationCreationEntry[] = [];

      // 1) Stok yenilənməsi — köhnə məlumatlar qorunur, yalnız `stock`
      //    (və faylda göstərilibsə `visibleTo`) dəyişir
      await Promise.all(
        result.updated.map((m) => {
          const finalStock =
            stockMode === 'add'
              ? Math.max(0, m.oldStock + m.newStock)
              : Math.max(0, m.newStock);
          const patch: Record<string, any> = { stock: finalStock };
          const oldValues: Record<string, any> = { stock: m.oldStock };
          const newValues: Record<string, any> = { stock: finalStock };
          if (m.row.visibility !== null) {
            patch.visibleTo = m.row.visibility;
            oldValues.visibleTo = m.oldVisibility;
            newValues.visibleTo = m.row.visibility;
          }
          // Migration log üçün toplayırıq
          logUpdates.push({
            productId: m.product.id,
            productName:
              (m.product.name as any)?.az ||
              (m.product.name as any)?.en ||
              String(m.product.name || ''),
            oldValues,
            newValues,
          });
          return updateDoc(doc(db, 'products', m.product.id), patch);
        })
      );

      // 2) Yeni məhsullar
      for (const r of result.created) {
        const gender = ['men', 'women', 'unisex'].includes(r.gender) ? r.gender : 'unisex';
        const newDocData = {
          name: { az: r.name, ru: r.name, en: r.name },
          description: { az: '', ru: '', en: '' },
          price: r.price || 0,
          salePrice: null,
          b2bPrice: null,
          b2bSalePrice: null,
          images: [],
          brand: r.brand,
          category: r.category,
          gender,
          isEnabled: true,
          isBestseller: false,
          stock: Math.max(0, r.stock),
          visibleTo: r.visibility ?? 'all',
          createdAt: new Date(),
        };
        const ref = await addDoc(collection(db, 'products'), newDocData);
        logCreations.push({
          productId: ref.id,
          productName: r.name,
          data: newDocData,
        });
      }

      // 3) Migration log-u saxla (yalnız əslində dəyişiklik edilibsə)
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
            },
            updates: logUpdates,
            creations: logCreations,
          });
        } catch (logErr) {
          // Log saxlamaq alınmasa da, əsas migration uğurlu olub — istifadəçiyə xəbərdarlıq
          console.warn('Migration log saxlamaq alınmadı:', logErr);
        }
      }

      const parts: string[] = [];
      if (result.updated.length > 0) parts.push(`${result.updated.length} məhsulun stoku yeniləndi`);
      if (result.created.length > 0) parts.push(`${result.created.length} yeni məhsul yaradıldı (şəkilsiz)`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} sətir atlandı`);
      alert(parts.join('\n') || 'Heç bir dəyişiklik edilmədi');
      setResult(null);
      if (fileRef.current) fileRef.current.value = '';
      onDone?.();
    } catch (e) {
      alert('Tətbiq xətası: ' + (e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-5 bg-gradient-to-br from-amber-50/50 to-white" data-testid="product-import-panel">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="h-6 w-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Excel ilə məhsul miqrasiyası</h3>
            <p className="text-xs text-gray-600 mt-0.5 max-w-2xl">
              Hazır şablonu yükləyin, doldurun, faylı əlavə edin. Məhsul <strong>ad-a görə</strong> tapılır —
              tapılsa <strong>stok</strong> (və faylda göstərilibsə <strong>görünürlük</strong>) yenilənir,
              qiymət/kateqoriya dəyişmir. Yoxdursa yeni yaradılır.
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              <span className="font-semibold">Görünür kim?</span> sütunu üçün qısa kodlar:
              <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">a</span> = Hamı,
              <span className="ml-1 inline-block px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">b</span> = Yalnız B2B,
              <span className="ml-1 inline-block px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono">c</span> = Yalnız müştəri.
              Boş qalsa: yeni məhsul üçün defolt &quot;a&quot;, mövcud məhsulda dəyişmir.
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
            title="Köhnə Excel versiyası (.xls) — bəzən .xlsx açılmayanda işə yarayır"
          >
            <Download className="h-4 w-4" />
            (.xls)
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-amber-200 bg-white/70 p-3" data-testid="product-import-stock-mode">
        <p className="text-xs font-semibold text-gray-800 mb-2">
          Stok rejimi — mövcud məhsulu fayl ilə müqayisə edəndə nə baş versin?
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <label
            className={`flex-1 flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
              stockMode === 'replace'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            data-testid="stock-mode-replace-label"
          >
            <input
              type="radio"
              name="stock-mode"
              value="replace"
              checked={stockMode === 'replace'}
              onChange={() => setStockMode('replace')}
              className="mt-0.5 accent-amber-600"
              data-testid="stock-mode-replace"
            />
            <span>
              <span className="font-medium text-gray-900">Stoku yenilə (əvəz et)</span>
              <span className="block text-[11px] text-gray-600 mt-0.5">
                Saytdakı miqdar fayldakı dəyərlə əvəz olunur. Məs: saytda 1, faylda 2 → nəticə 2.
              </span>
            </span>
          </label>
          <label
            className={`flex-1 flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-colors ${
              stockMode === 'add'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            data-testid="stock-mode-add-label"
          >
            <input
              type="radio"
              name="stock-mode"
              value="add"
              checked={stockMode === 'add'}
              onChange={() => setStockMode('add')}
              className="mt-0.5 accent-emerald-600"
              data-testid="stock-mode-add"
            />
            <span>
              <span className="font-medium text-gray-900">Stoku artır (üzərinə əlavə et)</span>
              <span className="block text-[11px] text-gray-600 mt-0.5">
                Fayldakı miqdar mövcud stokun üzərinə gəlir. Məs: saytda 1, faylda 2 → nəticə 3.
              </span>
            </span>
          </label>
        </div>
      </div>

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

      {result && (
        <div className="mt-5 space-y-3" data-testid="product-import-result">
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {result.updated.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Stok yenilənəcək ({result.updated.length})
                <span className="text-[11px] text-gray-500 font-normal">
                  — {stockMode === 'add' ? 'üzərinə əlavə olunacaq' : 'fayldakı dəyər ilə əvəz olunacaq'} · kateqoriya/qiymət köhnə qalır
                </span>
              </p>
              <div className="max-h-60 overflow-y-auto border border-emerald-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.updated.map((m, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3 flex-wrap" data-testid={`import-update-${i}`}>
                    <span className="flex-1 truncate min-w-[200px]">
                      {m.product.name?.az || m.product.name?.en}
                      {m.matchReason !== 'exact' && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200"
                          title={`Smart match (${Math.round(m.matchConfidence * 100)}% oxşar) — fayldakı ad: "${m.row.name}"`}
                          data-testid={`import-update-fuzzy-${i}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {Math.round(m.matchConfidence * 100)}%
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{m.product.category}</span>
                    {m.categoryMismatch && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200" title={`Faylda: ${m.row.category}`}>
                        Fayldakı kateqoriya iqnor edildi
                      </span>
                    )}
                    {m.visibilityChanged && m.row.visibility && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200" data-testid={`import-update-vis-${i}`}>
                        Görünür: {visibilityLabel(m.oldVisibility)} → <b>{visibilityLabel(m.row.visibility)}</b>
                      </span>
                    )}
                    <span className="font-mono tabular-nums">
                      {(() => {
                        const finalStock =
                          stockMode === 'add'
                            ? Math.max(0, m.oldStock + m.newStock)
                            : Math.max(0, m.newStock);
                        return (
                          <>
                            {m.oldStock}
                            {stockMode === 'add' && (
                              <span className="text-emerald-700"> + {m.newStock}</span>
                            )}
                            {' '}→{' '}
                            <span className={finalStock !== m.oldStock ? 'text-amber-700 font-bold' : ''}>
                              {finalStock}
                            </span>
                          </>
                        );
                      })()}
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
              <div className="max-h-60 overflow-y-auto border border-blue-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.created.map((r, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3" data-testid={`import-create-${i}`}>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-gray-500 text-[11px]">{r.category} · {r.brand}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      {visibilityLabel(r.visibility ?? 'all')}
                    </span>
                    <span className="font-mono tabular-nums">{r.price} AZN · stok: {r.stock}</span>
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
                      <span className="text-gray-900">{s.row.name || <em className="text-gray-400">(ad boş)</em>}</span>{' '}
                      <span className="text-gray-400">#{s.row.__row}</span>
                    </span>
                    <span className="text-amber-700 text-[11px]">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setResult(null)}
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
