import React, { useEffect, useState } from 'react';
import { Gift, Plus, Trash2, Save, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productService } from '../../services/productService';
import type { Product } from '../../types';

interface FormState {
  id?: string;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  descAz: string;
  descEn: string;
  descRu: string;
  price: string;
  imageUrl: string;
  isEnabled: boolean;
}

const empty: FormState = {
  nameAz: '',
  nameEn: '',
  nameRu: '',
  descAz: '',
  descEn: '',
  descRu: '',
  price: '',
  imageUrl: '',
  isEnabled: true,
};

const GiftCardsTab: React.FC = () => {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), where('isGiftCard', '==', true)));
      const list: Product[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as any), id: d.id } as Product));
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
      setItems(list);
    } catch (e) {
      console.error(e);
      alert('Yükləmə xətası: ' + (e as any)?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setForm(empty);
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setForm({
      id: p.id,
      nameAz: p.name?.az || '',
      nameEn: p.name?.en || '',
      nameRu: p.name?.ru || '',
      descAz: p.description?.az || '',
      descEn: p.description?.en || '',
      descRu: p.description?.ru || '',
      price: String(p.price || ''),
      imageUrl: p.images?.[0] || '',
      isEnabled: p.isEnabled !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const price = parseFloat(form.price);
    if (!form.nameAz.trim() && !form.nameEn.trim()) {
      alert('Ən azı bir dildə ad daxil edin');
      return;
    }
    if (!price || price <= 0) {
      alert('Düzgün qiymət daxil edin');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: {
          az: form.nameAz.trim() || form.nameEn.trim(),
          en: form.nameEn.trim() || form.nameAz.trim(),
          ru: form.nameRu.trim() || form.nameAz.trim() || form.nameEn.trim(),
        },
        description: {
          az: form.descAz.trim(),
          en: form.descEn.trim(),
          ru: form.descRu.trim(),
        },
        price,
        images: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
        category: 'gift-card',
        brand: 'De Valeur',
        gender: 'unisex' as const,
        isEnabled: form.isEnabled,
        isGiftCard: true,
        stock: 9999,
      };

      if (form.id) {
        await productService.update(form.id, payload);
      } else {
        await productService.add(payload);
      }

      setShowForm(false);
      setForm(empty);
      await load();
    } catch (e: any) {
      console.error(e);
      alert('Yadda saxlama xətası: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`"${p.name?.az || p.name?.en}" hədiyyə kartını silmək istəyirsinizmi?`)) return;
    try {
      await productService.delete(p.id);
      await load();
    } catch (e: any) {
      alert('Silmə xətası: ' + e?.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-6 h-6" /> Hədiyyə Kartları
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Müştərilər bu kartı alanda hesabları üçün avtomatik unikal promo kod yaranır.
          </p>
        </div>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          data-testid="gift-cards-add-btn"
        >
          <Plus className="w-4 h-4" /> Yeni Hədiyyə Kartı
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Hələ hədiyyə kartı yoxdur. "Yeni Hədiyyə Kartı" düyməsi ilə əlavə edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden" data-testid={`gift-card-row-${p.id}`}>
              <div className="aspect-[16/10] bg-gradient-to-br from-black to-[#2a2218] relative overflow-hidden">
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name?.az} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                )}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">De Valeur</p>
                  <p className="text-xl font-medium">{p.price.toFixed(0)} AZN</p>
                </div>
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-900 mb-1">{p.name?.az || p.name?.en}</p>
                <p className="text-xs text-gray-500 mb-3">
                  {p.isEnabled ? '✓ Aktiv' : '○ Deaktiv'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded"
                    data-testid={`gift-card-edit-${p.id}`}
                  >
                    Redaktə et
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="px-3 py-2 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded inline-flex items-center gap-1"
                    data-testid={`gift-card-delete-${p.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? 'Hədiyyə Kartını Redaktə Et' : 'Yeni Hədiyyə Kartı'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Bağla"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qiymət (AZN) *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="100"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                  data-testid="gift-card-form-price"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Müştəri bu kartı alanda eyni dəyərdə promo kod alacaq.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ad (AZ)</label>
                  <input
                    type="text"
                    value={form.nameAz}
                    onChange={(e) => setForm({ ...form, nameAz: e.target.value })}
                    placeholder="100 AZN Hədiyyə"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                    data-testid="gift-card-form-name-az"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name (EN)</label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="100 AZN Gift"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Имя (RU)</label>
                  <input
                    type="text"
                    value={form.nameRu}
                    onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
                    placeholder="100 AZN Подарок"
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şəkil URL (istəyə bağlı)</label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  data-testid="gift-card-form-image"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıqlama (AZ)</label>
                <textarea
                  rows={2}
                  value={form.descAz}
                  onChange={(e) => setForm({ ...form, descAz: e.target.value })}
                  placeholder="Sevdiklərinizə hədiyyə üçün ideal..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Aktiv (saytda göstər)</span>
              </label>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ləğv et
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
                data-testid="gift-card-form-save"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Yadda saxlanılır...' : 'Yadda saxla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftCardsTab;
