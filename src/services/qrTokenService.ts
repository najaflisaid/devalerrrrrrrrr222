import { 
  collection, 
  doc,
  addDoc, 
  getDocs, 
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

export interface QRToken {
  id: string;
  token: string;
  employeeId: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

const COLLECTION = 'qr_tokens';
const TOKEN_VALIDITY_HOURS = 1; // 1 saat

// Yeni QR token yarat
export const generateQRToken = async (employeeId: string): Promise<QRToken> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000);
  
  const token = uuidv4();
  
  const qrToken = {
    token,
    employeeId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true
  };
  
  const docRef = await addDoc(collection(db, COLLECTION), qrToken);
  
  return {
    id: docRef.id,
    ...qrToken
  };
};

// Token-i yoxla
export const validateQRToken = async (token: string): Promise<{ valid: boolean; employeeId?: string; message: string }> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token),
      where('isActive', '==', true),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { valid: false, message: 'Token tapılmadı və ya deaktiv edilib' };
    }
    
    const tokenDoc = querySnapshot.docs[0];
    const tokenData = tokenDoc.data() as Omit<QRToken, 'id'>;
    
    // Vaxt yoxlaması
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);
    
    if (now > expiresAt) {
      // Token köhnəlib - deaktiv et
      await updateDoc(tokenDoc.ref, { isActive: false });
      return { valid: false, message: 'Token vaxtı keçib (1 saatdan çox)' };
    }
    
    return { 
      valid: true, 
      employeeId: tokenData.employeeId,
      message: 'Token keçərlidir' 
    };
    
  } catch (error) {
    console.error('Token yoxlama xətası:', error);
    return { valid: false, message: 'Token yoxlanarkən xəta baş verdi' };
  }
};

// Aktiv token-i al (əgər varsa)
export const getActiveToken = async (employeeId: string): Promise<QRToken | null> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('employeeId', '==', employeeId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const tokenData = doc.data() as Omit<QRToken, 'id'>;
    
    // Vaxt yoxla
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);
    
    if (now > expiresAt) {
      // Köhnə token - deaktiv et
      await updateDoc(doc.ref, { isActive: false });
      return null;
    }
    
    return {
      id: doc.id,
      ...tokenData
    };
    
  } catch (error) {
    console.error('Aktiv token alma xətası:', error);
    return null;
  }
};

// Token-i deaktiv et
export const deactivateToken = async (tokenId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION, tokenId);
  await updateDoc(docRef, { isActive: false });
};

// Köhnə token-ləri təmizlə (optional - cleanup job)
export const cleanupExpiredTokens = async (): Promise<number> => {
  const now = new Date();
  const q = query(
    collection(db, COLLECTION),
    where('isActive', '==', true)
  );
  
  const querySnapshot = await getDocs(q);
  let cleaned = 0;
  
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      await updateDoc(docSnap.ref, { isActive: false });
      cleaned++;
    }
  }
  
  return cleaned;
};
