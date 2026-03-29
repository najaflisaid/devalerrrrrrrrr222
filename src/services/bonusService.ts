import { 
  collection, 
  getDocs, 
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bonus } from '../types/worker';

const COLLECTION = 'bonuses';

// Bonus əlavə et
export const addBonus = async (bonus: Omit<Bonus, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...bonus,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// İşçinin bonusları
export const getEmployeeBonuses = async (isciID: string): Promise<Bonus[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    orderBy('ay', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Bonus));
};

// Aylıq bonus
export const getMonthlyBonus = async (isciID: string, yearMonth: string): Promise<Bonus | null> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('ay', '==', yearMonth)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Bonus;
  }
  return null;
};

// Bonus hesabla (performansa görə)
export const calculateBonus = async (
  isciID: string,
  ay: string,
  performansBali: number
): Promise<number> => {
  let mebleg = 0;
  let sebeb = '';
  
  if (performansBali >= 95) {
    mebleg = 1000; // Super premium
    sebeb = 'Əla performans! Ayın işçisi!';
  } else if (performansBali >= 90) {
    mebleg = 750; // Premium
    sebeb = 'Çox yaxşı performans!';
  } else if (performansBali >= 80) {
    mebleg = 500; // Standart
    sebeb = 'Yaxşı performans!';
  }
  
  if (mebleg > 0) {
    await addBonus({
      isciID,
      ay,
      mebleg,
      sebeb,
      performansBali,
      status: 'gozlemede'
    });
  }
  
  return mebleg;
};

// Bütün bonuslar (Admin)
export const getAllBonuses = async (yearMonth: string): Promise<Bonus[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('ay', '==', yearMonth),
    orderBy('mebleg', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Bonus));
};
