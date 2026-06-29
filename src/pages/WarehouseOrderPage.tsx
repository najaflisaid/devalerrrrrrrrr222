/**
 * WarehouseOrderPage — açıq link (auth tələb etmir).
 *
 * Yalnız ANBARDAR rejimi:
 *   1) Hər mal üçün "Əlavə olundu" / "Mövcud deyil" düymələri
 *   2) Sifariş statusunu dəyişdirə bilir (real-time admin/müştəri görür)
 *   3) Anbardar qeydi
 *   4) Vəzifə + Ad/Soyad + İmza ataraq TƏSDİQ → linkdən düzəliş bağlanır
 *
 * Müştəri tərəfi üçün ayrıca `/customer-receive/order/:orderId` route var.
 *
 * Qiymət / endirim / borc GÖSTƏRİLMİR.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Package, Check, X, Loader2, AlertCircle, ArrowLeft, FileText, Lock, ClipboardCheck,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { productService } from '../services/productService';
import InlineSignaturePad from '../components/InlineSignaturePad';
import {
  updateB2BOrderWarehouseChecks,
  updateB2BOrderWarehouseNote,
  updateB2BOrderStatusFromWarehouse,
  finalizeB2BOrderWarehouse,
  type WarehouseStatus,
} from '../services/b2bOrderService';

interface OrderItem {
  productId: string;
  productName: { az?: string; ru?: string; en?: string } | string;
  quantity: number;
}

interface OrderDoc {
  id: string;
  orderNumber?: number;
  customerName?: string;
  customerLastname?: string;
  companyName?: string;
  customerPhone?: string;
  createdAt?: any;
  items: OrderItem[];
  status?: string;
  warehouseChecks?: Record<string, WarehouseStatus>;
  warehouseNote?: string;
  warehousePickerName?: string;
  warehousePickerPosition?: string;
  warehousePickerSignature?: string;
  warehouseFinalized?: boolean;
  warehouseFinalizedAt?: any;
}

const formatDate = (raw: any): string => {
  try {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Gözləyir' },
  { value: 'accepted', label: 'Qəbul olundu' },
  { value: 'preparing', label: 'Hazırlanır' },
  { value: 'ready', label: 'Hazırdır' },
  { value: 'delivering', label: 'Çatdırılma xidmətində' },
  { value: 'delivered', label: 'Təhvil verildi' },
];

const WarehouseOrderPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');
  const [pickerName, setPickerName] = useState('');
  const [pickerPosition, setPickerPosition] = useState('');
  const [pickerSignature, setPickerSignature] = useState('');

  const [submittingFinalize, setSubmittingFinalize] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(
      doc(db, 'b2bOrders', orderId),
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        setOrder({ id: snap.id, ...data });
        setNoteDraft((prev) => (prev === '' ? data.warehouseNote || '' : prev));
        setLoading(false);
      },
      (err) => {
        console.error('Warehouse order snapshot error:', err);
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    productService
      .getAll(true)
      .then(setProducts)
      .catch((e) => console.warn('Warehouse: products load failed', e));
  }, []);

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-700 mx-auto" />
          <p className="mt-4 text-gray-700">Sifariş yüklənir...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow border border-gray-200 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sifariş tapılmadı</h1>
          <p className="text-sm text-gray-600">
            Bu link etibarsızdır və ya sifariş silinib. Müştəri/admin ilə əlaqə saxlayın.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Əsas səhifə
          </Link>
        </div>
      </div>
    );
  }

  const finalized = !!order.warehouseFinalized;
  const orderNumberDisplay =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `#${order.orderNumber}`
      : `#${order.id.slice(0, 8)}`;
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';
  const checks = order.warehouseChecks || {};
  const total = order.items?.length || 0;
  const availableCount = Object.values(checks).filter((v) => v === 'available').length;
  const unavailableCount = Object.values(checks).filter((v) => v === 'unavailable').length;
  const remainingCount = Math.max(0, total - availableCount - unavailableCount);

  const toggleStatus = async (idx: number, next: WarehouseStatus) => {
    if (finalized) return;
    const prev = order.warehouseChecks || {};
    const current = prev[idx.toString()];
    const updated: Record<string, WarehouseStatus> = { ...prev };
    if (current === next) {
      delete updated[idx.toString()];
    } else {
      updated[idx.toString()] = next;
    }
    try {
      setSavingIdx(idx);
      await updateB2BOrderWarehouseChecks(order.id, updated);
    } catch (err) {
      console.error('Warehouse check update failed:', err);
      alert('Yadda saxlamaq alınmadı. Yenidən cəhd edin.');
    } finally {
      setSavingIdx(null);
    }
  };

  const onNoteBlur = async () => {
    if (finalized) return;
    if (noteDraft === (order.warehouseNote || '')) return;
    try {
      await updateB2BOrderWarehouseNote(order.id, noteDraft.trim());
    } catch (err) {
      console.error('Warehouse note save failed:', err);
    }
  };

  const onStatusChange = async (newStatus: string) => {
    try {
      setStatusSaving(true);
      await updateB2BOrderStatusFromWarehouse(order.id, newStatus);
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Statusu dəyişmək alınmadı.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!pickerName.trim() || !pickerPosition.trim() || !pickerSignature) {
      alert('Vəzifə, ad/soyad və imza tamamlanmalıdır.');
      return;
    }
    try {
      setSubmittingFinalize(true);
      await finalizeB2BOrderWarehouse(order.id, {
        pickerName,
        pickerPosition,
        pickerSignature,
        warehouseChecks: order.warehouseChecks,
        warehouseNote: noteDraft.trim(),
      });
    } catch (err) {
      console.error('Warehouse finalize failed:', err);
      alert('Təsdiq alınmadı. Yenidən cəhd edin.');
    } finally {
      setSubmittingFinalize(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="https://i.hizliresim.com/tmu65g6.png" alt="De Valeur" className="h-7" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              {finalized ? 'Yığım tamamlandı' : 'Yığım siyahısı'}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">Sifariş {orderNumberDisplay}</p>
          </div>
          {finalized ? (
            <Lock className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm" data-testid="warehouse-order-meta">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Sifariş №</p>
              <p className="font-semibold text-gray-900">{orderNumberDisplay}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Tarix</p>
              <p className="font-medium text-gray-800 text-xs">{formatDate(order.createdAt) || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Şirkət</p>
              <p className="font-medium text-gray-900 truncate">{company || '-'}</p>
            </div>
          </div>
        </div>

        {!finalized && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Sifariş statusu</label>
            <div className="flex items-center gap-2">
              <select
                value={order.status || 'pending'}
                onChange={(e) => onStatusChange(e.target.value)}
                disabled={statusSaving}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                data-testid="warehouse-status-select"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {statusSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Status həm admin paneldə, həm müştəridə avtomatik yenilənir.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-available">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Əlavə olundu</p>
            <p className="text-lg font-bold text-emerald-600">{availableCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-unavailable">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Mövcud deyil</p>
            <p className="text-lg font-bold text-rose-600">{unavailableCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-remaining">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Qalır</p>
            <p className="text-lg font-bold text-gray-700">{remainingCount}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {(order.items || []).map((item, idx) => {
            const product = productMap.get(item.productId);
            const image = product?.images?.[0];
            const barcode = product?.barcode || product?.sku || '';
            const brand = product?.brand || '';
            const name =
              (typeof item.productName === 'object' ? item.productName?.az : item.productName) ||
              product?.name?.az || product?.name?.en || '-';
            const wStatus = checks[idx.toString()];
            const rowSaving = savingIdx === idx;
            const borderClass =
              wStatus === 'available' ? 'border-emerald-300 bg-emerald-50/40'
              : wStatus === 'unavailable' ? 'border-rose-300 bg-rose-50/40'
              : 'border-gray-200';

            return (
              <div
                key={idx}
                className={`bg-white rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${borderClass}`}
                data-testid={`warehouse-item-${idx}`}
              >
                <div className="flex gap-3 items-start">
                  {image ? (
                    <img src={image} alt={String(name)} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-white" />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center">
                      <Package className="h-7 w-7 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {brand && <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{brand}</p>}
                    <p className="font-semibold text-gray-900 text-sm sm:text-base leading-snug break-words" data-testid={`warehouse-item-name-${idx}`}>
                      {String(name)}
                    </p>
                    {barcode && (
                      <p className="mt-1 text-xs font-mono text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-200" data-testid={`warehouse-item-barcode-${idx}`}>
                        {barcode}
                      </p>
                    )}
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Miqdar:</span>
                      <span className="text-lg font-bold text-gray-900" data-testid={`warehouse-item-qty-${idx}`}>{item.quantity}</span>
                      <span className="text-xs text-gray-500">ədəd</span>
                    </div>
                  </div>
                </div>

                {!finalized ? (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => toggleStatus(idx, 'available')}
                      disabled={rowSaving}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                        wStatus === 'available'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700'
                      } ${rowSaving ? 'opacity-60 cursor-wait' : ''}`}
                      data-testid={`warehouse-item-mark-available-${idx}`}
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      Əlavə olundu
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(idx, 'unavailable')}
                      disabled={rowSaving}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                        wStatus === 'unavailable'
                          ? 'bg-rose-600 border-rose-600 text-white shadow'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:text-rose-700'
                      } ${rowSaving ? 'opacity-60 cursor-wait' : ''}`}
                      data-testid={`warehouse-item-mark-unavailable-${idx}`}
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                      Mövcud deyil
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        wStatus === 'available'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : wStatus === 'unavailable'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {wStatus === 'available' ? (
                        <><Check className="h-3 w-3" strokeWidth={3} /> Əlavə olundu</>
                      ) : wStatus === 'unavailable' ? (
                        <><X className="h-3 w-3" strokeWidth={3} /> Mövcud deyil</>
                      ) : (
                        'İşlənmədi'
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(!finalized || (order.warehouseNote && order.warehouseNote.trim())) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Anbardar qeydi
              <span className="text-xs text-gray-500 font-normal ml-1">— admin və müştəri görəcək</span>
            </label>
            {!finalized ? (
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={onNoteBlur}
                rows={3}
                placeholder="Məs.: Çatışmayan mallar barədə əlavə qeyd, alternativ təklif və.s."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
                data-testid="warehouse-note-input"
              />
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3" data-testid="warehouse-note-readonly">
                {order.warehouseNote}
              </p>
            )}
          </div>
        )}

        {!finalized ? (
          <div className="bg-white rounded-2xl border-2 border-gray-900 p-4 mt-5 shadow">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="h-5 w-5 text-gray-900" />
              <h3 className="text-base font-bold text-gray-900">Yığımı təsdiq et</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Təsdiqdən sonra bu linkdə düzəliş etmək mümkün olmayacaq. Yalnız admin paneldən admin düzəliş edə bilər.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vəzifə</label>
                <input
                  type="text"
                  value={pickerPosition}
                  onChange={(e) => setPickerPosition(e.target.value)}
                  placeholder="Məs.: Anbardar"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="warehouse-picker-position"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ad, Soyad</label>
                <input
                  type="text"
                  value={pickerName}
                  onChange={(e) => setPickerName(e.target.value)}
                  placeholder="Məs.: Elvin Məmmədov"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="warehouse-picker-name"
                />
              </div>
            </div>
            <div className="mt-3">
              <InlineSignaturePad label="İmza" value={pickerSignature} onChange={setPickerSignature} />
            </div>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={submittingFinalize || !pickerName.trim() || !pickerPosition.trim() || !pickerSignature}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              data-testid="warehouse-finalize-btn"
            >
              {submittingFinalize ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
              Təsdiq
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-5">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-bold text-emerald-900">Yığım təsdiqləndi</p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-700">Yığımı edən</p>
            <p className="text-sm font-semibold text-emerald-900">
              {order.warehousePickerPosition} — {order.warehousePickerName}
            </p>
            <p className="text-[10px] text-emerald-700 mt-0.5">{formatDate(order.warehouseFinalizedAt)}</p>
            {order.warehousePickerSignature && (
              <img
                src={order.warehousePickerSignature}
                alt="İmza"
                className="mt-2 bg-white border border-emerald-200 rounded-lg p-2 max-h-28"
                data-testid="warehouse-picker-signature-display"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WarehouseOrderPage;
