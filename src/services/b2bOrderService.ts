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
  console.log('Creating B2B order in Firestore:', order);
  const ordersRef = collection(db, 'b2bOrders');

  // Sequential order number — quota xətası olarsa, timestamp əsaslı fallback istifadə olunur.
  // Bu sifariş yaradılmasını bloklamamalıdır.
  const counterRef = doc(db, 'counters', 'b2bOrders');
  let orderNumber: number;
  try {
    orderNumber = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? Number(snap.data().value || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { value: next });
      return next;
    });
  } catch (counterError) {
    // Quota və ya digər səhv halında — sayğacı keç, timestamp əsaslı nömrə qoy
    console.warn('Order counter transaction failed, using timestamp fallback:', counterError);
    orderNumber = Number(String(Date.now()).slice(-8)); // son 8 rəqəm
  }

  // Calculate subtotal (before discount)
  const subtotal = order.items.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0);

  // Sifariş sənədini yaradırıq — bu CƏHD UĞURSUZ olarsa, tam xəta atılmalıdır.
  const docRef = await addDoc(ordersRef, {
    ...order,
    orderNumber,
    subtotal: subtotal,
    status: 'pending',
    createdAt: Timestamp.now()
  });
  console.log('B2B order created with ID:', docRef.id, 'orderNumber:', orderNumber);

  // Stok yenilənməsi sifarişin yaradılmasından SONRA fonda baş verir.
  // Quota və ya icazə xətası olarsa, sifariş yenə də uğurlu sayılır.
  // Hər məhsul üçün ayrıca try/catch — birinin uğursuzluğu digərlərini bloklamasın.
  setTimeout(() => {
    (async () => {
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
