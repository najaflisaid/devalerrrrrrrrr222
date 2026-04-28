import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ProductReview {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt?: any;
}

const COLLECTION = 'product_reviews';

export const getProductReviews = async (productId: string): Promise<ProductReview[]> => {
  const q = query(collection(db, COLLECTION), where('productId', '==', productId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ProductReview));
  list.sort((a, b) => {
    const aT = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
    const bT = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
    return bT - aT;
  });
  return list;
};

export const addProductReview = async (
  review: Omit<ProductReview, 'id' | 'createdAt'>
): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...review,
    createdAt: Timestamp.now(),
  });
  return ref.id;
};

export const deleteProductReview = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const computeAverageRating = (reviews: ProductReview[]): number => {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};
