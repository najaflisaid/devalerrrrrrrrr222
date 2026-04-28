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

  // Seed default methods on first run
  if (list.length === 0) {
    const defaults: Omit<DeliveryMethod, 'id' | 'createdAt'>[] = [
      {
        name: 'Filialdan götürmə',
        description: 'Mağazamızdan özünüz götürün',
        price: 0,
        estimatedDays: 'Eyni gün',
        isActive: true,
        order: 1,
      },
      {
        name: 'Kuryer ilə çatdırılma',
        description: 'Bakı daxili kuryer xidməti',
        price: 5,
        estimatedDays: '1-2 iş günü',
        isActive: true,
        order: 2,
      },
      {
        name: 'Poçt ilə çatdırılma',
        description: 'Region və şəhərlərarası poçt',
        price: 10,
        estimatedDays: '3-5 iş günü',
        isActive: true,
        order: 3,
      },
    ];
    try {
      await Promise.all(
        defaults.map((m) =>
          addDoc(collection(db, COLLECTION), { ...m, createdAt: Timestamp.now() })
        )
      );
      const reloaded = await getDocs(collection(db, COLLECTION));
      list = reloaded.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as DeliveryMethod));
    } catch (e) {
      console.warn('Failed to seed default delivery methods:', e);
    }
  }

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
