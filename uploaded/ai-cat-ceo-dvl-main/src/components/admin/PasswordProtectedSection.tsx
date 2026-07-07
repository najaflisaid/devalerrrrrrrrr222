import React, { useState, useEffect } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { verifySectionPassword, isSectionOpen } from '../../services/adminPasswordService';

interface PasswordProtectedSectionProps {
  children: React.ReactNode;
  sectionName: string;
  onUnlock?: () => void;
}

const PasswordProtectedSection: React.FC<PasswordProtectedSectionProps> = ({
  children,
  sectionName,
  onUnlock,
}) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // On mount / when section changes: check if section is open (noPassword toggle)
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setIsAuthenticated(false);
    setPassword('');
    setError('');
    isSectionOpen(sectionName)
      .then((open) => {
        if (cancelled) return;
        if (open) {
          setIsAuthenticated(true);
          onUnlock?.();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ok = await verifySectionPassword(sectionName, password);
      if (ok) {
        setIsAuthenticated(true);
        onUnlock?.();
      } else {
        setError('Yanlış şifrə');
        setPassword('');
      }
    } catch {
      setError('Şifrə yoxlanıla bilmədi');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Qorunan Bölmə</h2>
        <p className="text-gray-600 text-center mb-6">
          Bu bölməyə daxil olmaq üçün şifrə daxil edin
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrəni daxil edin"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <X className="h-4 w-4" />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Daxil ol
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordProtectedSection;
