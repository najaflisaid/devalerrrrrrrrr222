import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type CustomerOrderStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'accepted'
  | 'preparing'
  | 'courier_handover'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface CustomerOrderItem {
  productId: string;
  productName: string;
  image: string;
  quantity: number;
  price: number;
}

export interface CustomerOrder {
  id?: string;
  orderNumber?: number;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: CustomerOrderItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  deliveryMethodId?: string;
  deliveryMethodName?: string;
  deliveryFee?: number;
  /** If the customer chose "Filialdan götürmə" these fields are populated and
   *  customerAddress is set to the branch address string. */
  isPickup?: boolean;
  pickupBranchId?: string;
  pickupBranchName?: string;
  pickupBranchAddress?: string;
  status: CustomerOrderStatus;
  paymentMethod: 'epoint';
  paymentStatus?: 'success' | 'failed' | 'unknown';
  epointTransaction?: string;
  epointCode?: string;
  customerSignature?: string; // base64 PNG of customer signature
  // Courier-captured receiver signature (used when delivery is taken by a
  // person other than the account holder — e.g., a family member at home,
  // shop assistant for a B2B-style retail flow, etc.)
  receiverName?: string;
  receiverSurname?: string;
  receiverPosition?: string;
  receiverPhone?: string;
  receiverSignature?: string; // base64 PNG
  receiverSignedAt?: any;
  createdAt?: any;
  paidAt?: any;
  courierHandoverAt?: any;
  onTheWayAt?: any;
  deliveredAt?: any;
  customerConfirmedAt?: any;
  isReadByAdmin?: boolean;
}

const COLLECTION = 'customer_orders';

export const createCustomerOrder = async (
  order: Omit<CustomerOrder, 'id' | 'orderNumber' | 'createdAt' | 'status'>
): Promise<{ id: string; orderNumber: number }> => {
  const counterRef = doc(db, 'counters', 'customerOrders');
  let orderNumber: number;
  try {
    orderNumber = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? Number(snap.data().value || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { value: next });
      return next;
    });
  } catch (err) {
    console.warn('customerOrders counter failed, using timestamp fallback:', err);
    orderNumber = Number(String(Date.now()).slice(-8));
  }

  const docRef = await addDoc(collection(db, COLLECTION), {
    ...order,
    orderNumber,
    status: 'pending_payment',
    paymentMethod: 'epoint',
    createdAt: Timestamp.now(),
  });
  return { id: docRef.id, orderNumber };
};

export const getUserOrders = async (userId: string): Promise<CustomerOrder[]> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as CustomerOrder));
  orders.sort((a, b) => {
    const aT = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
    const bT = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
    return bT - aT;
  });
  return orders;
};

export const getAllCustomerOrders = async (): Promise<CustomerOrder[]> => {
  const snapshot = await getDocs(collection(db, COLLECTION));
  const orders = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as CustomerOrder));
  orders.sort((a, b) => {
    const aT = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
    const bT = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
    return bT - aT;
  });
  return orders;
};

export const updateCustomerOrderStatus = async (
  orderId: string,
  status: CustomerOrderStatus
): Promise<void> => {
  const ref = doc(db, COLLECTION, orderId);
  const data: any = { status };
  if (status === 'courier_handover') data.courierHandoverAt = Timestamp.now();
  if (status === 'on_the_way') data.onTheWayAt = Timestamp.now();
  if (status === 'delivered') data.deliveredAt = Timestamp.now();
  await updateDoc(ref, data);
};

export const customerConfirmDelivered = async (
  orderId: string,
  signatureDataUrl?: string
): Promise<void> => {
  const ref = doc(db, COLLECTION, orderId);
  const data: any = {
    status: 'delivered',
    customerConfirmedAt: Timestamp.now(),
    deliveredAt: Timestamp.now(),
  };
  if (signatureDataUrl) data.customerSignature = signatureDataUrl;
  await updateDoc(ref, data);
};

export const markOrderReadByAdmin = async (orderId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, orderId), { isReadByAdmin: true });
};

