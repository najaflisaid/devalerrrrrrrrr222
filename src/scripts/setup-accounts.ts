import { createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Test hesabları yaratmaq funksiyası
async function createTestAccounts() {
  console.log('🚀 Test hesabları yaradılır...\n');

  try {
    // 1. Admin hesabı
    console.log('1️⃣ Admin hesabı yaradılır...');
    try {
      await createUserWithEmailAndPassword(auth, 'admin@devaleur.az', 'Admin123!');
      console.log('✅ Admin hesabı yaradıldı: admin@devaleur.az / Admin123!\n');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('ℹ️ Admin hesabı artıq mövcuddur\n');
      } else {
        console.error('❌ Admin xətası:', error.message, '\n');
      }
    }

    // 2. İşçi hesabları
    const workers = [
      {
        email: 'aysel.mammadova@devaleur.az',
        password: 'Test123!',
        ad: 'Ayşəl',
        soyad: 'Məmmədova',
        telefon: '+994501234567',
        vezife: 'Satış meneceri',
        magaza: 'Ana mağaza',
        iseGirisTarixi: '2024-01-15',
        mezuniyyetQaligi: 20
      },
      {
        email: 'elvin.hasanov@devaleur.az',
        password: 'Test123!',
        ad: 'Elvin',
        soyad: 'Həsənov',
        telefon: '+994502345678',
        vezife: 'Kassir',
        magaza: 'Ana mağaza',
        iseGirisTarixi: '2024-02-01',
        mezuniyyetQaligi: 18
      },
      {
        email: 'leyla.aliyeva@devaleur.az',
        password: 'Test123!',
        ad: 'Leyla',
        soyad: 'Əliyeva',
        telefon: '+994503456789',
        vezife: 'Satış məsləhətçisi',
        magaza: 'Ana mağaza',
        iseGirisTarixi: '2024-03-10',
        mezuniyyetQaligi: 22
      }
    ];

    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      console.log(`${i + 2}️⃣ İşçi yaradılır: ${worker.ad} ${worker.soyad}...`);
      
      try {
        // Firebase Auth-da hesab yarat
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          worker.email, 
          worker.password
        );
        
        // Firestore-da işçi məlumatı yarat
        await addDoc(collection(db, 'employees'), {
          ad: worker.ad,
          soyad: worker.soyad,
          email: worker.email,
          telefon: worker.telefon,
          vezife: worker.vezife,
          magaza: worker.magaza,
          iseGirisTarixi: worker.iseGirisTarixi,
          aktiv: true,
          mezuniyyetQaligi: worker.mezuniyyetQaligi,
          createdAt: new Date().toISOString()
        });
        
        console.log(`✅ Yaradıldı: ${worker.email} / ${worker.password}\n`);
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`ℹ️ ${worker.email} artıq mövcuddur\n`);
        } else {
          console.error(`❌ Xəta:`, error.message, '\n');
        }
      }
      
      // Rate limit-dən qaçmaq üçün gözlə
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ Proses tamamlandı!\n');
    console.log('📋 TEST HESABLARI:');
    console.log('==================\n');
    console.log('ADMIN:');
    console.log('Email: admin@devaleur.az');
    console.log('Password: Admin123!\n');
    console.log('İŞÇİLƏR:');
    workers.forEach((w, i) => {
      console.log(`${i + 1}. ${w.ad} ${w.soyad}`);
      console.log(`   Email: ${w.email}`);
      console.log(`   Password: ${w.password}\n`);
    });
    
    console.log('🔗 GİRİŞ LİNKLƏRİ:');
    console.log('Admin: http://localhost:3000/workers/admin-login');
    console.log('İşçi: http://localhost:3000/workers\n');

  } catch (error) {
    console.error('❌ Ümumi xəta:', error);
  }
}

// Export
export default createTestAccounts;

// Əgər birbaşa çalışdırılırsa
if (typeof window !== 'undefined') {
  console.log('Setup script hazırdır. Browser console-da çağırın:');
  console.log('import("/src/scripts/setup-accounts.ts").then(m => m.default())');
}
