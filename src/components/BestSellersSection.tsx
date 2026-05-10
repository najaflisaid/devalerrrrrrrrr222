import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { productService } from '../services/productService';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';

const BestSellersSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const getProductName = (product: Product): string => {
    if (typeof product.name === 'string') return product.name as unknown as string;
    const lang = i18n.language as 'az' | 'ru' | 'en';
    return product.name[lang] || product.name.az || product.name.en || '';
  };

  useEffect(() => {
    // Fetch top 12 best sellers — 4 columns × 3 rows grid
    productService.getBestSellers(12)
      .then((data) => setProducts(data))
      .catch((e) => console.error('Error loading best sellers:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <section
      className="relative py-8 md:py-12 bg-white"
      data-testid="dv-bestsellers"
    >
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6">
        {/* Section title — left-aligned, italdizain-style */}
        <div className="mb-5 md:mb-7">
          <h2 className="text-2xl sm:text-3xl md:text-[30px] font-light tracking-tight text-black">
            {t('bestSellers.title') || 'Çox satılanlar'}
          </h2>
        </div>

        {/* 2 cols mobile, 3 cols sm, 4 cols md+ — exactly like italdizain.az */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-black/8">
          {products.map((product) => {
            const onSale = !!product.salePrice && product.salePrice < product.price;
            const price = onSale ? product.salePrice! : product.price;
            const name = getProductName(product);
            const brand = (product as any).brand || '';
            const material = (product as any).material || (product as any).category || '';

            return (
              <button
                key={product.id}
                type="button"
                data-testid={`bestseller-card-${product.id}`}
                onClick={() => navigate(`/product/${product.id}`)}
                className="group relative flex flex-col bg-white text-left p-3 sm:p-4 md:p-5 transition-colors duration-300 hover:bg-gray-50/40"
              >
                {/* Wishlist heart — top right */}
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-3 md:top-4 md:right-4 text-black/40 group-hover:text-black/70 transition-colors z-[2]"
                >
                  <Heart className="w-5 h-5" strokeWidth={1.4} />
                </span>

                {/* Sale label — top left */}
                {onSale && (
                  <span className="absolute top-3 left-3 md:top-4 md:left-4 z-[2] text-[10px] md:text-[11px] tracking-[0.18em] uppercase font-medium text-[#D14545]">
                    {t('bestSellers.sale')}
                  </span>
                )}

                {/* Product image — large, centered, contained, square-ish */}
                <div className="relative aspect-[1/1.1] w-full overflow-hidden">
                  <img
                    src={product.images?.[0]}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-contain p-2 sm:p-4 md:p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  {product.images?.[1] && (
                    <img
                      src={product.images[1]}
                      alt={name}
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-contain p-2 sm:p-4 md:p-6 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
                    />
                  )}
                </div>

                {/* Info block — brand uppercase, product name, material, price */}
                <div className="mt-3 md:mt-4 space-y-1">
                  {brand && (
                    <p className="text-[11px] sm:text-[12px] md:text-[13px] tracking-[0.05em] uppercase text-black font-medium leading-tight truncate">
                      {brand}
                    </p>
                  )}
                  <h3 className="text-[13px] sm:text-[14px] md:text-[15px] font-light text-black/85 leading-snug line-clamp-1">
                    {name}
                  </h3>
                  {material && (
                    <p className="text-[11px] sm:text-[12px] md:text-[13px] text-black/55 font-light leading-tight line-clamp-1">
                      {material}
                    </p>
                  )}
                  <p className="pt-1.5 md:pt-2 text-[14px] sm:text-[15px] md:text-[16px] text-black font-medium tabular-nums">
                    {onSale ? (
                      <>
                        <span className="text-black/40 line-through mr-1.5 font-light">
                          {product.price.toFixed(0)} AZN
                        </span>
                        <span className="text-[#D14545]">{price.toFixed(0)} AZN</span>
                      </>
                    ) : (
                      <span>{price.toFixed(0)} AZN</span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
