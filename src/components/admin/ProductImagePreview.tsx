import React, { useState } from 'react';
import { ShoppingCart, Heart, ImageOff } from 'lucide-react';

interface ProductImagePreviewProps {
  imageUrl: string;
  name?: string;
  brand?: string;
  price?: string | number;
  salePrice?: string | number;
}

/**
 * Saytda ProductCard-ın 1-ci şəkli necə görünəcəyini tam olaraq replika edir.
 * Admin URL əlavə edən kimi şəklin saytda necə oturduğunu (boyük/balaca/keyfiyyət) görür.
 */
const ProductImagePreview: React.FC<ProductImagePreviewProps> = ({
  imageUrl,
  name = 'Məhsul adı',
  brand = 'BREND',
  price,
  salePrice,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const hasUrl = !!imageUrl && imageUrl.trim() !== '';
  const numericPrice = typeof price === 'string' ? parseFloat(price) || 0 : price || 0;
  const numericSale = typeof salePrice === 'string' ? parseFloat(salePrice) || 0 : salePrice || 0;
  const showSale = numericSale > 0 && numericSale < numericPrice;
  const displayPrice = showSale ? numericSale : numericPrice;
  const discountPct = showSale ? Math.round(((numericPrice - numericSale) / numericPrice) * 100) : 0;

  // Şəklin saytdakı görünüşünə dair tövsiyə — kvadrat 800x800+ ideal sayılır
  let sizeHint: { tone: 'good' | 'warn' | 'bad'; text: string } | null = null;
  if (imgDims) {
    const { w, h } = imgDims;
    const ratio = w / h;
    if (w < 400 || h < 400) {
      sizeHint = { tone: 'bad', text: `Çox kiçik: ${w}×${h}px · saytda bulanıq görünə bilər. Tövsiyə: 800×800px+` };
    } else if (Math.abs(ratio - 1) > 0.25) {
      sizeHint = { tone: 'warn', text: `Qeyri-kvadrat: ${w}×${h}px (nisbət ${ratio.toFixed(2)}) · ətrafda boşluq qalacaq. Tövsiyə: kvadrat 1:1` };
    } else if (w >= 800 && h >= 800) {
      sizeHint = { tone: 'good', text: `Mükəmməl: ${w}×${h}px · saytda təmiz görünəcək` };
    } else {
      sizeHint = { tone: 'good', text: `Yaxşı: ${w}×${h}px · saytda normal görünəcək` };
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4" data-testid="product-image-preview">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Saytda görünüş (1-ci şəkil)</p>
        {imgDims && (
          <span className="text-[10px] text-gray-500 tabular-nums">
            {imgDims.w}×{imgDims.h}px
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-4 items-start">
        {/* ProductCard replikası — saytdakı eyni stillərlə */}
        <div className="group relative w-full max-w-[260px] mx-auto sm:mx-0">
          <div className="relative bg-white border border-black/[0.04] aspect-square rounded-md overflow-hidden mb-3 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.18)]">
            {hasUrl && !errored ? (
              <img
                src={imageUrl}
                alt={name}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setLoaded(true);
                  setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                onError={() => { setErrored(true); setLoaded(false); }}
                style={{ backgroundColor: '#ffffff' }}
                className="w-full h-full object-contain p-2 bg-white"
                data-testid="product-image-preview-img"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
                <ImageOff className="h-10 w-10 mb-2" />
                <p className="text-[11px] text-gray-400">{errored ? 'Şəkil yüklənmədi' : 'Şəkil URL daxil edin'}</p>
              </div>
            )}

            {hasUrl && !errored && showSale && (
              <span className="absolute top-2 left-2 z-[2] inline-flex items-center justify-center w-8 h-8 md:w-[42px] md:h-[42px] rounded-full bg-[#D14545] text-white text-[10px] md:text-[12px] font-bold tracking-tight shadow-[0_4px_12px_-3px_rgba(209,69,69,0.55)]">
                -{discountPct}%
              </span>
            )}

            {hasUrl && !errored && (
              <>
                <button
                  type="button"
                  className="absolute top-3 right-3 p-2 rounded-full bg-white/85 text-gray-700 shadow-md cursor-default"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <Heart className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="absolute bottom-4 right-4 bg-black text-white p-3 rounded-full shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)] cursor-default"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <ShoppingCart className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          <div className="text-center">
            {brand && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-normal mb-0.5">{brand}</p>
            )}
            <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1 leading-snug">
              {name || 'Məhsul adı'}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
              {showSale ? (
                <>
                  <span className="text-[13px] font-semibold text-[#D14545] tabular-nums">
                    {displayPrice.toFixed(2)} AZN
                  </span>
                  <span className="text-[13px] font-light text-gray-400 line-through tabular-nums">
                    {numericPrice.toFixed(2)} AZN
                  </span>
                </>
              ) : (
                <span className="text-[13px] font-medium text-gray-900 tabular-nums">
                  {(displayPrice || 0).toFixed(2)} AZN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tövsiyələr paneli */}
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
            <div className={`rounded-md px-3 py-2 border ${
              sizeHint.tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : sizeHint.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {sizeHint.text}
            </div>
          )}
          <ul className="text-[11px] text-gray-500 space-y-0.5 pl-3 list-disc">
            <li>Tövsiyə olunan ölçü: <b>800×800px</b> və ya daha böyük</li>
            <li>Nisbət: <b>1:1 (kvadrat)</b> — saytda ən təmiz görünür</li>
            <li>Fon: ağ və ya şəffaf (PNG) tövsiyə olunur</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProductImagePreview;
