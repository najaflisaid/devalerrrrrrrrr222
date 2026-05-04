import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Product } from '../../types';

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
} as const;

interface ParsedRow {
  category: string;
  brand: string;
  name: string;
  price: number;
  stock: number;
  gender: string;
  __row: number;
}

interface ImportResult {
  updated: { product: Product; oldStock: number; newStock: number; row: ParsedRow; categoryMismatch: boolean }[];
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
const downloadTemplate = () => {
  const headers = [
    COL.category,
    COL.brand,
    COL.name,
    COL.price,
    COL.stock,
    COL.gender,
  ];
  const sampleRows = [
    { [COL.category]: '', [COL.brand]: '', [COL.name]: '', [COL.price]: '', [COL.stock]: '', [COL.gender]: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  (ws as any)['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
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
    ['4. Sistemdə həmin ad ilə məhsul varsa, YALNIZ miqdar yenilənir. Kateqoriya, brend, qiymət DƏYİŞMİR (köhnə məlumatlar qalır).'],
    ['5. Sistemdə məhsul yoxdursa yeni yaradılır. Amma bu halda:'],
    ['   • "Kateqoriya" sistemdə artıq mövcud olmalıdır (əks halda sətir atlanır).'],
    ['   • "Brend" sistemdə artıq mövcud olmalıdır (əks halda sətir atlanır).'],
    ['   Yeni kateqoriya/brend yaratmaq üçün admin panelinə keçin → Kateqoriyalar / Brendlər.'],
    ['6. "Cins" sütununda: men / women / unisex (boşdursa unisex qəbul olunur).'],
    ['7. Qiymət yalnız rəqəm: məsələn 280 və ya 280.50'],
    ['8. Şəkillər şablona daxil deyil — yeni məhsullar üçün sonradan admin panelindən əlavə edirsiniz.'],
    [''],
    ['Stok yenilənməsi nümunəsi:'],
    ['  Saytda: "Casio LTP-1094E-7ARDF" stoku 3 ədəd'],
    ['  Faylda eyni ad ilə miqdar: 4'],
    ['  Nəticə: stok avtomatik 4 olur. Başqa heç nə dəyişmir.'],
  ];
  const infoWs = XLSX.utils.aoa_to_sheet(info);
  (infoWs as any)['!cols'] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, infoWs, 'Təlimat');
  XLSX.writeFile(wb, 'devaleur-mehsul-sablonu.xlsx');
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
    rows.push({
      category: map.category ? String(r[map.category] || '').trim() : '',
      brand: map.brand ? String(r[map.brand] || '').trim() : '',
      name,
      price: map.price ? toNum(r[map.price]) : 0,
      stock,
      gender: (map.gender ? String(r[map.gender] || '').trim().toLowerCase() : '') || 'unisex',
      __row: idx + 2,
    });
  });
  return { rows, errors };
};

// ───── Komponent ─────
const ProductExcelImport: React.FC<Props> = ({ products, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
        // Match ƏSL: YALNIZ AD-A görə (case-insensitive)
        const found = products.find((p) => {
          const pname = norm(p.name?.az || p.name?.en || '');
          return pname && pname === norm(row.name);
        });

        if (found) {
          // Köhnə kateqoriya qorunur — fayldakı kateqoriya iqnor edilir
          const fileCatNorm = norm(row.category);
          const productCatNorm = norm(found.category);
          const categoryMismatch = !!row.category && fileCatNorm !== productCatNorm;
          updated.push({
            product: found,
            oldStock: typeof found.stock === 'number' ? found.stock : 0,
            newStock: row.stock,
            row,
            categoryMismatch,
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
      // 1) Stok yenilənməsi — köhnə məlumatlar qorunur, yalnız `stock` dəyişir
      await Promise.all(
        result.updated.map((m) =>
          updateDoc(doc(db, 'products', m.product.id), { stock: Math.max(0, m.newStock) })
        )
      );

      // 2) Yeni məhsullar
      for (const r of result.created) {
        const gender = ['men', 'women', 'unisex'].includes(r.gender) ? r.gender : 'unisex';
        await addDoc(collection(db, 'products'), {
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
          visibleTo: 'all',
          createdAt: new Date(),
        });
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
              tapılsa <strong>yalnız miqdar yenilənir</strong> (kateqoriya/qiymət dəyişmir). Yoxdursa yeni yaradılır,
              amma kateqoriya və brend sistemdə olmalıdır.
            </p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-500 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium"
          data-testid="product-import-template-btn"
        >
          <Download className="h-4 w-4" />
          Şablonu yüklə (.xlsx)
        </button>
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
                <span className="text-[11px] text-gray-500 font-normal">— kateqoriya/qiymət köhnə qalır</span>
              </p>
              <div className="max-h-60 overflow-y-auto border border-emerald-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.updated.map((m, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3" data-testid={`import-update-${i}`}>
                    <span className="flex-1 truncate">{m.product.name?.az || m.product.name?.en}</span>
                    <span className="text-gray-500">{m.product.category}</span>
                    {m.categoryMismatch && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200" title={`Faylda: ${m.row.category}`}>
                        Fayldakı kateqoriya iqnor edildi
                      </span>
                    )}
                    <span className="font-mono tabular-nums">
                      {m.oldStock} → <span className={m.newStock !== m.oldStock ? 'text-amber-700 font-bold' : ''}>{m.newStock}</span>
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
