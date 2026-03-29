import { 
  collection, 
  doc, 
  getDocs, 
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Behavior } from '../types/worker';

const COLLECTION = 'behaviors';

// Davranış qeydi əlavə et
export const addBehavior = async (behavior: Omit<Behavior, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...behavior,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// İşçinin davranış tarixçəsi
export const getEmployeeBehaviors = async (isciID: string): Promise<Behavior[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    orderBy('tarix', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Behavior));
};

// Aylıq davranış qeydləri
export const getMonthlyBehaviors = async (isciID: string, yearMonth: string): Promise<Behavior[]> => {
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
  } as Behavior));
};

// Bütün davranış qeydləri (Admin)
export const getAllBehaviors = async (): Promise<Behavior[]> => {
  const q = query(
    collection(db, COLLECTION),
    orderBy('tarix', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Behavior));
};

// Xəbərdarlıq əlavə et
export const addXeberdarliq = async (
  isciID: string, 
  sebeb: string, 
  manager: string, 
  qeyd: string = ''
): Promise<string> => {
  return addBehavior({
    isciID,
    tarix: new Date().toISOString().split('T')[0],
    nov: 'xeberdarliq',
    sebeb,
    qeyd,
    manager,
    balTesiri: -5
  });
};

// Töhmət əlavə et
export const addTohmet = async (
  isciID: string, 
  sebeb: string, 
  manager: string, 
  qeyd: string = ''
): Promise<string> => {
  return addBehavior({
    isciID,
    tarix: new Date().toISOString().split('T')[0],
    nov: 'tohmet',
    sebeb,
    qeyd,
    manager,
    balTesiri: -10
  });
};

// Təşəkkür əlavə et
export const addTesekkur = async (
  isciID: string, 
  sebeb: string, 
  manager: string, 
  qeyd: string = ''
): Promise<string> => {
  return addBehavior({
    isciID,
    tarix: new Date().toISOString().split('T')[0],
    nov: 'tesekkur',
    sebeb,
    qeyd,
    manager,
    balTesiri: 10
  });
};
