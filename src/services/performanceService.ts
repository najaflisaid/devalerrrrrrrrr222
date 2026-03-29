import { 
  collection, 
  doc, 
  getDocs, 
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Performance } from '../types/worker';
import { getMonthlyAttendance } from './attendanceService';
import { getMonthlyBehaviors } from './behaviorService';
import { getMonthlySales } from './salesService';

const COLLECTION = 'performance';

// Performans əlavə et
export const addPerformance = async (performance: Omit<Performance, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), performance);
  return docRef.id;
};

// İşçinin performansını al
export const getEmployeePerformance = async (isciID: string, yearMonth: string): Promise<Performance | null> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('ay', '==', yearMonth),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Performance;
  }
  return null;
};

// Son performansı al
export const getLatestPerformance = async (isciID: string): Promise<Performance | null> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    orderBy('ay', 'desc'),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Performance;
  }
  return null;
};

// Aylıq performans hesabla
export const calculateMonthlyPerformance = async (
  isciID: string, 
  yearMonth: string,
  satisHedfi: number = 50000 // Satış hədəfi (default)
): Promise<Performance> => {
  // 1. Davamiyyət balı (30%)
  const attendances = await getMonthlyAttendance(isciID, yearMonth);
  const isGunleri = attendances.filter(a => a.status === 'isde' || a.status === 'cixib').length;
  const gecikmeler = attendances.filter(a => a.gecikme > 0).length;
  const toplamIsGunu = 22; // Aylıq iş günü (ortalama)
  
  let davamiyyetBali = (isGunleri / toplamIsGunu) * 30;
  davamiyyetBali -= (gecikmeler * 0.5); // Hər gecikmə -0.5 bal
  davamiyyetBali = Math.max(0, Math.min(30, davamiyyetBali));
  
  // 2. Satış balı (40%)
  const sales = await getMonthlySales(isciID, yearMonth);
  const toplamSatis = sales.reduce((sum, sale) => sum + sale.mebleg, 0);
  const satisFaizi = (toplamSatis / satisHedfi) * 100;
  let satisBali = (satisFaizi / 100) * 40;
  satisBali = Math.max(0, Math.min(40, satisBali));
  
  // 3. İntizam balı (20%)
  const behaviors = await getMonthlyBehaviors(isciID, yearMonth);
  let intizamBali = 20; // Başlanğıc
  behaviors.forEach(b => {
    intizamBali += b.balTesiri;
  });
  intizamBali = Math.max(0, Math.min(20, intizamBali));
  
  // 4. Aktivlik balı (10%) - Default 8
  const aktivlikBali = 8;
  
  // Ümumi bal
  const umumi = Math.round(davamiyyetBali + satisBali + intizamBali + aktivlikBali);
  
  const performance: Omit<Performance, 'id'> = {
    isciID,
    ay: yearMonth,
    davamiyyetBali: Math.round(davamiyyetBali * 10) / 10,
    satisBali: Math.round(satisBali * 10) / 10,
    intizamBali: Math.round(intizamBali * 10) / 10,
    aktivlikBali,
    umumi,
    reytinq: 0, // Sonra hesablanacaq
    hesablanmaTarixi: new Date().toISOString()
  };
  
  // Performansı saxla
  const existing = await getEmployeePerformance(isciID, yearMonth);
  if (existing) {
    const docRef = doc(db, COLLECTION, existing.id);
    await updateDoc(docRef, performance);
    return { ...performance, id: existing.id };
  } else {
    const id = await addPerformance(performance);
    return { ...performance, id };
  }
};

// Reytinq hesabla (bütün işçilər üçün)
export const calculateRatings = async (yearMonth: string): Promise<void> => {
  const q = query(
    collection(db, COLLECTION),
    where('ay', '==', yearMonth),
    orderBy('umumi', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const performances = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Performance));
  
  // Reytinq 1-7
  for (let i = 0; i < performances.length; i++) {
    const perf = performances[i];
    const reytinq = Math.min(i + 1, 7);
    
    const docRef = doc(db, COLLECTION, perf.id);
    await updateDoc(docRef, { reytinq });
  }
};

// Bütün performanslar (Admin)
export const getAllPerformances = async (yearMonth: string): Promise<Performance[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('ay', '==', yearMonth),
    orderBy('umumi', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Performance));
};
