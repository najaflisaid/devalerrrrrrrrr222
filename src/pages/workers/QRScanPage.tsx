import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getEmployeeByEmail } from '../../services/employeeService';
import { checkIn, checkOut, getTodayAttendance } from '../../services/attendanceService';
import { Loader2, CheckCircle2, LogIn, Scan } from 'lucide-react';
import SignatureModal from '../../components/workers/SignatureModal';

const QRScanPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = searchParams.get('session');
  
  const [step, setStep] = useState<'login' | 'processing' | 'success' | 'signature'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<'check-in' | 'check-out' | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    if (!session) {
      setError('QR kod keçərsizdir');
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Firebase Auth ile login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Login uğurlu:', userCredential.user.email);
      
      // İşçi məlumatını al
      const employee = await getEmployeeByEmail(email);
      if (!employee) {
        setError('İşçi məlumatı tapılmadı');
        setLoading(false);
        return;
      }
      
      setEmployeeName(`${employee.ad} ${employee.soyad}`);
      setEmployeeId(employee.id);
      
      // Bugünkü davamiyyəti yoxla
      setStep('processing');
      const todayAttendance = await getTodayAttendance(employee.id);
      
      if (!todayAttendance) {
        // Check-in
        setAction('check-in');
        await checkIn(employee.id);
        setMessage(`Xoş gəldiniz! İşə giriş: ${new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`);
        setStep('success');
        
        // 3 saniyə sonra dashboard-a keç
        setTimeout(() => {
          navigate('/workers/dashboard');
        }, 3000);
        
      } else if (todayAttendance.status === 'isde') {
        // Check-out - imza lazımdır
        setAction('check-out');
        setStep('signature');
        
      } else {
        setError('Bu gün artıq çıxış etmisiniz');
        setStep('login');
      }
      
    } catch (err: any) {
      console.error('Login xətası:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email və ya şifrə yanlışdır');
      } else {
        setError('Xəta baş verdi: ' + err.message);
      }
      setStep('login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureSave = async (signature: string) => {
    try {
      setStep('processing');
      
      // Check-out et
      await checkOut(employeeId);
      
      // TODO: İmzanı saxla (attendance-ə signature field əlavə et)
      
      setMessage(`Xudahafiz! İşdən çıxış: ${new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`);
      setStep('success');
      
      // 3 saniyə sonra dashboard-a keç
      setTimeout(() => {
        navigate('/workers/dashboard');
      }, 3000);
      
    } catch (error: any) {
      setError('Çıxış xətası: ' + error.message);
      setStep('signature');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Scan className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">QR Kod Keçərsizdir</h2>
          <p className="text-gray-600">Zəhmət olmasa düzgün QR kodu scan edin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {step === 'login' && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">QR Giriş / Çıxış</h1>
                <p className="text-indigo-100">Email və şifrənizi daxil edin</p>
              </div>

              {/* Form */}
              <div className="p-8">
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="ornek@devaleur.az"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Şifrə
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Gözləyin...' : 'Daxil ol'}
                  </button>
                </form>

                <p className="text-xs text-gray-500 text-center mt-6">
                  QR Session: {session?.substring(0, 8)}...
                </p>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="p-12 text-center">
              <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-900">Əməliyyat yerinə yetirilir...</p>
              <p className="text-gray-600 mt-2">Zəhmət olmasa gözləyin</p>
            </div>
          )}

          {step === 'success' && (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {action === 'check-in' ? 'İşə Giriş Uğurlu!' : 'İşdən Çıxış Uğurlu!'}
              </h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <p className="text-lg font-semibold text-indigo-600">{employeeName}</p>
              <p className="text-sm text-gray-500 mt-4">Dashboard-a yönləndirilirsiniz...</p>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={step === 'signature'}
        onClose={() => setStep('login')}
        onSave={handleSignatureSave}
        employeeName={employeeName}
      />
    </div>
  );
};

export default QRScanPage;
