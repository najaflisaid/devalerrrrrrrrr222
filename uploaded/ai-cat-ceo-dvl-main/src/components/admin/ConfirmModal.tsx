import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, title, message, confirmLabel = 'Təsdiqlə', cancelLabel = 'Ləğv et',
  variant = 'default', onClose, onConfirm,
}) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) { setBusy(false); setErr(''); }
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true); setErr('');
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Xəta baş verdi.');
      setBusy(false);
    }
  };

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" data-testid="confirm-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${isDanger ? 'text-red-500' : 'text-amber-500'}`} />
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-50">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{message}</p>
          {err && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{err}</div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} disabled={busy}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {cancelLabel}
            </button>
            <button type="button" onClick={handleConfirm} disabled={busy}
              className={`px-4 py-2 text-sm rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5 text-white ${
                isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-black'
              }`}
              data-testid="confirm-modal-confirm">
              {busy && <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
