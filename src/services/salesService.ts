import { 
  collection, 
  getDocs, 
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sale } from '../types/worker';

const COLLECTION = 'sales';

// Satış əlavə et
export const addSale = async (sale: Omit<Sale, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...sale,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// İşçinin satışları
export const getEmployeeSales = async (isciID: string): Promise<Sale[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    orderBy('tarix', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Sale));
};

// Aylıq satışlar
export const getMonthlySales = async (isciID: string, yearMonth: string): Promise<Sale[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('tarix', '>=', `${yearMonth}-01`),
    where('tarix', '<=', `${yearMonth}-31`),
    orderBy('tarix', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Sale));
};

// Bugünkü satışlar
export const getTodaySales = async (isciID: string): Promise<Sale[]> => {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('tarix', '==', today)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Sale));
};
