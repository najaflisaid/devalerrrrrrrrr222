import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ProtectedAdminSectionProps {
  children: React.ReactNode;
}

const ADMIN_PASSWORD = 'Rasim7277';
const PASSWORD_KEY = 'admin_section_authenticated';

export default function ProtectedAdminSection({ children }: ProtectedAdminSectionProps) {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(PASSWORD_KEY);
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handlePasswordSubmit = () => {
    const password = prompt(t('admin.passwordPrompt'));

    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(PASSWORD_KEY, 'true');
    } else if (password !== null) {
      alert(t('admin.invalidPassword'));
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('admin.title')}
            </h2>
            <p className="text-gray-600">
              {t('admin.passwordPrompt')}
            </p>
          </div>

          <button
            onClick={handlePasswordSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {t('auth.login')}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
