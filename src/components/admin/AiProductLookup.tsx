/**
 * AiProductLookup — Admin panelində məhsul əlavə etməkdə AI köməkçisi.
 *
 * Barkod və ya SKU daxil edildikdə (kamera skan və ya əl ilə) Gemini + Google
 * axtarış vasitəsilə məhsul məlumatlarını internetdən tapır, AZ/EN/RU tərcümə
 * ilə göstərir və admin şəkilləri seçib "Formanı doldur" düyməsi ilə əsas
 * məhsul formasına köçürür.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Camera,
  Search,
  Loader2,
  X,
  Check,
  Star,
  RefreshCw,
  ImageOff,
  Globe2,
  ChevronDown,
} from 'lucide-react';

type LangObj = { az: string | null; en: string | null; ru: string | null };

export interface AiLookupResult {
  found: boolean;
  query: string;
  name: LangObj;
  description: LangObj;
  brand: string | null;
  model: string | null;
  barcode: string | null;
  sku: string | null;
  category_hint: string | null;
  gender: 'men' | 'women' | 'unisex' | null;
  country_of_origin: string | null;
  color: string | null;
  size: string | null;
  features: string[];
  specs: Record<string, string>;
  seo: { title_az: string | null; description_az: string | null; tags: string[] };
  image_urls: string[];
  source_urls: string[];
  model_used?: string;
}

export interface AiApplyPayload {
  nameAz: string;
  nameRu: string;
  nameEn: string;
  descAz: string;
  descRu: string;
  descEn: string;
  brand: string;
  categoryHint: string; // AI-nin təklif etdiyi qısa key, admin dropdown-dan uyğun kateqoriya seçir
  gender: 'men' | 'women' | 'unisex' | '';
  barcode: string;
  sku: string;
  images: string[]; // seçilmiş şəkillər, cover birinci sırada
  seoTitleAz: string;
  seoDescriptionAz: string;
  specsText: string; // "Şüşə: Mineral\nDiametr: 42mm" formatında
  featuresText: string;
}

interface Props {
  onApply: (data: AiApplyPayload) => void;
  categories?: Array<{ id: string; name?: any; nameAz?: string }>;
  brands?: Array<{ id: string; name: string }>;
  initialBarcode?: string;
}

const AiProductLookup: React.FC<Props> = ({ onApply, categories = [], brands = [], initialBarcode = '' }) => {
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState(initialBarcode);
  const [preferredSites, setPreferredSites] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiLookupResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string>('');
  const [activeLang, setActiveLang] = useState<'az' | 'en' | 'ru'>('az');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (initialBarcode && !query) setQuery(initialBarcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode]);

  const runLookup = async () => {
    const q = query.trim();
    if (!q) {
      setError('Barkod və ya SKU daxil edin');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setSelectedImages([]);
    setCoverImage('');
    try {
      const sites = preferredSites
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const res = await fetch('/api/ai/product-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: q, sites }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setResult(data as AiLookupResult);
      // Default seçim: ilk 4 şəkli avtomatik seç, birincisi cover
      if (Array.isArray(data.image_urls) && data.image_urls.length > 0) {
        const firstFour = data.image_urls.slice(0, 4);
        setSelectedImages(firstFour);
        setCoverImage(firstFour[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'AI axtarışı uğursuz oldu');
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (url: string) => {
    setSelectedImages((prev) => {
      if (prev.includes(url)) {
        // seçimdən çıxarılırsa və cover-dirsə, cover-i başqasına keçir
        if (coverImage === url) {
          const next = prev.filter((u) => u !== url);
          setCoverImage(next[0] || '');
          return next;
        }
        return prev.filter((u) => u !== url);
      }
      const next = [...prev, url];
      if (!coverImage) setCoverImage(url);
      return next;
    });
  };

  const chooseCover = (url: string) => {
    if (!selectedImages.includes(url)) {
      setSelectedImages((prev) => [...prev, url]);
    }
    setCoverImage(url);
  };

  const specsToText = (specs: Record<string, string>) =>
    Object.entries(specs || {})
      .filter(([k, v]) => k && v != null && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

  const applyToForm = () => {
    if (!result) return;
    // Cover şəkil massivin başında olsun
    const orderedImages = coverImage
      ? [coverImage, ...selectedImages.filter((u) => u !== coverImage)]
      : selectedImages;
    // AI-nin təklif etdiyi brend əgər Firestore-da varsa onu istifadə et, əks halda kobud dəyər
    const brandFromDb = brands.find(
      (b) => b.name.toLowerCase().trim() === (result.brand || '').toLowerCase().trim(),
    );
    onApply({
      nameAz: result.name.az || result.name.en || '',
      nameRu: result.name.ru || result.name.en || '',
      nameEn: result.name.en || result.name.az || '',
      descAz: result.description.az || result.description.en || '',
      descRu: result.description.ru || result.description.en || '',
      descEn: result.description.en || result.description.az || '',
      brand: brandFromDb?.name || result.brand || '',
      categoryHint: result.category_hint || '',
      gender: (result.gender as any) || '',
      barcode: result.barcode || query.trim(),
      sku: result.sku || '',
      images: orderedImages,
      seoTitleAz: result.seo?.title_az || result.name.az || '',
      seoDescriptionAz: result.seo?.description_az || result.description.az || '',
      specsText: specsToText(result.specs),
      featuresText: (result.features || []).join('\n'),
    });
    setCollapsed(true);
  };

  const handleReset = () => {
    setResult(null);
    setSelectedImages([]);
    setCoverImage('');
    setError(null);
  };

  return (
    <div
      className={`mb-4 rounded-xl border-2 transition-all ${
        enabled
          ? 'border-purple-300 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50'
          : 'border-gray-200 bg-white'
      }`}
      data-testid="ai-product-lookup-panel"
    >
      {/* Header — toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/70">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            enabled ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <Sparkles className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">AI ilə avtomatik doldurma</div>
            <div className="text-[11px] text-gray-500 leading-tight">Barkod və ya SKU daxil edin — Gemini məhsulu internetdən tapsın</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            enabled ? 'bg-purple-600' : 'bg-gray-300'
          }`}
          data-testid="ai-lookup-toggle"
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {enabled && !collapsed && (
        <div className="px-4 py-4 space-y-3">
          {/* Barkod / SKU input row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); runLookup(); }
                }}
                placeholder="Barkod (EAN/UPC) və ya SKU daxil edin"
                inputMode="numeric"
                autoComplete="off"
                className="w-full pl-10 pr-3 py-2.5 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                data-testid="ai-lookup-query"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              data-testid="ai-lookup-scan-btn"
            >
              <Camera className="w-4 h-4" />
              Skan et
            </button>
            <button
              type="button"
              onClick={runLookup}
              disabled={loading || !query.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-lg hover:from-purple-700 hover:to-fuchsia-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="ai-lookup-search-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Axtarır...' : 'AI Axtar'}
            </button>
          </div>

          {/* Preferred sites */}
          <details className="text-[11px] text-gray-600">
            <summary className="cursor-pointer hover:text-gray-900 inline-flex items-center gap-1">
              <Globe2 className="w-3.5 h-3.5" /> Xüsusi saytlarda axtar (istəyə bağlı)
            </summary>
            <input
              type="text"
              value={preferredSites}
              onChange={(e) => setPreferredSites(e.target.value)}
              placeholder="məs. seiko.com, casio.com, amazon.com"
              className="mt-1.5 w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              data-testid="ai-lookup-sites"
            />
            <p className="mt-1 text-[10px] text-gray-500">Vergüllə ayırın. Boş qoyulsa bütün Google-dan axtarılır.</p>
          </details>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="ai-lookup-error">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500" data-testid="ai-lookup-loading">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-600" strokeWidth={1.5} />
              <p className="text-xs">AI internetdə axtarır və məlumatları toplayır...</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Bu 10-20 saniyə çəkə bilər</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-3">
              {/* Meta strip */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {result.brand && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                    {result.brand}
                  </span>
                )}
                {result.model && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    Model: {result.model}
                  </span>
                )}
                {result.category_hint && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    {result.category_hint}
                  </span>
                )}
                {result.gender && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {result.gender}
                  </span>
                )}
                {result.color && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {result.color}
                  </span>
                )}
                {result.country_of_origin && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {result.country_of_origin}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 uppercase tracking-wider"
                >
                  <RefreshCw className="w-3 h-3" /> Sıfırla
                </button>
              </div>

              {/* Language tabs — name + description */}
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex border-b border-gray-200 text-xs">
                  {(['az', 'en', 'ru'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setActiveLang(l)}
                      className={`px-4 py-2 font-medium uppercase tracking-wider transition-colors ${
                        activeLang === l
                          ? 'bg-gray-900 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                      data-testid={`ai-lookup-lang-${l}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Ad</div>
                    <div className="text-sm font-semibold text-gray-900" data-testid={`ai-lookup-name-${activeLang}`}>
                      {result.name[activeLang] || <span className="italic text-gray-400">tapılmadı</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Təsvir</div>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed" data-testid={`ai-lookup-desc-${activeLang}`}>
                      {result.description[activeLang] || <span className="italic text-gray-400">tapılmadı</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features + Specs */}
              {(result.features.length > 0 || Object.keys(result.specs).length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.features.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Xüsusiyyətlər</div>
                      <ul className="text-xs text-gray-800 space-y-1">
                        {result.features.slice(0, 12).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Object.keys(result.specs).length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Texniki məlumat</div>
                      <dl className="text-xs text-gray-800 space-y-0.5">
                        {Object.entries(result.specs).slice(0, 12).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 border-b border-gray-100 py-1 last:border-b-0">
                            <dt className="text-gray-500">{k}</dt>
                            <dd className="text-right font-medium">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              )}

              {/* Images grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">
                    Şəkillər ({selectedImages.length} / {result.image_urls.length} seçildi)
                  </div>
                  {coverImage && (
                    <div className="text-[10px] text-gray-500">
                      <Star className="w-3 h-3 inline text-amber-500 fill-amber-400 mr-0.5" /> — əsas şəkil
                    </div>
                  )}
                </div>
                {result.image_urls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <ImageOff className="w-8 h-8 mb-1" />
                    <p className="text-xs">AI şəkil tapa bilmədi</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {result.image_urls.map((url, i) => {
                      const isSelected = selectedImages.includes(url);
                      const isCover = coverImage === url;
                      return (
                        <div
                          key={i}
                          className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? isCover
                                ? 'border-amber-500 ring-2 ring-amber-200'
                                : 'border-purple-500 ring-1 ring-purple-200'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                          data-testid={`ai-lookup-image-${i}`}
                        >
                          <div className="aspect-square bg-gray-100">
                            <img
                              src={url}
                              alt={`AI image ${i + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                (e.currentTarget.parentElement as HTMLElement).classList.add('bg-gray-200');
                              }}
                            />
                          </div>
                          {/* Overlay controls */}
                          <button
                            type="button"
                            onClick={() => toggleImage(url)}
                            className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/90 text-gray-500 hover:bg-white'
                            }`}
                            aria-label="Seç"
                            data-testid={`ai-lookup-image-select-${i}`}
                          >
                            {isSelected ? <Check className="w-3 h-3" /> : null}
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => chooseCover(url)}
                              className={`absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                isCover
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-white/90 text-gray-400 hover:bg-amber-100 hover:text-amber-700'
                              }`}
                              aria-label="Əsas şəkil"
                              title="Əsas şəkil təyin et"
                              data-testid={`ai-lookup-image-cover-${i}`}
                            >
                              <Star className={`w-3 h-3 ${isCover ? 'fill-white' : ''}`} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Source URLs */}
              {result.source_urls.length > 0 && (
                <details className="text-[11px] text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700 inline-flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" /> Mənbələr ({result.source_urls.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {result.source_urls.slice(0, 10).map((u, i) => (
                      <li key={i} className="truncate">
                        <a href={u} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{u}</a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Apply button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyToForm}
                  disabled={selectedImages.length === 0 && !result.name.az}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="ai-lookup-apply-btn"
                >
                  <Check className="w-4 h-4" />
                  Formaya köçür və şəkilləri yüklə
                </button>
                <button
                  type="button"
                  onClick={runLookup}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Yenidən axtar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {enabled && collapsed && (
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-600 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            AI məlumatları formaya köçürüldü. Aşağıdakı formada dəyişiklik edə bilərsiniz.
          </div>
          <button
            type="button"
            onClick={() => { setCollapsed(false); }}
            className="text-[11px] text-purple-700 hover:text-purple-900 uppercase tracking-wider font-medium"
          >
            Yenidən aç
          </button>
        </div>
      )}

      {showScanner && (
        <BarcodeScannerModal
          onDetected={(code) => {
            setQuery(code);
            setShowScanner(false);
            // Kiçik gecikmə ilə avtomatik axtar
            setTimeout(() => {
              // useState close → dəyəri lokal saxlayırıq
              const q = code.trim();
              if (!q) return;
              (async () => {
                setError(null);
                setLoading(true);
                setResult(null);
                setSelectedImages([]);
                setCoverImage('');
                try {
                  const res = await fetch('/api/ai/product-lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ barcode: q }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                  setResult(data as AiLookupResult);
                  if (Array.isArray(data.image_urls) && data.image_urls.length > 0) {
                    const firstFour = data.image_urls.slice(0, 4);
                    setSelectedImages(firstFour);
                    setCoverImage(firstFour[0]);
                  }
                } catch (err: any) {
                  setError(err?.message || 'AI axtarışı uğursuz oldu');
                } finally {
                  setLoading(false);
                }
              })();
            }, 200);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};

/* ─────────────────── Barcode Scanner Modal ─────────────────── */
const BarcodeScannerModal: React.FC<{ onDetected: (code: string) => void; onClose: () => void }> = ({
  onDetected,
  onClose,
}) => {
  const containerId = useRef(`bc-scan-${Math.random().toString(36).slice(2, 8)}`).current;
  const scannerRef = useRef<any>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dinamik import — bundle-a yalnız açıldıqda əlavə olunur
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const { Html5QrcodeScanner, Html5QrcodeSupportedFormats } = mod as any;
        const scanner = new Html5QrcodeScanner(
          containerId,
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false,
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText: string) => {
            if (!decodedText) return;
            onDetected(decodedText.trim());
          },
          () => { /* noop scan errors — çox səsli olmasın */ },
        );
      } catch (e: any) {
        setScannerError(e?.message || 'Kamera açıla bilmədi');
      }
    })();
    return () => {
      cancelled = true;
      try { scannerRef.current?.clear?.(); } catch { /* ignore */ }
    };
  }, [containerId, onDetected]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" data-testid="ai-lookup-scanner-modal">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Barkod skan et</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            data-testid="ai-lookup-scanner-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          {scannerError ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {scannerError}
              <p className="mt-1 text-xs text-red-600">
                Kamera icazəsini yoxlayın və ya URL-in HTTPS olduğuna əmin olun.
              </p>
            </div>
          ) : (
            <div id={containerId} className="[&_video]:rounded-lg [&_img]:mx-auto text-xs text-gray-500" />
          )}
          <p className="mt-2 text-[11px] text-gray-500 text-center">
            EAN/UPC/QR barkodlarını dəstəkləyir. Fayl yükləmə seçimi də mövcuddur.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiProductLookup;
