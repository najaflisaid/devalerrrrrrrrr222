import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order } from '../types';

export const orderService = {
  async createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Promise<string> {
    const orderNumber = `DV${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const order = {
      ...orderData,
      orderNumber,
      createdAt: new Date(),
      status: 'pending' as const
    };

    const docRef = await addDoc(collection(db, 'orders'), order);
    return docRef.id;
  },

  async getUserOrders(userId: string): Promise<Order[]> {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
      };
    }) as Order[];
  },

  async getAllOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
      };
    }) as Order[];
  },

  generateReceipt(order: Order): string {
    const date = order.createdAt.toLocaleDateString('az-AZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        DE VALEUR
     Premium Fashion Store
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QƏBZ / RECEIPT

Sifariş №: ${order.orderNumber}
Tarix: ${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÜŞTƏRİ MƏLUMATLARI

Ad: ${order.customerName}
Email: ${order.customerEmail}
Telefon: ${order.customerPhone}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MƏHSUL

${order.product.name}
Qiymət: $${order.product.price.toFixed(2)}
Miqdar: ${order.product.quantity}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YEKUN MƏBLƏĞ: $${order.totalAmount.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ${this.getStatusText(order.status)}

Təşəkkürlər! 🎁
www.devaleur.az

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  },

  getStatusText(status: Order['status']): string {
    const statusMap = {
      pending: 'Gözləyir',
      confirmed: 'Təsdiqləndi',
      delivered: 'Çatdırıldı',
      cancelled: 'Ləğv edildi'
    };
    return statusMap[status];
  }
};
