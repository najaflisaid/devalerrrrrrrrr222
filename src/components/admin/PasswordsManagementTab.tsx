import React, { useEffect, useState } from 'react';
import { Lock, Save, Loader2, Eye, EyeOff, Shield, Unlock } from 'lucide-react';
import {
  getAdminPasswords,
  updateAdminPasswords,
  updateSectionConfig,
  type AdminPasswords,
  type SectionPasswordConfig,
} from '../../services/adminPasswordService';

// Bütün admin paneldəki QORUNAN bölmələrin siyahısı (ID → görünən ad)
// Hər bölmənin AYRI şifrəsi olur, default şifrə artıq istifadə edilmir.
const SECTIONS: { id: string; label: string }[] = [
  { id: 'customerOrders', label: 'Müştəri Sifarişləri' },
  { id: 'b2bOrders', label: 'B2B Sifarişləri' },
  { id: 'b2b', label: 'B2B Müraciətləri' },
  { id: 'b2bUsers', label: 'B2B İstifadəçilər' },
  { id: 'b2bNotifications', label: 'B2B Bildirişləri' },
  { id: 'analytics', label: 'Analitika' },
  { id: 'epointSettings', label: 'Epoint Açarları' },
  { id: 'deliveryMethods', label: 'Çatdırılma Üsulları' },
  { id: 'users', label: 'İstifadəçilər' },
  { id: 'workers', label: 'İşçilər bölməsi (giriş)' },
  { id: 'passwordsAdmin', label: 'Şifrələr İdarəetməsi' },
];

const PasswordsManagementTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [data, setData] = useState<AdminPasswords>({
    default: '',
    workers: '',
    workersEdit: '',
    perSection: {},
  });
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Per-section local edit state
  const [sectionEdits, setSectionEdits] = useState<Record<string, SectionPasswordConfig>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await getAdminPasswords();
      setData(d);
      setSectionEdits(d.perSection || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const saveOne = async (key: keyof AdminPasswords) => {
    setError('');
    const value = ((data[key] as string) || '').trim();
    if (value.length < 4) {
      setError('Şifrə ən az 4 simvol olmalıdır');
      return;
    }
    setSaving(true);
    try {
      await updateAdminPasswords({ [key]: value } as Partial<AdminPasswords>);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e: any) {
      setError(e?.message || 'Saxlanmadı');
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionId: string) => {
    setError('');
    const cfg = sectionEdits[sectionId] || {};
    const password = (cfg.password || '').trim();
    // If noPassword is on, password not required. Otherwise validate length if provided.
    if (!cfg.noPassword && password.length > 0 && password.length < 4) {
      setError('Şifrə ən az 4 simvol olmalıdır');
      return;
    }
    setSaving(true);
    try {
      await updateSectionConfig(sectionId, {
        password,
        noPassword: !!cfg.noPassword,
      });
      setSavedKey(`section-${sectionId}`);
      setTimeout(() => setSavedKey(null), 2000);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Saxlanmadı');
    } finally {
      setSaving(false);
    }
  };

  const setSection = (sectionId: string, patch: Partial<SectionPasswordConfig>) => {
    setSectionEdits((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), ...patch },
    }));
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
        <h3 className="font-semibold text-gray-900">{label}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">{hint}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type={showSecrets ? 'text' : 'password'}
          value={(data[k] as string) || ''}
          onChange={(e) => setData({ ...data, [k]: e.target.value } as AdminPasswords)}
          placeholder="Yeni şifrə..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm"
          data-testid={`password-input-${k}`}
        />
        <button
          onClick={() => saveOne(k)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 text-sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {savedKey === k ? 'Yadda saxlanıldı' : 'Yadda saxla'}
        </button>
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
            onClick={() => setShowSecrets((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSecrets ? 'Gizlət' : 'Göstər'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Hər bölmə üçün ayrıca şifrə təyin edə bilərsiniz. Aşağıdakı xüsusi açarlar İşçilər bölməsi üçündür.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="space-y-3">
          <Row
            k="workersEdit"
            label="İşçi redaktə kilidi"
            hint="İşçi məlumatlarını redaktə etmək, silmək və ya yeni işçi əlavə etmək üçün ayrıca lazım olan şifrə."
          />
        </div>
      </div>

      {/* Per-section management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Unlock className="h-5 w-5 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Bölmə üzrə Xüsusi Şifrələr</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Hər admin bölməsi üçün ayrıca şifrə təyin edə və ya şifrəni tamamilə deaktiv edə bilərsiniz.
          Şifrə boş qalarsa, yuxarıdakı default şifrə işləyəcək.
        </p>

        <div className="space-y-2">
          {SECTIONS.map((s) => {
            const cfg = sectionEdits[s.id] || {};
            const saved = savedKey === `section-${s.id}`;
            return (
              <div
                key={s.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50/30"
                data-testid={`section-config-${s.id}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <p className="font-medium text-sm text-gray-900">{s.label}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{s.id}</p>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cfg.noPassword}
                      onChange={(e) => setSection(s.id, { noPassword: e.target.checked })}
                      className="w-3.5 h-3.5"
                      data-testid={`section-no-password-${s.id}`}
                    />
                    Şifrəsiz
                  </label>

                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={cfg.password || ''}
                    onChange={(e) => setSection(s.id, { password: e.target.value })}
                    placeholder={cfg.noPassword ? '— şifrəsiz —' : 'Xüsusi şifrə (boş = default)'}
                    disabled={!!cfg.noPassword}
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
                    data-testid={`section-password-input-${s.id}`}
                  />
                  <button
                    onClick={() => saveSection(s.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-60 text-xs"
                    data-testid={`section-save-${s.id}`}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {saved ? '✓' : 'Saxla'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PasswordsManagementTab;