export const deleteCustomerOrder = async (orderId: string): Promise<void> => {
  const ref = doc(db, COLLECTION, orderId);
  await deleteDoc(ref);
};

export const STATUS_LABELS_AZ: Record<CustomerOrderStatus, string> = {
  pending_payment: 'Ödəniş gözləyir',
  payment_failed: 'Ödəniş uğursuz',
  accepted: 'Qəbul olundu',
  preparing: 'Hazırlanır',
  courier_handover: 'Hazırdır',
  on_the_way: 'Çatdırılma xidmətində',
  delivered: 'Təhvil verildi',
  cancelled: 'Ləğv olundu',
};

// =====================================================================
// Delivery-flow (courier captures receiver signature for retail orders
// when somebody other than the customer takes delivery).
// =====================================================================

export interface CustomerReceiverSignaturePayload {
  receiverName: string;
  receiverSurname: string;
  receiverPosition: string;
  receiverSignature: string; // base64 dataURL
  receiverPhone?: string;
}

export const saveCustomerReceiverSignature = async (
  orderId: string,
  payload: CustomerReceiverSignaturePayload
): Promise<void> => {
  const ref = doc(db, COLLECTION, orderId);
  await updateDoc(ref, {
    receiverName: payload.receiverName.trim(),
    receiverSurname: payload.receiverSurname.trim(),
    receiverPosition: payload.receiverPosition.trim(),
    receiverPhone: payload.receiverPhone?.trim() || '',
    receiverSignature: payload.receiverSignature,
    receiverSignedAt: Timestamp.now(),
    status: 'delivered',
    deliveredAt: Timestamp.now(),
  });
};

/** All retail orders for a given customer (by email) that are currently
 * "on_the_way" and have NOT yet been signed by a receiver. */
export const getRetailOrdersAwaitingReceiverSignature = async (customerEmail: string) => {
  const e = (customerEmail || '').trim().toLowerCase();
  const snapshot = await getDocs(collection(db, COLLECTION));
  const list: any[] = [];
  snapshot.forEach((d) => {
    const data = d.data() as any;
    const email = (data.customerEmail || '').trim().toLowerCase();
    if (email !== e) return;
    if (data.receiverSignature) return;
    if (data.status !== 'on_the_way') return;
    list.push({ id: d.id, ...data });
  });
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};

/** Retail customers (deduplicated) that currently have at least one
 * order in "on_the_way" status awaiting receiver signature. */
export const getRetailCustomersWithPendingDeliveries = async () => {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where('status', '==', 'on_the_way'))
  );
  const map = new Map<string, {
    email: string;
    name: string;
    phone: string;
    address: string;
    pendingCount: number;
    latestCreatedAt: number;
  }>();
  snapshot.forEach((d) => {
    const data = d.data() as any;
    if (data.receiverSignature) return;
    const email = (data.customerEmail || '').trim().toLowerCase();
    if (!email) return;
    const ts = data.createdAt?.toMillis?.() || 0;
    const existing = map.get(email);
    if (existing) {
      existing.pendingCount += 1;
      if (ts > existing.latestCreatedAt) existing.latestCreatedAt = ts;
    } else {
      map.set(email, {
        email,
        name: data.customerName || '',
        phone: data.customerPhone || '',
        address: data.customerAddress || '',
        pendingCount: 1,
        latestCreatedAt: ts,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
};

/** Retail orders signed by the courier in the last `days` days. */
export const getRecentlySignedRetailOrders = async (days = 3) => {
  const snapshot = await getDocs(collection(db, COLLECTION));
  const cutoff = Date.now() - days * 86400000;
  const list: any[] = [];
  snapshot.forEach((d) => {
    const data = d.data() as any;
    const t = data.receiverSignedAt?.toMillis?.() || 0;
    if (data.receiverSignature && t >= cutoff) {
      list.push({ id: d.id, ...data });
    }
  });
  list.sort((a, b) => {
    const ta = a.receiverSignedAt?.toMillis?.() || 0;
    const tb = b.receiverSignedAt?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};
