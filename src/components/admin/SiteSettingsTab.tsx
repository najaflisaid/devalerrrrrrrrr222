import React, { useState, useEffect } from 'react';
import { Loader2, Save, Plus, Trash2, CreditCard } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PaymentCard {
  id: string;
  name: string;
  icon?: string;
}

interface SiteSettings {
  copyrightText: string;
  paymentCards: PaymentCard[];
}

const defaultSettings: SiteSettings = {
  copyrightText: '© 2025 De Valeur. Bütün hüquqlar qorunur',
  paymentCards: [
    { id: '1', name: 'TamKart' },
    { id: '2', name: 'BirKart' },
    { id: '3', name: 'LeoKart' },
    { id: '4', name: 'Visa' },
    { id: '5', name: 'Mastercard' },
  ]
};

const SiteSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCardName, setNewCardName] = useState('');

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
        { id: Date.now().toString(), name: newCardName.trim() }
      ]
    });
    setNewCardName('');
  };

  const removeCard = (id: string) => {
    setSettings({
      ...settings,
      paymentCards: settings.paymentCards.filter(c => c.id !== id)
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
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.paymentCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg"
              >
                <span className="text-sm">{card.name}</span>
                <button
                  onClick={() => removeCard(card.id)}
                  className="text-red-500 hover:text-red-700"
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
              placeholder="Yeni kart adı"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addCard()}
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
            <div className="flex flex-wrap gap-2 mb-2">
              {settings.paymentCards.map((card) => (
                <span key={card.id} className="text-xs text-gray-300">
                  {card.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400">{settings.copyrightText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsTab;
