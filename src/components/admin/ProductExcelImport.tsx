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
// İstifadəçi şablonu dəyişdirə bilər amma sütun adları mütləq eyni qalmalıdır.
const COL = {
  category: 'Kateqoriya',
  brand: 'Brend',
  sku: 'Məhsul kodu',
  name: 'Məhsul adı',
  price: 'Qiymət (AZN)',
  b2bPrice: 'B2B qiymət (AZN)',
  stock: 'Miqdar',
  gender: 'Cins',
} as const;

interface ParsedRow {
  category: string;
  brand: string;
  sku: string;
  name: string;
  price: number;
  b2bPrice: number;
  stock: number;
  gender: string;
  __row: number;
}

interface ImportResult {
  updated: { product: Product; oldStock: number; newStock: number; row: ParsedRow }[];
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
    COL.sku,
    COL.name,
    COL.price,
    COL.b2bPrice,
    COL.stock,
    COL.gender,
  ];
  const sampleRows = [
    { [COL.category]: 'Saatlar', [COL.brand]: 'U.S. Polo Assn.', [COL.sku]: 'USPA 1111-02', [COL.name]: 'U.S. Polo Assn. Kişi saatı 1111-02', [COL.price]: 280, [COL.b2bPrice]: 195, [COL.stock]: 4, [COL.gender]: 'men' },
    { [COL.category]: 'Saatlar', [COL.brand]: 'Casio', [COL.sku]: 'MTP-V001L-7B', [COL.name]: 'Casio Classic MTP-V001L-7B', [COL.price]: 155, [COL.b2bPrice]: 110, [COL.stock]: 10, [COL.gender]: 'men' },
    { [COL.category]: 'Çantalar', [COL.brand]: 'Silver & Polo', [COL.sku]: 'SP-CNT-2024-01', [COL.name]: 'Silver & Polo Qadın dəri çanta', [COL.price]: 320, [COL.b2bPrice]: 230, [COL.stock]: 6, [COL.gender]: 'women' },
    { [COL.category]: '', [COL.brand]: '', [COL.sku]: '', [COL.name]: '', [COL.price]: '', [COL.b2bPrice]: '', [COL.stock]: '', [COL.gender]: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  // Sütun genişlikləri
  (ws as any)['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 44 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');
  // İnstruksiya vərəqi
  const info = [
    ['DE VALEUR — Məhsul miqrasiyası şablonu'],
    [''],
    ['İstifadə qaydaları:'],
    ['1. Yuxarıdakı sütun başlıqlarını DƏYİŞMƏYİN. Sıra da eynilə qalsın.'],
    ['2. Hər sətir 1 məhsul deməkdir. Boş sətir atlanır.'],
    ['3. "Məhsul kodu" (SKU) unikal olmalıdır. Sistemdə bu kod ilə məhsul varsa, YALNIZ miqdar yenilənir.'],
    ['4. SKU boş olsa ad+kateqoriya birləşməsinə görə uyğunlaşdırılır.'],
    ['5. Sistemdə məhsul yoxdursa, bütün sütunlardan istifadə olunaraq yeni məhsul yaradılır (şəkil boş — sonradan admin panelindən əlavə edərsiniz).'],
    ['6. "Cins" sütununda: men / women / unisex yazılmalıdır. Boşdursa unisex olur.'],
    ['7. Qiymətlər yalnız rəqəm. Məsələn: 280 və ya 280.50'],
    ['8. Kateqoriya və ya brend sistemdə yoxdursa avtomatik yaradılır.'],
    [''],
    ['Stok yenilənməsi nümunəsi:'],
    ['  Saytda: "USPA 1111-02" məhsulunun stoku 3 ədəd'],
    ['  Fayldakı həmin SKU-nun miqdarı 4 ədəd'],
    ['  Sonra: stok avtomatik 4 olur (yenisi gözləyir: 1)'],
  ];
  const infoWs = XLSX.utils.aoa_to_sheet(info);
  (infoWs as any)['!cols'] = [{ wch: 90 }];
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
  if (!ws) {
    return { rows: [], errors: ['Faylda heç bir vərəq tapılmadı'] };
  }
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (raw.length === 0) return { rows: [], errors: ['Faylda heç bir sətir yoxdur'] };

  // Sütun adlarını case-insensitive uyğunlaşdır
  const firstRow = raw[0];
  const availableCols = Object.keys(firstRow);
  const findCol = (target: string): string | null => {
    const t = norm(target);
    return availableCols.find((c) => norm(c) === t) || null;
  };

  const map = {
    category: findCol(COL.category),
    brand: findCol(COL.brand),
    sku: findCol(COL.sku),
    name: findCol(COL.name),
    price: findCol(COL.price),
    b2bPrice: findCol(COL.b2bPrice),
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
    if (!name) return; // boş sətir
    rows.push({
      category: map.category ? String(r[map.category] || '').trim() : '',
      brand: map.brand ? String(r[map.brand] || '').trim() : '',
      sku: map.sku ? String(r[map.sku] || '').trim() : '',
      name,
      price: map.price ? toNum(r[map.price]) : 0,
      b2bPrice: map.b2bPrice ? toNum(r[map.b2bPrice]) : 0,
      stock,
      gender: (map.gender ? String(r[map.gender] || '').trim().toLowerCase() : '') || 'unisex',
      __row: idx + 2, // 1-based + header
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

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const { rows, errors } = await parseFile(file);
      if (errors.length > 0 || rows.length === 0) {
        setResult({ updated: [], created: [], skipped: [], errors: errors.length > 0 ? errors : ['Sətir tapılmadı'] });
        return;
      }

      const updated: ImportResult['updated'] = [];
      const created: ParsedRow[] = [];
      const skipped: ImportResult['skipped'] = [];

      for (const row of rows) {
        // 1) SKU-a görə match et (prioritet)
        let found: Product | undefined;
        if (row.sku) {
          found = products.find((p) => p.sku && norm(p.sku) === norm(row.sku));
        }
        // 2) Ad + kateqoriya match
        if (!found) {
          found = products.find((p) => {
            const pname = norm(p.name?.az || p.name?.en || '');
            if (!pname) return false;
            if (norm(row.name) !== pname) return false;
            if (row.category && p.category && norm(row.category) !== norm(p.category)) return false;
            return true;
          });
        }

        if (found) {
          // Mövcud məhsul — yalnız stok yenilə
          updated.push({
            product: found,
            oldStock: typeof found.stock === 'number' ? found.stock : 0,
            newStock: row.stock,
            row,
          });
        } else {
          // Tam məlumatla yarat — amma ən az lazımi sütunlar olmalıdır
          if (!row.name || !row.category) {
            skipped.push({ row, reason: !row.name ? 'Ad boş' : 'Kateqoriya boş (yeni məhsul üçün tələb olunur)' });
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
      // 1) Stok yenilənməsi
      await Promise.all(
        result.updated.map((m) =>
          updateDoc(doc(db, 'products', m.product.id), { stock: Math.max(0, m.newStock) })
        )
      );

      // 2) Yeni məhsullar — kateqoriya və brend yoxdursa yarat
      if (result.created.length > 0) {
        const [catSnap, brandSnap] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'brands')),
        ]);
        const cats = catSnap.docs.map((d) => {
          const data = d.data() as any;
          const name = typeof data.name === 'object' ? data.name.az : data.name;
          return { id: d.id, name: name || '' };
        });
        const brands = brandSnap.docs.map((d) => {
          const data = d.data() as any;
          const name = typeof data.name === 'object' ? data.name.az : data.name;
          return { id: d.id, name: name || '' };
        });

        for (const r of result.created) {
          if (r.category && !cats.find((c) => norm(c.name) === norm(r.category))) {
            const ref = await addDoc(collection(db, 'categories'), {
              name: { az: r.category, ru: r.category, en: r.category },
              parentId: null,
              createdAt: new Date(),
            });
            cats.push({ id: ref.id, name: r.category });
          }
          if (r.brand && !brands.find((b) => norm(b.name) === norm(r.brand))) {
            const ref = await addDoc(collection(db, 'brands'), {
              name: r.brand,
              logo: null,
              createdAt: new Date(),
            });
            brands.push({ id: ref.id, name: r.brand });
          }

          const gender = ['men', 'women', 'unisex'].includes(r.gender) ? r.gender : 'unisex';
          await addDoc(collection(db, 'products'), {
            sku: r.sku || null,
            name: { az: r.name, ru: r.name, en: r.name },
            description: { az: '', ru: '', en: '' },
            price: r.price || 0,
            salePrice: null,
            b2bPrice: r.b2bPrice || null,
            b2bSalePrice: null,
            images: [], // sonra admin əlavə edəcək
            brand: r.brand || '',
            category: r.category,
            gender,
            isEnabled: true,
            isBestseller: false,
            stock: Math.max(0, r.stock),
            visibleTo: 'all',
            createdAt: new Date(),
          });
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
            <p className="text-xs text-gray-600 mt-0.5">
              Hazır şablonu yükləyin, doldurun və faylı buraya əlavə edin. Eyni <strong>SKU</strong> (məhsul kodu) və ya
              ad+kateqoriya tapılsa, <strong>yalnız miqdar yenilənir</strong>. Yoxdursa, bütün məlumatlarla yeni məhsul yaradılır.
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
        <span className="text-xs text-gray-500">
          Qəbul olunur: .xlsx, .xls, .csv
        </span>
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

          {/* Yenilənəcək */}
          {result.updated.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Stok yenilənəcək ({result.updated.length})
              </p>
              <div className="max-h-60 overflow-y-auto border border-emerald-100 rounded-lg divide-y divide-gray-100 bg-white">
                {result.updated.map((m, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3" data-testid={`import-update-${i}`}>
                    <span className="flex-1 truncate">{m.product.name?.az || m.product.name?.en}</span>
                    {m.product.sku && <span className="text-gray-400 font-mono text-[10px]">{m.product.sku}</span>}
                    <span className="text-gray-500">{m.product.category}</span>
                    <span className="font-mono tabular-nums">
                      {m.oldStock} → <span className={m.newStock !== m.oldStock ? 'text-amber-700 font-bold' : ''}>{m.newStock}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yaradılacaq */}
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
                    {r.sku && <span className="text-gray-400 font-mono text-[10px]">{r.sku}</span>}
                    <span className="text-gray-500 text-[11px]">{r.category} · {r.brand}</span>
                    <span className="font-mono tabular-nums">{r.price} AZN · stok: {r.stock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atlanılanlar */}
          {result.skipped.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Atlandı ({result.skipped.length})
              </p>
              <div className="max-h-32 overflow-y-auto border border-amber-100 rounded-lg divide-y divide-amber-100 bg-amber-50/30">
                {result.skipped.map((s, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs flex items-center gap-3">
                    <span className="flex-1 truncate">{s.row.name || <em className="text-gray-400">(ad boş)</em>} <span className="text-gray-400">#{s.row.__row}</span></span>
                    <span className="text-amber-700">{s.reason}</span>
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
    </div>
  );
};

export default ProductExcelImport;
