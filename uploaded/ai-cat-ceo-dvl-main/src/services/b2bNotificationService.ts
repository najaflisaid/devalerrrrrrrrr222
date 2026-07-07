import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc,
  updateDoc,
  query, 
  orderBy,
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface B2BNotification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  createdAt: any;
  expiresAt?: any;
  isActive: boolean;
  readBy?: string[]; // Email siyahısı
}

const COLLECTION_NAME = 'b2b_notifications';

// Bildiriş əlavə et
export const addB2BNotification = async (
  title: string, 
  message: string, 
  type: NotificationType = 'info',
  priority: NotificationPriority = 'medium',
  expiresAt?: Date
): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    title,
    message,
    type,
    priority,
    createdAt: Timestamp.now(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    isActive: true,
    readBy: []
  });
  return docRef.id;
};

// Bütün bildirişləri al (admin üçün)
export const getAllB2BNotifications = async (): Promise<B2BNotification[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as B2BNotification[];
    
    // Prioritet və tarixə görə sırala
    return notifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Aktiv bildirişləri al (B2B müştəri üçün)
export const getActiveB2BNotifications = async (userEmail?: string): Promise<B2BNotification[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const now = new Date();
    
    const notifications = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((notif: any) => {
        // Aktiv olmalıdır
        if (notif.isActive === false) return false;
        // Bitmə tarixi yoxdursa və ya hələ bitmyibsə göstər
        if (!notif.expiresAt) return true;
        const expiresDate = notif.expiresAt.toDate ? notif.expiresAt.toDate() : new Date(notif.expiresAt);
        return expiresDate > now;
      }) as B2BNotification[];
    
    // Prioritet və tarixə görə sırala
    return notifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error('Error getting active notifications:', error);
    return [];
  }
};

// Real-time aktiv bildirişləri dinlə
export const subscribeToActiveNotifications = (
  userEmail: string,
  callback: (notifications: B2BNotification[]) => void
): (() => void) => {
  const q = query(collection(db, COLLECTION_NAME));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const now = new Date();
    
    const notifications = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((notif: any) => {
        if (notif.isActive === false) return false;
        if (!notif.expiresAt) return true;
        const expiresDate = notif.expiresAt.toDate ? notif.expiresAt.toDate() : new Date(notif.expiresAt);
        return expiresDate > now;
      }) as B2BNotification[];
    
    // Prioritet və tarixə görə sırala
    const sorted = notifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    callback(sorted);
  });
  
  return unsubscribe;
};

// Bildirişi oxunmuş kimi işarələ
export const markNotificationAsRead = async (notificationId: string, userEmail: string): Promise<void> => {
  try {
    const notifRef = doc(db, COLLECTION_NAME, notificationId);
    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', notificationId)));
    
    if (!snapshot.empty) {
      const notifData = snapshot.docs[0].data();
      const readBy = notifData.readBy || [];
      
      if (!readBy.includes(userEmail)) {
        await updateDoc(notifRef, {
          readBy: [...readBy, userEmail]
        });
      }
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

// Bildirişi sil
export const deleteB2BNotification = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
