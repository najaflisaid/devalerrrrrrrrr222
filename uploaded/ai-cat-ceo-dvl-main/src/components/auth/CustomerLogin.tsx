import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Lock, User, X, Phone, ArrowLeft } from 'lucide-react';
import SuccessNotification from '../SuccessNotification';
import { useCart } from '../../context/CartContext';

interface CustomerLoginProps {
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

type Mode = 'login' | 'register' | 'forgot';

// Phone-only auth helper: convert "501234567" → "phone994501234567@devaleur.az"
const phoneToSyntheticEmail = (digits: string) => `phone994${digits}@devaleur.az`;

const formatPhoneDisplay = (digits: string) =>
  digits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4');

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  '';

const CustomerLogin: React.FC<CustomerLoginProps> = ({ onClose, initialMode = 'login' }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const lookupEmailByPhone = async (fullPhone: string): Promise<string | null> => {
    try {
      const q = query(collection(db, 'users'), where('phone', '==', fullPhone), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return (snap.docs[0].data().email as string) || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (phoneDigits.length !== 9) {
        setError('Nömrəni tam daxil edin (9 rəqəm). Məs: 50 123 45 67');
        setLoading(false);
        return;
      }
      const fullPhone = `+994${phoneDigits}`;
      const syntheticEmail = phoneToSyntheticEmail(phoneDigits);

      if (mode === 'forgot') {
        // Call backend forgot-password endpoint
        const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: fullPhone }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || 'Şifrə bərpası uğursuz oldu.');
        }
        const body = await res.json();
        setInfo(
          body.delivered
            ? 'Yeni şifrə WhatsApp nömrənizə göndərildi. Daxil olduqdan sonra profil bölməsindən onu dəyişməyi unutmayın.'
            : (body.message || 'Əgər bu nömrə qeydiyyatdadırsa, WhatsApp-a yeni şifrə göndəriləcək.')
        );
        setLoading(false);
        return;
      }

      if (mode === 'login') {
        const previousRole = localStorage.getItem('userRole');
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
        } catch (firstErr: any) {
          const code = firstErr?.code || '';
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
            const realEmail = await lookupEmailByPhone(fullPhone);
            if (realEmail && realEmail !== syntheticEmail) {
              userCredential = await signInWithEmailAndPassword(auth, realEmail, password);
            } else {
              throw firstErr;
            }
          } else {
            throw firstErr;
          }
        }

        const userId = userCredential.user.uid;
        const userEmail = userCredential.user.email || syntheticEmail;
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const newRole = userData.role || 'customer';
          if (previousRole && previousRole !== newRole) clearCart(true);

          let validDiscount = 0;
          const discountPercentage = userData.discountPercentage || 0;
          const discountUsageType = userData.discountUsageType || 'unlimited';
          const discountUsed = userData.discountUsed || false;
          const discountExpiresAt = userData.discountExpiresAt;
          if (discountUsageType === 'unlimited') validDiscount = discountPercentage;
          else if (discountUsageType === 'once' && !discountUsed) validDiscount = discountPercentage;
          else if (discountUsageType === 'time_limited' && discountExpiresAt) {
            const expiryDate = new Date(discountExpiresAt.toDate ? discountExpiresAt.toDate() : discountExpiresAt);
            if (expiryDate > new Date()) validDiscount = discountPercentage;
          }

          localStorage.setItem('userRole', newRole);
          window.dispatchEvent(new Event('userRoleChanged'));
          localStorage.setItem('userName', userData.name || fullPhone);
          localStorage.setItem('userEmail', userEmail);
          localStorage.setItem('userId', userId);
          localStorage.setItem('userPhone', userData.phone || fullPhone);
          if (userData.surname) localStorage.setItem('userSurname', userData.surname);
          if (userData.mustChangePassword) localStorage.setItem('mustChangePassword', '1');
          else localStorage.removeItem('mustChangePassword');

