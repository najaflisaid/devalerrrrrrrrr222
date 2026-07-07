import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Copy,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { productService } from '../../services/productService';
import type { Product } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = (import.meta as any).env?.VITE_BACKEND_URL || '';

type SeoLangBlock = { title: string; description: string; keywords: string; imageAlt: string };
type SeoResult = { az: SeoLangBlock; ru: SeoLangBlock; en: SeoLangBlock; slug: string };

interface SeoGenerateResponse {
  success: boolean;
  seo?: SeoResult;
  error?: string | null;
  raw?: string | null;
}

async function generateSeoForProduct(p: Product, signal?: AbortSignal): Promise<SeoGenerateResponse> {
  const body = {
    product: {
      id: p.id,
      name_az: p.name?.az || '',
      name_ru: p.name?.ru || '',
      name_en: p.name?.en || '',
      description_az: p.description?.az || '',
      description_ru: p.description?.ru || '',
      description_en: p.description?.en || '',
      brand: p.brand || '',
      category: p.category || '',
      gender: p.gender || '',
      price: p.price ?? null,
      salePrice: p.salePrice ?? null,
    },
    site_name: 'DE VALEUR',
    site_url: 'https://devaleur.az',
  };

  const url = `${API_BASE}/api/seo/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

const LANGS = [
  { code: 'az', label: 'AZ', flag: '🇦🇿' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
] as const;

type LangCode = (typeof LANGS)[number]['code'];

// Small badge that shows how "healthy" a piece of SEO content is
const LenBadge: React.FC<{ value: string; min: number; max: number; label: string }> = ({
  value,
  min,
  max,
  label,
}) => {
  const len = (value || '').length;
  let color = 'bg-red-100 text-red-700 border-red-200';
  if (len === 0) color = 'bg-gray-100 text-gray-500 border-gray-200';
  else if (len >= min && len <= max) color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (len < min) color = 'bg-amber-100 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
      {label}: {len} {min && max ? `/ ${min}-${max}` : ''}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiSeoTabProps {
  /** All products loaded by the AdminPanel; parent already has them so we reuse. */
  products: Product[];
  /** Refresh callback the parent uses to re-fetch products after a batch save. */
  onProductsChanged?: () => void;
}

type Status = 'idle' | 'running' | 'paused' | 'done' | 'error';

const AiSeoTab: React.FC<AiSeoTabProps> = ({ products, onProductsChanged }) => {
  // filter / search
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedLang, setSelectedLang] = useState<LangCode>('az');

  // batch runner state
  const [status, setStatus] = useState<Status>('idle');
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [logs, setLogs] = useState<{ id: string; name: string; ok: boolean; error?: string }[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);
  const pauseRef = React.useRef<boolean>(false);
  const stopRef = React.useRef<boolean>(false);

  // preview: results not yet saved
  const [previews, setPreviews] = useState<Record<string, SeoResult>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  void saving;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // single-product manual override
  const [busySingle, setBusySingle] = useState<Record<string, boolean>>({});

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (q) {
          const hay = [p.name?.az, p.name?.ru, p.name?.en, p.brand, p.category, p.id]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (onlyMissing) {
          const hasAny =
            !!p.seo?.title?.az || !!p.seo?.title?.en || !!p.seo?.description?.az || !!p.seo?.description?.en;
          if (hasAny) return false;
        }
        return true;
      })
      .sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
  }, [products, search, onlyMissing]);

  const totalCovered = useMemo(
    () => products.filter((p) => p.seo?.title?.az || p.seo?.title?.en).length,
    [products]
  );

  // Batch runner
  const runBatch = async () => {
    if (status === 'running') return;
    pauseRef.current = false;
    stopRef.current = false;
    setStatus('running');
    setLogs([]);

    const list = filtered.slice(); // snapshot
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      while (pauseRef.current) {
        setStatus('paused');
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 300));
      }
      setStatus('running');
      setCurrentIndex(i);
      const p = list[i];
      abortRef.current = new AbortController();
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await generateSeoForProduct(p, abortRef.current.signal);
        if (!res.success || !res.seo) throw new Error(res.error || 'no seo');
        setPreviews((prev) => ({ ...prev, [p.id]: res.seo as SeoResult }));
        // Auto-save immediately so a browser refresh doesn't lose progress
        // eslint-disable-next-line no-await-in-loop
        await saveOne(p, res.seo as SeoResult, /* silent */ true);
        setLogs((prev) => [
          { id: p.id, name: p.name?.az || p.name?.en || p.id, ok: true },
          ...prev,
        ]);
      } catch (err: any) {
        setLogs((prev) => [
          { id: p.id, name: p.name?.az || p.name?.en || p.id, ok: false, error: err?.message || String(err) },
          ...prev,
        ]);
      }
      // Small throttle to be nice to the NVIDIA endpoint
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 300));
    }

    setStatus('done');
    setCurrentIndex(-1);
    onProductsChanged?.();
  };

  const pauseBatch = () => {
    pauseRef.current = true;
  };
  const resumeBatch = () => {
    pauseRef.current = false;
  };
  const stopBatch = () => {
    stopRef.current = true;
    pauseRef.current = false;
    abortRef.current?.abort();
  };

  // Save one product's SEO to Firestore
  const saveOne = async (p: Product, seo: SeoResult, silent = false) => {
    if (!silent) setSaving((s) => ({ ...s, [p.id]: true }));
    try {
      const patch: any = {
        seo: {
          title: { az: seo.az.title, ru: seo.ru.title, en: seo.en.title },
          description: { az: seo.az.description, ru: seo.ru.description, en: seo.en.description },
          keywords: { az: seo.az.keywords, ru: seo.ru.keywords, en: seo.en.keywords },
          imageAlt: { az: seo.az.imageAlt, ru: seo.ru.imageAlt, en: seo.en.imageAlt },
          slug: seo.slug,
          generatedAt: new Date().toISOString(),
          generatedBy: 'ai-nvidia-gpt-oss-20b',
        },
      };
      await productService.update(p.id, patch);
    } finally {
      if (!silent) setSaving((s) => ({ ...s, [p.id]: false }));
    }
  };

  // Manual single-product generate button
  const generateOne = async (p: Product) => {
    setBusySingle((s) => ({ ...s, [p.id]: true }));
    try {
      const res = await generateSeoForProduct(p);
      if (!res.success || !res.seo) throw new Error(res.error || 'no seo');
      setPreviews((prev) => ({ ...prev, [p.id]: res.seo as SeoResult }));
      await saveOne(p, res.seo as SeoResult, true);
      onProductsChanged?.();
    } catch (err: any) {
      setLogs((prev) => [
        { id: p.id, name: p.name?.az || p.name?.en || p.id, ok: false, error: err?.message || String(err) },
        ...prev,
      ]);
    } finally {
      setBusySingle((s) => ({ ...s, [p.id]: false }));
    }
  };

  // Merge saved SEO with in-session preview so admin sees the latest
  const seoFor = (p: Product): SeoResult | null => {
    const preview = previews[p.id];
    if (preview) return preview;
    if (!p.seo) return null;
    return {
      az: {
        title: p.seo.title?.az || '',
        description: p.seo.description?.az || '',
        keywords: p.seo.keywords?.az || '',
        imageAlt: p.seo.imageAlt?.az || '',
      },
      ru: {
        title: p.seo.title?.ru || '',
        description: p.seo.description?.ru || '',
        keywords: p.seo.keywords?.ru || '',
        imageAlt: p.seo.imageAlt?.ru || '',
      },
      en: {
        title: p.seo.title?.en || '',
        description: p.seo.description?.en || '',
        keywords: p.seo.keywords?.en || '',
        imageAlt: p.seo.imageAlt?.en || '',
      },
      slug: p.seo.slug || '',
    };
  };

  useEffect(() => {
    return () => {
      // Cleanup any in-flight request on unmount
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-testid="ai-seo-tab">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI SEO — bütün məhsullar üçün
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            NVIDIA <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">gpt-oss-20b</code> modeli
            hər məhsula 3 dildə (AZ / RU / EN) SEO title, meta description, keywords, alt-text və slug yazır.
            Nəticələr Firestore-də saxlanılır və məhsul səhifələrində avtomatik göstərilir.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' || status === 'done' || status === 'error' ? (
            <button
              onClick={runBatch}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="ai-seo-batch-start"
            >
              <Play className="w-4 h-4" />
              {onlyMissing ? 'Boş olanları AI ilə doldur' : 'Hamısını AI ilə yenilə'} ({filtered.length})
            </button>
          ) : status === 'running' ? (
            <>
              <button
                onClick={pauseBatch}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg shadow-md transition-all"
                data-testid="ai-seo-batch-pause"
              >
                <Pause className="w-4 h-4" />
                Dayandır
              </button>
              <button
                onClick={stopBatch}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg shadow-md transition-all"
                data-testid="ai-seo-batch-stop"
              >
                Dur
              </button>
            </>
          ) : (
            <>
              <button
                onClick={resumeBatch}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-md transition-all"
                data-testid="ai-seo-batch-resume"
              >
                <Play className="w-4 h-4" />
                Davam et
              </button>
              <button
                onClick={stopBatch}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg shadow-md transition-all"
                data-testid="ai-seo-batch-stop"
              >
                Dur
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats + Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="col-span-1 md:col-span-1 bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-wider text-purple-700 font-semibold">SEO əhatəsi</div>
          <div className="text-2xl font-bold text-purple-900 mt-1" data-testid="ai-seo-coverage">
            {totalCovered} / {products.length}
          </div>
          <div className="w-full bg-purple-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-1.5 rounded-full transition-all"
              style={{ width: `${products.length ? Math.round((totalCovered / products.length) * 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Məhsul, brend, kateqoriya axtar..."
            className="flex-1 py-2.5 outline-none text-sm"
            data-testid="ai-seo-search"
          />
        </div>

        <label className="col-span-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer text-sm select-none">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="w-4 h-4 accent-purple-600"
            data-testid="ai-seo-only-missing"
          />
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-gray-700">Yalnız SEO-suz olanlar</span>
        </label>
      </div>

      {/* Language switcher */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs uppercase tracking-wider text-gray-500 mr-2">Baxılan dil:</span>
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setSelectedLang(l.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedLang === l.code
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
            }`}
            data-testid={`ai-seo-lang-${l.code}`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Batch progress banner */}
      {(status === 'running' || status === 'paused') && (
        <div className="mb-5 bg-gradient-to-r from-purple-50 to-fuchsia-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-purple-900">
              <Loader2 className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''}`} />
              <span className="font-medium">
                {status === 'paused' ? 'Dayandırılıb' : 'İşləyir'}
              </span>
              <span className="text-purple-700">
                — {currentIndex + 1} / {filtered.length}
                {filtered[currentIndex] ? ` · ${filtered[currentIndex].name?.az || filtered[currentIndex].id}` : ''}
              </span>
            </div>
            <div className="text-xs text-purple-700">
              ✅ {logs.filter((l) => l.ok).length} · ❌ {logs.filter((l) => !l.ok).length}
            </div>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-1.5 mt-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-1.5 rounded-full transition-all"
              style={{ width: `${filtered.length ? ((currentIndex + 1) / filtered.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div className="text-sm text-emerald-800">
            <strong>Tamamlandı</strong> — {logs.filter((l) => l.ok).length} məhsul üçün SEO yaradıldı,{' '}
            {logs.filter((l) => !l.ok).length} xəta.
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-2" data-testid="ai-seo-product-list">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">
              {onlyMissing
                ? 'SEO-suz məhsul yoxdur — bütün məhsullar əhatə olunub 🎉'
                : 'Axtarışa uyğun məhsul tapılmadı.'}
            </p>
          </div>
        )}

        {filtered.map((p, idx) => {
          const seo = seoFor(p);
          const block = seo ? seo[selectedLang] : null;
          const isCurrent = status === 'running' && idx === currentIndex;
          const rowClass = isCurrent
            ? 'ring-2 ring-purple-400 border-purple-300'
            : seo
              ? 'border-emerald-200 bg-emerald-50/30'
              : 'border-gray-200';
          const isExpanded = expanded[p.id];
          return (
            <div
              key={p.id}
              className={`border rounded-lg overflow-hidden transition-all ${rowClass}`}
              data-testid={`ai-seo-row-${p.id}`}
            >
              <div className="flex items-start gap-3 p-4">
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  className="mt-1 text-gray-400 hover:text-gray-700"
                  aria-label="toggle"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {p.images?.[0] && (
                  <img
                    src={p.images[0]}
                    alt=""
                    className="w-14 h-14 object-contain bg-white border border-gray-100 rounded-md flex-shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">{p.brand}</span>
                    {seo ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        SEO var
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">
                        SEO yoxdur
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {p.name?.az || p.name?.en || p.name?.ru || p.id}
                  </h3>

                  {/* SEO preview line for currently selected language */}
                  {block ? (
                    <div className="mt-2">
                      <div className="text-[13px] text-blue-700 truncate font-medium" data-testid={`ai-seo-title-${p.id}`}>
                        {block.title || <span className="italic text-gray-400">— başlıq yoxdur —</span>}
                      </div>
                      <div className="text-[12px] text-gray-600 line-clamp-2 mt-0.5" data-testid={`ai-seo-desc-${p.id}`}>
                        {block.description || <span className="italic text-gray-400">— təsvir yoxdur —</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <LenBadge label="T" value={block.title} min={50} max={65} />
                        <LenBadge label="D" value={block.description} min={140} max={160} />
                        <LenBadge label="K" value={block.keywords} min={20} max={400} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-gray-400 italic mt-2">Bu məhsul üçün hələ SEO yaradılmayıb.</div>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => generateOne(p)}
                    disabled={busySingle[p.id] || status === 'running'}
                    className="inline-flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`ai-seo-generate-${p.id}`}
                  >
                    {busySingle[p.id] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {seo ? 'Yenidən yarat' : 'AI ilə yarat'}
                  </button>
                </div>
              </div>

              {/* Expanded — full 3-language view */}
              {isExpanded && (
                <div className="border-t bg-gray-50/60 p-4 space-y-4">
                  {seo ? (
                    <>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="font-medium">Slug:</span>
                        <code className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px]">
                          /product/{seo.slug || p.id}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(seo.slug)}
                          className="text-gray-400 hover:text-gray-700"
                          aria-label="copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {LANGS.map((l) => {
                          const b = seo[l.code];
                          return (
                            <div key={l.code} className="bg-white border border-gray-200 rounded-md p-3">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                {l.flag} {l.label}
                              </div>
                              <div className="space-y-1.5 text-[12px]">
                                <div>
                                  <div className="text-gray-500">Title</div>
                                  <div className="text-gray-900 font-medium">{b.title || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mt-1">Meta description</div>
                                  <div className="text-gray-700">{b.description || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mt-1">Keywords</div>
                                  <div className="text-gray-700">{b.keywords || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 mt-1">Image alt</div>
                                  <div className="text-gray-700">{b.imageAlt || '—'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      Bu məhsul üçün SEO yaradın — yuxarıdakı <b>AI ilə yarat</b> düyməsinə klikləyin.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="mt-8 border-t pt-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Son emal jurnalı ({logs.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1" data-testid="ai-seo-log">
            {logs.slice(0, 60).map((l, i) => (
              <div
                key={i}
                className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 ${
                  l.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {l.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span className="font-medium truncate max-w-[280px]">{l.name}</span>
                {!l.ok && <span className="text-red-600 truncate">— {l.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiSeoTab;
