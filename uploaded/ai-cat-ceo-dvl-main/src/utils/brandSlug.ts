// Brand name → URL slug çevrilməsi.
// Bəzi brendlər üçün xüsusi qısaltma slug-ları (məs: U.S. Polo Assn. → USPA).
// Naməlum brendlər üçün avtomatik: nöqtələri/boşluqları sil, böyük hərf.

const SPECIAL_BRAND_SLUGS: Record<string, string> = {
  // Hər iki istiqamətdə tanınması üçün – aşağıda fromBrandSlug-də case-insensitive yoxlanılır
  'u.s. polo assn.': 'USPA',
  'u.s. polo assn': 'USPA',
  'us polo assn': 'USPA',
  'us polo assn.': 'USPA',
  'u.s polo assn': 'USPA',
};

export const toBrandSlug = (brand: string): string => {
  if (!brand) return '';
  const key = brand.trim().toLowerCase();
  if (SPECIAL_BRAND_SLUGS[key]) return SPECIAL_BRAND_SLUGS[key];
  // Default: nöqtələri, boşluqları və xüsusi simvolları sil; böyük hərf
  return brand
    .replace(/[.\s&'`"]+/g, '')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();
};

// Slug-dan həqiqi brend adını tap (məhsul siyahısındakı brendlər əsasında)
export const fromBrandSlug = (slug: string, knownBrands: string[]): string | null => {
  if (!slug) return null;
  const target = slug.trim().toUpperCase();
  for (const brand of knownBrands) {
    if (toBrandSlug(brand) === target) return brand;
    if (brand.toLowerCase() === slug.toLowerCase()) return brand;
  }
  return null;
};
