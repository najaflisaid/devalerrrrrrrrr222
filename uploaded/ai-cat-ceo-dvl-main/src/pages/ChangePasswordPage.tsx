import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Lock, ShieldCheck, ArrowLeft } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const mustChange = typeof window !== 'undefined' && localStorage.getItem('mustChangePassword') === '1';

  useEffect(() => {
    if (!localStorage.getItem('userId')) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Yeni şifrə minimum 6 simvol olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifrələr üst-üstə düşmür.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Yeni şifrə köhnə şifrədən fərqli olmalıdır.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setError('Sessiya tapılmadı. Zəhmət olmasa yenidən daxil olun.');
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate first (Firebase requires this for password updates)
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      // Clear "must change" flag in Firestore
      try {
        await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false });
      } catch { /* non-blocking */ }
      localStorage.removeItem('mustChangePassword');

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Mövcud şifrə yanlışdır.');
      } else if (code === 'auth/weak-password') {
        setError('Yeni şifrə çox zəifdir. Daha güclü şifrə seçin.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Təhlükəsizlik üçün təkrar daxil olun və yenidən cəhd edin.');
      } else {
        setError(err?.message || 'Şifrə dəyişdirilə bilmədi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6"
          data-testid="change-pw-back"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-6 w-6 text-gray-900" />
            <h1 className="text-2xl font-playfair">Şifrəni dəyiş</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            {mustChange
              ? 'WhatsApp-dan gələn müvəqqəti şifrəni daxil edin və yenisini təyin edin.'
              : 'Hesabınızın təhlükəsizliyini qorumaq üçün vaxtaşırı şifrəni dəyişin.'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4" data-testid="change-pw-error">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 text-emerald-700 text-sm p-3 rounded-lg mb-4" data-testid="change-pw-success">
              Şifrə uğurla dəyişdirildi! Ana səhifəyə yönləndirilirsiniz...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mustChange ? 'WhatsApp-dan gələn müvəqqəti şifrə' : 'Mövcud şifrə'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  required
                  data-testid="change-pw-current"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yeni şifrə</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  required
                  minLength={6}
                  data-testid="change-pw-new"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yeni şifrəni təkrarla</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  required
                  minLength={6}
                  data-testid="change-pw-confirm"
                />
              </div>
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-xs text-red-600 mt-1">Şifrələr üst-üstə düşmür</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
              data-testid="change-pw-submit"
            >
              {loading ? 'Dəyişdirilir...' : 'Şifrəni dəyiş'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
