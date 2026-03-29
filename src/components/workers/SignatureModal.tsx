import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RefreshCw, Check } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  employeeName: string;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, employeeName }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  if (!isOpen) return null;

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const signature = sigCanvas.current.toDataURL('image/png');
      onSave(signature);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">İmza</h3>
              <p className="text-sm text-gray-600 mt-1">
                {employeeName}, iş günü bitdi. İmzanızı əlavə edin.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: 'w-full h-64 cursor-crosshair',
                style: { touchAction: 'none' }
              }}
              onBegin={handleBegin}
              backgroundColor="rgb(249, 250, 251)"
              penColor="rgb(30, 41, 59)"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Ekranda və ya toxunma panelində imzanızı çəkin
            </p>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
              Təmizlə
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Ləğv et
            </button>
            <button
              onClick={handleSave}
              disabled={isEmpty}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Check className="w-5 h-5" />
              İmzanı Təsdiq Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
