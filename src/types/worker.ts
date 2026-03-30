// İşçi İdarəetmə Sistemi - Type Definitions

export interface Employee {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  telefon: string;
  vezife: string; // vəzifə
  magaza: string; // mağaza
  iseGirisTarixi: string; // işə giriş tarixi
  foto?: string;
  aktiv: boolean;
  mezuniyyetQaligi: number; // məzuniyyət qalığı (gün)
  createdAt: string;
}

export interface Attendance {
  id: string;
  isciID: string; // işçi ID
  tarix: string; // format: YYYY-MM-DD
  girisSaati?: string; // giriş saatı (timestamp)
  cixisSaati?: string; // çıxış saatı (timestamp)
  gecikme: number; // gecikmə (dəqiqə)
  erkenCixis: number; // erkən çıxış (dəqiqə)
  isSaati: number; // iş saatı (dəqiqə)
  qeyd?: string;
  status: 'isde' | 'cixib' | 'icazeli' | 'mezuniyyet'; // işdə, çıxıb, icazəli, məzuniyyət
  createdAt: string;
}

export interface Behavior {
  id: string;
  isciID: string;
  tarix: string;
  nov: 'xeberdarliq' | 'tohmet' | 'tesekkur' | 'cerime'; // xəbərdarlıq, töhmət, təşəkkür, cərimə
  sebeb: string; // səbəb
  qeyd: string;
  manager: string;
  balTesiri: number; // bal təsiri (-10, -20, +5, +10)
  mebleg?: number; // cərimə məbləği (AZN)
  createdAt: string;
}

export interface Performance {
  id: string;
  isciID: string;
  ay: string; // format: YYYY-MM
  davamiyyetBali: number; // 0-30
  satisBali: number; // 0-40
  intizamBali: number; // 0-20
  aktivlikBali: number; // 0-10
  umumi: number; // ümumi bal (0-100)
  reytinq: number; // 1-7
  hesablanmaTarixi: string;
}

export interface Bonus {
  id: string;
  isciID: string;
  ay: string;
  mebleg: number; // məbləğ
  sebeb: string;
  performansBali: number;
  status: 'gozlemede' | 'tesdiq' | 'odenilib'; // gözləmədə, təsdiq, ödənilib
  createdAt: string;
}

export interface Badge {
  id: string;
  isciID: string;
  nov: '30gun_gecikme_yox' | 'tam_davamiyyet' | 'satis_lideri' | 'ayin_iscisi' | 'intizam_numunesi';
  ad: string;
  icon: string;
  qazanilmaTarixi: string; // qazanılma tarixi
  aktiv: boolean;
}

export interface Sale {
  id: string;
  isciID: string;
  tarix: string;
  mebleg: number;
  mehsulSayi: number; // məhsul sayı
  qeyd?: string;
  createdAt: string;
}

export interface WorkerStats {
  buAyIsSaati: number;
  gecikmeSayi: number;
  performansBali: number;
  bonusMeblegi: number;
  reytinq: number;
  mezuniyyetQaligi: number;
  bugunStatus: string;
  satisHedefineFaiz: number;
  badges: Badge[];
}

export interface AdminDashboardStats {
  bugunIsde: number;
  bugunGecikenler: number;
  bugunIcazeli: number;
  umumi_isci: number; // ümumi işçi
  ortalamaDavamiyyet: number; // ortalama davamiyyət %
  ortalamaPerformans: number; // ortalama performans
  buAyToplamBonus: number;
}

export interface RealtimeWorker {
  isci: Employee;
  bugunDavamiyyet?: Attendance;
  performans?: Performance;
  status: 'isde' | 'yoxdur' | 'gecikmeli' | 'icazeli';
  statusText: string;
}
