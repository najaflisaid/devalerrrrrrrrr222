/**
 * Category service — hierarxik kateqoriya dəstəyi (parent → alt-kategoriya)
 * Məsələn: "Dəri Aksesuarlar" (parent) → "Çantalar", "Pul qabıları" (alt-kategori).
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CategoryNode {
  id: string;
  name: string;            // cari dilə uyğun ad (UI üçün)
  nameAz: string;
  nameRu: string;
  nameEn: string;
  parentId: string | null;
  children: CategoryNode[];
}

/**
 * Bütün kateqoriyaları yükləyir və parent-child hierarxiyasını qurur.
 * Yalnız top-level (parentId == null) kateqoriyalar qaytarılır.
 * Hər birinin `children` array-ində alt-kateqoriyaları olur.
 */
export const getCategoryTree = async (lang: 'az' | 'ru' | 'en' = 'az'): Promise<CategoryNode[]> => {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const flat: CategoryNode[] = snap.docs.map(d => {
      const data = d.data() as any;
      const isObj = data.name && typeof data.name === 'object';
      const nameAz = isObj ? (data.name.az || '') : (data.name || '');
      const nameRu = isObj ? (data.name.ru || nameAz) : (data.name || '');
      const nameEn = isObj ? (data.name.en || nameAz) : (data.name || '');
      const display = lang === 'ru' ? nameRu : lang === 'en' ? nameEn : nameAz;
      return {
        id: d.id,
        name: display || nameAz || nameEn || nameRu,
        nameAz, nameRu, nameEn,
        parentId: data.parentId || null,
        children: [],
      };
    });
    const byId = new Map<string, CategoryNode>(flat.map(n => [n.id, n]));
    const roots: CategoryNode[] = [];
    flat.forEach(n => {
      if (n.parentId && byId.has(n.parentId)) {
        byId.get(n.parentId)!.children.push(n);
      } else {
        roots.push(n);
      }
    });
    return roots;
  } catch (e) {
    console.error('getCategoryTree failed:', e);
    return [];
  }
};

/**
 * Hər kategori üçün (özü + alt-kategoriyalar) bütün ad-larını qaytarır.
 * Filtrasiya üçün istifadə olunur — parent seçildikdə alt-larındakı məhsullar da gəlsin.
 */
export const getCategoryAndDescendantsNames = (root: CategoryNode): string[] => {
  const result: string[] = [root.nameAz];
  if (root.nameRu && !result.includes(root.nameRu)) result.push(root.nameRu);
  if (root.nameEn && !result.includes(root.nameEn)) result.push(root.nameEn);
  root.children.forEach(c => {
    result.push(...getCategoryAndDescendantsNames(c));
  });
  return result;
};
