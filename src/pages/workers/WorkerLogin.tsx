import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useWorkerAuth } from '../../context/WorkerAuthContext';

const WorkerLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login, worker } = useWorkerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (worker) navigate('/workers/dashboard', { replace: true });
  }, [worker, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/workers/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.message?.includes('auth/')
        ? 'Email və ya şifrə yanlışdır.'
        : (err?.message || 'Daxil ola bilmədi.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-7">
          <img
            src="https://i.hizliresim.com/tmu65g6.png"
            alt="De Valeur"
            className="h-12 sm:h-14 mx-auto mb-3 object-contain"
            data-testid="worker-login-logo"
          />
          <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 font-medium">
            Giriş edin
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm" data-testid="worker-login-error">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="ad@devaleur.az"
                data-testid="worker-login-email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1.5">Şifrə</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="••••••••"
                data-testid="worker-login-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg uppercase tracking-[0.2em] text-xs font-medium hover:bg-[#C99B1F] transition-all disabled:opacity-60"
            data-testid="worker-login-submit"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Daxil ol
          </button>
        </form>
      </div>
    </div>
  );
};

export default WorkerLogin;
