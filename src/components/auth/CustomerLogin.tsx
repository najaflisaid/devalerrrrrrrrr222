import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Lock, User, X, Phone } from 'lucide-react';
import SuccessNotification from '../SuccessNotification';
import { useCart } from '../../context/CartContext';

interface CustomerLoginProps {
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

// Phone-only auth helper: convert "501234567" → "phone994501234567@devaleur.az"
// (Firebase Auth requires an email — the user never sees this synthetic address.)
const phoneToSyntheticEmail = (digits: string) => `phone994${digits}@devaleur.az`;

const formatPhoneDisplay = (digits: string) =>
  digits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4');

const CustomerLogin: React.FC<CustomerLoginProps> = ({ onClose, initialMode = 'login' }) => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const { clearCart } = useCart();

  // Look up real email by phone in Firestore (handles legacy users registered with real email)
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
    setLoading(true);

    try {
      if (phoneDigits.length !== 9) {
        setError('Nömrəni tam daxil edin (9 rəqəm). Məs: 50 123 45 67');
        setLoading(false);
        return;
      }
      const fullPhone = `+994${phoneDigits}`;
      const syntheticEmail = phoneToSyntheticEmail(phoneDigits);

      if (isLogin) {
        const previousRole = localStorage.getItem('userRole');

        // 1) Try synthetic email first (new phone-based accounts)
        // 2) Fallback: lookup the real email by phone in Firestore (legacy email-registered accounts)
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

          if (previousRole && previousRole !== newRole) {
            clearCart(true);
          }

          let validDiscount = 0;
          const discountPercentage = userData.discountPercentage || 0;
          const discountUsageType = userData.discountUsageType || 'unlimited';
          const discountUsed = userData.discountUsed || false;
          const discountExpiresAt = userData.discountExpiresAt;

          if (discountUsageType === 'unlimited') {
            validDiscount = discountPercentage;
          } else if (discountUsageType === 'once' && !discountUsed) {
            validDiscount = discountPercentage;
          } else if (discountUsageType === 'time_limited' && discountExpiresAt) {
            const expiryDate = new Date(discountExpiresAt.toDate ? discountExpiresAt.toDate() : discountExpiresAt);
            if (expiryDate > new Date()) {
              validDiscount = discountPercentage;
            }
          }

          localStorage.setItem('userRole', newRole);
          window.dispatchEvent(new Event('userRoleChanged'));
          localStorage.setItem('userName', userData.name || fullPhone);
          localStorage.setItem('userEmail', userEmail);
          localStorage.setItem('userId', userId);
          localStorage.setItem('userPhone', userData.phone || fullPhone);
          if (userData.surname) {
            localStorage.setItem('userSurname', userData.surname);
          }

          localStorage.setItem('userData', JSON.stringify({
            id: userId,
            email: userEmail,
            name: userData.name || fullPhone,
            surname: userData.surname || '',
            phone: userData.phone || fullPhone,
            role: newRole,
            discountPercentage: discountPercentage,
            discountUsageType: discountUsageType,
            discountUsed: discountUsed,
            discountExpiresAt: discountExpiresAt,
            validDiscount,
          }));
        }

        setSuccessMessage(t('auth.loginSuccess'));
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1400);
      } else {
        // REGISTER — phone + name + surname + password
        const previousRole = localStorage.getItem('userRole');
        if (previousRole) {
          clearCart(true);
        }

        if (!name.trim()) {
          setError('Adınızı daxil edin');
          setLoading(false);
          return;
        }
        if (!surname.trim()) {
          setError('Soyadınızı daxil edin');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Şifrə minimum 6 simvol olmalıdır');
          setLoading(false);
          return;
        }

        // Reject if phone already used
        const existing = await lookupEmailByPhone(fullPhone);
        if (existing) {
          setError('Bu nömrə artıq qeydiyyatdadır. Zəhmət olmasa "Daxil ol" düyməsindən giriş edin.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
        const userId = userCredential.user.uid;

        await setDoc(doc(db, 'users', userId), {
          id: userId,
          email: syntheticEmail,
          name: name.trim(),
          surname: surname.trim(),
          phone: fullPhone,
          role: 'customer',
          discountPercentage: 0,
          discountUsageType: 'unlimited',
          discountUsed: false,
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
          id: userId,
          email: syntheticEmail,
          name: name.trim(),
          surname: surname.trim(),
          phone: fullPhone,
          role: 'customer',
          discountPercentage: 0,
          discountUsageType: 'unlimited',
          discountUsed: false,
        }));

        setSuccessMessage(t('auth.registerSuccess'));
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1400);
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

  // Avoid unused var warning while we keep this for logging only
  void navigate;

  return (
    <>
      {showSuccess && (
        <SuccessNotification
          message={successMessage}
          onClose={() => setShowSuccess(false)}
        />
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

          <h2 className="font-playfair text-3xl text-center mb-6">
            {isLogin ? t('auth.customerTitle') : t('auth.customerRegisterTitle')}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm" data-testid="customer-auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ad</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      placeholder="Adınız"
                      required={!isLogin}
                      data-testid="customer-register-name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Soyad</label>
                  <input
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    placeholder="Soyadınız"
                    required={!isLogin}
                    data-testid="customer-register-surname"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Əlaqə nömrəsi
              </label>
              <div className="flex items-stretch border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent overflow-hidden">
                <span className="px-3 flex items-center bg-gray-50 text-sm text-gray-700 font-medium border-r border-gray-200 select-none gap-1.5">
                  <Phone className="h-4 w-4 text-gray-400" />
                  +994
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatPhoneDisplay(phoneDigits)}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setPhoneDigits(onlyDigits);
                  }}
                  placeholder="50 123 45 67"
                  maxLength={13}
                  required
                  className="flex-1 px-3 py-3 text-sm focus:outline-none"
                  data-testid={isLogin ? 'customer-login-phone' : 'customer-register-phone'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  data-testid={isLogin ? 'customer-login-password' : 'customer-register-password'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
              data-testid={isLogin ? 'customer-login-submit' : 'customer-register-submit'}
            >
              {loading ? t('common.loading') : isLogin ? t('auth.signIn') : t('auth.signUp')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
              data-testid="customer-toggle-mode"
            >
              {isLogin ? t('auth.toggleRegister') : t('auth.toggleLogin')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerLogin;
