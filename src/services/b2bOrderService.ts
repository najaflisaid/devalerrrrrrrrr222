 import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc, Timestamp, getDoc, increment, runTransaction } from 'firebase/firestore';

export interface B2BOrderItem {
  productId: string;
  productName: { az: string; ru: string };
  quantity: number;
  regularPrice: number;
}

export interface B2BOrder {
  customerName: string;
  customerLastname?: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  items: B2BOrderItem[];
  totalAmount: number;
  discountAmount: number;
  notes?: string;
  status?: string;
  createdAt?: any;
}

export const createB2BOrder = async (order: B2BOrder) => {
  console.log('Creating B2B order in Firestore (fast path):', order);
  const ordersRef = collection(db, 'b2bOrders');

  // FAST PATH: timestamp-based orderNumber — heç bir əlavə round-trip yoxdur.
  // Sayğac (counters/b2bOrders) yenilənməsi fonda baş verir, sifariş yaradılmasını
  // bloklamır.
  const orderNumber = Number(String(Date.now()).slice(-8));

  // Calculate subtotal (before discount)
  const subtotal = order.items.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0);

  // KRİTİK YOL: yalnız 1 Firestore round-trip — addDoc.
  const docRef = await addDoc(ordersRef, {
    ...order,
    orderNumber,
    subtotal: subtotal,
    status: 'pending',
    createdAt: Timestamp.now()
  });
  console.log('B2B order created with ID:', docRef.id, 'orderNumber:', orderNumber);

  // FONDAKI İŞLƏR — sifariş artıq uğurlu sayılır, bunlar UI gözləməsinə təsir etmir.
  setTimeout(() => {
    (async () => {
      // 1) Stok yenilənməsi — hər məhsul üçün ayrıca try/catch.
      for (const item of order.items) {
        try {
          const productRef = doc(db, 'products', item.productId);
          await updateDoc(productRef, {
            stock: increment(-item.quantity)
          });
        } catch (stockError) {
          console.warn(`Stock update failed for ${item.productId} (sifariş uğurla yaradılıb):`, stockError);
        }
      }
      // 2) Sayğacı statistik məqsədlərlə fonda artırırıq — uğursuz olsa belə əhəmiyyəti yoxdur.
      try {
        const counterRef = doc(db, 'counters', 'b2bOrders');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const current = snap.exists() ? Number(snap.data().value || 0) : 0;
          tx.set(counterRef, { value: current + 1 });
        });
      } catch (counterError) {
        console.warn('Counter background update failed (ignored):', counterError);
      }
    })();
  }, 0);

  return { id: docRef.id, orderNumber, ...order, subtotal };
};

