import React, { useEffect, useState } from 'react';
import { Save, Loader2, KeyRound, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { getEpointSettings, saveEpointSettings, type EpointSettings } from '../../services/epointPaymentService';

const EpointSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<EpointSettings>({
    publicKey: '',
    privateKey: '',
    successUrl: '',
    errorUrl: '',
    resultUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      const cur = await getEpointSettings();
      const origin = window.location.origin;
      setSettings({
        publicKey: cur.publicKey || '',
        privateKey: cur.privateKey || '',
        successUrl: cur.successUrl || `${origin}/payment/success`,
        errorUrl: cur.errorUrl || `${origin}/payment/error`,
        resultUrl: cur.resultUrl || `${origin}/payment/result`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEpointSettings(settings);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (e) {
      alert('Yadda saxlanmadı: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="epoint-settings-tab">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
          <KeyRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Epoint Ödəniş Açarları</h2>
          <p className="text-sm text-gray-500">Frontend-only inteqrasiya — açarlar Firestore-da saxlanılır.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Təhlükəsizlik xəbərdarlığı</p>
          <p>
            Frontend-only inteqrasiyada <strong>EPOINT_PRIVATE_KEY</strong> brauzerdə
            görünə bilər. Yalnız bu sayt üçün ayrıca açar istifadə edin və
            kompromis baş verərsə dərhal Epoint paneldən yenisi ilə əvəzləyin.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Public Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={settings.publicKey}
            onChange={(e) => setSettings({ ...settings, publicKey: e.target.value })}
            placeholder="məsələn: i0000001"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-sm"
            data-testid="epoint-public-key-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Private Key <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPrivate ? 'text' : 'password'}
              value={settings.privateKey}
              onChange={(e) => setSettings({ ...settings, privateKey: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full pl-4 pr-11 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-sm"
              data-testid="epoint-private-key-input"
            />
            <button
              type="button"
              onClick={() => setShowPrivate(!showPrivate)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700"
            >
              {showPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 mb-2">
              Aşağıdakı URL-ləri Epoint qeydiyyat formuna yapışdırın:
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Uğurlu əməliyyat linki</label>
            <input
              type="text"
              value={settings.successUrl}
              onChange={(e) => setSettings({ ...settings, successUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Uğursuz əməliyyat linki</label>
            <input
              type="text"
              value={settings.errorUrl}
              onChange={(e) => setSettings({ ...settings, errorUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nəticə (result) linki</label>
            <input
              type="text"
              value={settings.resultUrl}
              onChange={(e) => setSettings({ ...settings, resultUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {savedToast && (
              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                ✓ Yadda saxlanıldı
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors text-sm font-medium"
            data-testid="epoint-settings-save-btn"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Yadda saxla
          </button>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-700">
        <h3 className="font-semibold mb-2">Necə işləyir?</h3>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Müştəri Səbətdən "Epoint ilə ödə" düyməsinə basır.</li>
          <li>Brauzerdə imza yaradılır və Epoint checkout səhifəsinə yönləndirilir.</li>
          <li>Müştəri kart məlumatlarını Epoint-də daxil edir.</li>
          <li>Epoint müştərini "Uğurlu" və ya "Uğursuz" səhifəyə geri qaytarır.</li>
          <li>Sifariş statusu Firestore-da avtomatik yenilənir.</li>
        </ol>
      </div>
    </div>
  );
};

export default EpointSettingsTab;
