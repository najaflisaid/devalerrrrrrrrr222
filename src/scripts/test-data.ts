// Test Dataları Yaratmaq üçün Script
// Firebase Console-da çalışdırılmalıdır və ya ayrıca Node.js script kimi

/*
QEYD: Bu script Firebase Admin SDK ilə işləyir.
Əvvəlcə Firebase Console-dan aşağıdakı addımları edin:

1. Admin hesabı yaradın:
   Email: admin@devaleur.az
   Password: Admin123!
   
2. Test işçiləri yaradın Firebase Authentication-da:

   a) İşçi 1:
      Email: aysel.mammadova@devaleur.az
      Password: Test123!
      
   b) İşçi 2:
      Email: elvin.hasanov@devaleur.az
      Password: Test123!
      
   c) İşçi 3:
      Email: leyla.aliyeva@devaleur.az
      Password: Test123!

3. Sonra Firestore-da employees collection-da aşağıdakı məlumatları əl ilə əlavə edin:

employees collection:
[
  {
    id: "auto-generated",
    ad: "Ayşəl",
    soyad: "Məmmədova",
    email: "aysel.mammadova@devaleur.az",
    telefon: "+994501234567",
    vezife: "Satış meneceri",
    magaza: "Ana mağaza",
    iseGirisTarixi: "2024-01-15",
    aktiv: true,
    mezuniyyetQaligi: 20,
    createdAt: "2024-01-15T00:00:00.000Z"
  },
  {
    id: "auto-generated",
    ad: "Elvin",
    soyad: "Həsənov",
    email: "elvin.hasanov@devaleur.az",
    telefon: "+994502345678",
    vezife: "Kassir",
    magaza: "Ana mağaza",
    iseGirisTarixi: "2024-02-01",
    aktiv: true,
    mezuniyyetQaligi: 18,
    createdAt: "2024-02-01T00:00:00.000Z"
  },
  {
    id: "Leyla",
    soyad: "Əliyeva",
    email: "leyla.aliyeva@devaleur.az",
    telefon: "+994503456789",
    vezife: "Satış məsləhətçisi",
    magaza: "Ana mağaza",
    iseGirisTarixi: "2024-03-10",
    aktiv: true,
    mezuniyyetQaligi: 22,
    createdAt: "2024-03-10T00:00:00.000Z"
  }
]

4. Növbəti addımlar:
   - İşçilər sistemə daxil olaraq check-in/check-out edə bilərlər
   - Admin panel-dən performans hesablamaq olar
   - Davranış qeydləri əlavə etmək olar
   - Bonuslar avtomatik hesablanacaq

TEST HESABLARI:
================

ADMIN:
Email: admin@devaleur.az
Password: Admin123!

İŞÇİLƏR:
1. Ayşəl Məmmədova
   Email: aysel.mammadova@devaleur.az
   Password: Test123!

2. Elvin Həsənov
   Email: elvin.hasanov@devaleur.az
   Password: Test123!

3. Leyla Əliyeva
   Email: leyla.aliyeva@devaleur.az
   Password: Test123!

SİSTEM LİNKLƏRİ:
================
- İşçi girişi: /workers
- Admin girişi: /workers/admin-login
- İşçi dashboard: /workers/dashboard
- Admin panel: /workers/admin

NOT: Firebase Authentication və Firestore artıq qurulub və işləyir.
Yuxarıdakı test hesablarını Firebase Console-dan yaradın.
*/

console.log('Test hesabları yaratmaq üçün yuxarıdakı təlimatları izləyin.');

export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@devaleur.az',
    password: 'Admin123!'
  },
  workers: [
    {
      email: 'aysel.mammadova@devaleur.az',
      password: 'Test123!',
      ad: 'Ayşəl',
      soyad: 'Məmmədova'
    },
    {
      email: 'elvin.hasanov@devaleur.az',
      password: 'Test123!',
      ad: 'Elvin',
      soyad: 'Həsənov'
    },
    {
      email: 'leyla.aliyeva@devaleur.az',
      password: 'Test123!',
      ad: 'Leyla',
      soyad: 'Əliyeva'
    }
  ]
};
