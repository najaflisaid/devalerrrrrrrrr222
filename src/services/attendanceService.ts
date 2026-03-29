import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Attendance } from '../types/worker';

const COLLECTION = 'attendance';

// Bugünkü tarixi al (YYYY-MM-DD)
export const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Giriş et (Check-in)
export const checkIn = async (isciID: string): Promise<string> => {
  const today = getTodayDate();
  const now = new Date();
  
  // Bugünkü davamiyyət var mı yoxla
  const existing = await getTodayAttendance(isciID);
  if (existing) {
    throw new Error('Bu gün artıq giriş edilib');
  }
  
  // Standart iş vaxtı 09:00
  const standardTime = new Date(now);
  standardTime.setHours(9, 0, 0, 0);
  
  // Gecikmə hesabla (dəqiqə)
  const gecikme = now > standardTime 
    ? Math.floor((now.getTime() - standardTime.getTime()) / 60000) 
    : 0;
  
  const attendance: Omit<Attendance, 'id'> = {
    isciID,
    tarix: today,
    girisSaati: now.toISOString(),
    gecikme,
    erkenCixis: 0,
    isSaati: 0,
    status: 'isde',
    createdAt: now.toISOString(),
  };
  
  const docRef = await addDoc(collection(db, COLLECTION), attendance);
  return docRef.id;
};

// Çıxış et (Check-out)
export const checkOut = async (isciID: string): Promise<void> => {
  const today = getTodayDate();
  const now = new Date();
  
  // Bugünkü davamiyyəti tap
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('tarix', '==', today),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    throw new Error('Bu gün giriş edilməyib');
  }
  
  const docRef = querySnapshot.docs[0].ref;
  const data = querySnapshot.docs[0].data();
  
  if (data.cixisSaati) {
    throw new Error('Artıq çıxış edilib');
  }
  
  const girisTime = new Date(data.girisSaati);
  
  // Standart çıxış 18:00
  const standardExitTime = new Date(now);
  standardExitTime.setHours(18, 0, 0, 0);
  
  // Erkən çıxış hesabla
  const erkenCixis = now < standardExitTime
    ? Math.floor((standardExitTime.getTime() - now.getTime()) / 60000)
    : 0;
  
  // İş saatı hesabla (dəqiqə)
  const isSaati = Math.floor((now.getTime() - girisTime.getTime()) / 60000);
  
  await updateDoc(docRef, {
    cixisSaati: now.toISOString(),
    erkenCixis,
    isSaati,
    status: 'cixib'
  });
};

// Bugünkü davamiyyət
export const getTodayAttendance = async (isciID: string): Promise<Attendance | null> => {
  const today = getTodayDate();
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('tarix', '==', today),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Attendance;
  }
  return null;
};

// Aylıq davamiyyət
export const getMonthlyAttendance = async (isciID: string, yearMonth: string): Promise<Attendance[]> => {
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
  } as Attendance));
};

// Son N gün davamiyyət
export const getRecentAttendance = async (isciID: string, days: number = 7): Promise<Attendance[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    orderBy('tarix', 'desc'),
    limit(days)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Attendance));
};

// Bugünkü bütün davamiyyət (Admin üçün)
export const getTodayAllAttendance = async (): Promise<Attendance[]> => {
  const today = getTodayDate();
  const q = query(
    collection(db, COLLECTION),
    where('tarix', '==', today)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Attendance));
};

// İcazəli çıxış əlavə et (Admin)
export const addIcazeliCixis = async (isciID: string, tarix: string, sebeb: string): Promise<void> => {
  const attendance: Omit<Attendance, 'id'> = {
    isciID,
    tarix,
    gecikme: 0,
    erkenCixis: 0,
    isSaati: 0,
    status: 'icazeli',
    qeyd: sebeb,
    createdAt: new Date().toISOString(),
  };
  
  await addDoc(collection(db, COLLECTION), attendance);
};
