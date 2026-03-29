import { 
  collection, 
  getDocs, 
  addDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Badge } from '../types/worker';
import { getMonthlyAttendance } from './attendanceService';

const COLLECTION = 'badges';

const BADGE_INFO = {
  '30gun_gecikme_yox': {
    ad: '30 Gün Gecikmə Yox',
    icon: '🎯'
  },
  'tam_davamiyyet': {
    ad: '100% Davamiyyət',
    icon: '⭐'
  },
  'satis_lideri': {
    ad: 'Satış Lideri',
    icon: '🏆'
  },
  'ayin_iscisi': {
    ad: 'Ayın İşçisi',
    icon: '👑'
  },
  'intizam_numunesi': {
    ad: 'İntizam Nümunəsi',
    icon: '💎'
  }
};

// Badge əlavə et
export const addBadge = async (badge: Omit<Badge, 'id'>): Promise<string> => {
  // Eyni badge var mı yoxla
  const existing = await getEmployeeBadges(badge.isciID);
  const hasBadge = existing.find(b => b.nov === badge.nov && b.aktiv);
  
  if (hasBadge) {
    return hasBadge.id;
  }
  
  const docRef = await addDoc(collection(db, COLLECTION), badge);
  return docRef.id;
};

// İşçinin badge-ləri
export const getEmployeeBadges = async (isciID: string): Promise<Badge[]> => {
  const q = query(
    collection(db, COLLECTION),
    where('isciID', '==', isciID),
    where('aktiv', '==', true),
    orderBy('qazanilmaTarixi', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Badge));
};

// Badge yoxla və ver
export const checkAndAwardBadges = async (
  isciID: string, 
  yearMonth: string,
  performansBali: number
): Promise<void> => {
  const attendances = await getMonthlyAttendance(isciID, yearMonth);
  
  // 30 Gün Gecikmə Yox
  const gecikmeSayi = attendances.filter(a => a.gecikme > 0).length;
  if (gecikmeSayi === 0 && attendances.length >= 20) {
    await addBadge({
      isciID,
      nov: '30gun_gecikme_yox',
      ad: BADGE_INFO['30gun_gecikme_yox'].ad,
      icon: BADGE_INFO['30gun_gecikme_yox'].icon,
      qazanilmaTarixi: new Date().toISOString(),
      aktiv: true
    });
  }
  
  // 100% Davamiyyət
  const toplamIsGunu = 22;
  if (attendances.length >= toplamIsGunu) {
    await addBadge({
      isciID,
      nov: 'tam_davamiyyet',
      ad: BADGE_INFO['tam_davamiyyet'].ad,
      icon: BADGE_INFO['tam_davamiyyet'].icon,
      qazanilmaTarixi: new Date().toISOString(),
      aktiv: true
    });
  }
  
  // Ayın İşçisi
  if (performansBali >= 95) {
    await addBadge({
      isciID,
      nov: 'ayin_iscisi',
      ad: BADGE_INFO['ayin_iscisi'].ad,
      icon: BADGE_INFO['ayin_iscisi'].icon,
      qazanilmaTarixi: new Date().toISOString(),
      aktiv: true
    });
  }
  
  // İntizam Nümunəsi
  if (performansBali >= 90 && gecikmeSayi === 0) {
    await addBadge({
      isciID,
      nov: 'intizam_numunesi',
      ad: BADGE_INFO['intizam_numunesi'].ad,
      icon: BADGE_INFO['intizam_numunesi'].icon,
      qazanilmaTarixi: new Date().toISOString(),
      aktiv: true
    });
  }
};
