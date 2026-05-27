import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';

interface SimilarProductsProps {
  /** The product currently being viewed (excluded from the list). */
  current: Product;
  /** Full product catalogue — already fetched by the parent page. */
  all: Product[];
  /** Optional override for the section heading. */
  title?: string;
  /** Maximum number of cards to show. Default: 3 (compact sidebar). */
  limit?: number;
  /** Compact = small vertical list (used in right column). Default: true. */
  compact?: boolean;
}

/**
 * Extract the "model base" from a product name so variants of the same
 * model can be grouped together.
 *
 *   "USPA 2111-01"   →  "uspa 2111"
 *   "USPA 2111-02"   →  "uspa 2111"   (matches the above)
 *   "DS 2432 C1"     →  "ds 2432"     (color code C1 stripped)
 *   "Pierre Lannier 007J542"  →  "pierre lannier 007j542"  (no trailing variant)
 *
 * The heuristic:
 *   1. Lowercase + trim
 *   2. Strip trailing color-code suffix: ` C\d+`, ` ?-?\d{1,3}[a-z]?` etc.
 *   3. Fallback to full name if stripped result is too short.
 */
const extractModelBase = (rawName: string | undefined | null): string => {
  if (!rawName) return '';
  let s = String(rawName).toLowerCase().trim();
  // Strip color code like " C1", " C12", " c3" at the end
  s = s.replace(/\s+c\d{1,3}$/i, '');
  // Strip variant numeric suffix like "-01", "_02", "/03", " 01"
  s = s.replace(/[\s\-_/]+\d{1,3}[a-z]?$/i, '');
  s = s.trim();
  return s.length >= 4 ? s : String(rawName).toLowerCase().trim();
};

