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
  try {
    console.log('🔵 QR Token yaradılır...', employeeId);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000);
    
    const token = uuidv4();
    console.log('🔵 Token generated:', token);
    
    const qrToken = {
      token,
      employeeId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true
    };
    
    console.log('🔵 Firestore-a yazılır:', qrToken);
    const docRef = await addDoc(collection(db, COLLECTION), qrToken);
    console.log('✅ Token yaradıldı! Doc ID:', docRef.id);
    
    return {
      id: docRef.id,
      ...qrToken
    };
  } catch (error) {
    console.error('❌ Token yaratma xətası:', error);
    throw error;
  }
};

// Token-i yoxla
export const validateQRToken = async (token: string): Promise<{ valid: boolean; employeeId?: string; message: string }> => {
  try {
    console.log('🔍 Token yoxlanılır:', token);
    
    // Sadə query - index problemi olmasın
    const allTokensQuery = query(collection(db, COLLECTION));
    const querySnapshot = await getDocs(allTokensQuery);
    
    console.log('📊 Toplam token sayı:', querySnapshot.size);
    
    // Manual filter
    let tokenDoc = null;
    let tokenData = null;
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      console.log('Yoxlanılır:', data.token === token, data.isActive);
      
      if (data.token === token && data.isActive) {
        tokenDoc = doc;
        tokenData = data;
        break;
      }
    }
    
    if (!tokenDoc || !tokenData) {
      console.log('❌ Token tapılmadı');
      return { valid: false, message: 'Token tapılmadı və ya deaktiv edilib' };
    }
    
    console.log('✅ Token tapıldı:', tokenData);
    
    // Vaxt yoxlaması
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);
    
    console.log('⏰ İndi:', now.toISOString());
    console.log('⏰ Bitmə:', expiresAt.toISOString());
    
    if (now > expiresAt) {
      console.log('❌ Token vaxtı keçib');
      await updateDoc(tokenDoc.ref, { isActive: false });
      return { valid: false, message: 'Token vaxtı keçib (1 saatdan çox)' };
    }
    
    console.log('✅ Token keçərlidir!');
    return { 
      valid: true, 
      employeeId: tokenData.employeeId,
      message: 'Token keçərlidir' 
    };
    
  } catch (error) {
    console.error('❌ Token yoxlama xətası:', error);
    return { valid: false, message: 'Token yoxlanarkən xəta baş verdi: ' + (error as Error).message };
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
