import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
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

let __seedAttempted = false;

export const getDeliveryMethods = async (activeOnly = false): Promise<DeliveryMethod[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as DeliveryMethod));

  // Seed default methods on first run with deterministic IDs to avoid duplicates
  if (list.length === 0 && !__seedAttempted) {
    __seedAttempted = true;
    const defaults: { id: string; data: Omit<DeliveryMethod, 'id' | 'createdAt'> }[] = [
      {
        id: 'pickup',
        data: {
          name: 'Filialdan götürmə',
          description: 'Mağazamızdan özünüz götürün',
          price: 0,
          estimatedDays: 'Eyni gün',
          isActive: true,
          order: 1,
        },
      },
      {
        id: 'courier',
        data: {
          name: 'Kuryer ilə çatdırılma',
          description: 'Bakı daxili kuryer xidməti',
          price: 5,
          estimatedDays: '1-2 iş günü',
          isActive: true,
          order: 2,
        },
      },
      {
        id: 'post',
        data: {
          name: 'Poçt ilə çatdırılma',
          description: 'Region və şəhərlərarası poçt',
          price: 10,
          estimatedDays: '3-5 iş günü',
          isActive: true,
          order: 3,
        },
      },
    ];
    try {
      await Promise.all(
        defaults.map((d) =>
          setDoc(
            doc(db, COLLECTION, d.id),
            { ...d.data, createdAt: Timestamp.now() },
            { merge: false }
          )
        )
      );
      const reloaded = await getDocs(collection(db, COLLECTION));
      list = reloaded.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as DeliveryMethod));
    } catch (e) {
      console.warn('Failed to seed default delivery methods:', e);
    }
  }

  if (activeOnly) list = list.filter((m) => m.isActive);

  // Deduplicate by name (clean up stale duplicates from older buggy seeding)
  const seen = new Map<string, DeliveryMethod>();
  const duplicateIds: string[] = [];
  for (const m of list) {
    const key = (m.name || '').trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      // Keep the deterministic-ID one (pickup/courier/post) over arbitrary IDs
      const existing = seen.get(key)!;
      const existingDeterministic = ['pickup', 'courier', 'post'].includes(existing.id || '');
      const currentDeterministic = ['pickup', 'courier', 'post'].includes(m.id || '');
      if (currentDeterministic && !existingDeterministic) {
        duplicateIds.push(existing.id!);
        seen.set(key, m);
      } else {
        duplicateIds.push(m.id!);
      }
    } else {
      seen.set(key, m);
    }
  }
  list = Array.from(seen.values());
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Background cleanup: delete duplicate docs (fire-and-forget)
  if (duplicateIds.length > 0) {
    Promise.all(duplicateIds.map((id) => deleteDoc(doc(db, COLLECTION, id)))).catch(
      (err) => console.warn('Failed to clean duplicate delivery methods:', err)
    );
  }

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
