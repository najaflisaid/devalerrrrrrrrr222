import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Zəmanət / Servis təhvil-təslim aktı.
 *
 * Axın:
 *  1. Müştəri qeydiyyatdan keçir, menyudan "Zəmanət Servisi" bölməsinə girir,
 *     brend + model + nasazlıq təsviri + filial seçir və barmaqla imza atır → status `submitted`.
 *  2. Mağaza işçisi (admin panel) aktı servisə qəbul edir, öz adını seçir → status `accepted`.
 *  3. Admin statusu `in_service` (servisdədir) edə bilər.
 *  4. Məhsul servisdən qayıdanda admin `at_branch` (filiala qaytarıldı) seçir →
 *     müştəri linkində bildiriş görünür və yenidən imza sahəsi açılır.
 *  5. Müştəri gəlib təhvil alanda öz imzası ilə təsdiqləyir → status `completed`.
 */

export type WarrantyStatus =
  | 'submitted'
  | 'accepted'
  | 'in_service'
  | 'at_branch'
  | 'completed';

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  submitted: 'Təhvil verildi',
  accepted: 'Servisə qəbul olundu',
  in_service: 'Servisdədir',
  at_branch: 'Filiala qaytarıldı',
  completed: 'Təhvil alındı',
};

export const WARRANTY_STATUS_ORDER: WarrantyStatus[] = [
  'submitted',
  'accepted',
  'in_service',
  'at_branch',
  'completed',
];

export interface WarrantyStatusEvent {
  status: WarrantyStatus;
  at: any;
  note?: string;
  by?: string;
}

export interface WarrantyService {
  id: string;
  serviceNumber: number;
  userId: string;
  customerName: string;
  customerSurname?: string;
  customerPhone?: string;
  brand: string;
  model: string;
  faultDescription: string;
  branch: string;
  status: WarrantyStatus;
  handoverSignature: string; // müştərinin təhvil-vermə imzası
  // Servisə qəbul (mağaza işçisi)
  acceptedWorkerId?: string;
  acceptedWorkerName?: string;
  acceptedWorkerSignature?: string;
  acceptedAt?: any;
  inServiceAt?: any;
  atBranchAt?: any;
  // Təhvil-alma (müştəri + işçi)
  pickupSignature?: string;
  pickupWorkerName?: string;
  pickupWorkerSignature?: string;
  completedAt?: any;
  statusHistory?: WarrantyStatusEvent[];
  createdAt: any;
  updatedAt?: any;
}

const COLLECTION = 'warranty_services';

const genServiceNumber = () => Number(String(Date.now()).slice(-8));

// ─────────────── CREATE (müştəri) ───────────────
export const createWarrantyService = async (data: {
  userId: string;
  customerName: string;
  customerSurname?: string;
  customerPhone?: string;
  brand: string;
  model: string;
  faultDescription: string;
  branch: string;
  handoverSignature: string;
}): Promise<WarrantyService> => {
  const brand = (data.brand || '').trim();
  const model = (data.model || '').trim();
  const fault = (data.faultDescription || '').trim();
  const branch = (data.branch || '').trim();

  if (!brand) throw new Error('Brend seçin.');
  if (!model) throw new Error('Modelin nömrəsini qeyd edin.');
  if (!fault) throw new Error('Nasazlığın təsvirini qeyd edin.');
  if (!branch) throw new Error('Filialı seçin.');
  if (!data.handoverSignature) throw new Error('İmza tələb olunur.');

  const now = Timestamp.now();
  const payload: any = {
    serviceNumber: genServiceNumber(),
    userId: data.userId,
    customerName: (data.customerName || '').trim(),
    customerSurname: (data.customerSurname || '').trim(),
    customerPhone: (data.customerPhone || '').trim(),
    brand,
    model,
    faultDescription: fault,
    branch,
    status: 'submitted' as WarrantyStatus,
    handoverSignature: data.handoverSignature,
    statusHistory: [{ status: 'submitted', at: now }],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return { id: ref.id, ...payload } as WarrantyService;
};

// ─────────────── READ ───────────────
export const getWarrantyService = async (
  id: string
): Promise<WarrantyService | null> => {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as WarrantyService) : null;
};

const sortByCreated = (list: WarrantyService[]) =>
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() || 0;
    const tb = (b.createdAt as any)?.toMillis?.() || 0;
    return tb - ta;
  });

export const listAllWarrantyServices = async (): Promise<WarrantyService[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return sortByCreated(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as WarrantyService)));
};

export const subscribeAllWarrantyServices = (
  cb: (items: WarrantyService[]) => void,
  onError?: (e: any) => void
) => {
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as WarrantyService));
      cb(sortByCreated(list));
    },
    (err) => onError?.(err)
  );
};

export const subscribeMyWarrantyServices = (
  userId: string,
  cb: (items: WarrantyService[]) => void,
  onError?: (e: any) => void
) => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as WarrantyService));
      cb(sortByCreated(list));
    },
    (err) => onError?.(err)
  );
};

// ─────────────── UPDATE (admin) ───────────────
export const acceptWarrantyService = async (
  id: string,
  payload: { workerId?: string; workerName: string; workerSignature?: string }
): Promise<void> => {
  const name = (payload.workerName || '').trim();
  if (!name) throw new Error('İşçini seçin.');
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'accepted',
    acceptedWorkerId: payload.workerId || '',
    acceptedWorkerName: name,
    acceptedWorkerSignature: payload.workerSignature || '',
    acceptedAt: now,
    updatedAt: now,
    statusHistory: arrayUnion({ status: 'accepted', at: now, by: name }),
  } as any);
};

export const setWarrantyStatus = async (
  id: string,
  status: WarrantyStatus,
  note?: string
): Promise<void> => {
  const now = Timestamp.now();
  const patch: any = {
    status,
    updatedAt: now,
    statusHistory: arrayUnion({ status, at: now, ...(note ? { note } : {}) }),
  };
  if (status === 'in_service') patch.inServiceAt = now;
  if (status === 'at_branch') patch.atBranchAt = now;
  await updateDoc(doc(db, COLLECTION, id), patch);
};

// ─────────────── PICKUP (müştəri təhvil alır) ───────────────
export const customerPickupWarranty = async (
  id: string,
  payload: { pickupSignature: string }
): Promise<void> => {
  if (!payload.pickupSignature) throw new Error('İmza tələb olunur.');
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'completed',
    pickupSignature: payload.pickupSignature,
    completedAt: now,
    updatedAt: now,
    statusHistory: arrayUnion({ status: 'completed', at: now }),
  } as any);
};

// İşçinin təhvil-vermə imzası (admin panel — istəyə bağlı)
export const setPickupWorkerSignature = async (
  id: string,
  payload: { workerName: string; workerSignature: string }
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    pickupWorkerName: (payload.workerName || '').trim(),
    pickupWorkerSignature: payload.workerSignature || '',
    updatedAt: Timestamp.now(),
  } as any);
};

export const deleteWarrantyService = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const formatWarrantyDate = (raw: any): string => {
  try {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};
