import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Mail, Lock, User, X, Phone } from 'lucide-react';
import SuccessNotification from '../SuccessNotification';
import { useCart } from '../../context/CartContext';

interface CustomerLoginProps {
  onClose: () => void;
}

const CustomerLogin: React.FC<CustomerLoginProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const previousRole = localStorage.getItem('userRole');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userId = userCredential.user.uid;
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
          localStorage.setItem('userName', userData.name || email);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userId', userId);
          if (userData.phone) {
            localStorage.setItem('userPhone', userData.phone);
          }
          if (userData.surname) {
            localStorage.setItem('userSurname', userData.surname);
          }

          localStorage.setItem('userData', JSON.stringify({
            id: userId,
            email: email,
            name: userData.name || email,
            surname: userData.surname || '',
            phone: userData.phone || '',
            role: newRole,
            discountPercentage: discountPercentage,
            discountUsageType: discountUsageType,
            discountUsed: discountUsed,
            discountExpiresAt: discountExpiresAt
          }));
        }

        setSuccessMessage(t('auth.loginSuccess'));
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      } else {
        const previousRole = localStorage.getItem('userRole');
        if (previousRole) {
          clearCart(true);
        }

        // Validate phone (must be 9 digits after +994)
        if (phoneDigits.length !== 9) {
          setError('Telefon nömrəsi düzgün deyil (9 rəqəm olmalıdır)');
          setLoading(false);
          return;
        }
        if (!surname.trim()) {
          setError('Soyad daxil edin');
          setLoading(false);
          return;
        }

        const fullPhone = `+994${phoneDigits}`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;

        await setDoc(doc(db, 'users', userId), {
          id: userId,
          email: email,
          name: name,
          surname: surname,
          phone: fullPhone,
          role: 'customer',
          discountPercentage: 0,
          discountUsageType: 'unlimited',
          discountUsed: false,
          createdAt: new Date().toISOString()
        });

        localStorage.setItem('userRole', 'customer');
        localStorage.setItem('userName', name);
        localStorage.setItem('userSurname', surname);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userPhone', fullPhone);
        localStorage.setItem('userId', userId);

        localStorage.setItem('userData', JSON.stringify({
          id: userId,
          email: email,
          name: name,
          surname: surname,
          phone: fullPhone,
          role: 'customer',
          discountPercentage: 0,
          discountUsageType: 'unlimited',
          discountUsed: false
        }));

        setSuccessMessage(t('auth.registerSuccess'));
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

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
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="font-playfair text-3xl text-center mb-6">
          {isLogin ? t('auth.customerTitle') : t('auth.customerRegisterTitle')}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Soyad
                  </label>
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
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          {!isLogin && (
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
                  value={phoneDigits.replace(/(\d{2})(\d{3})(\d{2})(\d{2}).*/, '$1 $2 $3 $4')}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setPhoneDigits(onlyDigits);
                  }}
                  placeholder="50 123 45 67"
                  maxLength={13}
                  required={!isLogin}
                  className="flex-1 px-3 py-3 text-sm focus:outline-none"
                  data-testid="customer-register-phone"
                />
              </div>
            </div>
          )}

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
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
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
