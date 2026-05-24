import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { productService } from '../services/productService';
import { fromBrandSlug } from '../utils/brandSlug';

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
        const [all, brandsSnap] = await Promise.all([
          productService.getAll(),
          (async () => {
            try {
              const { collection, getDocs } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              const s = await getDocs(collection(db, 'brands'));
              return s.docs.map((d) => {
                const data = d.data() as any;
                const n = typeof data.name === 'object'
                  ? (data.name.az || data.name.ru || data.name.en || '')
                  : data.name;
                return String(n || '').trim();
              }).filter(Boolean);
            } catch {
              return [] as string[];
            }
          })(),
        ]);
        // Həm məhsullardakı, həm Firestore-dakı brendləri birləşdir — beləliklə
        // admin yenidən təyin etdiyi, lakin hələ məhsulu olmayan brendlər də tanınır
        const productBrands = (all.map((p) => p.brand).filter(Boolean) as string[]);
        const knownBrands = Array.from(new Set([...productBrands, ...brandsSnap]));
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
