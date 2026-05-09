import React, { useEffect, useState } from 'react';
import { MessageSquare, Save, RefreshCw, Send, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  '';

interface WhatsAppConfigPublic {
  phone_id: string;
  access_token_masked: string;
  has_token: boolean;
  business_account_id: string;
  api_version: string;
  sender_display: string;
  firebase_ready: boolean;
}

const WhatsAppSettingsTab: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfigPublic | null>(null);
  const [adminSecret, setAdminSecret] = useState<string>(
    () => localStorage.getItem('adminApiSecret') || 'devaleur-admin-2026'
  );
  const [phoneId, setPhoneId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [apiVersion, setApiVersion] = useState('v22.0');
  const [senderDisplay, setSenderDisplay] = useState('+994777577277');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('DE VALEUR test mesajı – əgər bunu görürsünüzsə, inteqrasiya işləyir.');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/whatsapp-config`, {
        headers: { 'X-Admin-Secret': adminSecret },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WhatsAppConfigPublic;
      setConfig(data);
      setPhoneId(data.phone_id);
      setBusinessAccountId(data.business_account_id);
      setApiVersion(data.api_version);
      setSenderDisplay(data.sender_display);
      // Don't pre-fill token; admin must paste new one to update
      setAccessToken('');
    } catch (e: any) {
      showToast(false, e?.message || 'Konfiqurasiya yüklənmədi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('adminApiSecret', adminSecret);
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/whatsapp-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({
          phone_id: phoneId.trim(),
          access_token: accessToken.trim(), // empty = keep existing
          business_account_id: businessAccountId.trim(),
          api_version: apiVersion.trim() || 'v22.0',
          sender_display: senderDisplay.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WhatsAppConfigPublic;
      setConfig(data);
      setAccessToken('');
      showToast(true, 'WhatsApp konfiqurasiyası yadda saxlanıldı.');
    } catch (e: any) {
      showToast(false, e?.message || 'Konfiqurasiya yadda saxlanmadı');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/whatsapp-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ to_phone: testTo.trim(), message: testMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, text: data.detail || `HTTP ${res.status}` });
        return;
      }
      if (data.success) {
        setTestResult({ ok: true, text: `Göndərildi! Mesaj ID: ${data.message_id}` });
      } else {
        setTestResult({ ok: false, text: data.detail || data.error || 'Naməlum xəta' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, text: e?.message || 'Şəbəkə xətası' });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-gray-700" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">WhatsApp Cloud API</h2>
            <p className="text-sm text-gray-500">Şifrə bərpası mesajları üçün Meta hesab açarları</p>
          </div>
        </div>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading}
          data-testid="wa-refresh-btn"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      {!config?.firebase_ready && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg mb-6 text-sm flex gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Firebase Admin SDK aktiv deyil</p>
            <p className="text-xs mt-1">
              Şifrə sıfırlama endpoint-ləri Firebase service account tələb edir. Faylı{' '}
              <code className="px-1 bg-amber-100 rounded">/app/backend/firebase-service-account.json</code> yerinə qoyun və backend-i yenidən başladın.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Göstərilən göndərici nömrə
            <span className="text-xs font-normal text-gray-500 ml-2">(müştəri "WhatsApp-dan + bu nömrədən gözləyin" mətnini görür)</span>
          </label>
          <input
            type="text"
            value={senderDisplay}
            onChange={(e) => setSenderDisplay(e.target.value)}
            placeholder="+994777577277"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
            data-testid="wa-sender-display"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number ID</label>
          <input
            type="text"
            value={phoneId}
            onChange={(e) => setPhoneId(e.target.value)}
            placeholder="Meta-dan aldığınız 15+ rəqəmli ID"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
            data-testid="wa-phone-id"
          />
          <p className="text-xs text-gray-500 mt-1">Meta Business Manager → WhatsApp Manager → Account Tools → Phone Numbers</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Permanent Access Token
            {config?.has_token && (
              <span className="text-xs font-normal text-emerald-600 ml-2">Hazırda təyin olunub: {config.access_token_masked}</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={config?.has_token ? 'Yenisini yazın və ya boş buraxın (köhnə qalsın)' : 'EAA... ilə başlayan token'}
              className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
              data-testid="wa-access-token"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Business Settings → System Users → "Generate New Token" (whatsapp_business_messaging icazəsi ilə)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Account ID</label>
          <input
            type="text"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="WhatsApp Business Account ID"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
            data-testid="wa-business-account-id"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">API Version</label>
          <input
            type="text"
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            placeholder="v22.0"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
            data-testid="wa-api-version"
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin API Secret (yerli)</label>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => { setAdminSecret(e.target.value); localStorage.setItem('adminApiSecret', e.target.value); }}
            placeholder="X-Admin-Secret header dəyəri"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none font-mono text-sm"
            data-testid="wa-admin-secret"
          />
          <p className="text-xs text-gray-500 mt-1">Backend ADMIN_API_SECRET ilə eyni olmalıdır. Default: devaleur-admin-2026</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
            data-testid="wa-save-btn"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Yadda saxlanılır...' : 'Yadda saxla'}
          </button>
        </div>
      </div>

      {/* TEST */}
      <div className="mt-10 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Send className="h-5 w-5" /> Test mesajı göndər
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="tel"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="+994501234567"
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
            data-testid="wa-test-phone"
          />
          <button
            onClick={handleTest}
            disabled={!testTo}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400"
            data-testid="wa-test-send-btn"
          >
            <Send className="h-4 w-4" /> Test göndər
          </button>
        </div>
        <textarea
          value={testMsg}
          onChange={(e) => setTestMsg(e.target.value)}
          rows={3}
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
        />
        {testResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm flex gap-2 ${
              testResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
            data-testid="wa-test-result"
          >
            {testResult.ok ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            {testResult.text}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[110] px-4 py-3 rounded-xl shadow-2xl text-sm flex items-center gap-2 ${
            toast.ok ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
          data-testid="wa-toast"
        >
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default WhatsAppSettingsTab;