export const sendB2BOrderEmail = async (order: B2BOrder, orderId: string, orderNumber?: number) => {
  try {
    const displayNumber = orderNumber ? `#${orderNumber}` : `#${orderId.slice(0, 8)}`;
    const itemsHTML = order.items.map((item, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.productName.az}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${item.regularPrice.toFixed(2)} AZN</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${(item.regularPrice * item.quantity).toFixed(2)} AZN</td>
      </tr>
    `).join('');

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #1f2937; margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 12px;">
            🎉 Yeni B2B Sifariş
          </h1>

          <div style="background-color: #eff6ff; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
            <p style="margin: 8px 0;"><strong>Sifariş №:</strong> ${displayNumber}</p>
            <p style="margin: 8px 0;"><strong>Müştəri:</strong> ${order.customerName}${order.customerLastname ? ' ' + order.customerLastname : ''}</p>
            ${order.companyName ? `<p style="margin: 8px 0;"><strong>Şirkət:</strong> ${order.companyName}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Email:</strong> ${order.customerEmail}</p>
            <p style="margin: 8px 0;"><strong>Telefon:</strong> ${order.customerPhone || 'Yoxdur'}</p>
          </div>

          <h2 style="color: #1f2937; margin-top: 24px; margin-bottom: 16px;">Sifariş Məhsulları</h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">#</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Məhsul</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Miqdar</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Qiymət</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Cəmi</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin-top: 24px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 16px;"><strong>Ümumi Endirim:</strong></span>
              <span style="font-size: 16px; color: #16a34a; font-weight: bold;">${order.discountAmount.toFixed(2)} AZN</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #e5e7eb;">
              <span style="font-size: 20px; font-weight: bold;">Ümumi Məbləğ:</span>
              <span style="font-size: 24px; color: #3b82f6; font-weight: bold;">${order.totalAmount.toFixed(2)} AZN</span>
            </div>
          </div>

          ${order.notes ? `
            <div style="margin-top: 24px; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <strong>Qeydlər:</strong>
              <p style="margin: 8px 0 0 0;">${order.notes}</p>
            </div>
          ` : ''}

          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p>Bu email avtomatik olaraq De Valeur B2B sistemi tərəfindən göndərilib.</p>
          </div>
        </div>
      </div>
    `;

    console.log('Sending B2B order email...', { orderId, customerEmail: order.customerEmail });

    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: 'ba0691ce-e027-4ca2-b56d-a49332af710a',
        subject: `🛍️ Yeni B2B Sifariş ${displayNumber}`,
        from_name: 'De Valeur B2B Portal',
        name: order.customerName,
        email: order.customerEmail,
        message: htmlMessage,
        replyto: order.customerEmail,
        redirect: false
      })
    });

    const result = await response.json();
    console.log('Web3Forms response:', result);

    if (!result.success) {
      throw new Error(result.message || 'Email göndərilmədi');
    }

    return result;
  } catch (error) {
    console.error('B2B Order Email error:', error);
    throw error;
  }
};

export const getB2BOrders = async (statusFilter?: string) => {
  const ordersRef = collection(db, 'b2bOrders');
  let q;

  if (statusFilter) {
    q = query(ordersRef, where('status', '==', statusFilter));
  } else {
    q = query(ordersRef);
  }

  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Sort manually by createdAt
  orders.sort((a: any, b: any) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  return orders;
};

export const updateB2BOrderStatus = async (orderId: string, status: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { status });
  return { id: orderId, status };
};

export const deleteB2BOrder = async (orderId: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await deleteDoc(orderRef);
};

export const updateB2BOrderNote = async (orderId: string, adminNote: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { adminNote });
  return { id: orderId, adminNote };
};

export const updateB2BOrderCustomerInfo = async (orderId: string, customerInfo: {
  customerName?: string;
  customerLastname?: string;
  customerPhone?: string;
  companyName?: string;
}) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, customerInfo);
  return { id: orderId, ...customerInfo };
};

export const updateB2BOrderPaymentInfo = async (orderId: string, paymentInfo: {
  totalDebt?: number;
  totalDebtOverride?: number | null;
  paymentDeadline?: string;
}) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, paymentInfo as any);
  return { id: orderId, ...paymentInfo };
};

// Toggle confirmation (checkmark) for a specific order item
export const updateB2BOrderCheckedItems = async (orderId: string, checkedItems: number[]) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { checkedItems });
  return { id: orderId, checkedItems };
};

// =====================================================================
// Warehouse flow — public link (no auth) for the warehouse picker.
// The picker sees ONLY: product image, name, barcode, quantity (NO prices).
// They tick ✓ "var" / ✗ "yox" per item and add a note.  Customer + admin
// see this status in real-time via onSnapshot.
// =====================================================================

export type WarehouseStatus = 'available' | 'unavailable';

/**
 * Per-item warehouse status — stored as a map { [itemIndex]: 'available'|'unavailable' }.
 * Indexes refer to the order.items array.
 */
export const updateB2BOrderWarehouseChecks = async (
  orderId: string,
  warehouseChecks: Record<string, WarehouseStatus>
) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { warehouseChecks });
  return { id: orderId, warehouseChecks };
};

export const updateB2BOrderWarehouseNote = async (orderId: string, warehouseNote: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { warehouseNote });
  return { id: orderId, warehouseNote };
};

/** Yığım səhifəsindən sifariş statusunun dəyişdirilməsi (anbardar üçün) */
export const updateB2BOrderStatusFromWarehouse = async (orderId: string, status: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { status });
  return { id: orderId, status };
};

/** Anbardar tərəfi YIĞIMI bitirir — vəzifə + ad/soyad + imza ilə təsdiqləyir.
 *  Bundan sonra linkdən anbardar düzəliş edə bilmir; müştəri modu açılır. */
export const finalizeB2BOrderWarehouse = async (
  orderId: string,
  payload: {
    pickerName: string;
    pickerPosition: string;
    pickerSignature: string; // dataURL
    warehouseChecks?: Record<string, 'available' | 'unavailable'>;
    warehouseNote?: string;
  }
) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const patch: any = {
    warehousePickerName: payload.pickerName.trim(),
    warehousePickerPosition: payload.pickerPosition.trim(),
    warehousePickerSignature: payload.pickerSignature,
    warehouseFinalized: true,
    warehouseFinalizedAt: Timestamp.now(),
  };
  if (payload.warehouseChecks) patch.warehouseChecks = payload.warehouseChecks;
  if (payload.warehouseNote !== undefined) patch.warehouseNote = payload.warehouseNote;
  await updateDoc(orderRef, patch);
  return { id: orderId };
};

/** Müştəri öz tərəfindən hansı malları təhvil aldığını işarələyir (təsdiq edilməyən rejimə qədər). */
export const updateB2BOrderCustomerReceiveChecks = async (
  orderId: string,
  customerReceiveChecks: Record<string, boolean>
) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  await updateDoc(orderRef, { customerReceiveChecks });
  return { id: orderId, customerReceiveChecks };
};

/** Müştəri tərəfi TƏHVİLİ təsdiqləyir — vəzifə + ad/soyad + imza ilə.
 *  Bundan sonra linkdən düzəliş edilə bilməz. Order status='delivered' olur. */
export const finalizeB2BOrderCustomerReceive = async (
  orderId: string,
  payload: {
    receiverName: string;
    receiverPosition: string;
    receiverSignature: string; // dataURL
    customerReceiveChecks?: Record<string, boolean>;
  }
) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const patch: any = {
    customerReceiveName: payload.receiverName.trim(),
    customerReceivePosition: payload.receiverPosition.trim(),
    customerReceiveSignature: payload.receiverSignature,
    customerFinalized: true,
    customerFinalizedAt: Timestamp.now(),
    status: 'delivered',
    deliveredAt: Timestamp.now(),
    // Müştərinin əsas imzasına da yapışdırırıq ki, mövcud admin UI dərhal göstərsin
    signature: payload.receiverSignature,
    signedAt: Timestamp.now(),
  };
  if (payload.customerReceiveChecks) patch.customerReceiveChecks = payload.customerReceiveChecks;
  await updateDoc(orderRef, patch);
  return { id: orderId };
};

/** Single-fetch public read for the warehouse picker (no auth required). */
export const getB2BOrderByIdPublic = async (orderId: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

// =====================================================================
// Delivery-flow (courier captures a "receiver" signature on behalf of the
// company employee actually present at delivery — separate from the
// account holder's own signature in B2BOrdersPage).
// =====================================================================

export interface ReceiverSignaturePayload {
  receiverName: string;
  receiverSurname: string;
  receiverPosition: string;
  receiverSignature: string; // base64 dataURL
  receiverPhone?: string;
  // Courier's own signature + identity (captured on the same delivery form)
  courierSignature?: string;
  courierEmail?: string;
  courierName?: string;
}

export const saveReceiverSignature = async (
  orderId: string,
  payload: ReceiverSignaturePayload
) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const patch: any = {
    receiverName: payload.receiverName.trim(),
    receiverSurname: payload.receiverSurname.trim(),
    receiverPosition: payload.receiverPosition.trim(),
    receiverPhone: payload.receiverPhone?.trim() || '',
    receiverSignature: payload.receiverSignature,
    receiverSignedAt: Timestamp.now(),
    // Mark order as delivered (receiver acknowledged delivery on behalf of company).
    // The company account holder can still add their own signature later via B2BOrdersPage.
    status: 'delivered',
    deliveredAt: Timestamp.now(),
  };
  if (payload.courierSignature) patch.courierSignature = payload.courierSignature;
  if (payload.courierEmail) patch.courierEmail = payload.courierEmail.trim().toLowerCase();
  if (payload.courierName) patch.courierName = payload.courierName.trim();
  await updateDoc(orderRef, patch);
  return { id: orderId };
};

/** All orders for a given B2B customer (by email) that have NOT yet been
 * signed by a delivery receiver AND are currently in "delivering" status.
 * Sorted newest first. */
export const getOrdersAwaitingReceiverSignature = async (customerEmail: string) => {
  const ordersRef = collection(db, 'b2bOrders');
  const q = query(ordersRef, where('customerEmail', '==', customerEmail));
  const snap = await getDocs(q);
  const list: any[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    if (!data.receiverSignature && data.status === 'delivering') {
      list.push({ id: d.id, ...data });
    }
  });
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
};

/** All B2B customers that currently have at least one order awaiting
 * receiver signature AND in "delivering" status. Returns deduplicated list.
 *
 * Confidentiality: ONLY orders explicitly set to status='delivering' (Çatdırılmadadır)
 * by the admin appear in the courier's view. */
export const getCustomersWithPendingDeliveries = async () => {
  const ordersRef = collection(db, 'b2bOrders');
  // Filter directly by status to keep payload smaller
  const q = query(ordersRef, where('status', '==', 'delivering'));
  const snap = await getDocs(q);
  const map = new Map<string, {
    email: string;
    name: string;
    lastname: string;
    company: string;
    phone: string;
    pendingCount: number;
    latestCreatedAt: number;
  }>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data.receiverSignature) return; // already signed
    const email = (data.customerEmail || '').toLowerCase();
    if (!email) return;
    const existing = map.get(email);
    const ts = data.createdAt?.toMillis?.() || 0;
    if (existing) {
      existing.pendingCount += 1;
      if (ts > existing.latestCreatedAt) existing.latestCreatedAt = ts;
    } else {
      map.set(email, {
        email,
        name: data.customerName || '',
        lastname: data.customerLastname || '',
        company: data.companyName || '',
        phone: data.customerPhone || '',
        pendingCount: 1,
        latestCreatedAt: ts,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
};

/** B2B orders that the courier has signed in the last `days` days.
 * Used by the courier panel to show a short history that auto-disappears
 * after 3 days. */
export const getRecentlySignedB2BOrders = async (days = 3) => {
  const ordersRef = collection(db, 'b2bOrders');
  const snap = await getDocs(ordersRef);
  const cutoff = Date.now() - days * 86400000;
  const list: any[] = [];
  snap.forEach((d) => {
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



export const updateOrderItemQuantity = async (orderId: string, itemIndex: number, newQuantity: number, oldQuantity: number, productId: string) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Sifariş tapılmadı');
  }

  const orderData = orderSnap.data();
  const items = [...orderData.items];
  const item = items[itemIndex];

  const quantityDiff = oldQuantity - newQuantity;

  items[itemIndex] = { ...item, quantity: newQuantity };

  // Calculate subtotal (before discount)
  const subtotal = items.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0);
  
  // Calculate discount proportionally based on original discount percentage
  const originalSubtotal = orderData.items.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0);
  const originalDiscountPercentage = originalSubtotal > 0 ? (orderData.discountAmount / originalSubtotal) * 100 : 0;
  
  // Apply same discount percentage to new subtotal
  const newDiscountAmount = (subtotal * originalDiscountPercentage) / 100;
  const newTotalAmount = subtotal - newDiscountAmount;

  await updateDoc(orderRef, {
    items,
    totalAmount: newTotalAmount,
    discountAmount: newDiscountAmount,
    subtotal: subtotal
  });

  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, {
    stock: increment(quantityDiff)
  });

  return { id: orderId, items, totalAmount: newTotalAmount, discountAmount: newDiscountAmount, subtotal };
};

export const removeOrderItem = async (orderId: string, itemIndex: number, productId: string, quantity: number) => {
  const orderRef = doc(db, 'b2bOrders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Sifariş tapılmadı');
  }

  const orderData = orderSnap.data();
  const items = [...orderData.items];
  
  // Calculate original discount percentage before removing item
  const originalSubtotal = orderData.items.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0);
  const originalDiscountPercentage = originalSubtotal > 0 ? (orderData.discountAmount / originalSubtotal) * 100 : 0;

  items.splice(itemIndex, 1);

  if (items.length === 0) {
    await deleteDoc(orderRef);

    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      stock: increment(quantity)
    });

    return { deleted: true };
  }

  // Calculate new subtotal and apply same discount percentage
  const subtotal = items.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0);
  const newDiscountAmount = (subtotal * originalDiscountPercentage) / 100;
  const newTotalAmount = subtotal - newDiscountAmount;

  await updateDoc(orderRef, {
    items,
    totalAmount: newTotalAmount,
    discountAmount: newDiscountAmount,
    subtotal: subtotal
  });

  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, {
    stock: increment(quantity)
  });

  return { id: orderId, items, totalAmount: newTotalAmount, discountAmount: newDiscountAmount, subtotal };
};
