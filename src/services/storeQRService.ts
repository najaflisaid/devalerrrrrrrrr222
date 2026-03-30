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

export interface StoreQRToken {
  id: string;
  token: string;
  magaza: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  usedBy: string[]; // Bu token-i istifadə edən işçilərin ID-ləri
}

const COLLECTION = 'store_qr_tokens';
const TOKEN_VALIDITY_HOURS = 1; // 1 saat

// Mağaza üçün yeni QR token yarat
export const generateStoreQRToken = async (magaza: string): Promise<StoreQRToken> => {
  try {
    // Əvvəlki aktiv tokenləri deaktiv et
    await deactivateOldStoreTokens(magaza);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000);
    
    const token = `STORE_${magaza.replace(/\s+/g, '_')}_${uuidv4()}`;
    
    const qrToken = {
      token,
      magaza,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      usedBy: []
    };
    
    const docRef = await addDoc(collection(db, COLLECTION), qrToken);
    
    return {
      id: docRef.id,
      ...qrToken
    };
  } catch (error) {
    console.error('Store QR Token yaratma xətası:', error);
    throw error;
  }
};

// Köhnə tokenləri deaktiv et
const deactivateOldStoreTokens = async (magaza: string): Promise<void> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('magaza', '==', magaza),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      await updateDoc(docSnap.ref, { isActive: false });
    }
  } catch (error) {
    console.error('Köhnə tokenləri deaktiv etmə xətası:', error);
  }
};

// Mağazanın aktiv QR token-ini al
export const getActiveStoreToken = async (magaza: string): Promise<StoreQRToken | null> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('magaza', '==', magaza),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Vaxt yoxla
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      await updateDoc(doc.ref, { isActive: false });
      return null;
    }
    
    return {
      id: doc.id,
      ...data
    } as StoreQRToken;
  } catch (error) {
    console.error('Aktiv store token alma xətası:', error);
    return null;
  }
};

// QR token-i yoxla və işçini qeyd et
export const validateStoreQRToken = async (
  token: string, 
  employeeId: string,
  action: 'checkin' | 'checkout'
): Promise<{ valid: boolean; message: string; magaza?: string }> => {
  try {
    // Bütün tokenləri al
    const snapshot = await getDocs(collection(db, COLLECTION));
    
    let tokenDoc = null;
    let tokenData = null;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.token === token && data.isActive) {
        tokenDoc = doc;
        tokenData = data;
        break;
      }
    }
    
    if (!tokenDoc || !tokenData) {
      return { valid: false, message: 'QR kod tapılmadı və ya keçərsizdir' };
    }
    
    // Vaxt yoxla
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);
    
    if (now > expiresAt) {
      await updateDoc(tokenDoc.ref, { isActive: false });
      return { valid: false, message: 'QR kod vaxtı keçib. Yeni QR kod tələb edin.' };
    }
    
    // Giriş üçün: eyni işçi eyni QR ilə 2 dəfə giriş edə bilməz
    if (action === 'checkin') {
      const usedBy = tokenData.usedBy || [];
      if (usedBy.includes(employeeId)) {
        return { valid: false, message: 'Bu QR kod ilə artıq giriş etmisiniz' };
      }
      
      // İşçini qeyd et
      await updateDoc(tokenDoc.ref, {
        usedBy: [...usedBy, employeeId]
      });
    }
    
    return { 
      valid: true, 
      message: action === 'checkin' ? 'Giriş uğurlu!' : 'Çıxış uğurlu!',
      magaza: tokenData.magaza
    };
    
  } catch (error) {
    console.error('Store QR validation xətası:', error);
    return { valid: false, message: 'QR yoxlanarkən xəta baş verdi' };
  }
};

// Token-in qalan vaxtını al (dəqiqə)
export const getTokenRemainingTime = (expiresAt: string): number => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / 60000));
};
