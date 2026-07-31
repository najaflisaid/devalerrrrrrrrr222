import React, { useEffect, useState } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  CheckCircle2,
  History,
  AlertCircle,
  Store,
  MapPin,
  Package,
} from 'lucide-react';
import {
  listCouriers,
  addCourier,
  updateCourier,
  deleteCourier,
  Courier,
} from '../../services/courierService';
import { getRecentlySignedB2BOrders } from '../../services/b2bOrderService';
import { getRecentlySignedRetailOrders } from '../../services/customerOrderService';
import {
  createManualDelivery,
  listAllManualDeliveries,
  deleteManualDelivery,
  ManualDelivery,
  ManualDeliveryItem,
} from '../../services/manualDeliveryService';

const CourierManagementTab: React.FC = () => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const [b2bSigned, setB2bSigned] = useState<any[]>([]);
  const [retailSigned, setRetailSigned] = useState<any[]>([]);

  // ─── Manual store deliveries ───
  const [manuals, setManuals] = useState<ManualDelivery[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [mCustomerName, setMCustomerName] = useState('');
  const [mCustomerPhone, setMCustomerPhone] = useState('');
  const [mCustomerAddress, setMCustomerAddress] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [mAssignedEmail, setMAssignedEmail] = useState('');
  const [mItems, setMItems] = useState<ManualDeliveryItem[]>([
    { productName: '', quantity: 1, note: '' },
  ]);
  const [mSaving, setMSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, b, r, m] = await Promise.all([
        listCouriers(),
        getRecentlySignedB2BOrders(30),
        getRecentlySignedRetailOrders(30),
        listAllManualDeliveries(),
      ]);
      setCouriers(c);
      setB2bSigned(b);
      setRetailSigned(r);
      setManuals(m);
    } catch (e: any) {
      setError(e?.message || 'Yüklənmədi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAdd = async () => {
    setError('');
    setAdding(true);
    try {
      await addCourier({
        email: newEmail,
        password: newPassword,
        name: newName,
        phone: newPhone,
      });
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewPhone('');
      setShowAdd(false);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Əlavə edilmədi');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c: Courier) => {
    setEditingId(c.id);
    setEditEmail(c.email);
    setEditName(c.name);
    setEditPhone(c.phone || '');
    setEditPassword(c.password);
    setEditIsActive(c.isActive);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setError('');
    try {
      await updateCourier(editingId, {
        email: editEmail,
        name: editName,
        phone: editPhone,
        password: editPassword,
        isActive: editIsActive,
      });
      setEditingId(null);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Yenilənmədi');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" kuryerini silmək istədiyinizə əminsiniz?`)) return;
    setError('');
    try {
      await deleteCourier(id);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Silinmədi');
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Manual delivery handlers ───
  const updateManualItem = (i: number, patch: Partial<ManualDeliveryItem>) => {
    setMItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const addManualItem = () =>
    setMItems((arr) => [...arr, { productName: '', quantity: 1, note: '' }]);
  const removeManualItem = (i: number) =>
    setMItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const resetManualForm = () => {
    setMCustomerName('');
    setMCustomerPhone('');
    setMCustomerAddress('');
    setMNotes('');
    setMAssignedEmail('');
    setMItems([{ productName: '', quantity: 1, note: '' }]);
  };

  const handleCreateManual = async () => {
    setError('');
    setMSaving(true);
    try {
      const assigned = couriers.find((c) => c.email === mAssignedEmail);
      await createManualDelivery({
        customerName: mCustomerName,
        customerPhone: mCustomerPhone,
        customerAddress: mCustomerAddress,
        notes: mNotes,
        items: mItems,
        assignedCourierEmail: assigned?.email,
        assignedCourierName: assigned?.name,
      });
      resetManualForm();
      setShowManualForm(false);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Yaradılmadı');
    } finally {
      setMSaving(false);
    }
  };

  const handleDeleteManual = async (id: string, name: string) => {
    if (!confirm(`"${name}" çatdırılmasını silmək istədiyinizə əminsiniz?`)) return;
    setError('');
    try {
      await deleteManualDelivery(id);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Silinmədi');
    }
  };

  const allSigned = [
    ...b2bSigned.map((o) => ({ ...o, _kind: 'B2B' as const })),
    ...retailSigned.map((o) => ({ ...o, _kind: 'Müştəri' as const })),
  ].sort((a, b) => {
    const ta = a.receiverSignedAt?.toMillis?.() || 0;
    const tb = b.receiverSignedAt?.toMillis?.() || 0;
    return tb - ta;
  });

  return (
    <div className="space-y-6">
      {/* Header card — Couriers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Çatdırılma — Kuryerlər</h2>
              <p className="text-xs text-gray-500">
                Kuryer giriş hesabları (devaleur.az/delivery)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800"
            data-testid="courier-add-toggle"
          >
            <Plus className="h-4 w-4" />
            {showAdd ? 'Bağla' : 'Yeni kuryer'}
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {showAdd && (
          <div
            className="mb-5 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-3"
            data-testid="courier-add-form"
          >
            <FieldInput
              icon={<UserIcon className="h-4 w-4 text-gray-400" />}
              placeholder="Ad Soyad"
              value={newName}
              onChange={setNewName}
              testId="courier-new-name"
            />
            <FieldInput
              icon={<Mail className="h-4 w-4 text-gray-400" />}
              placeholder="Email"
              type="email"
              value={newEmail}
              onChange={setNewEmail}
              testId="courier-new-email"
            />
            <FieldInput
              icon={<Lock className="h-4 w-4 text-gray-400" />}
              placeholder="Şifrə"
              value={newPassword}
              onChange={setNewPassword}
              testId="courier-new-password"
            />
            <FieldInput
              icon={<Phone className="h-4 w-4 text-gray-400" />}
              placeholder="Telefon (opsional)"
              value={newPhone}
              onChange={setNewPhone}
              testId="courier-new-phone"
            />
            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Ləğv et
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !newEmail || !newPassword || !newName}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-gray-300"
                data-testid="courier-new-save"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Əlavə et
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Yüklənir...
          </div>
        ) : couriers.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm" data-testid="couriers-empty">
            Hələ kuryer əlavə edilməyib.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-2">Ad</th>
                  <th className="py-3 px-2">Email</th>
                  <th className="py-3 px-2">Şifrə</th>
                  <th className="py-3 px-2">Telefon</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {couriers.map((c) => {
                  const isEditing = editingId === c.id;
                  const revealed = revealedIds.has(c.id);
                  return (
                    <tr key={c.id} data-testid={`courier-row-${c.id}`}>
                      <td className="py-3 px-2 align-top">
                        {isEditing ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm w-full"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">{c.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        {isEditing ? (
                          <input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm w-full"
                          />
                        ) : (
                          <span className="text-gray-700">{c.email}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        {isEditing ? (
                          <input
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm w-full font-mono"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-gray-700">
                              {revealed ? c.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => toggleReveal(c.id)}
                              className="p-1 text-gray-400 hover:text-gray-700"
                              title={revealed ? 'Gizlət' : 'Göstər'}
                            >
                              {revealed ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        {isEditing ? (
                          <input
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm w-full"
                          />
                        ) : (
                          <span className="text-gray-600">{c.phone || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                            />
                            Aktiv
                          </label>
                        ) : c.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Aktiv
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-gray-100 text-gray-600">
                            Deaktiv
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={saveEdit}
                              className="p-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                              data-testid={`courier-save-${c.id}`}
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => startEdit(c)}
                              className="p-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                              data-testid={`courier-edit-${c.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, c.name)}
                              className="p-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100"
                              data-testid={`courier-delete-${c.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual store deliveries — items NOT on site but delivered from the shop */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Mağazadan çatdırılmalar</h2>
              <p className="text-xs text-gray-500">
                Saytda olmayan malı kuryerə tapşır — imzalanır və qeydə alınır
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowManualForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700"
            data-testid="manual-delivery-toggle"
          >
            <Plus className="h-4 w-4" />
            {showManualForm ? 'Bağla' : 'Yeni çatdırılma'}
          </button>
        </div>

        {showManualForm && (
          <div
            className="mb-5 p-4 border border-dashed border-amber-300 rounded-xl bg-amber-50/40 space-y-3"
            data-testid="manual-delivery-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldInput
                icon={<UserIcon className="h-4 w-4 text-gray-400" />}
                placeholder="Müştəri adı"
                value={mCustomerName}
                onChange={setMCustomerName}
                testId="manual-customer-name"
              />
              <FieldInput
                icon={<Phone className="h-4 w-4 text-gray-400" />}
                placeholder="Telefon"
                value={mCustomerPhone}
                onChange={setMCustomerPhone}
                testId="manual-customer-phone"
              />
              <div className="md:col-span-2 relative">
                <span className="absolute left-3 top-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                </span>
                <textarea
                  value={mCustomerAddress}
                  onChange={(e) => setMCustomerAddress(e.target.value)}
                  placeholder="Çatdırılma ünvanı"
                  rows={2}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white resize-none"
                  data-testid="manual-customer-address"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Kuryerə tapşır (opsional)
                </label>
                <select
                  value={mAssignedEmail}
                  onChange={(e) => setMAssignedEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  data-testid="manual-assigned-courier"
                >
                  <option value="">— Hər aktiv kuryer görsün —</option>
                  {couriers
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.email}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="border-t border-amber-200 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Məhsullar
                </label>
                <button
                  type="button"
                  onClick={addManualItem}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
                  data-testid="manual-item-add"
                >
                  <Plus className="h-3 w-3" /> Sətir əlavə et
                </button>
              </div>
              <div className="space-y-2">
                {mItems.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start" data-testid={`manual-item-row-${i}`}>
                    <input
                      value={it.productName}
                      onChange={(e) => updateManualItem(i, { productName: e.target.value })}
                      placeholder="Məhsulun adı"
                      className="col-span-6 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      data-testid={`manual-item-name-${i}`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateManualItem(i, { quantity: Number(e.target.value) })}
                      placeholder="Say"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      data-testid={`manual-item-qty-${i}`}
                    />
                    <input
                      value={it.note || ''}
                      onChange={(e) => updateManualItem(i, { note: e.target.value })}
                      placeholder="Qeyd (opsional)"
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      data-testid={`manual-item-note-${i}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeManualItem(i)}
                      className="col-span-1 p-2 text-red-500 hover:text-red-700 disabled:opacity-30"
                      disabled={mItems.length <= 1}
                      data-testid={`manual-item-remove-${i}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <textarea
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
                placeholder="Əlavə qeyd (məs: təhvil vaxtı, açar sözlər...)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white resize-none"
                data-testid="manual-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  resetManualForm();
                  setShowManualForm(false);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Ləğv et
              </button>
              <button
                onClick={handleCreateManual}
                disabled={mSaving || !mCustomerName || !mCustomerAddress}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:bg-gray-300"
                data-testid="manual-delivery-save"
              >
                {mSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Kuryerə tapşır
              </button>
            </div>
          </div>
        )}

        {/* Manual deliveries list */}
        {manuals.length === 0 ? (
          <div
            className="text-center py-8 text-gray-500 text-sm"
            data-testid="manual-deliveries-empty"
          >
            Hələ mağazadan çatdırılma əlavə edilməyib.
          </div>
        ) : (
          <div className="space-y-2">
            {manuals.map((m) => {
              const isDelivered = m.status === 'delivered';
              return (
                <div
                  key={m.id}
                  className={`border rounded-xl p-3 ${
                    isDelivered
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-gray-200 bg-white'
                  }`}
                  data-testid={`manual-row-${m.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-900 text-white">
                          #{m.orderNumber}
                        </span>
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Təhvil verildi
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700">
                            Gözləyir
                          </span>
                        )}
                        {m.assignedCourierName && (
                          <span className="text-[11px] text-gray-500">
                            → {m.assignedCourierName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{m.customerName}</p>
                      <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {m.customerPhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {m.customerPhone}
                          </span>
                        )}
                        {m.customerAddress && (
                          <span className="inline-flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5" />
                            <span>{m.customerAddress}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {m.items.length} məhsul ·{' '}
                        {m.items
                          .slice(0, 3)
                          .map((i) => `${i.productName} ×${i.quantity}`)
                          .join(', ')}
                        {m.items.length > 3 ? '...' : ''}
                      </p>
                      {isDelivered && m.receiverName && (
                        <div className="mt-2 pt-2 border-t border-emerald-200 text-[11px] text-gray-700 space-y-1">
                          <p>
                            Təhvil aldı:{' '}
                            <span className="font-semibold">
                              {m.receiverName} {m.receiverSurname}
                            </span>
                            {m.receiverPosition ? ` — ${m.receiverPosition}` : ''}
                          </p>
                          <div className="flex gap-3">
                            {m.receiverSignature && (
                              <div>
                                <p className="text-[10px] text-gray-500 mb-0.5">Müştəri</p>
                                <img
                                  src={m.receiverSignature}
                                  alt="receiver signature"
                                  className="h-12 bg-white border border-gray-200 rounded p-0.5"
                                />
                              </div>
                            )}
                            {m.courierSignature && (
                              <div>
                                <p className="text-[10px] text-gray-500 mb-0.5">
                                  Kuryer{m.courierName ? ` (${m.courierName})` : ''}
                                </p>
                                <img
                                  src={m.courierSignature}
                                  alt="courier signature"
                                  className="h-12 bg-white border border-gray-200 rounded p-0.5"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteManual(m.id, m.customerName)}
                      className="p-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 flex-shrink-0"
                      data-testid={`manual-delete-${m.id}`}
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent signatures */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-gray-700" />
          <h3 className="text-lg font-bold text-gray-900">
            Kuryer tərəfindən imzalanmış sifarişlər (son 30 gün)
          </h3>
        </div>
        {allSigned.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8" data-testid="signed-orders-empty">
            Hələ imzalanmış sifariş yoxdur.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allSigned.map((o) => {
              const when = o.receiverSignedAt?.toDate
                ? o.receiverSignedAt.toDate().toLocaleString('az-AZ')
                : '';
              const customerLine =
                o._kind === 'B2B'
                  ? o.companyName ||
                    `${o.customerName || ''} ${o.customerLastname || ''}`.trim()
                  : o.customerName || o.customerEmail;
              return (
                <div
                  key={`${o._kind}-${o.id}`}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                  data-testid={`signed-order-${o.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-900 text-white">
                        {o._kind}
                      </span>
                      <span className="ml-2 text-sm font-semibold text-gray-900">
                        {o.orderNumber || o.id.slice(0, 6)}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500">{when}</span>
                  </div>
                  <p className="text-sm text-gray-800 mb-1">{customerLine}</p>
                  <p className="text-xs text-gray-600">
                    Təhvil aldı:{' '}
                    <span className="font-semibold">
                      {o.receiverName} {o.receiverSurname}
                    </span>
                    {o.receiverPosition && (
                      <span className="text-gray-500"> — {o.receiverPosition}</span>
                    )}
                  </p>
                  {(o.receiverSignature || o.courierSignature) && (
                    <div className="mt-2 flex gap-3">
                      {o.receiverSignature && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">Müştəri</p>
                          <img
                            src={o.receiverSignature}
                            alt="receiver signature"
                            className="h-14 bg-white border border-gray-200 rounded p-1"
                          />
                        </div>
                      )}
                      {o.courierSignature && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">
                            Kuryer{o.courierName ? ` (${o.courierName})` : ''}
                          </p>
                          <img
                            src={o.courierSignature}
                            alt="courier signature"
                            className="h-14 bg-white border border-gray-200 rounded p-1"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const FieldInput: React.FC<{
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testId?: string;
}> = ({ icon, placeholder, value, onChange, type = 'text', testId }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none bg-white"
      data-testid={testId}
    />
  </div>
);

export default CourierManagementTab;
