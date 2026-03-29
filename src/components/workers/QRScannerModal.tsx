import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle, XCircle } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  onScan,
  title = "QR Kod Oxut" 
}) => {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setError('');
      const html5QrCode = new Html5Qrcode("qr-reader");
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: "environment" }, // Arxadakı kamera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          setSuccess(true);
          setScanning(false);
          onScan(decodedText);
          
          // 1 saniyə sonra bağla
          setTimeout(() => {
            stopScanner();
            onClose();
          }, 1000);
        },
        (errorMessage) => {
          // Scan error - normal, hər frame-də baş verir
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('Scanner başlatma xətası:', err);
      setError('Kamera açıla bilmədi. Zəhmət olmasa kamera icazəsi verin.');
    }
  };

  const stopScanner = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (err) {
        console.error('Scanner dayandırma xətası:', err);
      }
      setScanner(null);
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scanner Area */}
        <div className="p-6">
          {error ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <p className="text-red-800 font-medium">{error}</p>
              <button
                onClick={startScanner}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Yenidən Cəhd Et
              </button>
            </div>
          ) : success ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-green-800 font-medium">QR Kod Oxundu!</p>
            </div>
          ) : (
            <>
              <div id="qr-reader" className="rounded-lg overflow-hidden"></div>
              
              {scanning && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-indigo-600">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">QR kodu kameraya tutun...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-600 text-center">
            QR kodu ekranda göstərilən çərçivəyə yerləşdirin
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
