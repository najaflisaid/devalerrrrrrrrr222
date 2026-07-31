import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Manual delivery service — for products that are NOT listed on the site
 * but are delivered from the physical store by a courier.
 *
 * Admin creates these entries from the "Çatdırılma — Kuryerlər" tab.
 * The courier sees them (customer name / phone / address) inside their
 * delivery panel, delivers, then captures both the receiver's signature
 * AND the courier's own signature.
 */

export interface ManualDeliveryItem {
  productName: string;
  quantity: number;
  note?: string;
}

export type ManualDeliveryStatus = 'pending' | 'delivered';

export interface ManualDelivery {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: ManualDeliveryItem[];
  assignedCourierEmail?: string; // if set, only this courier sees it
  assignedCourierName?: string;
  status: ManualDeliveryStatus;
  createdAt: any;
  // Signatures captured on delivery
  receiverName?: string;
  receiverSurname?: string;
  receiverPosition?: string;
  receiverPhone?: string;
  receiverSignature?: string;
  courierSignature?: string;
  courierEmail?: string;
  courierName?: string;
  receiverSignedAt?: any;
}

const COLLECTION = 'manual_deliveries';

// ─────────────── CREATE ───────────────
export const createManualDelivery = async (data: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: ManualDeliveryItem[];
  assignedCourierEmail?: string;
  assignedCourierName?: string;
}): Promise<ManualDelivery> => {
  const name = (data.customerName || '').trim();
  const phone = (data.customerPhone || '').trim();
  const address = (data.customerAddress || '').trim();
  const items = (data.items || []).filter(
    (i) => (i.productName || '').trim() && Number(i.quantity) > 0
  );

  if (!name) throw new Error('Müştəri adı məcburidir.');
  if (!address) throw new Error('Çatdırılma ünvanı məcburidir.');
  if (items.length === 0) throw new Error('Ən azı bir məhsul əlavə edin.');

  const orderNumber = Number(String(Date.now()).slice(-8));

  const payload: any = {
    orderNumber,
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    notes: (data.notes || '').trim(),
    items: items.map((it) => ({
      productName: it.productName.trim(),
      quantity: Number(it.quantity),
      note: (it.note || '').trim(),
    })),
    assignedCourierEmail: (data.assignedCourierEmail || '').trim().toLowerCase(),
    assignedCourierName: (data.assignedCourierName || '').trim(),
    status: 'pending' as ManualDeliveryStatus,
    createdAt: Timestamp.now(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return { id: ref.id, ...payload } as ManualDelivery;
};

// ─────────────── LIST ───────────────
export const listAllManualDeliveries = async (): Promise<ManualDelivery[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  const list = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) } as ManualDelivery)
  );
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() || 0;
    const tb = (b.createdAt as any)?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};

/**
 * Pending manual deliveries visible to a courier.
 *  - If `courierEmail` provided: returns items either unassigned OR assigned to that email.
 *  - Otherwise returns all pending items.
 */
export const listPendingManualDeliveriesForCourier = async (
  courierEmail?: string
): Promise<ManualDelivery[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('status', '==', 'pending'))
  );
  const email = (courierEmail || '').trim().toLowerCase();
  const list: ManualDelivery[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    const assigned = (data.assignedCourierEmail || '').trim().toLowerCase();
    if (email && assigned && assigned !== email) return;
    list.push({ id: d.id, ...(data as any) } as ManualDelivery);
  });
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() || 0;
    const tb = (b.createdAt as any)?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};

/** Recently signed manual deliveries (last N days). */
export const getRecentlySignedManualDeliveries = async (
  days = 3
): Promise<ManualDelivery[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  const cutoff = Date.now() - days * 86400000;
  const list: ManualDelivery[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    const t = data.receiverSignedAt?.toMillis?.() || 0;
    if (data.receiverSignature && t >= cutoff) {
      list.push({ id: d.id, ...(data as any) } as ManualDelivery);
    }
  });
  list.sort((a, b) => {
    const ta = (a.receiverSignedAt as any)?.toMillis?.() || 0;
    const tb = (b.receiverSignedAt as any)?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};

// ─────────────── SIGN / DELETE ───────────────

export interface ManualDeliverySignPayload {
  receiverName: string;
  receiverSurname: string;
  receiverPosition: string;
  receiverPhone?: string;
  receiverSignature: string;
  courierSignature: string;
  courierEmail: string;
  courierName: string;
}

export const signManualDelivery = async (
  id: string,
  payload: ManualDeliverySignPayload
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    receiverName: payload.receiverName.trim(),
    receiverSurname: payload.receiverSurname.trim(),
    receiverPosition: payload.receiverPosition.trim(),
    receiverPhone: (payload.receiverPhone || '').trim(),
    receiverSignature: payload.receiverSignature,
    courierSignature: payload.courierSignature,
    courierEmail: payload.courierEmail.trim().toLowerCase(),
    courierName: payload.courierName.trim(),
    receiverSignedAt: Timestamp.now(),
    status: 'delivered',
  });
};

export const deleteManualDelivery = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
