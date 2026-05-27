import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { Product } from '../types';

interface SimilarProductsProps {
  /** The product currently being viewed (excluded from the list). */
  current: Product;
  /** Full product catalogue — already fetched by the parent page. */
  all: Product[];
  /** Optional override for the section heading. */
  title?: string;
  /** Maximum number of cards to show. */
  limit?: number;
}

/**
 * Extract the "model base" from a product name so variants of the same
 * model can be grouped together.
 *
 *   "USPA 2111-01"   →  "uspa 2111"
 *   "USPA 2111-02"   →  "uspa 2111"   (matches the above)
 *   "USPA 2111/03"   →  "uspa 2111"
 *   "Casio AB-123 X" →  "casio ab-123 x"   (no trailing variant → use full name)
 *
 * The heuristic: lowercase the name, strip trailing whitespace and any
 * suffix of the form `[\-_/ ]\d{1,3}[a-z]?` (the variant code). If the
 * cleaned base is too short (<4 chars) we fall back to the full name to
 * avoid grouping unrelated products together.
 */
const extractModelBase = (rawName: string | undefined | null): string => {
  if (!rawName) return '';
  const lower = String(rawName).toLowerCase().trim();
  // Strip trailing variant suffix: separator (-, _, /, space) + 1-3 digits + optional single letter
  const stripped = lower.replace(/[\s\-_/]+\d{1,3}[a-z]?$/i, '').trim();
  return stripped.length >= 4 ? stripped : lower;
};

const SimilarProducts: React.FC<SimilarProductsProps> = ({
  current,
  all,
  title,
  limit = 8,
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';

  const { groupName, items } = useMemo(() => {
    if (!current) return { groupName: '', items: [] as Product[] };

    const currentName =
      current.name?.az || current.name?.en || current.name?.ru || '';
    const baseModel = extractModelBase(currentName);

    const others = all.filter((p) => p && p.id !== current.id);

    // 1) Same model family — name shares the base prefix (e.g. "uspa 2111")
    const sameModel: Product[] = baseModel
      ? others.filter((p) => {
          const n =
            (p.name?.az || p.name?.en || p.name?.ru || '').toLowerCase();
          return extractModelBase(n) === baseModel;
        })
      : [];

    if (sameModel.length > 0) {
      return {
        groupName: 'model',
        items: sameModel.slice(0, limit),
      };
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
      return {
        groupName: 'brandCategory',
        items: sameBrandCat.slice(0, limit),
      };
    }

    // 3) Same brand alone
    const sameBrand = others.filter(
      (p) =>
        p.brand &&
        current.brand &&
        p.brand.toLowerCase() === current.brand.toLowerCase()
    );
    if (sameBrand.length > 0) {
      return {
        groupName: 'brand',
        items: sameBrand.slice(0, limit),
      };
    }

    // 4) Same category fallback
    const sameCat = others.filter((p) => p.category === current.category);
    if (sameCat.length > 0) {
      return {
        groupName: 'category',
        items: sameCat.slice(0, limit),
      };
    }

    // 5) Last resort — random pick from the rest
    return {
      groupName: 'recommended',
      items: others.slice(0, limit),
    };
  }, [current, all, limit]);

  if (items.length === 0) return null;

  // Default heading copy by grouping result (Az primary)
  const defaultHeading = (() => {
    switch (groupName) {
      case 'model':
        return 'Eyni modelin digər variantları';
      case 'brandCategory':
        return 'Bənzər modellər / Digər rənglər';
      case 'brand':
        return 'Eyni brendin digər modelləri';
      case 'category':
        return 'Bənzər məhsullar';
      default:
        return 'Sizə tövsiyə edilir';
    }
  })();

  const headingText = title || defaultHeading;

  return (
    <section
      className="mt-12 border-t border-black/10 pt-10"
      data-testid="similar-products-section"
    >
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2
            className="text-[18px] md:text-[22px] font-medium text-gray-900 tracking-tight"
            data-testid="similar-products-heading"
          >
            {headingText}
          </h2>
          <p className="text-[12px] text-gray-500 mt-1">
            {items.length} {items.length === 1 ? 'məhsul' : 'məhsul'} tapıldı
          </p>
        </div>
      </div>

      {/* Horizontal scrollable rail (mobile-friendly) */}
      <div
        className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2
                   snap-x snap-mandatory scroll-smooth
                   md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:mx-0 md:px-0"
        data-testid="similar-products-list"
      >
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
                // Scroll the new product page to top on navigation
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group flex-shrink-0 w-[180px] md:w-auto snap-start text-left
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 rounded-md"
              data-testid={`similar-product-${p.id}`}
            >
              <div className="aspect-square bg-gray-50 rounded-md overflow-hidden mb-3 relative">
                {onSale && (
                  <span className="absolute top-2 left-2 z-10 bg-[#D14545] text-white text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm">
                    {t('product.sale')}
                  </span>
                )}
                {p.stock === 0 && (
                  <span className="absolute top-2 right-2 z-10 bg-black/80 text-white text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm">
                    Bitdi
                  </span>
                )}
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={displayName}
                    loading="lazy"
                    className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-[0.12em] mb-1 truncate">
                {p.brand}
              </p>
              <p
                className="text-[14px] text-gray-900 leading-snug line-clamp-2 mb-2 min-h-[36px]"
                title={displayName}
              >
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

        {/* "See all" tile — only when we've hit the limit */}
        {items.length >= limit && (
          <button
            type="button"
            onClick={() => navigate(`/brand/${encodeURIComponent(current.brand || '')}`)}
            className="group flex-shrink-0 w-[180px] md:w-auto snap-start
                       flex flex-col items-center justify-center
                       aspect-square md:aspect-auto md:min-h-[300px]
                       bg-gray-50 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            data-testid="similar-products-see-all"
          >
            <ArrowRight className="w-6 h-6 mb-2 transition-transform group-hover:translate-x-1" strokeWidth={1.4} />
            <span className="text-[12px] uppercase tracking-[0.18em]">
              Daha çox bax
            </span>
          </button>
        )}
      </div>
    </section>
  );
};

export default SimilarProducts;
