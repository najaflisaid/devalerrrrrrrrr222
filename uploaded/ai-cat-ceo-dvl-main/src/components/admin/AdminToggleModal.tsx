import React, { useEffect, useState } from 'react';
import { Lock, X, ShieldCheck, AlertCircle } from 'lucide-react';

interface AdminToggleModalProps {
  open: boolean;
  userName: string;
  newRole: 'admin' | 'customer';
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const CORRECT_PASSWORD = '20202025';

const AdminToggleModal: React.FC<AdminToggleModalProps> = ({
  open, userName, newRole, onClose, onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'pwd' | 'confirm'>('pwd');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(''); setStep('pwd'); setErr(''); setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const checkPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setErr('');
      setStep('confirm');
    } else {
      setErr('Yanlış şifrə');
      setPassword('');
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (e: any) {
      setErr(e?.message || 'Xəta baş verdi.');
      setBusy(false);
      return;
    }
    setBusy(false);
    onClose();
  };

  const action = newRole === 'admin' ? 'admin etmək' : 'adminliyi geri almaq';
  const actionEmphasis = newRole === 'admin' ? 'Admin etmək' : 'Adminliyi geri almaq';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" data-testid="admin-toggle-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'pwd' ? (
              <Lock className="h-4 w-4 text-gray-700" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-gray-900" />
            )}
            <h3 className="font-semibold text-gray-900 text-sm">
              {step === 'pwd' ? 'Təhlükəsizlik şifrəsi' : actionEmphasis}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" disabled={busy}>
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {step === 'pwd' ? (
            <form onSubmit={checkPassword} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{userName}</strong> istifadəçisini {action} istəyirsiniz.
                  Davam etmək üçün təhlükəsizlik şifrəsini daxil edin.
                </span>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Şifrə</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="••••••••"
                  data-testid="admin-toggle-password-input"
                />
              </div>
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  {err}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  Ləğv et
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black"
                  data-testid="admin-toggle-password-submit">
                  Davam et
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed">
                <strong className="text-gray-900">{userName}</strong> istifadəçisinin rolu{' '}
                <strong className="text-gray-900">
                  {newRole === 'admin' ? 'Admin' : 'Müştəri'}
                </strong>{' '}
                kimi dəyişdiriləcək. Bu əməliyyat dərhal qüvvəyə minəcək.
              </div>
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  {err}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} disabled={busy}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  Ləğv et
                </button>
                <button type="button" onClick={doConfirm} disabled={busy}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 inline-flex items-center gap-1.5"
                  data-testid="admin-toggle-confirm">
                  {busy ? <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Təsdiqlə
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminToggleModal;
