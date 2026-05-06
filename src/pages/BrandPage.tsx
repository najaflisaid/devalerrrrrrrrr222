import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { fromBrandSlug } from '../utils/brandSlug';
import type { Product } from '../types';

/**
 * BrandPage artıq müstəqil layout deyil — filter UI-nın həmişə görünməsi üçün
 * `/products?brand=<canonicalName>` ünvanına yönləndirilir. URL-də brend slug
 * olduğu üçün (məs: `ZIPPO`, `USPA`) əvvəlcə həqiqi brend adını tapırıq, sonra
 * `/products` səhifəsinin filter siyahısı ilə uyğunlaşsın deyə kanonik adla yönləndiririk.
 */
const BrandPage: React.FC = () => {
  const { brand } = useParams<{ brand: string }>();
  const [resolved, setResolved] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all: Product[] = await productService.getAll();
        const knownBrands = Array.from(
          new Set(all.map((p) => p.brand).filter(Boolean) as string[])
        );
        const canonical = fromBrandSlug(brand || '', knownBrands);
        if (cancelled) return;
        if (canonical) {
          setResolved(canonical);
        } else {
          // Slug tanınmırsa, slug-ı olduğu kimi göndəririk — ProductsPage filter siyahısı
          // boş olarsa istifadəçi yenə də sıfırlama düyməsi ilə bütün məhsulları görə biləcək.
          setResolved(brand || '');
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setResolved(brand || '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand]);

  if (!brand) {
    return <Navigate to="/products" replace />;
  }

  if (resolved === null) {
    // Brendi tapana qədər kiçik spinner — bu mərhələ adətən bir neçə yüz millisaniyə çəkir.
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"
          data-testid="brand-redirect-spinner"
        />
      </div>
    );
  }

  void notFound;
  return (
    <Navigate
      to={`/products?brand=${encodeURIComponent(resolved)}`}
      replace
    />
  );
};

export default BrandPage;
