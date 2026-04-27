import React, { useEffect, useState } from 'react';
import { Lock, Save, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { getAdminPasswords, updateAdminPasswords, type AdminPasswords } from '../../services/adminPasswordService';

const PasswordsManagementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [data, setData] = useState<AdminPasswords>({ default: '', workers: '', workersEdit: '' });
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await getAdminPasswords();
      setData(d);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const saveOne = async (key: keyof AdminPasswords) => {
    setError('');
    const value = (data[key] || '').trim();
    if (value.length < 4) {
      setError('Şifrə ən az 4 simvol olmalıdır');
      return;
    }
    setSaving(true);
    try {
      await updateAdminPasswords({ [key]: value });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e: any) {
      setError(e?.message || 'Saxlanmadı');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  const Row = ({ k, label, hint }: { k: keyof AdminPasswords; label: string; hint: string }) => (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/40" data-testid={`password-row-${k}`}>
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-4 w-4 text-gray-700" />
        <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
      </div>
      <p className="text-xs text-gray-600 mb-3">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type={showSecrets ? 'text' : 'password'}
          value={data[k]}
          onChange={(e) => setData(d => ({ ...d, [k]: e.target.value }))}
          placeholder="Yeni şifrə..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          data-testid={`password-input-${k}`}
        />
        <button
          onClick={() => saveOne(k)}
          disabled={saving}
          data-testid={`password-save-${k}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saxla
        </button>
        {savedKey === k && (
          <span className="text-xs text-emerald-600 font-medium">✓ Yeniləndi</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="passwords-management-tab">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">Şifrə İdarəetməsi</h2>
          </div>
          <button
            onClick={() => setShowSecrets(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSecrets ? 'Gizlət' : 'Göstər'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Admin panelinin qorunan bölmələri üçün şifrələr. Hər biri ayrıca dəyişdirilə bilər.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="space-y-3">
          <Row
            k="default"
            label="Ümumi qorunan bölmə şifrəsi"
            hint="B2B, B2B Sifarişləri, Bildirişlər, B2B İstifadəçilər və digər ümumi qorunan bölmələrə daxil olmaq üçün."
          />
          <Row
            k="workers"
            label="İşçilər bölməsi şifrəsi"
            hint="“İşçilər” bölməsinə daxil olmaq üçün ayrı şifrə."
          />
          <Row
            k="workersEdit"
            label="İşçi redaktə kilidi"
            hint="İşçi məlumatlarını redaktə etmək, silmək və ya yeni işçi əlavə etmək üçün ayrıca lazım olan şifrə."
          />
        </div>
      </div>
    </div>
  );
};

export default PasswordsManagementTab;
