import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [logs, setLogs] = useState<Array<{ type: 'success' | 'error' | 'info', message: string }>>([]);

  const addLog = (type: 'success' | 'error' | 'info', message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };

  const runSetup = async () => {
    setStatus('running');
    setLogs([]);
    addLog('info', '🚀 Setup başladı...');

    try {
      // 1. Admin hesabı
      addLog('info', '1️⃣ Admin hesabı yaradılır...');
      try {
        await createUserWithEmailAndPassword(auth, 'admin@devaleur.az', 'Admin123!');
        addLog('success', '✅ Admin hesabı yaradıldı: admin@devaleur.az');
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          addLog('info', 'ℹ️ Admin hesabı artıq mövcuddur');
        } else {
          addLog('error', `❌ Admin xətası: ${error.message}`);
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
        addLog('info', `${i + 2}️⃣ İşçi yaradılır: ${worker.ad} ${worker.soyad}...`);
        
        try {
          // Firebase Auth-da hesab yarat
          addLog('info', `  → Auth hesabı yaradılır...`);
          const userCredential = await createUserWithEmailAndPassword(auth, worker.email, worker.password);
          addLog('success', `  ✓ Auth UID: ${userCredential.user.uid}`);
          
          // Firestore-da işçi məlumatı yarat
          addLog('info', `  → Firestore-da məlumat yazılır...`);
          const employeeData = {
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
          };
          
          const docRef = await addDoc(collection(db, 'employees'), employeeData);
          addLog('success', `  ✓ Firestore Doc ID: ${docRef.id}`);
          addLog('success', `✅ ${worker.ad} ${worker.soyad} tam yaradıldı`);
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            addLog('info', `ℹ️ ${worker.email} Auth-da artıq var`);
            
            // Yenə də Firestore-a yazmağa cəhd et
            try {
              addLog('info', `  → Firestore-a yenidən yazılır...`);
              const employeeData = {
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
              };
              
              const docRef = await addDoc(collection(db, 'employees'), employeeData);
              addLog('success', `  ✓ Firestore-a yazıldı: ${docRef.id}`);
            } catch (fsError: any) {
              addLog('error', `  ✗ Firestore xətası: ${fsError.message}`);
            }
          } else {
            addLog('error', `❌ Xəta: ${error.code} - ${error.message}`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      addLog('success', '✨ Setup tamamlandı!');
      setStatus('done');

    } catch (error: any) {
      addLog('error', `❌ Ümumi xəta: ${error.message}`);
      setStatus('done');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            İşçi Sistemi Setup
          </h1>
          <p className="text-gray-600">
            Test hesabları və məlumatları yaradın
          </p>
        </div>

        {status === 'idle' && (
          <div className="text-center space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-3">Yaradılacaq hesablar:</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>✅ <strong>Admin:</strong> admin@devaleur.az / Admin123!</p>
                <p>✅ <strong>İşçi 1:</strong> aysel.mammadova@devaleur.az / Test123!</p>
                <p>✅ <strong>İşçi 2:</strong> elvin.hasanov@devaleur.az / Test123!</p>
                <p>✅ <strong>İşçi 3:</strong> leyla.aliyeva@devaleur.az / Test123!</p>
              </div>
            </div>

            <button
              onClick={runSetup}
              className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors"
            >
              Setup Başlat
            </button>
          </div>
        )}

        {status === 'running' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-indigo-600 mb-6">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-semibold">Hesablar yaradılır...</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={`py-2 ${
                  log.type === 'error' ? 'text-red-600' :
                  log.type === 'success' ? 'text-green-600' :
                  'text-gray-700'
                }`}>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Setup Tamamlandı!</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={`py-2 ${
                  log.type === 'error' ? 'text-red-600' :
                  log.type === 'success' ? 'text-green-600' :
                  'text-gray-700'
                }`}>
                  {log.message}
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h4 className="font-semibold text-green-900 mb-3">İndi nə edə bilərsiniz?</h4>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/workers/admin-login')}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                >
                  Admin Girişi
                </button>
                <button
                  onClick={() => navigate('/workers')}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  İşçi Girişi
                </button>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setStatus('idle');
                  setLogs([]);
                }}
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Yenidən başlat
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Ana səhifəyə qayıt
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
