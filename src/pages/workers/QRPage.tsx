import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Clock, Wifi } from 'lucide-react';

const QRDisplayPage: React.FC = () => {
  const [sessionCode, setSessionCode] = useState('');
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    generateNewSession();
    
    // Hər 1 saatda bir yenilə
    const interval = setInterval(() => {
      generateNewSession();
    }, 60 * 60 * 1000); // 1 saat

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Timer - hər saniyə yenilə
    const timer = setInterval(() => {
      if (expiryTime) {
        const now = new Date();
        const diff = expiryTime.getTime() - now.getTime();
        
        if (diff <= 0) {
          generateNewSession();
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryTime]);

  const generateNewSession = () => {
    // Unique session code yarat
    const code = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat sonra
    
    setSessionCode(code);
    setExpiryTime(expiry);
    
    console.log('🔄 Yeni QR session yaradıldı:', code);
  };

  const qrUrl = `${window.location.origin}/workers/qr-scan?session=${sessionCode}`;

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
            Telefonunuzdan bu QR kodu scan edin
          </p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-6">
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-white p-8 rounded-2xl inline-block mb-6 border-8 border-indigo-100">
              <QRCodeSVG 
                value={qrUrl}
                size={400}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#4F46E5"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">
                İşə Giriş / Çıxış
              </h2>
              <ol className="text-left max-w-md mx-auto space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
                  <span className="pt-1">Telefonda kamera və ya QR scanner tətbiqi açın</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
                  <span className="pt-1">Yuxarıdakı QR kodu scan edin</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
                  <span className="pt-1">Email və şifrənizi daxil edin</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
                  <span className="pt-1">Avtomatik giriş və ya çıxış ediləcək</span>
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
                onClick={generateNewSession}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Yenilə"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {expiryTime && (
            <p className="text-indigo-200 text-sm mt-2 text-center">
              Növbəti yenilənmə: {expiryTime.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-indigo-200 text-sm">
            Bu ekran 24/7 açıq qalmalıdır • QR kod hər saat avtomatik yenilənir
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRDisplayPage;
