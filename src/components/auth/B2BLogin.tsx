import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import B2BRequestForm from './B2BRequestForm';
import SuccessNotification from '../SuccessNotification';
import { useCart } from '../../context/CartContext';

const B2BLogin: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const { clearCart } = useCart();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const role = localStorage.getItem('userRole');
        if (role === 'b2b') {
          setIsLoggedIn(true);
          setUserName(localStorage.getItem('userName') || user.email || '');
        }
      } else {
        setIsLoggedIn(false);
        setUserName('');
      }
    });
    return () => unsubscribe();
  }, []);

  // Redirect after login (kept as effect so hooks are not skipped on re-render)
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/products');
    }
  }, [isLoggedIn, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      window.dispatchEvent(new Event('userRoleChanged'));
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('userDiscount');
      localStorage.removeItem('userDiscountType');
      localStorage.removeItem('userId');
      localStorage.removeItem('userData');
      clearCart(true);
      setIsLoggedIn(false);
      navigate('/');
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError('');
    setLoginLoading(true);

    try {
      const previousRole = localStorage.getItem('userRole');
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('../../lib/firebase');

      await signInWithEmailAndPassword(auth, email, password);

      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        if (userData.role === 'b2b') {
          // Hər B2B login-də səbət təmizlənir (əvvəlki guest/customer cart qarışmasın)
          if (previousRole !== 'b2b') {
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

          localStorage.setItem('userRole', 'b2b');
          window.dispatchEvent(new Event('userRoleChanged'));
          localStorage.setItem('userName', userData.name || email);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userPhone', userData.phone || '');
          localStorage.setItem('userDiscount', validDiscount.toString());
          localStorage.setItem('userDiscountType', discountUsageType);
          localStorage.setItem('userId', userData.id);

          localStorage.setItem('userData', JSON.stringify({
            id: userData.id,
            email: email,
            name: userData.name,
            surname: userData.surname || '',
            phone: userData.phone,
            companyName: userData.companyName || '',
            role: 'b2b',
            discountPercentage: discountPercentage,
            discountUsageType: discountUsageType,
            discountUsed: discountUsed,
            discountExpiresAt: discountExpiresAt
          }));

          setShowSuccess(true);
          setTimeout(() => {
            setIsLoggedIn(true);
            setUserName(userData.name || email);
            window.location.reload();
          }, 1200);
        } else {
          setLoginError(t('auth.notB2BUser'));
          setLoginLoading(false);
        }
      } else {
        setLoginError(t('auth.invalidCredentials'));
        setLoginLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(t('auth.invalidCredentials'));
      setLoginLoading(false);
    }
  };

  // Avoid rendering the rest of the UI while we redirect (but DON'T return before all hooks above run!)
  if (isLoggedIn) {
    return null;
  }

  return (
    <>
      {showSuccess && (
        <SuccessNotification
          message={t('auth.b2bLoginSuccess')}
          onClose={() => setShowSuccess(false)}
        />
      )}

      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        {!showRequestForm && !showLogin ? (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.b2bCollaboration')}</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">{t('auth.b2bAdvantages')}</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li>✓ {t('auth.b2bAdvantage1')}</li>
                  <li>✓ {t('auth.b2bAdvantage2')}</li>
                  <li>✓ {t('auth.b2bAdvantage3')}</li>
                </ul>
              </div>

              <button
                onClick={() => setShowLogin(true)}
                className="w-full bg-black text-white py-3 px-4 rounded-md hover:bg-gray-900 transition-colors font-medium"
              >
                {t('auth.b2bLogin')}
              </button>

              <button
                onClick={() => setShowRequestForm(true)}
                className="w-full bg-white text-black border-2 border-black py-3 px-4 rounded-md hover:bg-gray-50 transition-colors font-medium"
              >
                {t('auth.b2bRequestButton')}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  <button
                    onClick={() => navigate('/')}
                    className="text-black hover:underline font-medium"
                  >
                    {t('auth.backToHome')}
                  </button>
                </p>
              </div>
            </div>
          </div>
        ) : showLogin ? (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <button
              onClick={() => setShowLogin(false)}
              className="text-gray-600 hover:text-gray-900 mb-4 text-sm"
            >
              {t('auth.backButton')}
            </button>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.b2bLoginTitle')}</h2>
              <p className="text-gray-600 text-sm">
                {t('auth.b2bLoginSubtitle')}
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.email')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.password')}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-black text-white py-3 px-4 rounded-md hover:bg-gray-900 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="b2b-login-submit"
              >
                {loginLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {loginLoading ? 'Daxil olunur...' : t('auth.signIn')}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <button
              onClick={() => setShowRequestForm(false)}
              className="text-gray-600 hover:text-gray-900 mb-4 text-sm"
            >
              {t('auth.backButton')}
            </button>
            <B2BRequestForm onSuccess={() => {
              setShowRequestForm(false);
              alert(t('auth.requestSuccess'));
            }} />
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default B2BLogin;
