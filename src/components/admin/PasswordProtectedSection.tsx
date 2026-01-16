import React, { useState, useEffect } from 'react';
import { Lock, X } from 'lucide-react';

interface PasswordProtectedSectionProps {
  children: React.ReactNode;
  sectionName: string;
}

const PasswordProtectedSection: React.FC<PasswordProtectedSectionProps> = ({ children, sectionName }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const CORRECT_PASSWORD = '20202025';

  useEffect(() => {
    setIsAuthenticated(false);
    setPassword('');
    setError('');
  }, [sectionName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Yanlış şifrə');
      setPassword('');
    }
  };

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
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Qorunan Bölmə
        </h2>
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
            className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
          >
            Daxil ol
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordProtectedSection;