          localStorage.setItem('userData', JSON.stringify({
            id: userId, email: userEmail,
            name: userData.name || fullPhone, surname: userData.surname || '',
            phone: userData.phone || fullPhone, role: newRole,
            discountPercentage, discountUsageType, discountUsed, discountExpiresAt,
            validDiscount, mustChangePassword: !!userData.mustChangePassword,
          }));
        }

        setSuccessMessage(t('auth.loginSuccess'));
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
          if (localStorage.getItem('mustChangePassword') === '1') {
            window.location.href = '/change-password';
          } else {
            window.location.reload();
          }
        }, 300);
      } else {
        // REGISTER
        const previousRole = localStorage.getItem('userRole');
        if (previousRole) clearCart(true);

        if (!name.trim()) { setError('Adınızı daxil edin'); setLoading(false); return; }
        if (!surname.trim()) { setError('Soyadınızı daxil edin'); setLoading(false); return; }
        if (password.length < 6) { setError('Şifrə minimum 6 simvol olmalıdır'); setLoading(false); return; }
        if (password !== passwordConfirm) {
          setError('Şifrələr üst-üstə düşmür. Hər iki sahəyə eyni şifrəni yazın.');
          setLoading(false);
          return;
        }
        if (!agreedToTerms) {
          setError('Davam etmək üçün İstifadəçi qaydaları və Məxfilik siyasəti ilə razılaşmalısınız.');
          setLoading(false);
          return;
        }

        const existing = await lookupEmailByPhone(fullPhone);
        if (existing) {
          setError('Bu nömrə artıq qeydiyyatdadır. Zəhmət olmasa "Daxil ol" düyməsindən giriş edin.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
        const userId = userCredential.user.uid;

        await setDoc(doc(db, 'users', userId), {
          id: userId, email: syntheticEmail,
          name: name.trim(), surname: surname.trim(), phone: fullPhone,
          role: 'customer',
          discountPercentage: 0, discountUsageType: 'unlimited', discountUsed: false,
          acceptedTermsAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });

        localStorage.setItem('userRole', 'customer');
        window.dispatchEvent(new Event('userRoleChanged'));
        localStorage.setItem('userName', name.trim());
        localStorage.setItem('userSurname', surname.trim());
        localStorage.setItem('userEmail', syntheticEmail);
        localStorage.setItem('userPhone', fullPhone);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userData', JSON.stringify({
          id: userId, email: syntheticEmail, name: name.trim(), surname: surname.trim(),
          phone: fullPhone, role: 'customer',
          discountPercentage: 0, discountUsageType: 'unlimited', discountUsed: false,
        }));

        setSuccessMessage(t('auth.registerSuccess'));
        setShowSuccess(true);
        setTimeout(() => { onClose(); window.location.reload(); }, 400);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        setError('Nömrə və ya şifrə yanlışdır.');
      } else if (code === 'auth/email-already-in-use') {
        setError('Bu nömrə artıq qeydiyyatdadır. "Daxil ol" düyməsindən giriş edin.');
      } else if (code === 'auth/too-many-requests') {
        setError('Çox cəhd oldu. Zəhmət olmasa bir az sonra yenidən cəhd edin.');
      } else if (code === 'auth/network-request-failed') {
        setError('İnternet bağlantısı problemi var. Yenidən cəhd edin.');
      } else {
        setError(err?.message || t('auth.genericError'));
      }
    } finally {
      setLoading(false);
    }
  };

  void navigate;

  const title = mode === 'login' ? t('auth.customerTitle') : mode === 'register' ? t('auth.customerRegisterTitle') : 'Şifrəni unutmusuz?';

  return (
    <>
      {showSuccess && (
        <SuccessNotification message={successMessage} onClose={() => setShowSuccess(false)} />
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            data-testid="customer-login-close"
          >
            <X className="h-6 w-6" />
          </button>

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
              data-testid="customer-forgot-back"
            >
              <ArrowLeft className="h-4 w-4" /> Geri
            </button>
          )}

          <h2 className="font-playfair text-3xl text-center mb-2">{title}</h2>
          {mode === 'forgot' && (
            <p className="text-sm text-gray-500 text-center mb-6">
              Nömrənizi daxil edin — yeni şifrəniz WhatsApp-a göndəriləcək.
            </p>
          )}
          {mode !== 'forgot' && <div className="mb-4" />}

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm" data-testid="customer-auth-error">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-4 text-sm" data-testid="customer-auth-info">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ad</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder="Adınız" required
                      data-testid="customer-register-name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Soyad</label>
                  <input
                    type="text" value={surname} onChange={(e) => setSurname(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder="Soyadınız" required
                    data-testid="customer-register-surname"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Əlaqə nömrəsi</label>
              <div className="flex items-stretch border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent overflow-hidden">
                <span className="px-3 flex items-center bg-gray-50 text-sm text-gray-700 font-medium border-r border-gray-200 select-none gap-1.5">
                  <Phone className="h-4 w-4 text-gray-400" />
                  +994
                </span>
                <input
                  type="tel" inputMode="numeric"
                  value={formatPhoneDisplay(phoneDigits)}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="50 123 45 67" maxLength={13} required
                  className="flex-1 px-3 py-3 text-sm focus:outline-none"
                  data-testid={
                    mode === 'login' ? 'customer-login-phone'
                    : mode === 'register' ? 'customer-register-phone'
                    : 'customer-forgot-phone'
                  }
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder="••••••••" required minLength={6}
                    data-testid={mode === 'login' ? 'customer-login-password' : 'customer-register-password'}
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Şifrəni təkrarla</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder="••••••••" required minLength={6}
                    data-testid="customer-register-password-confirm"
                  />
                </div>
                {passwordConfirm.length > 0 && passwordConfirm !== password && (
                  <p className="text-xs text-red-600 mt-1">Şifrələr üst-üstə düşmür</p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2 text-xs text-gray-600 select-none cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer flex-shrink-0"
                  data-testid="customer-register-terms"
                />
                <span className="leading-snug">
                  Qeydiyyatdan keçərək Siz{' '}
                  <Link to="/privacy-policy" target="_blank" className="text-gray-900 underline underline-offset-2 hover:opacity-70" onClick={(e) => e.stopPropagation()}>
                    İstifadəçi qaydaları
                  </Link>
                  {' '}və{' '}
                  <Link to="/privacy-policy" target="_blank" className="text-gray-900 underline underline-offset-2 hover:opacity-70" onClick={(e) => e.stopPropagation()}>
                    Məxfilik siyasəti
                  </Link>
                  {' '}ilə razılaşırsınız.
                </span>
              </label>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setInfo(''); setPassword(''); }}
                  className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  data-testid="customer-forgot-link"
                >
                  Şifrəni unutmusuz?
                </button>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
              data-testid={
                mode === 'login' ? 'customer-login-submit'
                : mode === 'register' ? 'customer-register-submit'
                : 'customer-forgot-submit'
              }
            >
              {loading ? t('common.loading') : (
                mode === 'login' ? t('auth.signIn') :
                mode === 'register' ? t('auth.signUp') :
                'Yeni şifrə göndər'
              )}
            </button>
          </form>

          {mode !== 'forgot' && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(''); setInfo('');
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
                data-testid="customer-toggle-mode"
              >
                {mode === 'login' ? t('auth.toggleRegister') : t('auth.toggleLogin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CustomerLogin;
