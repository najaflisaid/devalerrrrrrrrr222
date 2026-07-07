import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart, Heart, ImageOff, Grid3x3, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

interface ProductImagePreviewProps {
  imageUrl: string;
  name?: string;
  brand?: string;
  price?: string | number;
  salePrice?: string | number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  onScaleChange?: (scale: number) => void;
  onOffsetChange?: (x: number, y: number) => void;
}

/**
 * Saytda ProductCard-ın 1-ci şəkli necə görünəcəyini tam olaraq replika edir.
 * Admin URL əlavə edən kimi şəklin saytda necə oturduğunu görür və:
 *  - Zoom slider (0.5×–2.0×) ilə miqyas tənzimləyir
 *  - Şəkli klikləyib sürükləyərək (drag) mərkəzi mövqeləndirir
 *  - 3×3 grid overlay ilə kompozisiyanı yoxlayır
 * Bütün dəyişikliklər (scale + offsetX + offsetY) məhsulla birgə Firestore-da
 * yadda saxlanır və saytda eyni görünür.
 */
const ProductImagePreview: React.FC<ProductImagePreviewProps> = ({
  imageUrl,
  name = 'Məhsul adı',
  brand = 'BREND',
  price,
  salePrice,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  onScaleChange,
  onOffsetChange,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [localScale, setLocalScale] = useState<number>(scale);
  const [localOffsetX, setLocalOffsetX] = useState<number>(offsetX);
  const [localOffsetY, setLocalOffsetY] = useState<number>(offsetY);
  const [isPanning, setIsPanning] = useState(false);

  // Drag state — pan üçün başlanğıc koordinatlar və başlanğıc offsetlər
  const panStart = useRef<{ x: number; y: number; offX: number; offY: number; w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Xarici prop dəyişikliyini izlə (məs: yeni məhsul üçün reset)
  useEffect(() => { setLocalScale(scale); }, [scale]);
  useEffect(() => { setLocalOffsetX(offsetX); }, [offsetX]);
  useEffect(() => { setLocalOffsetY(offsetY); }, [offsetY]);

  const hasUrl = !!imageUrl && imageUrl.trim() !== '';
  const numericPrice = typeof price === 'string' ? parseFloat(price) || 0 : price || 0;
  const numericSale = typeof salePrice === 'string' ? parseFloat(salePrice) || 0 : salePrice || 0;
  const showSale = numericSale > 0 && numericSale < numericPrice;
  const displayPrice = showSale ? numericSale : numericPrice;
  const discountPct = showSale ? Math.round(((numericPrice - numericSale) / numericPrice) * 100) : 0;

  // Bounds (% in image's own size space). ±50% normal limit.
  const clampOff = (v: number) => Math.max(-50, Math.min(50, Math.round(v * 10) / 10));

  const updateScale = (next: number) => {
    const clamped = Math.max(0.5, Math.min(2.5, Math.round(next * 100) / 100));
    setLocalScale(clamped);
    onScaleChange?.(clamped);
  };

  const updateOffset = (x: number, y: number) => {
    const cx = clampOff(x);
    const cy = clampOff(y);
    setLocalOffsetX(cx);
    setLocalOffsetY(cy);
    onOffsetChange?.(cx, cy);
  };

  // === PAN (DRAG) ===
  const beginPan = (clientX: number, clientY: number) => {
    if (!containerRef.current || !hasUrl || errored) return;
    const rect = containerRef.current.getBoundingClientRect();
    panStart.current = {
      x: clientX,
      y: clientY,
      offX: localOffsetX,
      offY: localOffsetY,
      w: rect.width,
      h: rect.height,
    };
    setIsPanning(true);
  };

  const movePan = (clientX: number, clientY: number) => {
    if (!isPanning || !panStart.current) return;
    const { x, y, offX, offY, w, h } = panStart.current;
    // Pixel delta → % of container
    const dxPct = ((clientX - x) / w) * 100;
    const dyPct = ((clientY - y) / h) * 100;
    updateOffset(offX + dxPct, offY + dyPct);
  };

  const endPan = () => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
    }
  };

  // Global mouseup/move listeners — admin imkanı dışına çıxsa belə drag düzgün bitsin
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => movePan(e.clientX, e.clientY);
    const onUp = () => endPan();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) movePan(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => endPan();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanning]);

  // Şəklin saytdakı görünüşünə dair tövsiyə
  let sizeHint: { tone: 'good' | 'warn' | 'bad'; text: string } | null = null;
  if (imgDims) {
    const { w, h } = imgDims;
    const ratio = w / h;
    if (w < 400 || h < 400) {
      sizeHint = { tone: 'bad', text: `Çox kiçik: ${w}×${h}px · saytda bulanıq görünə bilər. Tövsiyə: 800×800px+` };
    } else if (Math.abs(ratio - 1) > 0.25) {
      sizeHint = { tone: 'warn', text: `Qeyri-kvadrat: ${w}×${h}px (nisbət ${ratio.toFixed(2)}) · drag ilə mərkəzi düzəldə bilərsiniz` };
    } else if (w >= 800 && h >= 800) {
      sizeHint = { tone: 'good', text: `Mükəmməl: ${w}×${h}px · saytda təmiz görünəcək` };
    } else {
      sizeHint = { tone: 'good', text: `Yaxşı: ${w}×${h}px · saytda normal görünəcək` };
    }
  }

  const scaleChanged = Math.abs(localScale - 1) > 0.001;
  const offsetChanged = Math.abs(localOffsetX) > 0.05 || Math.abs(localOffsetY) > 0.05;
  const anyChange = scaleChanged || offsetChanged;

  const resetAll = () => {
    setLocalScale(1);
    setLocalOffsetX(0);
    setLocalOffsetY(0);
    onScaleChange?.(1);
    onOffsetChange?.(0, 0);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-100 p-3" data-testid="product-image-preview">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Saytda görünüş · 1-ci şəkil</p>
        <div className="flex items-center gap-2 flex-wrap">
          {imgDims && (
            <span className="text-[10px] text-gray-500 tabular-nums">{imgDims.w}×{imgDims.h}px</span>
          )}
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-all ${
              showGrid ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
            }`}
            title="3×3 köməkçi şəbəkə"
            data-testid="preview-grid-toggle"
          >
            <Grid3x3 className="h-3 w-3" /> Grid
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
        {/* ProductCard replikası */}
        <div className="w-full max-w-[260px] mx-auto md:mx-0">
          <div
            ref={containerRef}
            className={`relative bg-white border border-black/[0.04] aspect-square rounded-md overflow-hidden mb-2 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.18)] ${
              hasUrl && !errored ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            } select-none`}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              beginPan(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) beginPan(e.touches[0].clientX, e.touches[0].clientY);
            }}
            data-testid="preview-image-container"
          >
            {hasUrl && !errored ? (
              <img
                src={imageUrl}
                alt={name}
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setLoaded(true);
                  setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                onError={() => { setErrored(true); setLoaded(false); }}
                style={{
                  backgroundColor: '#ffffff',
                  transform: `translate(${localOffsetX}%, ${localOffsetY}%) scale(${localScale})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  pointerEvents: 'none',
                }}
                className="w-full h-full object-contain p-2 bg-white"
                data-testid="product-image-preview-img"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
                <ImageOff className="h-10 w-10 mb-2" />
                <p className="text-[11px] text-gray-400">{errored ? 'Şəkil yüklənmədi' : 'Şəkil URL daxil edin'}</p>
              </div>
            )}

            {/* 3×3 köməkçi grid */}
            {showGrid && hasUrl && !errored && (
              <div className="absolute inset-0 pointer-events-none" data-testid="preview-grid-overlay">
                <div className="absolute inset-0 border-y border-dashed border-blue-400/70" style={{ top: '33.33%', height: '33.34%' }} />
                <div className="absolute inset-0 border-x border-dashed border-blue-400/70" style={{ left: '33.33%', width: '33.34%' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500/80" />
              </div>
            )}

            {/* Drag hint — yalnız dəyişiklik yoxsa göstər */}
            {hasUrl && !errored && !isPanning && !anyChange && (
              <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full pointer-events-none">
                <Move className="h-3 w-3" /> Sürüklə
              </div>
            )}

            {hasUrl && !errored && showSale && (
              <span className="absolute top-2 left-2 z-[2] inline-flex items-center justify-center w-8 h-8 md:w-[42px] md:h-[42px] rounded-full bg-[#D14545] text-white text-[10px] md:text-[12px] font-bold tracking-tight shadow-[0_4px_12px_-3px_rgba(209,69,69,0.55)] pointer-events-none">
                -{discountPct}%
              </span>
            )}

            {hasUrl && !errored && (
              <>
                <div className="absolute top-3 right-3 p-2 rounded-full bg-white/85 text-gray-700 shadow-md pointer-events-none" aria-hidden="true">
                  <Heart className="h-4 w-4" />
                </div>
                <div className="absolute bottom-4 right-4 bg-black text-white p-3 rounded-full shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)] pointer-events-none" aria-hidden="true">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </>
            )}
          </div>

          <div className="text-center">
            {brand && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-normal mb-0.5">{brand}</p>
            )}
            <h3 className="text-[14px] font-medium text-gray-900 line-clamp-1 leading-snug">
              {name || 'Məhsul adı'}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
              {showSale ? (
                <>
                  <span className="text-[12px] font-semibold text-[#D14545] tabular-nums">
                    {displayPrice.toFixed(2)} AZN
                  </span>
                  <span className="text-[12px] font-light text-gray-400 line-through tabular-nums">
                    {numericPrice.toFixed(2)} AZN
                  </span>
                </>
              ) : (
                <span className="text-[12px] font-medium text-gray-900 tabular-nums">
                  {(displayPrice || 0).toFixed(2)} AZN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sağ panel — zoom + offset + tövsiyələr */}
        <div className="space-y-3">
          {/* Zoom kontrolu */}
          {hasUrl && !errored && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-700">Zoom</label>
                  <span className="text-[11px] text-gray-500 tabular-nums">{localScale.toFixed(2)}×</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateScale(localScale - 0.05)}
                    className="p-1.5 rounded-md border border-gray-300 hover:border-gray-500 text-gray-700 hover:bg-gray-50 transition-all"
                    title="Kiçilt"
                    data-testid="preview-zoom-out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={localScale}
                    onChange={(e) => updateScale(parseFloat(e.target.value))}
                    className="flex-1 accent-gray-900"
                    data-testid="preview-zoom-slider"
                  />
                  <button
                    type="button"
                    onClick={() => updateScale(localScale + 0.05)}
                    className="p-1.5 rounded-md border border-gray-300 hover:border-gray-500 text-gray-700 hover:bg-gray-50 transition-all"
                    title="Böyüt"
                    data-testid="preview-zoom-in"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700 inline-flex items-center gap-1">
                    <Move className="h-3 w-3" /> Mərkəz (sürüklə və ya dəqiq daxil et)
                  </label>
                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={!anyChange}
                    className="inline-flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Hər şeyi sıfırla"
                    data-testid="preview-reset-all"
                  >
                    <RotateCcw className="h-3 w-3" /> Sıfırla
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Üfüqi · X (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="-50"
                      max="50"
                      value={Math.round(localOffsetX)}
                      onChange={(e) => updateOffset(parseFloat(e.target.value) || 0, localOffsetY)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 tabular-nums"
                      data-testid="preview-offset-x"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Şaquli · Y (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="-50"
                      max="50"
                      value={Math.round(localOffsetY)}
                      onChange={(e) => updateOffset(localOffsetX, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 tabular-nums"
                      data-testid="preview-offset-y"
                    />
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-gray-500 leading-relaxed">
                {anyChange ? (
                  <>Cari görünüş <b>"Məhsul əlavə et / Yenilə"</b> düyməsi ilə yadda saxlanacaq və saytda eyni olacaq.</>
                ) : (
                  <>Şəkli sürüklə və ya slider/X-Y ilə tənzimlə — saytda da bu görünüşdə qalacaq.</>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 inline-block w-2 h-2 rounded-full ${loaded ? 'bg-emerald-500' : errored ? 'bg-red-500' : 'bg-gray-300'}`} />
              <p className="text-gray-700">
                {!hasUrl && 'URL gözlənilir...'}
                {hasUrl && !loaded && !errored && 'Şəkil yüklənir...'}
                {loaded && 'Şəkil saytda yuxarıdakı kimi görünəcək'}
                {errored && 'URL keçərli deyil və ya şəkil mövcud deyil'}
              </p>
            </div>
            {sizeHint && (
              <div className={`rounded-md px-2.5 py-1.5 border text-[11px] ${
                sizeHint.tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : sizeHint.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {sizeHint.text}
              </div>
            )}
            <ul className="text-[10px] text-gray-500 space-y-0.5 pl-3 list-disc">
              <li>İdeal ölçü: <b>800×800px</b>+, kvadrat (1:1)</li>
              <li>Drag, zoom və mərkəz dəyişiklikləri saytda da göstərilir</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImagePreview;
