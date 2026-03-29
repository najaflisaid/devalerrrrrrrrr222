import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee } from '../types/worker';

const COLLECTION = 'employees';

// İşçi əlavə et
export const addEmployee = async (employee: Omit<Employee, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...employee,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// İşçi yenilə
export const updateEmployee = async (id: string, data: Partial<Employee>): Promise<void> => {
  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, data);
};

// İşçi sil
export const deleteEmployee = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTION, id);
  await deleteDoc(docRef);
};

// İşçi məlumatını al
export const getEmployee = async (id: string): Promise<Employee | null> => {
  const docRef = doc(db, COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Employee;
  }
  return null;
};

// Email ilə işçi tap
export const getEmployeeByEmail = async (email: string): Promise<Employee | null> => {
  const q = query(collection(db, COLLECTION), where('email', '==', email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Employee;
  }
  return null;
};

// Bütün işçiləri al
export const getAllEmployees = async (): Promise<Employee[]> => {
  try {
    // Sadə query - index lazım deyil
    const q = query(collection(db, COLLECTION), where('aktiv', '==', true));
    const querySnapshot = await getDocs(q);
    
    // Memory-də sort et
    const employees = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Employee));
    
    // Əlifba sırası ilə sort
    return employees.sort((a, b) => a.ad.localeCompare(b.ad, 'az'));
  } catch (error) {
    console.error('getAllEmployees xətası:', error);
    return [];
  }
};

// Mağazaya görə işçilər
export const getEmployeesByMagaza = async (magaza: string): Promise<Employee[]> => {
  try {
    const q = query(
      collection(db, COLLECTION), 
      where('aktiv', '==', true),
      where('magaza', '==', magaza)
    );
    const querySnapshot = await getDocs(q);
    
    const employees = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Employee));
    
    return employees.sort((a, b) => a.ad.localeCompare(b.ad, 'az'));
  } catch (error) {
    console.error('getEmployeesByMagaza xətası:', error);
    return [];
  }
};
