import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, X, Truck, ToggleLeft, ToggleRight, Edit3 } from 'lucide-react';
import {
  getDeliveryMethods,
  addDeliveryMethod,
  updateDeliveryMethod,
  deleteDeliveryMethod,
  type DeliveryMethod,
} from '../../services/deliveryMethodService';

const empty: Omit<DeliveryMethod, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  price: 0,
  estimatedDays: '',
  isActive: true,
  order: 0,
};

const DeliveryMethodsTab: React.FC = () => {
  const [methods, setMethods] = useState<DeliveryMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setMethods(await getDeliveryMethods(false));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert('Adı daxil edin');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateDeliveryMethod(editingId, form);
      } else {
        await addDeliveryMethod(form);
      }
      setForm({ ...empty });
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (e) {
      alert('Yadda saxlanmadı: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m: DeliveryMethod) => {
    setEditingId(m.id!);
    setForm({
      name: m.name,
      description: m.description || '',
      price: m.price,
      estimatedDays: m.estimatedDays || '',
      isActive: m.isActive,
      order: m.order ?? 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu çatdırılma üsulunu silmək istəyirsiniz?')) return;
    try {
      await deleteDeliveryMethod(id);
      await load();
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const handleToggleActive = async (m: DeliveryMethod) => {
    try {
      await updateDeliveryMethod(m.id!, { isActive: !m.isActive });
      await load();
    } catch (e) {
      alert('Dəyişdirilmədi: ' + (e as Error).message);
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
    <div className="space-y-6" data-testid="delivery-methods-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Çatdırılma Üsulları</h2>
            <p className="text-sm text-gray-500">{methods.length} üsul · müştəri checkout-da seçir</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ ...empty });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800 text-sm font-medium"
            data-testid="delivery-add-btn"
          >
            <Plus className="h-4 w-4" />
            Yeni üsul əlavə et
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">
              {editingId ? 'Üsulu redaktə et' : 'Yeni çatdırılma üsulu'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm({ ...empty });
              }}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Ad *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Məs: Bakı daxili çatdırılma"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm"
                data-testid="delivery-form-name"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Təsvir</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Məs: Bakı şəhəri daxilində kuryer ilə çatdırılma"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qiymət (₼)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm"
                data-testid="delivery-form-price"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">0 = pulsuz</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Təxmini müddət</label>
              <input
                type="text"
                value={form.estimatedDays}
                onChange={(e) => setForm({ ...form, estimatedDays: e.target.value })}
                placeholder="Məs: 1-2 iş günü"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sıra</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                Aktiv (müştəriyə görünür)
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 text-sm font-medium"
              data-testid="delivery-form-save"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? 'Yenilə' : 'Əlavə et'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm({ ...empty });
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
            >
              Ləğv et
            </button>
          </div>
        </div>
      )}

      {methods.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Truck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">Hələ çatdırılma üsulu əlavə edilməyib</p>
          <p className="text-xs text-gray-400">"Yeni üsul əlavə et" düyməsi ilə başlayın</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {methods.map((m) => (
            <div
              key={m.id}
              className={`bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${
                m.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
              data-testid={`delivery-method-${m.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{m.name}</h3>
                  {!m.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Deaktiv</span>
                  )}
                </div>
                {m.description && <p className="text-sm text-gray-600">{m.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span className="font-semibold text-gray-900">
                    {m.price > 0 ? `${m.price.toFixed(2)} ₼` : 'Pulsuz'}
                  </span>
                  {m.estimatedDays && <span>· {m.estimatedDays}</span>}
                  <span>· Sıra: {m.order ?? 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleActive(m)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title={m.isActive ? 'Deaktiv et' : 'Aktiv et'}
                >
                  {m.isActive ? (
                    <ToggleRight className="h-5 w-5 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => handleEdit(m)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(m.id!)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryMethodsTab;
