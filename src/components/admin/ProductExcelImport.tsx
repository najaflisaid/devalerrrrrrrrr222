import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Product } from '../../types';

interface Props {
  products: Product[];
  onDone?: () => void;
}

interface ParsedRow {
  name: string;
  category: string;
  brand?: string;
  stock: number;
  price?: number;
  rawLine: string;
}

interface ImportResult {
  matched: { product: Product; oldStock: number; newStock: number; row: ParsedRow }[];
  notFound: ParsedRow[];
  errors: string[];
}

// Sadə CSV parser — comma və semicolon dəstəkləyir, sətir başına 1 məhsul
const parseCsv = (text: string): ParsedRow[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  // Header: name,category,brand,stock,price (sıra önəmlidir, header tələbatı yoxdur)
  // Auto-detect delimiter
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  // Detect & skip header line if it contains text like "name" / "ad" / "stock" / "stok"
  let startIdx = 0;
  const headerHints = ['name', 'ad', 'category', 'kateqori', 'brand', 'brend', 'stock', 'stok'];
  const firstLower = lines[0].toLowerCase();
  if (headerHints.some((h) => firstLower.includes(h))) {
    startIdx = 1;
  }
  const rows: ParsedRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2) continue;
    const name = cells[0] || '';
    const category = cells[1] || '';
    const brand = cells[2] || '';
    const stockRaw = cells[3] ?? cells[2] ?? '0';
    const priceRaw = cells[4] || '';
    const stock = parseInt(stockRaw.replace(/[^\d-]/g, ''), 10);
    if (!name || isNaN(stock)) continue;
    rows.push({
      name,
      category,
      brand: brand || undefined,
      stock,
      price: priceRaw ? parseFloat(priceRaw.replace(/[^\d.]/g, '')) || undefined : undefined,
      rawLine: lines[i],
    });
  }
  return rows;
};

const norm = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const ProductExcelImport: React.FC<Props> = ({ products, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [autoCreate, setAutoCreate] = useState(false);

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setResult({ matched: [], notFound: [], errors: ['CSV-də heç bir məhsul sətri tapılmadı. Format: ad,kateqoriya,brend,stok,qiymət'] });
        return;
      }
      const matched: ImportResult['matched'] = [];
      const notFound: ParsedRow[] = [];
      for (const row of rows) {
        // Eyni ad + kateqoriya birləşməsi əsasında uyğunlaşdır (kateqoriya boşdursa yalnız ad)
        const found = products.find((p) => {
          const pname = norm(p.name?.az || p.name?.en || '');
          const pcat = norm(p.category || '');
          if (norm(row.name) !== pname) return false;
          if (row.category && norm(row.category) !== pcat) return false;
          return true;
        });
        if (found) {
          matched.push({
            product: found,
            oldStock: typeof found.stock === 'number' ? found.stock : 0,
            newStock: row.stock,
            row,
          });
        } else {
          notFound.push(row);
        }
      }
      setResult({ matched, notFound, errors: [] });
    } catch (e) {
      setResult({ matched: [], notFound: [], errors: ['Faylı oxumaq xəta: ' + (e as Error).message] });
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      // 1) Mövcud məhsulların stoku yenilə
      await Promise.all(
        result.matched.map((m) =>
          updateDoc(doc(db, 'products', m.product.id), { stock: Math.max(0, m.newStock) })
        )
      );
      // 2) Auto-create seçimi yandırılıbsa, tapılmayanları yarat
      if (autoCreate && result.notFound.length > 0) {
        // Mövcud kateqoriyaları və brendləri bir dəfə oxu
        const [catSnap, brandSnap] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'brands')),
        ]);
        const cats = catSnap.docs.map((d) => {
          const data = d.data() as any;
          const name = typeof data.name === 'object' ? data.name.az : data.name;
          return { id: d.id, name };
        });
        const brands = brandSnap.docs.map((d) => {
          const data = d.data() as any;
          const name = typeof data.name === 'object' ? data.name.az : data.name;
          return { id: d.id, name };
        });
        for (const r of result.notFound) {
          // Kateqoriya yoxdursa yarat
          if (r.category && !cats.find((c) => norm(c.name) === norm(r.category))) {
            await addDoc(collection(db, 'categories'), {
              name: { az: r.category, ru: r.category, en: r.category },
              parentId: null,
              createdAt: new Date(),
            });
          }
          // Brend yoxdursa yarat
          if (r.brand && !brands.find((b) => norm(b.name) === norm(r.brand!))) {
            await addDoc(collection(db, 'brands'), {
              name: r.brand,
              logo: null,
              createdAt: new Date(),
            });
          }
          await addDoc(collection(db, 'products'), {
            name: { az: r.name, ru: r.name, en: r.name },
            description: { az: '', ru: '', en: '' },
            price: r.price || 0,
            salePrice: null,
            b2bPrice: null,
            b2bSalePrice: null,
            images: [],
            brand: r.brand || '',
            category: r.category,
            gender: 'unisex',
            isEnabled: true,
            isBestseller: false,
            stock: Math.max(0, r.stock),
            visibleTo: 'all',
            createdAt: new Date(),
          });
        }
      }
      alert(
        `${result.matched.length} məhsulun stoku yeniləndi.` +
          (autoCreate ? ` ${result.notFound.length} yeni məhsul yaradıldı.` : '')
      );
      setResult(null);
      if (fileRef.current) fileRef.current.value = '';
      onDone?.();
    } catch (e) {
      alert('Tətbiq xətası: ' + (e as Error).message);
    } finally {
      setApplying(false);
    }
    void query;
    void where;
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-5 bg-amber-50/40" data-testid="product-import-panel">
      <div className="flex items-center gap-3 mb-3">
        <FileSpreadsheet className="h-5 w-5 text-amber-700" />
        <div>
          <h3 className="font-semibold text-gray-900">Excel/CSV ilə stok migrasiyası</h3>
          <p className="text-xs text-gray-600">
            Format: <span className="font-mono">ad,kateqoriya,brend,stok,qiymət</span> · 1-ci sətir başlıq ola bilər ·
            comma (,) və ya semicolon (;) dəstəklənir
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv"
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 text-sm"
          data-testid="product-import-select-btn"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          CSV faylı seç
        </button>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCreate}
            onChange={(e) => setAutoCreate(e.target.checked)}
            data-testid="product-import-auto-create"
          />
          Yeni məhsulları avtomatik yarat (tapılmayanlar)
        </label>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          {result.matched.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Uyğunlaşdı ({result.matched.length})
              </p>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                {result.matched.map((m, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center gap-3" data-testid={`import-match-${i}`}>
                    <span className="flex-1 truncate">{m.product.name?.az}</span>
                    <span className="text-gray-500">{m.product.category}</span>
                    <span className="font-mono">
                      {m.oldStock} → <span className={m.newStock !== m.oldStock ? 'text-amber-700 font-bold' : ''}>{m.newStock}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.notFound.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Tapılmadı ({result.notFound.length})
                {!autoCreate && <span className="text-xs text-gray-500">— "Avtomatik yarat" seçimi yandırılmayıb</span>}
              </p>
              <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg divide-y divide-amber-100 bg-amber-50/30">
                {result.notFound.map((r, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs flex items-center gap-3" data-testid={`import-notfound-${i}`}>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-gray-500">{r.category}</span>
                    <span className="font-mono">stok: {r.stock}</span>
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
              disabled={applying || (result.matched.length === 0 && !(autoCreate && result.notFound.length > 0))}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-60"
              data-testid="product-import-apply"
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              Tətbiq et
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductExcelImport;
