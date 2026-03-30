import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Clock, Wifi } from 'lucide-react';
import { generateStoreQRToken, getActiveStoreToken, getTokenRemainingTime, StoreQRToken } from '../../services/storeQRService';

const QRDisplayPage: React.FC = () => {
  const [token, setToken] = useState<StoreQRToken | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrCreateToken();
    
    // Hər 5 dəqiqədə token yoxla
    const interval = setInterval(() => {
      checkTokenValidity();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Timer - hər saniyə yenilə
    const timer = setInterval(() => {
      if (token) {
        const now = new Date();
        const expiresAt = new Date(token.expiresAt);
        const diff = expiresAt.getTime() - now.getTime();
        
        if (diff <= 0) {
          // Token bitib, yenisini yarat
          generateNewToken();
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [token]);

  const loadOrCreateToken = async () => {
    try {
      setLoading(true);
      const activeToken = await getActiveStoreToken('Ana mağaza');
      
      if (activeToken) {
        setToken(activeToken);
      } else {
        await generateNewToken();
      }
    } catch (error) {
      console.error('Token yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkTokenValidity = async () => {
    if (token) {
      const remaining = getTokenRemainingTime(token.expiresAt);
      if (remaining <= 0) {
        await generateNewToken();
      }
    }
  };

  const generateNewToken = async () => {
    try {
      const newToken = await generateStoreQRToken('Ana mağaza');
      setToken(newToken);
      console.log('🔄 Yeni QR token yaradıldı:', newToken.token);
    } catch (error) {
      console.error('Token yaratma xətası:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl">QR kod hazırlanır...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <Wifi className="w-8 h-8 text-white animate-pulse" />
            <h1 className="text-5xl font-bold text-white">İşçi QR Sistemi</h1>
          </div>
          <p className="text-xl text-indigo-200">
            İşçi dashboard-dan bu QR kodu skan edin
          </p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-6">
          <div className="text-center">
            {/* QR Code */}
            {token && (
              <div className="bg-white p-8 rounded-2xl inline-block mb-6 border-8 border-indigo-100">
                <QRCodeSVG 
                  value={token.token}
                  size={400}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#4F46E5"
                />
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">
                İşə Giriş / Çıxış
              </h2>
              <ol className="text-left max-w-md mx-auto space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
                  <span className="pt-1">/workers linkindən işçi hesabına daxil olun</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
                  <span className="pt-1">"QR Skan - Giriş" düyməsinə basın</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
                  <span className="pt-1">Bu QR kodu kameraya tutun</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
                  <span className="pt-1">Giriş/çıxış avtomatik qeyd olunacaq</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Timer Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <span className="text-lg">QR kod keçərliliyi:</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold font-mono">{timeLeft}</span>
              <button
                onClick={generateNewToken}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Yenilə"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {token && (
            <p className="text-indigo-200 text-sm mt-2 text-center">
              Bitmə vaxtı: {new Date(token.expiresAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-indigo-200 text-sm">
            Bu ekran 24/7 açıq qalmalıdır • QR kod hər saat avtomatik yenilənir
          </p>
          <p className="text-yellow-300 text-sm font-medium">
            ⚠️ Hər işçi eyni QR ilə yalnız 1 dəfə giriş edə bilər
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRDisplayPage;
