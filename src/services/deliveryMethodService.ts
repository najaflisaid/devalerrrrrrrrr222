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

export interface PickupBranch {
  id: string;
  name: string;
  address: string;
  mapUrl?: string;
  phone?: string;
}

export interface DeliveryMethod {
  id?: string;
  name: string;
  description?: string;
  price: number;
  estimatedDays?: string;
  isActive: boolean;
  order?: number;
  /** When true, this method is "Filialdan götürmə" — customer picks one of the branches
   *  instead of entering an address. */
  isPickup?: boolean;
  branches?: PickupBranch[];
  createdAt?: any;
}

/** Default branches used on first seed — admin can later edit/add/remove from the panel. */
export const DEFAULT_PICKUP_BRANCHES: PickupBranch[] = [
  {
    id: 'sumqayit-sulh',
    name: 'DE VALEUR — Sumqayıt, Sülh küçəsi',
    address: 'Sumqayıt şəh., Sülh küçəsi',
  },
  {
    id: 'baki-azadliq',
    name: 'DE VALEUR — Bakı, Azadlıq Prospekti',
    address: 'Bakı şəh., Azadlıq Prospekti',
  },
  {
    id: 'sumqayit-karvan',
    name: 'DE VALEUR — Sumqayıt, Karvan Mall',
    address: 'Sumqayıt şəh., Karvan Mall',
  },
];

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
          isPickup: true,
          branches: DEFAULT_PICKUP_BRANCHES,
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

  // Auto-upgrade legacy pickup method docs so the branch picker works
  // without admin intervention. A method is considered "pickup" when:
  //   - its id is 'pickup', OR
  //   - its name contains the AZ word "filial"
  // If it lacks isPickup / branches, we patch the flag in-memory AND fire-and-forget
  // persist the default branches to Firestore so the admin panel shows them too.
  const upgrades: Promise<unknown>[] = [];
  list = list.map((m) => {
    const nm = (m.name || '').toLowerCase();
    const looksLikePickup = m.id === 'pickup' || nm.includes('filial');
    if (!looksLikePickup) return m;
    const patched: DeliveryMethod = { ...m };
    let needsPersist = false;
    if (!patched.isPickup) {
      patched.isPickup = true;
      needsPersist = true;
    }
    if (!patched.branches || patched.branches.length === 0) {
      patched.branches = DEFAULT_PICKUP_BRANCHES;
      needsPersist = true;
    }
    if (needsPersist && patched.id) {
      upgrades.push(
        updateDoc(doc(db, COLLECTION, patched.id), {
          isPickup: true,
          branches: patched.branches,
        }).catch((err) => console.warn('Pickup auto-upgrade failed:', err))
      );
    }
    return patched;
  });
  // Fire-and-forget (don't block render)
  if (upgrades.length > 0) void Promise.all(upgrades);

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
