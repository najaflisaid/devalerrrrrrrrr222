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
