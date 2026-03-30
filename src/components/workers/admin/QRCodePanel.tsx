import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Clock, QrCode, AlertCircle } from 'lucide-react';
import { 
  generateStoreQRToken, 
  getActiveStoreToken,
  getTokenRemainingTime,
  StoreQRToken 
} from '../../../services/storeQRService';

interface Props {
  magaza?: string;
}

const QRCodePanel: React.FC<Props> = ({ magaza = 'Ana mağaza' }) => {
  const [token, setToken] = useState<StoreQRToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    loadActiveToken();
  }, [magaza]);

  useEffect(() => {
    // Hər dəqiqə qalan vaxtı yenilə
    const interval = setInterval(() => {
      if (token) {
        const remaining = getTokenRemainingTime(token.expiresAt);
        setRemainingTime(remaining);
        
        // Vaxt bitibsə, token-i null et
        if (remaining <= 0) {
          setToken(null);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [token]);

  const loadActiveToken = async () => {
    try {
      setLoading(true);
      const activeToken = await getActiveStoreToken(magaza);
      
      if (activeToken) {
        setToken(activeToken);
        setRemainingTime(getTokenRemainingTime(activeToken.expiresAt));
      } else {
        setToken(null);
      }
    } catch (error) {
      console.error('Token yüklənə bilmədi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    try {
      setGenerating(true);
      const newToken = await generateStoreQRToken(magaza);
      setToken(newToken);
      setRemainingTime(60); // 60 dəqiqə
    } catch (error: any) {
      alert('QR yaratmaq alınmadı: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <QrCode className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Mağaza QR Kodu</h3>
            <p className="text-sm text-gray-600">{magaza}</p>
          </div>
        </div>
        
        <button
          onClick={handleGenerateQR}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Yaradılır...' : 'Yeni QR Yarat'}
        </button>
      </div>

      {token ? (
        <div className="text-center">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
            <QRCodeSVG 
              value={token.token} 
              size={200}
              level="H"
              includeMargin
            />
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className={`w-5 h-5 ${remainingTime <= 10 ? 'text-red-600' : 'text-green-600'}`} />
            <span className={`font-semibold ${remainingTime <= 10 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingTime} dəqiqə qalıb
            </span>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm text-blue-800">
              <strong>Məlumat:</strong> Bu QR kod 1 saat ərzində keçərlidir. İşçilər bu kodu skan edərək giriş/çıxış edə bilərlər.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Hər işçi eyni QR ilə yalnız 1 dəfə giriş edə bilər.
            </p>
          </div>

          {/* Used By */}
          {token.usedBy && token.usedBy.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-sm text-gray-600">
                Bu QR ilə {token.usedBy.length} işçi giriş edib
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4">Aktiv QR kod yoxdur</p>
          <button
            onClick={handleGenerateQR}
            disabled={generating}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {generating ? 'Yaradılır...' : 'QR Kod Yarat'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QRCodePanel;
