import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AttendanceRequest } from '../types/worker';
import { checkIn, checkOut } from './attendanceService';

const COLLECTION_NAME = 'attendance_requests';

// Yeni sorğu yarat
export const createAttendanceRequest = async (
  isciID: string,
  isciAd: string,
  isciSoyad: string,
  nov: 'giris' | 'cixis'
): Promise<string> => {
  const today = new Date().toISOString().split('T')[0];
  
  // Eyni gün eyni növ sorğu varsa yoxla
  const existingQuery = query(
    collection(db, COLLECTION_NAME),
    where('isciID', '==', isciID),
    where('tarix', '==', today),
    where('nov', '==', nov),
    where('status', '==', 'gozlemede')
  );
  
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Artıq gözləmədə olan sorğunuz var');
  }
  
  const requestData: Omit<AttendanceRequest, 'id'> = {
    isciID,
    isciAd,
    isciSoyad,
    nov,
    tarix: today,
    sorguVaxti: new Date().toISOString(),
    status: 'gozlemede',
    createdAt: new Date().toISOString()
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), requestData);
  return docRef.id;
};

// Gözləmədə olan sorğuları al (Admin üçün)
export const getPendingRequests = async (): Promise<AttendanceRequest[]> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('status', '==', 'gozlemede')
  );
  
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AttendanceRequest[];
  
  // Client-side sort
  return requests.sort((a, b) => 
    new Date(b.sorguVaxti).getTime() - new Date(a.sorguVaxti).getTime()
  );
};

// Real-time gözləmədə olan sorğuları dinlə
export const subscribeToPendingRequests = (
  callback: (requests: AttendanceRequest[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('status', '==', 'gozlemede')
  );
  
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceRequest[];
    
    // Client-side sort
    const sortedRequests = requests.sort((a, b) => 
      new Date(b.sorguVaxti).getTime() - new Date(a.sorguVaxti).getTime()
    );
    callback(sortedRequests);
  }, (error) => {
    console.error('Sorğu dinləmə xətası:', error);
    callback([]);
  });
};

// İşçinin öz sorğularını dinlə
export const subscribeToMyRequests = (
  isciID: string,
  callback: (requests: AttendanceRequest[]) => void
): Unsubscribe => {
  const today = new Date().toISOString().split('T')[0];
  
  const q = query(
    collection(db, COLLECTION_NAME),
    where('isciID', '==', isciID),
    where('tarix', '==', today)
  );
  
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceRequest[];
    
    // Client-side sort
    const sortedRequests = requests.sort((a, b) => 
      new Date(b.sorguVaxti).getTime() - new Date(a.sorguVaxti).getTime()
    );
    callback(sortedRequests);
  }, (error) => {
    console.error('Sorğu dinləmə xətası:', error);
    callback([]);
  });
};

// Sorğunu təsdiq et
export const approveRequest = async (requestId: string, adminQeyd?: string): Promise<void> => {
  const requestRef = doc(db, COLLECTION_NAME, requestId);
  
  // Sorğu məlumatını al
  const requestsQuery = query(
    collection(db, COLLECTION_NAME),
    where('status', '==', 'gozlemede')
  );
  const snapshot = await getDocs(requestsQuery);
  const requestDoc = snapshot.docs.find(d => d.id === requestId);
  
  if (!requestDoc) {
    throw new Error('Sorğu tapılmadı');
  }
  
  const requestData = requestDoc.data() as AttendanceRequest;
  
  // Davamiyyəti qeyd et
  if (requestData.nov === 'giris') {
    await checkIn(requestData.isciID);
  } else {
    await checkOut(requestData.isciID);
  }
  
  // Sorğunu yenilə
  await updateDoc(requestRef, {
    status: 'tesdiq',
    adminQeyd: adminQeyd || '',
    cavabVaxti: new Date().toISOString()
  });
};

// Sorğunu ləğv et
export const rejectRequest = async (requestId: string, adminQeyd?: string): Promise<void> => {
  const requestRef = doc(db, COLLECTION_NAME, requestId);
  
  await updateDoc(requestRef, {
    status: 'legv',
    adminQeyd: adminQeyd || '',
    cavabVaxti: new Date().toISOString()
  });
};

// Bugünkü gözləmədə olan sorğu sayı
export const getPendingRequestCount = async (): Promise<number> => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('status', '==', 'gozlemede')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// İşçinin bugünkü sorğu statusu
export const getMyTodayRequestStatus = async (
  isciID: string,
  nov: 'giris' | 'cixis'
): Promise<AttendanceRequest | null> => {
  const today = new Date().toISOString().split('T')[0];
  
  const q = query(
    collection(db, COLLECTION_NAME),
    where('isciID', '==', isciID),
    where('tarix', '==', today),
    where('nov', '==', nov)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  // Ən son sorğunu qaytar
  const requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AttendanceRequest[];
  
  return requests.sort((a, b) => 
    new Date(b.sorguVaxti).getTime() - new Date(a.sorguVaxti).getTime()
  )[0];
};
