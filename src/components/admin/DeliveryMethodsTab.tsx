import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, X, Truck, ToggleLeft, ToggleRight, Edit3, Store, MapPin } from 'lucide-react';
import {
  getDeliveryMethods,
  addDeliveryMethod,
  updateDeliveryMethod,
  deleteDeliveryMethod,
  type DeliveryMethod,
  type PickupBranch,
  DEFAULT_PICKUP_BRANCHES,
} from '../../services/deliveryMethodService';

const emptyBranch = (): PickupBranch => ({
  id: 'branch-' + Math.random().toString(36).slice(2, 8),
  name: '',
  address: '',
  mapUrl: '',
  phone: '',
});

const empty: Omit<DeliveryMethod, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  price: 0,
  estimatedDays: '',
  isActive: true,
  order: 0,
  isPickup: false,
  branches: [],
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
    if (form.isPickup) {
      const valid = (form.branches || []).filter((b) => b.name.trim() && b.address.trim());
      if (valid.length === 0) {
        alert('Ən azı bir filialı (ad + ünvan ilə) əlavə edin.');
        return;
      }
    }
    setSaving(true);
    try {
      // Strip empty branches before persist so the admin panel & checkout show
      // only the valid ones.
      const payload: Omit<DeliveryMethod, 'id' | 'createdAt'> = form.isPickup
        ? {
            ...form,
            branches: (form.branches || []).filter((b) => b.name.trim() && b.address.trim()),
          }
        : { ...form, isPickup: false, branches: [] };
      if (editingId) {
        await updateDeliveryMethod(editingId, payload);
      } else {
        await addDeliveryMethod(payload);
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
      isPickup: !!m.isPickup,
      branches: m.branches && m.branches.length > 0 ? m.branches : [],
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

  // Sürətli qiymət dəyişdirmə (inline) — admin tez-tez qiymətləri yeniləyə bilsin deyə
  const [quickPriceMap, setQuickPriceMap] = useState<Record<string, string>>({});
  const [savingQuickPriceId, setSavingQuickPriceId] = useState<string | null>(null);
  const [savedQuickPriceId, setSavedQuickPriceId] = useState<string | null>(null);

  const saveQuickPrice = async (m: DeliveryMethod) => {
    const raw = quickPriceMap[m.id!];
    if (raw === undefined) return;
    const newPrice = Math.max(0, parseFloat(raw) || 0);
    if (newPrice === m.price) {
      setQuickPriceMap((p) => ({ ...p, [m.id!]: '' }));
      return;
    }
    setSavingQuickPriceId(m.id!);
    try {
      await updateDeliveryMethod(m.id!, { price: newPrice });
      await load();
      setQuickPriceMap((p) => ({ ...p, [m.id!]: '' }));
      setSavedQuickPriceId(m.id!);
      setTimeout(() => setSavedQuickPriceId(null), 1800);
    } catch (e) {
      alert('Qiymət yenilənmədi: ' + (e as Error).message);
    } finally {
      setSavingQuickPriceId(null);
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Qiymət ( AZN)</label>
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
            <div className="sm:col-span-2 flex items-center gap-3 pt-2 border-t border-gray-200 mt-1">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700" data-testid="delivery-form-is-pickup">
                <input
                  type="checkbox"
                  checked={!!form.isPickup}
                  onChange={(e) => {
                    const isPickup = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      isPickup,
                      // When enabling pickup for the first time, prefill default branches
                      branches:
                        isPickup && (!prev.branches || prev.branches.length === 0)
                          ? [...DEFAULT_PICKUP_BRANCHES]
                          : prev.branches,
                    }));
                  }}
                  className="w-4 h-4"
                />
                <Store className="h-3.5 w-3.5 text-gray-500" />
                <span>Filialdan götürmə (müştəri ünvan yazmasın, filial seçsin)</span>
              </label>
            </div>

            {form.isPickup && (
              <div className="sm:col-span-2 bg-white border border-gray-200 rounded-lg p-3 space-y-2" data-testid="delivery-form-branches">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Filiallar ({form.branches?.length || 0})
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        branches: [...(prev.branches || []), emptyBranch()],
                      }))
                    }
                    className="inline-flex items-center gap-1 text-xs bg-gray-900 text-white px-2.5 py-1 rounded-md hover:bg-black"
                    data-testid="delivery-form-add-branch"
                  >
                    <Plus className="h-3 w-3" /> Filial əlavə et
                  </button>
                </div>
                {(form.branches || []).length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">Hələ filial əlavə edilməyib.</p>
                ) : (
                  <div className="space-y-2">
                    {(form.branches || []).map((b, idx) => (
                      <div key={b.id} className="bg-gray-50 border border-gray-200 rounded-md p-2.5 space-y-1.5" data-testid={`delivery-form-branch-${idx}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-500 font-medium">FİLİAL {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                branches: (prev.branches || []).filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Filialı sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={b.name}
                          onChange={(e) =>
                            setForm((prev) => {
                              const next = [...(prev.branches || [])];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...prev, branches: next };
                            })
                          }
                          placeholder="DE VALEUR — Bakı, Azadlıq Prospekti"
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={b.address}
                          onChange={(e) =>
                            setForm((prev) => {
                              const next = [...(prev.branches || [])];
                              next[idx] = { ...next[idx], address: e.target.value };
                              return { ...prev, branches: next };
                            })
                          }
                          placeholder="Bakı şəh., Azadlıq Prospekti"
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={b.phone || ''}
                            onChange={(e) =>
                              setForm((prev) => {
                                const next = [...(prev.branches || [])];
                                next[idx] = { ...next[idx], phone: e.target.value };
                                return { ...prev, branches: next };
                              })
                            }
                            placeholder="Telefon (istəyə bağlı)"
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                          />
                          <input
                            type="url"
                            value={b.mapUrl || ''}
                            onChange={(e) =>
                              setForm((prev) => {
                                const next = [...(prev.branches || [])];
                                next[idx] = { ...next[idx], mapUrl: e.target.value };
                                return { ...prev, branches: next };
                              })
                            }
                            placeholder="Xəritə linki (istəyə bağlı)"
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
        <>
          {/* Sürətli qiymət paneli — qiymətləri tez dəyişdirmək üçün (cədvəl şəklində) */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4" data-testid="delivery-quick-prices">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <h3 className="font-semibold text-gray-900 text-sm">Sürətli qiymət yeniləmə</h3>
              <span className="text-[11px] text-amber-700 ml-auto">Yalnız qiyməti dəyişdirib Enter basın və ya ✓ düyməsinə kliklə</span>
            </div>
            <div className="space-y-2">
              {methods.map((m) => {
                const draft = quickPriceMap[m.id!] ?? '';
                const numeric = draft === '' ? null : Math.max(0, parseFloat(draft) || 0);
                const changed = numeric !== null && numeric !== m.price;
                const saving = savingQuickPriceId === m.id!;
                const justSaved = savedQuickPriceId === m.id!;
                return (
                  <div key={`qp-${m.id}`} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <Truck className={`h-4 w-4 ${m.isActive ? 'text-gray-700' : 'text-gray-300'} flex-shrink-0`} />
                    <span className={`text-sm font-medium flex-1 truncate ${m.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{m.name}</span>
                    <span className="text-[11px] text-gray-400 hidden sm:inline">cari:</span>
                    <span className="text-sm font-mono text-gray-700 tabular-nums w-20 text-right hidden sm:inline">{m.price.toFixed(2)} AZN</span>
                    <span className="text-gray-300 hidden sm:inline">→</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft}
                        placeholder={m.price.toFixed(2)}
                        onChange={(e) => setQuickPriceMap((p) => ({ ...p, [m.id!]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveQuickPrice(m);
                          if (e.key === 'Escape') setQuickPriceMap((p) => ({ ...p, [m.id!]: '' }));
                        }}
                        className={`w-24 px-2 py-1.5 border rounded-md text-sm font-mono text-right tabular-nums focus:ring-2 focus:ring-gray-900 focus:outline-none ${
                          changed ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                        }`}
                        data-testid={`delivery-quick-price-input-${m.id}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none"> AZN</span>
                    </div>
                    <button
                      onClick={() => saveQuickPrice(m)}
                      disabled={!changed || saving}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all ${
                        justSaved
                          ? 'bg-emerald-50 text-emerald-700'
                          : changed
                          ? 'bg-gray-900 text-white hover:bg-black'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title="Yeni qiyməti saxla"
                      data-testid={`delivery-quick-price-save-${m.id}`}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : justSaved ? <span>✓ Saxlandı</span> : <Save className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

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
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                  <span className="font-semibold text-gray-900">
                    {m.price > 0 ? `${m.price.toFixed(2)} AZN` : 'Pulsuz'}
                  </span>
                  {m.estimatedDays && <span>· {m.estimatedDays}</span>}
                  <span>· Sıra: {m.order ?? 0}</span>
                  {m.isPickup && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded">
                      <Store className="h-3 w-3" />
                      Filialdan götürmə · {m.branches?.length || 0} filial
                    </span>
                  )}
                </div>
                {m.isPickup && m.branches && m.branches.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-gray-600 border-t border-dashed border-gray-200 pt-2">
                    {m.branches.map((b) => (
                      <li key={b.id} className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 mt-0.5 text-gray-400 flex-shrink-0" />
                        <span className="leading-tight">
                          <span className="font-medium text-gray-800">{b.name}</span>
                          {b.address && <span className="text-gray-500"> — {b.address}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
        </>
      )}
    </div>
  );
};

export default DeliveryMethodsTab;
