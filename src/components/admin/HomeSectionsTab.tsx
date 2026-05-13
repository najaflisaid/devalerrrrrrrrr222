import React, { useEffect, useState } from 'react';
import { Loader2, Save, ToggleLeft, ToggleRight, Image as ImageIcon, Upload, X, ArrowUp, ArrowDown } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import {
  getHomepageSections,
  updateHomepageSections,
  HomepageSections,
  DEFAULT_HOMEPAGE_SECTIONS,
} from '../../services/contentService';
import { productService } from '../../services/productService';
import type { Product } from '../../types';

type Lang = 'az' | 'ru' | 'en';
const LANGS: Lang[] = ['az', 'ru', 'en'];

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
);

const MultiLangField: React.FC<{
  label: string;
  value: { az: string; ru: string; en: string };
  onChange: (v: { az: string; ru: string; en: string }) => void;
  textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <div>
    <Label>{label}</Label>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {LANGS.map((l) => {
        const Tag: any = textarea ? 'textarea' : 'input';
        return (
          <div key={l}>
            <span className="text-xs text-gray-500 uppercase">{l}</span>
            <Tag
              value={value[l] || ''}
              onChange={(e: any) => onChange({ ...value, [l]: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              rows={textarea ? 3 : undefined}
              data-testid={`home-sections-${label.replace(/\s+/g, '-').toLowerCase()}-${l}`}
            />
          </div>
        );
      })}
    </div>
  </div>
);

/** Reusable section wrapper with header + enable/disable toggle. */
const SectionEditor: React.FC<{
  title: string;
  description: string;
  testid: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}> = ({ title, description, testid, enabled, onToggle, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5" data-testid={testid}>
    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black"
      >
        {enabled ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
        {enabled ? 'Aktivdir' : 'Deaktivdir'}
      </button>
    </div>
    {children}
  </div>
);

/** Multi-select product picker with thumbnail, multi-lang search, category filter. */
const ProductPicker: React.FC<{
  label: string;
  products: Product[];
  selected: string[];
  onChange: (ids: string[]) => void;
  maxCount?: number;
  testidPrefix: string;
}> = ({ label, products, selected, onChange, maxCount = 12, testidPrefix }) => {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const getName = (p: Product) =>
    typeof p.name === 'string' ? (p.name as unknown as string) : p.name.az || p.name.en || p.name.ru || '';

  // Yığım: bütün uniq brendlər və kateqoriyalar
  const allBrands = React.useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => p.brand && s.add(p.brand));
    return Array.from(s).sort();
  }, [products]);
  const allCats = React.useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [products]);

  // Filter
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'all' && p.category !== catFilter) return false;
      if (brandFilter !== 'all' && p.brand !== brandFilter) return false;
      if (!s) return true;
      // Çoxdilli + brend + kateqoriya + id axtarışı
      const pname = typeof p.name === 'string' ? p.name : `${p.name.az || ''} ${p.name.en || ''} ${p.name.ru || ''}`;
      const hay = `${pname} ${p.brand || ''} ${p.category || ''} ${p.id || ''}`.toLowerCase();
      return hay.includes(s);
    });
  }, [products, q, catFilter, brandFilter]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      if (selected.length >= maxCount) return;
      onChange([...selected, id]);
    }
  };
  const move = (id: string, dir: -1 | 1) => {
    const idx = selected.indexOf(id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= selected.length) return;
    const copy = [...selected];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  };

  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <div data-testid={testidPrefix}>
      <Label>{label}</Label>

      {/* Selected chips with reorder + thumbnail */}
      {selected.length > 0 && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid={`${testidPrefix}-selected`}>
          {selected.map((id, i) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-3 p-2 bg-black/[0.03] border border-gray-200 rounded-lg"
                data-testid={`${testidPrefix}-chip-${i}`}
              >
                <span className="font-mono text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="w-12 h-12 object-contain bg-white border border-gray-100 rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-gray-500 font-semibold">{p.brand}</div>
                  <div className="text-sm text-gray-800 truncate">{getName(p)}</div>
                  <div className="text-xs text-gray-500 tabular-nums">{p.price?.toFixed(0)} AZN</div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    disabled={i === 0}
                    className="p-1 text-gray-500 hover:text-black disabled:opacity-25"
                    aria-label="Yuxarı"
                    data-testid={`${testidPrefix}-move-up-${i}`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    disabled={i === selected.length - 1}
                    className="p-1 text-gray-500 hover:text-black disabled:opacity-25"
                    aria-label="Aşağı"
                    data-testid={`${testidPrefix}-move-down-${i}`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  aria-label="Sil"
                  data-testid={`${testidPrefix}-remove-${i}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-500 hover:text-black underline justify-self-start mt-1"
          >
            Hamısını təmizlə
          </button>
        </div>
      )}

      {/* Search + filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
        <div className="sm:col-span-6 relative">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍  Məhsul axtar (ad, brend, kateqoriya, ID)..."
            className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            data-testid={`${testidPrefix}-search`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-1"
              aria-label="Təmizlə"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="sm:col-span-3 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          data-testid={`${testidPrefix}-brand-filter`}
        >
          <option value="all">Bütün brendlər</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="sm:col-span-3 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          data-testid={`${testidPrefix}-cat-filter`}
        >
          <option value="all">Bütün kateqoriyalar</option>
          {allCats.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Options grid with thumbnail */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
        {filtered.length === 0 ? (
          <p className="col-span-full text-center py-8 text-sm text-gray-500">
            Bu axtarışa uyğun məhsul tapılmadı.
          </p>
        ) : (
          filtered.slice(0, 200).map((p) => {
            const isSel = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`group text-left p-2 rounded-lg border-2 transition-all relative ${
                  isSel
                    ? 'bg-white border-black ring-1 ring-black'
                    : 'bg-white border-gray-200 hover:border-gray-900'
                }`}
                data-testid={`${testidPrefix}-option-${p.id}`}
              >
                {isSel && (
                  <span className="absolute top-1 right-1 z-[2] w-5 h-5 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-bold">
                    {selected.indexOf(p.id) + 1}
                  </span>
                )}
                <div className="aspect-square w-full bg-white rounded mb-2 overflow-hidden">
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt=""
                      className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                <div className="text-[9px] tracking-[0.18em] uppercase text-gray-600 font-bold truncate">
                  {p.brand || '—'}
                </div>
                <div className="text-[11px] text-gray-800 line-clamp-2 leading-snug min-h-[2em]">
                  {getName(p)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="font-medium tabular-nums text-black">{p.price?.toFixed(0)} AZN</span>
                  {p.stock !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded ${p.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {p.stock > 0 ? `${p.stock}` : '0'}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-500 flex items-center justify-between">
        <span>Seçilmiş: <b className="text-black">{selected.length}</b> / {maxCount}</span>
        <span className="text-gray-400">{filtered.length} / {products.length} məhsul göstərilir</span>
      </p>
    </div>
  );
};

/** Section order list with up/down arrows. */
const SECTION_LABELS: Record<string, string> = {
  collectionTiles: 'Kateqoriyalar (Collection Tiles)',
  bestSellers: 'Best Sellers carousel',
  heroSecondary: 'İkinci Hero (Hero Secondary)',
  redCarpet: 'Red Carpet Ready',
  ambassador: 'Ambassador editorial',
  featuredStory: 'Featured Story (editorial split)',
  giftFinder: 'Hədiyyə tapıcı kartı',
  brandShowcase: 'Brand Showcase',
  homeProductBanners: 'Home Product Banners',
  homeBlogSection: 'News & Stories (blog grid)',
  newsTiles: 'News Tiles',
  categoryBanner: 'Category Banner',
};

const SectionOrderList: React.FC<{
  order: string[];
  onChange: (o: string[]) => void;
}> = ({ order, onChange }) => {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const copy = [...order];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className="space-y-2">
      {order.map((key, i) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
          data-testid={`section-order-row-${key}`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-gray-400 w-6">{i + 1}.</span>
            <span className="text-sm text-gray-800">{SECTION_LABELS[key] || key}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="p-1.5 text-gray-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Yuxarı"
              data-testid={`section-order-up-${key}`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              className="p-1.5 text-gray-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Aşağı"
              data-testid={`section-order-down-${key}`}
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const HomeSectionsTab: React.FC = () => {
  const [data, setData] = useState<HomepageSections>(DEFAULT_HOMEPAGE_SECTIONS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sec, prods] = await Promise.all([
          getHomepageSections(),
          productService.getAll(true),
        ]);
        setData(sec);
        setProducts(prods);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await updateHomepageSections(data);
      setStatus('Yadda saxlanıldı ✓');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setStatus('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black"
    >
      {on ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
      {on ? 'Aktivdir' : 'Deaktivdir'}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="home-sections-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Ana səhifə bölmələri</h2>
          <p className="text-sm text-gray-500 mt-1">Brend vitrinı, kateqoriya kartları və yeniliklər bölmələrini idarə edin.</p>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm text-gray-600">{status}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
            data-testid="home-sections-save"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Yadda saxla
          </button>
        </div>
      </div>

      {/* --- Brand Showcase --- */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5" data-testid="home-sections-brand-showcase">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Premium brendlər vitrinı</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ana səhifədə hansı brendlər və hansı sıra ilə görünməsini seçin.</p>
          </div>
          <Toggle
            on={data.brandShowcase.enabled}
            onChange={(v) => setData({ ...data, brandShowcase: { ...data.brandShowcase, enabled: v } })}
          />
        </div>

        <div>
          <Label>Maksimum brend sayı (1–12)</Label>
          <input
            type="number"
            min={1}
            max={12}
            value={data.brandShowcase.maxBrands}
            onChange={(e) =>
              setData({
                ...data,
                brandShowcase: {
                  ...data.brandShowcase,
                  maxBrands: Math.max(1, Math.min(12, Number(e.target.value) || 6)),
                },
              })
            }
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            data-testid="home-sections-brand-max"
          />
          <p className="text-xs text-gray-500 mt-1">
            Hazırda ana səhifədə həmişə dəqiq <strong>6 brend</strong> göstərilir (3 sütunda 2 sıra).
            Bu sahə yalnız avtomatik seçim üçün top-N saymağa təsir edir.
          </p>
        </div>

        <div>
          <Label>Brendlər</Label>
          <p className="text-xs text-gray-500 mb-2">
            Heç biri seçilməsə, ən çox məhsulu olan top {data.brandShowcase.maxBrands} brend avtomatik göstərilir.
            Seçdiyiniz brendlər seçilmə sırası ilə vitrində görünür.
          </p>

          {(() => {
            const allBrands = Array.from(
              new Set(products.map((p) => (p as any).brand).filter(Boolean))
            ).sort((a: string, b: string) => a.localeCompare(b, 'az'));
            const selected = data.brandShowcase.selectedBrands || [];
            const toggleBrand = (b: string) => {
              const next = selected.includes(b)
                ? selected.filter((x) => x !== b)
                : [...selected, b];
              setData({ ...data, brandShowcase: { ...data.brandShowcase, selectedBrands: next } });
            };
            return (
              <>
                {selected.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selected.map((b, i) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black text-white rounded-full text-xs"
                      >
                        <span className="font-mono opacity-60">{i + 1}.</span> {b}
                        <button
                          type="button"
                          onClick={() => toggleBrand(b)}
                          className="ml-1 opacity-70 hover:opacity-100"
                          aria-label="Sil"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setData({ ...data, brandShowcase: { ...data.brandShowcase, selectedBrands: [] } })
                      }
                      className="text-xs text-gray-500 hover:text-black underline ml-1"
                    >
                      Hamısını təmizlə
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
                  {allBrands.map((b: string) => {
                    const isSel = selected.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBrand(b)}
                        className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                          isSel
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-800 border-gray-200 hover:border-black hover:bg-gray-50'
                        }`}
                        data-testid={`brand-toggle-${b}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                  {allBrands.length === 0 && (
                    <p className="col-span-full text-xs text-gray-500 italic">Brend tapılmadı.</p>
                  )}
                </div>
              </>
            );
          })()}
        </div>

      </div>

      {/* ==================== Collection Tiles ==================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5" data-testid="home-sections-collection-tiles">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Kateqoriya kartları (2 sütun grid)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ana səhifədə 2 sütunda görünən kateqoriya kartlarını idarə edin (məs: Qol saatları, Gümüş aksesuarlar, Dəri).
              Hər birinin adı, şəkili və linki sizin tərəfinizdən təyin olunur.
            </p>
          </div>
          <Toggle
            on={data.collectionTiles?.enabled !== false}
            onChange={(v) =>
              setData({
                ...data,
                collectionTiles: {
                  ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                  enabled: v,
                },
              })
            }
          />
        </div>

        {/* Eyebrow / Title / Subtitle */}
        <MultiLangField
          label="Üst yazı (eyebrow)"
          value={(data.collectionTiles?.eyebrow || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.eyebrow!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                eyebrow: v,
              },
            })
          }
        />
        <MultiLangField
          label="Başlıq"
          value={(data.collectionTiles?.title || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.title!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                title: v,
              },
            })
          }
        />
        <MultiLangField
          label="Alt başlıq"
          textarea
          value={(data.collectionTiles?.subtitle || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!.subtitle!) as any}
          onChange={(v) =>
            setData({
              ...data,
              collectionTiles: {
                ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                subtitle: v,
              },
            })
          }
        />

        {/* Tile list */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label>Kartlar</Label>
            <button
              type="button"
              onClick={() => {
                const newTile = {
                  id: `tile_${Date.now()}`,
                  title_az: '',
                  title_ru: '',
                  title_en: '',
                  image_url: '',
                  link_url: '',
                };
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: [...(data.collectionTiles?.tiles || []), newTile],
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-md text-xs hover:bg-gray-800"
              data-testid="add-collection-tile-btn"
            >
              + Yeni kart
            </button>
          </div>

          <div className="space-y-3">
            {(data.collectionTiles?.tiles || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Hələ kart yoxdur. Yuxarıdakı "+ Yeni kart" düyməsi ilə əlavə edin.</p>
            )}

            {(data.collectionTiles?.tiles || []).map((t, idx) => {
              const updateTile = (patch: Partial<typeof t>) => {
                const next = [...(data.collectionTiles?.tiles || [])];
                next[idx] = { ...next[idx], ...patch };
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const removeTile = () => {
                const next = (data.collectionTiles?.tiles || []).filter((_, i) => i !== idx);
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const moveUp = () => {
                if (idx === 0) return;
                const next = [...(data.collectionTiles?.tiles || [])];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const moveDown = () => {
                const len = (data.collectionTiles?.tiles || []).length;
                if (idx >= len - 1) return;
                const next = [...(data.collectionTiles?.tiles || [])];
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                setData({
                  ...data,
                  collectionTiles: {
                    ...(data.collectionTiles || DEFAULT_HOMEPAGE_SECTIONS.collectionTiles!),
                    tiles: next,
                  },
                });
              };
              const handleUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const filename = `collection_tile_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_collection_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ image_url: url });
                } catch (err) {
                  alert('Şəkil yüklənmədi: ' + (err as Error).message);
                }
              };
              const handleVideoUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'mp4';
                  const filename = `collection_tile_video_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_collection_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ video_url: url } as any);
                } catch (err) {
                  alert('Video yüklənmədi: ' + (err as Error).message);
                }
              };

              return (
                <div
                  key={t.id || idx}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                  data-testid={`collection-tile-row-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={moveUp} disabled={idx === 0} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Yuxarı">↑</button>
                      <button type="button" onClick={moveDown} disabled={idx >= (data.collectionTiles?.tiles || []).length - 1} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Aşağı">↓</button>
                      <button type="button" onClick={removeTile} className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-700" aria-label="Sil" data-testid={`remove-collection-tile-${idx}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact horizontal layout: small thumbnail + fields side by side */}
                  <div className="flex gap-3">
                    {/* Image — small thumbnail on the left */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <div className="aspect-[4/3] bg-white border border-gray-200 rounded overflow-hidden relative">
                        {t.image_url ? (
                          <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <label className="mt-1 w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                        <Upload className="h-3 w-3" />
                        {t.image_url ? 'Yenilə' : 'Yüklə'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.currentTarget.value = '';
                          }}
                          data-testid={`collection-tile-upload-${idx}`}
                        />
                      </label>
                      <input
                        type="text"
                        value={t.image_url}
                        onChange={(e) => updateTile({ image_url: e.target.value })}
                        placeholder="URL"
                        className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                      />

                      {/* Video — istəyə bağlı; yerləşdirilərsə şəkilin yerinə oynayır */}
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                        <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Video (istəyə bağlı)</p>
                        {(t as any).video_url && (
                          <div className="aspect-[4/3] bg-black border border-gray-200 rounded overflow-hidden mb-1">
                            <video
                              src={(t as any).video_url}
                              className="w-full h-full object-cover"
                              muted
                              autoPlay
                              loop
                              playsInline
                            />
                          </div>
                        )}
                        <label className="w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                          <Upload className="h-3 w-3" />
                          {(t as any).video_url ? 'Yenilə' : 'Yüklə'}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleVideoUpload(f);
                              e.currentTarget.value = '';
                            }}
                            data-testid={`collection-tile-video-upload-${idx}`}
                          />
                        </label>
                        <input
                          type="text"
                          value={(t as any).video_url || ''}
                          onChange={(e) => updateTile({ video_url: e.target.value } as any)}
                          placeholder="Video URL"
                          className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                          data-testid={`collection-tile-video-url-${idx}`}
                        />
                        {(t as any).video_url && (
                          <button
                            type="button"
                            onClick={() => updateTile({ video_url: '' } as any)}
                            className="mt-1 w-full px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded"
                          >
                            Videonu sil
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields — compact */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={t.title_az}
                        onChange={(e) => updateTile({ title_az: e.target.value })}
                        placeholder="Başlıq AZ"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                        data-testid={`collection-tile-title-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={t.title_ru}
                          onChange={(e) => updateTile({ title_ru: e.target.value })}
                          placeholder="RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                        <input
                          type="text"
                          value={t.title_en}
                          onChange={(e) => updateTile({ title_en: e.target.value })}
                          placeholder="EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={t.link_url}
                        onChange={(e) => updateTile({ link_url: e.target.value })}
                        placeholder="Link (məs: /products?category=...)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none font-mono"
                        data-testid={`collection-tile-link-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== News Tiles (Yeniliklər) ==================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5" data-testid="home-sections-news-tiles">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Yeniliklər (üfüqi sürüşmə)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ana səhifədə "Yeniliklər" bölməsi. Webdə eyni anda 4, mobildə 3 kart görünür — istifadəçi sağa-sola sürüşdürərək digərlərinə baxa bilir. Kartlar bir-birinə bitişikdir.
            </p>
          </div>
          <Toggle
            on={data.newsTiles?.enabled !== false}
            onChange={(v) =>
              setData({
                ...data,
                newsTiles: {
                  ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                  enabled: v,
                },
              })
            }
          />
        </div>

        <MultiLangField
          label="Başlıq"
          value={(data.newsTiles?.title || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!.title!) as any}
          onChange={(v) =>
            setData({
              ...data,
              newsTiles: {
                ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                title: v,
              },
            })
          }
        />

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <Label>Kartlar</Label>
            <button
              type="button"
              onClick={() => {
                const newTile = {
                  id: `news_${Date.now()}`,
                  title_az: '',
                  title_ru: '',
                  title_en: '',
                  image_url: '',
                  link_url: '',
                };
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: [...(data.newsTiles?.tiles || []), newTile],
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-md text-xs hover:bg-gray-800"
              data-testid="add-news-tile-btn"
            >
              + Yeni kart
            </button>
          </div>

          <div className="space-y-3">
            {(data.newsTiles?.tiles || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Hələ kart yoxdur.</p>
            )}

            {(data.newsTiles?.tiles || []).map((nt, idx) => {
              const tilesArr = data.newsTiles?.tiles || [];
              const updateTile = (patch: Partial<typeof nt>) => {
                const next = [...tilesArr];
                next[idx] = { ...next[idx], ...patch };
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const removeTile = () => {
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: tilesArr.filter((_, i) => i !== idx),
                  },
                });
              };
              const moveUp = () => {
                if (idx === 0) return;
                const next = [...tilesArr];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const moveDown = () => {
                if (idx >= tilesArr.length - 1) return;
                const next = [...tilesArr];
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                setData({
                  ...data,
                  newsTiles: {
                    ...(data.newsTiles || DEFAULT_HOMEPAGE_SECTIONS.newsTiles!),
                    tiles: next,
                  },
                });
              };
              const handleUpload = async (file: File) => {
                try {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const filename = `news_tile_${Date.now()}.${ext}`;
                  const sref = storageRef(storage, `homepage_news_tiles/${filename}`);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  updateTile({ image_url: url });
                } catch (err) {
                  alert('Şəkil yüklənmədi: ' + (err as Error).message);
                }
              };

              return (
                <div
                  key={nt.id || idx}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                  data-testid={`news-tile-row-${idx}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={moveUp} disabled={idx === 0} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Yuxarı">↑</button>
                      <button type="button" onClick={moveDown} disabled={idx >= tilesArr.length - 1} className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-black disabled:opacity-30" aria-label="Aşağı">↓</button>
                      <button type="button" onClick={removeTile} className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-700" aria-label="Sil" data-testid={`remove-news-tile-${idx}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact horizontal layout: small thumbnail + fields side by side */}
                  <div className="flex gap-3">
                    {/* Image — small thumbnail on the left */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <div className="aspect-[4/3] bg-white border border-gray-200 rounded overflow-hidden relative">
                        {nt.image_url ? (
                          <img src={nt.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <label className="mt-1 w-full inline-flex items-center justify-center gap-1 px-1.5 py-1 border border-dashed border-gray-300 text-[10px] text-gray-700 hover:border-gray-700 hover:text-gray-900 rounded cursor-pointer">
                        <Upload className="h-3 w-3" />
                        {nt.image_url ? 'Yenilə' : 'Yüklə'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.currentTarget.value = '';
                          }}
                          data-testid={`news-tile-upload-${idx}`}
                        />
                      </label>
                      <input
                        type="text"
                        value={nt.image_url}
                        onChange={(e) => updateTile({ image_url: e.target.value })}
                        placeholder="URL"
                        className="mt-1 w-full px-1.5 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-gray-900 outline-none"
                      />
                    </div>

                    {/* Fields — compact */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={nt.title_az}
                        onChange={(e) => updateTile({ title_az: e.target.value })}
                        placeholder="Başlıq AZ"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-gray-900 outline-none"
                        data-testid={`news-tile-title-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={nt.title_ru}
                          onChange={(e) => updateTile({ title_ru: e.target.value })}
                          placeholder="RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                        <input
                          type="text"
                          value={nt.title_en}
                          onChange={(e) => updateTile({ title_en: e.target.value })}
                          placeholder="EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none"
                        />
                      </div>
                      <textarea
                        value={(nt as any).description_az || ''}
                        onChange={(e) => updateTile({ description_az: e.target.value } as any)}
                        rows={2}
                        placeholder="Açıqlama AZ"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        data-testid={`news-tile-desc-az-${idx}`}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <textarea
                          value={(nt as any).description_ru || ''}
                          onChange={(e) => updateTile({ description_ru: e.target.value } as any)}
                          rows={2}
                          placeholder="Açıqlama RU"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        />
                        <textarea
                          value={(nt as any).description_en || ''}
                          onChange={(e) => updateTile({ description_en: e.target.value } as any)}
                          rows={2}
                          placeholder="Açıqlama EN"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none resize-y"
                        />
                      </div>
                      <input
                        type="text"
                        value={nt.link_url}
                        onChange={(e) => updateTile({ link_url: e.target.value })}
                        placeholder="Link (məs: /blog/...)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 outline-none font-mono"
                        data-testid={`news-tile-link-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ FEATURED STORY ============ */}
      <SectionEditor
        title="Featured Story (Editorial split)"
        description="Sol şəkil + sağ editorial mətn — admin tərəfindən idarə olunan."
        testid="home-sections-featured-story"
        enabled={data.featuredStory?.enabled !== false}
        onToggle={(v) =>
          setData({
            ...data,
            featuredStory: {
              ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!),
              enabled: v,
            },
          })
        }
      >
        <MultiLangField
          label="Eyebrow (kiçik üst yazı)"
          value={data.featuredStory?.eyebrow ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!.eyebrow}
          onChange={(v) =>
            setData({
              ...data,
              featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), eyebrow: v },
            })
          }
        />
        <MultiLangField
          label="Başlıq (sətr keçidi üçün Enter)"
          textarea
          value={data.featuredStory?.title ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!.title}
          onChange={(v) =>
            setData({
              ...data,
              featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), title: v },
            })
          }
        />
        <MultiLangField
          label="Mətn"
          textarea
          value={data.featuredStory?.body ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!.body}
          onChange={(v) =>
            setData({
              ...data,
              featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), body: v },
            })
          }
        />
        <div>
          <Label>Şəkil URL</Label>
          <input
            type="text"
            value={data.featuredStory?.imageUrl ?? ''}
            onChange={(e) =>
              setData({
                ...data,
                featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), imageUrl: e.target.value },
              })
            }
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            data-testid="featured-story-image-url"
          />
        </div>
        <MultiLangField
          label="CTA mətni"
          value={data.featuredStory?.ctaLabel ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!.ctaLabel}
          onChange={(v) =>
            setData({
              ...data,
              featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), ctaLabel: v },
            })
          }
        />
        <div>
          <Label>CTA Link</Label>
          <input
            type="text"
            value={data.featuredStory?.ctaLink ?? ''}
            onChange={(e) =>
              setData({
                ...data,
                featuredStory: { ...(data.featuredStory ?? DEFAULT_HOMEPAGE_SECTIONS.featuredStory!), ctaLink: e.target.value },
              })
            }
            placeholder="/products"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            data-testid="featured-story-cta-link"
          />
        </div>
      </SectionEditor>

      {/* ============ AMBASSADOR ============ */}
      <SectionEditor
        title="Ambassador (brend siması)"
        description="Editorial split + 6 məhsula qədər mini-carousel."
        testid="home-sections-ambassador"
        enabled={data.ambassador?.enabled !== false}
        onToggle={(v) =>
          setData({
            ...data,
            ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), enabled: v },
          })
        }
      >
        <MultiLangField
          label="Eyebrow"
          value={data.ambassador?.eyebrow ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!.eyebrow}
          onChange={(v) =>
            setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), eyebrow: v } })
          }
        />
        <MultiLangField
          label="Başlıq (sətr keçidi üçün Enter)"
          textarea
          value={data.ambassador?.title ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!.title}
          onChange={(v) =>
            setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), title: v } })
          }
        />
        <MultiLangField
          label="Mətn"
          textarea
          value={data.ambassador?.body ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!.body}
          onChange={(v) =>
            setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), body: v } })
          }
        />
        <div>
          <Label>Şəkil URL</Label>
          <input
            type="text"
            value={data.ambassador?.imageUrl ?? ''}
            onChange={(e) =>
              setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), imageUrl: e.target.value } })
            }
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            data-testid="ambassador-image-url"
          />
        </div>
        <MultiLangField
          label="CTA mətni"
          value={data.ambassador?.ctaLabel ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!.ctaLabel}
          onChange={(v) =>
            setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), ctaLabel: v } })
          }
        />
        <div>
          <Label>CTA Link</Label>
          <input
            type="text"
            value={data.ambassador?.ctaLink ?? ''}
            onChange={(e) =>
              setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), ctaLink: e.target.value } })
            }
            placeholder="/products"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            data-testid="ambassador-cta-link"
          />
        </div>

        <ProductPicker
          label="Mini-carousel məhsulları (maks. 6 seçin; boş olsa bestsellers fallback)"
          products={products}
          selected={data.ambassador?.productIds ?? []}
          onChange={(ids) =>
            setData({ ...data, ambassador: { ...(data.ambassador ?? DEFAULT_HOMEPAGE_SECTIONS.ambassador!), productIds: ids } })
          }
          maxCount={6}
          testidPrefix="ambassador-products"
        />
      </SectionEditor>

      {/* ============ GIFT FINDER ============ */}
      <SectionEditor
        title="Hədiyyə tapıcı kartı"
        description="Mərkəzi card: dairəvi illüstrasiya + başlıq + CTA."
        testid="home-sections-gift-finder"
        enabled={data.giftFinder?.enabled !== false}
        onToggle={(v) =>
          setData({
            ...data,
            giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), enabled: v },
          })
        }
      >
        <MultiLangField
          label="Eyebrow"
          value={data.giftFinder?.eyebrow ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!.eyebrow}
          onChange={(v) =>
            setData({ ...data, giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), eyebrow: v } })
          }
        />
        <MultiLangField
          label="Başlıq"
          value={data.giftFinder?.title ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!.title}
          onChange={(v) =>
            setData({ ...data, giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), title: v } })
          }
        />
        <MultiLangField
          label="Mətn"
          textarea
          value={data.giftFinder?.body ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!.body}
          onChange={(v) =>
            setData({ ...data, giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), body: v } })
          }
        />
        <MultiLangField
          label="CTA mətni"
          value={data.giftFinder?.ctaLabel ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!.ctaLabel}
          onChange={(v) =>
            setData({ ...data, giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), ctaLabel: v } })
          }
        />
        <div>
          <Label>CTA Link</Label>
          <input
            type="text"
            value={data.giftFinder?.ctaLink ?? ''}
            onChange={(e) =>
              setData({ ...data, giftFinder: { ...(data.giftFinder ?? DEFAULT_HOMEPAGE_SECTIONS.giftFinder!), ctaLink: e.target.value } })
            }
            placeholder="/gift-cards"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            data-testid="gift-finder-cta-link"
          />
        </div>
      </SectionEditor>

      {/* ============ RED CARPET ============ */}
      <SectionEditor
        title="Red Carpet Ready (ikinci məhsul carousel)"
        description="Tematik məhsul carousel — admin manuel olaraq 8–12 məhsul seçir."
        testid="home-sections-red-carpet"
        enabled={data.redCarpet?.enabled !== false}
        onToggle={(v) =>
          setData({ ...data, redCarpet: { ...(data.redCarpet ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!), enabled: v } })
        }
      >
        <MultiLangField
          label="Eyebrow"
          value={data.redCarpet?.eyebrow ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!.eyebrow}
          onChange={(v) =>
            setData({ ...data, redCarpet: { ...(data.redCarpet ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!), eyebrow: v } })
          }
        />
        <MultiLangField
          label="Başlıq"
          value={data.redCarpet?.title ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!.title}
          onChange={(v) =>
            setData({ ...data, redCarpet: { ...(data.redCarpet ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!), title: v } })
          }
        />
        <ProductPicker
          label="Carousel məhsulları (8–12 məhsul seçin; boş olsa ən bahalı 12 məhsul fallback)"
          products={products}
          selected={data.redCarpet?.productIds ?? []}
          onChange={(ids) =>
            setData({ ...data, redCarpet: { ...(data.redCarpet ?? DEFAULT_HOMEPAGE_SECTIONS.redCarpet!), productIds: ids } })
          }
          maxCount={12}
          testidPrefix="redcarpet-products"
        />
      </SectionEditor>

      {/* ============ SECTION ORDER ============ */}
      <div
        className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
        data-testid="home-sections-order"
      >
        <div className="border-b border-gray-100 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">Bölmələrin sırası</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Ana səhifədə bölmələrin görünmə sırasını yuxarı/aşağı düymələri ilə tənzimləyin.
            Hero həmişə ən üstdə qalır.
          </p>
        </div>
        <SectionOrderList
          order={data.sectionOrder ?? DEFAULT_HOMEPAGE_SECTIONS.sectionOrder!}
          onChange={(o) => setData({ ...data, sectionOrder: o })}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Dəyişiklikləri saxla
        </button>
      </div>
    </div>
  );
};

export default HomeSectionsTab;
