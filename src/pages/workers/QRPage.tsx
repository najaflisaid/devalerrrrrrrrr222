import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { validateQRToken } from '../../services/qrTokenService';
import { getEmployee } from '../../services/employeeService';
import { checkIn, checkOut, getTodayAttendance } from '../../services/attendanceService';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { Employee, Attendance } from '../../types/worker';

const QRPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const employeeId = searchParams.get('employeeId');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'success' | 'error'>('validating');
  const [message, setMessage] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [action, setAction] = useState<'check-in' | 'check-out' | null>(null);

  useEffect(() => {
    if (token && employeeId) {
      validateAndProcess();
    } else {
      setStatus('invalid');
      setMessage('Token və ya işçi ID-si tapılmadı');
      setLoading(false);
    }
  }, [token, employeeId]);

  const validateAndProcess = async () => {
    try {
      setLoading(true);
      setStatus('validating');
      
      // Token yoxla
      const validation = await validateQRToken(token!);
      
      if (!validation.valid) {
        setStatus('invalid');
        setMessage(validation.message);
        setLoading(false);
        return;
      }
      
      // İşçi məlumatını al
      const emp = await getEmployee(employeeId!);
      if (!emp) {
        setStatus('invalid');
        setMessage('İşçi tapılmadı');
        setLoading(false);
        return;
      }
      
      setEmployee(emp);
      
      // Bugünkü davamiyyət yoxla
      const todayAtt = await getTodayAttendance(employeeId!);
      setAttendance(todayAtt);
      
      // Status təyin et
      if (!todayAtt) {
        setAction('check-in');
        setStatus('valid');
        setMessage(`${emp.ad} ${emp.soyad}, işə girmək üçün hazırsınız`);
      } else if (todayAtt.status === 'isde') {
        setAction('check-out');
        setStatus('valid');
        setMessage(`${emp.ad} ${emp.soyad}, işdən çıxmaq üçün hazırsınız`);
      } else {
        setStatus('invalid');
        setMessage('Bu gün artıq çıxış etmisiniz');
      }
      
      setLoading(false);
      
      // 3 saniyə sonra avtomatik əməliyyat et
      setTimeout(() => {
        processAttendance();
      }, 3000);
      
    } catch (error: any) {
      console.error('QR yoxlama xətası:', error);
      setStatus('error');
      setMessage('Xəta baş verdi: ' + error.message);
      setLoading(false);
    }
  };

  const processAttendance = async () => {
    if (!employee || !action || processing) return;
    
    try {
      setProcessing(true);
      
      if (action === 'check-in') {
        await checkIn(employee.id);
        setStatus('success');
        setMessage(`✅ İşə giriş uğurlu! ${new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        await checkOut(employee.id);
        setStatus('success');
        setMessage(`✅ İşdən çıxış uğurlu! ${new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`);
      }
      
      // 2 saniyə sonra dashboard-a yönləndir
      setTimeout(() => {
        navigate('/workers/dashboard');
      }, 2000);
      
    } catch (error: any) {
      console.error('Davamiyyət xətası:', error);
      setStatus('error');
      setMessage('Xəta: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana səhifə
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Token yoxlanılır...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={`p-6 ${
                status === 'valid' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                status === 'success' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
                'bg-gradient-to-r from-red-500 to-pink-600'
              } text-white`}>
                <div className="flex items-center justify-center mb-4">
                  {status === 'valid' || status === 'success' ? (
                    <CheckCircle2 className="w-16 h-16" />
                  ) : (
                    <XCircle className="w-16 h-16" />
                  )}
                </div>
                <h1 className="text-2xl font-bold text-center">
                  {status === 'valid' ? 'QR Kod Keçərlidir' :
                   status === 'success' ? 'Uğurlu!' :
                   status === 'invalid' ? 'Token Keçərsizdir' :
                   'Xəta Baş Verdi'}
                </h1>
              </div>

              {/* Content */}
              <div className="p-8">
                {employee && (
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl mx-auto mb-4">
                      {employee.ad[0]}{employee.soyad[0]}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {employee.ad} {employee.soyad}
                    </h2>
                    <p className="text-gray-600">{employee.vezife}</p>
                  </div>
                )}

                <div className={`p-4 rounded-lg border-2 ${
                  status === 'valid' ? 'bg-green-50 border-green-200' :
                  status === 'success' ? 'bg-blue-50 border-blue-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-center font-medium ${
                    status === 'valid' ? 'text-green-800' :
                    status === 'success' ? 'text-blue-800' :
                    'text-red-800'
                  }`}>
                    {message}
                  </p>
                </div>

                {status === 'valid' && !processing && (
                  <div className="mt-6">
                    <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                      <Clock className="w-5 h-5 animate-pulse" />
                      <span className="text-sm">3 saniyə sonra avtomatik...</span>
                    </div>
                    <button
                      onClick={processAttendance}
                      className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors"
                    >
                      {action === 'check-in' ? 'İndi Giriş Et' : 'İndi Çıxış Et'}
                    </button>
                  </div>
                )}

                {processing && (
                  <div className="mt-6 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="text-gray-600 mt-2">Əməliyyat yerinə yetirilir...</p>
                  </div>
                )}

                {status === 'success' && (
                  <div className="mt-6 text-center text-gray-600">
                    <p>Dashboard-a yönləndirilirsiniz...</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>QR kod 1 saat ərzində keçərlidir</p>
        </div>
      </div>
    </div>
  );
};

export default QRPage;
