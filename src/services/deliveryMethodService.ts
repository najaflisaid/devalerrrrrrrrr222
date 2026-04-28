import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DeliveryMethod {
  id?: string;
  name: string;
  description?: string;
  price: number;
  estimatedDays?: string;
  isActive: boolean;
  order?: number;
  createdAt?: any;
}

const COLLECTION = 'delivery_methods';

export const getDeliveryMethods = async (activeOnly = false): Promise<DeliveryMethod[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as DeliveryMethod));
  if (activeOnly) list = list.filter((m) => m.isActive);
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return list;
};

export const addDeliveryMethod = async (method: Omit<DeliveryMethod, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...method,
    createdAt: Timestamp.now(),
  });
  return ref.id;
};

export const updateDeliveryMethod = async (id: string, method: Partial<DeliveryMethod>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), method as any);
};

export const deleteDeliveryMethod = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