const SimilarProducts: React.FC<SimilarProductsProps> = ({
  current,
  all,
  title,
  limit = 3,
  compact = true,
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const { groupName, items } = useMemo(() => {
    if (!current) return { groupName: '', items: [] as Product[] };

    const currentName =
      current.name?.az || current.name?.en || current.name?.ru || '';
    const baseModel = extractModelBase(currentName);
    const currentGender = (current as any).gender || '';

    // Only consider products of the SAME gender (men's vs women's vs unisex)
    // when the current product has one. Unisex matches anything.
    const matchesGender = (p: Product) => {
      const g = (p as any).gender || '';
      if (!currentGender || currentGender === 'unisex') return true;
      if (!g || g === 'unisex') return true;
      return g.toLowerCase() === currentGender.toLowerCase();
    };

    const others = all.filter(
      (p) => p && p.id !== current.id && matchesGender(p)
    );

    // 1) Same model family — name shares the base prefix (different colour codes)
    const sameModel: Product[] = baseModel
      ? others.filter((p) => {
          const n = (p.name?.az || p.name?.en || p.name?.ru || '').toLowerCase();
          return extractModelBase(n) === baseModel;
        })
      : [];
    if (sameModel.length > 0) {
      return { groupName: 'model', items: sameModel.slice(0, limit) };
    }

    // 2) Same brand + same category (other "colours / variants")
    const sameBrandCat = others.filter(
      (p) =>
        p.brand &&
        current.brand &&
        p.brand.toLowerCase() === current.brand.toLowerCase() &&
        p.category === current.category
    );
    if (sameBrandCat.length > 0) {
      return { groupName: 'brandCategory', items: sameBrandCat.slice(0, limit) };
    }

    // 3) Same category (same gender already enforced above)
    const sameCat = others.filter((p) => p.category === current.category);
    if (sameCat.length > 0) {
      return { groupName: 'category', items: sameCat.slice(0, limit) };
    }

    // 4) Same brand alone
    const sameBrand = others.filter(
      (p) =>
        p.brand &&
        current.brand &&
        p.brand.toLowerCase() === current.brand.toLowerCase()
    );
    if (sameBrand.length > 0) {
      return { groupName: 'brand', items: sameBrand.slice(0, limit) };
    }

    return { groupName: 'recommended', items: others.slice(0, limit) };
  }, [current, all, limit]);

  if (items.length === 0) return null;

  const defaultHeading = (() => {
    switch (groupName) {
      case 'model':
        return 'Eyni modelin digər rəngləri';
      case 'brandCategory':
        return 'Bənzər modellər';
      case 'brand':
        return 'Eyni brenddən';
      case 'category':
        return 'Bənzər məhsullar';
      default:
        return 'Sizə tövsiyə';
    }
  })();

  const headingText = title || defaultHeading;

  // ── COMPACT MODE ─────────────────────────────────────────────────────
  // Small vertical list — designed to slot into the right product column
  // (under the Share button). Each row: 56×56 thumbnail + name + price.
  if (compact) {
    return (
      <section
        className="mt-8 pt-6 border-t border-black/10"
        data-testid="similar-products-section"
      >
        <h3
          className="text-[11px] uppercase tracking-[0.22em] text-black/65 mb-4"
          data-testid="similar-products-heading"
        >
          {headingText}
        </h3>
        <div className="space-y-3" data-testid="similar-products-list">
          {items.map((p) => {
            const displayName =
              p.name?.[lang] || p.name?.az || p.name?.en || '';
            const onSale = !!p.salePrice && p.salePrice < p.price;
            const visiblePrice = p.salePrice || p.price;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  navigate(`/product/${p.id}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3 p-2 -mx-2 rounded-md
                           hover:bg-black/[0.03] transition-colors text-left
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                data-testid={`similar-product-${p.id}`}
              >
                <div className="w-14 h-14 flex-shrink-0 bg-gray-50 rounded-md overflow-hidden relative">
                  {onSale && (
                    <span className="absolute top-0.5 left-0.5 z-10 bg-[#D14545] text-white text-[8px] uppercase tracking-[0.08em] px-1 py-px rounded-sm">
                      {t('product.sale')}
                    </span>
                  )}
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt={displayName}
                      loading="lazy"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] text-black/85 leading-snug line-clamp-2"
                    title={displayName}
                  >
                    {displayName}
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-[12px] font-medium text-black tabular-nums">
                      {visiblePrice.toFixed(2)} AZN
                    </span>
                    {onSale && (
                      <span className="text-[10px] text-black/40 line-through tabular-nums">
                        {p.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // ── FULL MODE ────────────────────────────────────────────────────────
  // (Not used currently, kept for flexibility — grid/carousel layout.)
  return (
    <section
      className="mt-12 border-t border-black/10 pt-10"
      data-testid="similar-products-section"
    >
      <h2
        className="text-[18px] md:text-[22px] font-medium text-gray-900 tracking-tight mb-6"
        data-testid="similar-products-heading"
      >
        {headingText}
      </h2>
      <div
        className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory
                   md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:mx-0 md:px-0"
        data-testid="similar-products-list"
      >
        {items.map((p) => {
          const displayName = p.name?.[lang] || p.name?.az || '';
          const onSale = !!p.salePrice && p.salePrice < p.price;
          const visiblePrice = p.salePrice || p.price;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                navigate(`/product/${p.id}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex-shrink-0 w-[180px] md:w-auto snap-start text-left
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 rounded-md"
              data-testid={`similar-product-${p.id}`}
            >
              <div className="aspect-square bg-gray-50 rounded-md overflow-hidden mb-3 relative">
                {onSale && (
                  <span className="absolute top-2 left-2 z-10 bg-[#D14545] text-white text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm">
                    {t('product.sale')}
                  </span>
                )}
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={displayName}
                    loading="lazy"
                    className="w-full h-full object-contain p-3"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-[0.12em] mb-1 truncate">
                {p.brand}
              </p>
              <p className="text-[14px] text-gray-900 leading-snug line-clamp-2 mb-2 min-h-[36px]">
                {displayName}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[15px] font-medium text-gray-900 tabular-nums">
                  {visiblePrice.toFixed(2)} AZN
                </span>
                {onSale && (
                  <span className="text-[12px] text-gray-400 line-through tabular-nums">
                    {p.price.toFixed(2)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default SimilarProducts;
