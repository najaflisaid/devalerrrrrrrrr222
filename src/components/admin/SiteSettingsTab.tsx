import React, { useState, useEffect } from 'react';
import { Loader2, Save, Plus, Trash2, CreditCard, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTheme } from '../../context/ThemeContext';

interface PaymentCard {
  id: string;
  name: string;
  iconUrl?: string;
}

interface SiteSettings {
  copyrightText: string;
  paymentCards: PaymentCard[];
}

const defaultSettings: SiteSettings = {
  copyrightText: '© 2025 De Valeur. Bütün hüquqlar qorunur',
  paymentCards: [
    { id: '1', name: 'TamKart', iconUrl: '' },
    { id: '2', name: 'BirKart', iconUrl: '' },
    { id: '3', name: 'LeoKart', iconUrl: '' },
    { id: '4', name: 'Visa', iconUrl: '' },
    { id: '5', name: 'Mastercard', iconUrl: '' },
  ]
};

const SiteSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'site_settings', 'footer');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data() as SiteSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'site_settings', 'footer'), settings);
      alert('Parametrlər saxlanıldı!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    if (!newCardName.trim()) return;
    setSettings({
      ...settings,
      paymentCards: [
        ...settings.paymentCards,
        { id: Date.now().toString(), name: newCardName.trim(), iconUrl: newCardIcon.trim() }
      ]
    });
    setNewCardName('');
    setNewCardIcon('');
  };

  const removeCard = (id: string) => {
    setSettings({
      ...settings,
      paymentCards: settings.paymentCards.filter(c => c.id !== id)
    });
  };

  const updateCardIcon = (id: string, iconUrl: string) => {
    setSettings({
      ...settings,
      paymentCards: settings.paymentCards.map(c => 
        c.id === id ? { ...c, iconUrl } : c
      )
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Sayt Parametrləri</h2>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Saxla
        </button>
      </div>

      {/* ========== Site Theme Toggle ========== */}
      <SiteThemePanel />

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Copyright Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Copyright Mətni (Səhifənin altında görünən)
          </label>
          <input
            type="text"
            value={settings.copyrightText}
            onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="© 2025 De Valeur. Bütün hüquqlar qorunur"
          />
        </div>

        {/* Payment Cards */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <CreditCard className="h-4 w-4 inline mr-2" />
            Ödəniş Kartları (Footer-da görünən)
          </label>
          <p className="text-xs text-gray-500 mb-4">İkon URL əlavə etsəniz, yalnız ikon görünəcək. Boş buraxsanız, yalnız ad görünəcək.</p>
          
          <div className="space-y-3 mb-4">
            {settings.paymentCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{card.name}</p>
                  <input
                    type="url"
                    value={card.iconUrl || ''}
                    onChange={(e) => updateCardIcon(card.id, e.target.value)}
                    placeholder="İkon URL (məs: https://...png)"
                    className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-black focus:border-transparent"
                  />
                </div>
                {card.iconUrl && (
                  <img src={card.iconUrl} alt={card.name} className="h-6 w-auto object-contain" />
                )}
                <button
                  onClick={() => removeCard(card.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              placeholder="Kart adı"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <input
              type="url"
              value={newCardIcon}
              onChange={(e) => setNewCardIcon(e.target.value)}
              placeholder="İkon URL (istəyə bağlı)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <button
              onClick={addCard}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              Əlavə et
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Önizləmə:</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg">
            <div className="flex flex-wrap items-center justify-center gap-4 mb-2">
              {settings.paymentCards.map((card) => (
                card.iconUrl ? (
                  <img 
                    key={card.id} 
                    src={card.iconUrl} 
                    alt={card.name} 
                    className="h-4 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
                    title={card.name}
                  />
                ) : (
                  <span key={card.id} className="text-xs text-gray-300">
                    {card.name}
                  </span>
                )
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">{settings.copyrightText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsTab;

/* ================= Site Theme (Dark / Light) Panel ================= */
const SiteThemePanel: React.FC = () => {
  const { theme, setTheme, loading } = useTheme();
  const [busy, setBusy] = useState(false);

  const apply = async (t: 'light' | 'dark') => {
    if (t === theme || busy) return;
    setBusy(true);
    try {
      await setTheme(t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6"
      data-testid="site-theme-panel"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="h-5 w-5 text-[#D4AF37]" /> : <Sun className="h-5 w-5 text-amber-500" />}
            Sayt teması
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Saytı qara (dark) və ya ağ (light) temaya keçirin. Dəyişiklik bütün ziyarətçilər üçün tətbiq olunur.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Hazırkı: <span className="font-semibold">{theme === 'dark' ? 'Qara' : 'Ağ'}</span>
            {loading && <span className="ml-2 text-gray-400">yüklənir...</span>}
          </p>
        </div>

        <div className="inline-flex p-1 bg-gray-100 rounded-full" role="group">
          <button
            type="button"
            onClick={() => apply('light')}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              theme === 'light'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
            data-testid="site-theme-light"
          >
            <Sun className="h-4 w-4" /> Ağ
          </button>
          <button
            type="button"
            onClick={() => apply('dark')}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              theme === 'dark'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
            data-testid="site-theme-dark"
          >
            <Moon className="h-4 w-4" /> Qara
          </button>
        </div>
      </div>
    </div>
  );
};

