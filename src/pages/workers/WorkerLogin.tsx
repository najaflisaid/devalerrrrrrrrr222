import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorker } from '../../context/WorkerContext';
import { LogIn, AlertCircle } from 'lucide-react';

const WorkerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useWorker();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/workers/dashboard');
    } catch (err: any) {
      setError('Email və ya şifrə yanlışdır');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo və Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">İşçi Girişi</h1>
            <p className="text-gray-600">Hesabınıza daxil olun</p>
          </div>

          {/* Error mesajı */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="ornek@devaleur.az"
                required
                data-testid="worker-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Şifrə
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                required
                data-testid="worker-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="worker-login-button"
            >
              {loading ? 'Giriş edilir...' : 'Daxil ol'}
            </button>
          </form>

          {/* Admin login linki */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Admin isiniz?{' '}
              <button
                onClick={() => navigate('/workers/admin-login')}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Admin girişi
              </button>
            </p>
          </div>
        </div>

        {/* Ana səhifəyə qayıt */}
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Ana səhifəyə qayıt
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerLogin;
