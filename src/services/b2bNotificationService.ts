import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc,
  query, 
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface B2BNotification {
  id?: string;
  title: string;
  message: string;
  createdAt: any;
  expiresAt?: any;
  isActive: boolean;
}

const COLLECTION_NAME = 'b2b_notifications';

// Bildiriş əlavə et
export const addB2BNotification = async (title: string, message: string, expiresAt?: Date): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    title,
    message,
    createdAt: Timestamp.now(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    isActive: true
  });
  return docRef.id;
};

// Bütün bildirişləri al (admin üçün)
export const getAllB2BNotifications = async (): Promise<B2BNotification[]> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as B2BNotification[];
};

// Aktiv bildirişləri al (B2B müştəri üçün)
export const getActiveB2BNotifications = async (): Promise<B2BNotification[]> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const now = new Date();
  
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((notif: any) => {
      // Bitmə tarixi yoxdursa və ya hələ bitmyibsə göstər
      if (!notif.expiresAt) return true;
      const expiresDate = notif.expiresAt.toDate ? notif.expiresAt.toDate() : new Date(notif.expiresAt);
      return expiresDate > now;
    }) as B2BNotification[];
};

// Bildirişi sil
export const deleteB2BNotification = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};
