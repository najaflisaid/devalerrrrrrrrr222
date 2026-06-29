/**
 * WarehouseOrderPage — public səhifə (auth tələb etmir).
 *
 * Anbardar müştəri/admin tərəfindən paylaşılan link ilə açır:
 *   /warehouse/order/:orderId
 *
 * Görür:
 *   • Müştəri & sifariş №
 *   • Hər məhsul üçün: şəkil, ad, brend, barkod, miqdar
 *   • Qiymət / endirim / borc — YOX (məxfi).
 * Edə bilər:
 *   • Hər malın yanından ✓ "Var" və ya ✗ "Yox" işarələyə bilir
 *   • Ümumi qeyd yaza bilir
 *
 * Bütün dəyişikliklər real-time olaraq Firestore-da yenilənir → müştəri və admin
 * onSnapshot ilə dərhal görür.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Package, Check, X, Save, Loader2, AlertCircle, ArrowLeft, FileText } from 'lucide-react';
import { db } from '../lib/firebase';
import { productService } from '../services/productService';
import {
  updateB2BOrderWarehouseChecks,
  updateB2BOrderWarehouseNote,
  type WarehouseStatus,
} from '../services/b2bOrderService';

interface OrderItem {
  productId: string;
  productName: { az?: string; ru?: string; en?: string } | string;
  quantity: number;
  regularPrice?: number;
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
  warehouseChecks?: Record<string, WarehouseStatus>;
  warehouseNote?: string;
  status?: string;
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

const WarehouseOrderPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  // 1) Real-time subscribe to the order doc
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
        const next: OrderDoc = { id: snap.id, ...data };
        setOrder(next);
        // Sinxronlaşdır note draft-ı yalnız ilk dəfə (istifadəçinin yazdığını silməsin)
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

  // 2) Load product catalog (for images + barcode lookup)
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

  const toggleStatus = async (idx: number, next: WarehouseStatus) => {
    if (!order) return;
    const prev = order.warehouseChecks || {};
    const current = prev[idx.toString()];
    const updated: Record<string, WarehouseStatus> = { ...prev };
    if (current === next) {
      delete updated[idx.toString()]; // ikinci dəfə eyni — sıfırla
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

  const saveNote = async () => {
    if (!order) return;
    try {
      setNoteSaving(true);
      await updateB2BOrderWarehouseNote(order.id, noteDraft.trim());
      setNoteSavedAt(Date.now());
    } catch (err) {
      console.error('Warehouse note save failed:', err);
      alert('Qeydi yadda saxlamaq alınmadı.');
    } finally {
      setNoteSaving(false);
    }
  };

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

  const orderNumberDisplay =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `#${order.orderNumber}`
      : `#${order.id.slice(0, 8)}`;
  const customerFull = [order.customerName, order.customerLastname].filter(Boolean).join(' ').trim() || '-';
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';

  const checks = order.warehouseChecks || {};
  const total = order.items?.length || 0;
  const available = Object.values(checks).filter((v) => v === 'available').length;
  const unavailable = Object.values(checks).filter((v) => v === 'unavailable').length;
  const remaining = Math.max(0, total - available - unavailable);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img
            src="https://i.hizliresim.com/tmu65g6.png"
            alt="De Valeur"
            className="h-7"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Anbardar yığım siyahısı</p>
            <p className="text-sm font-semibold text-gray-900 truncate">Sifariş {orderNumberDisplay}</p>
          </div>
          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        {/* Customer info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm" data-testid="warehouse-order-meta">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Sifariş №</p>
              <p className="font-semibold text-gray-900">{orderNumberDisplay}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Tarix</p>
              <p className="font-medium text-gray-800 text-xs">{formatDate(order.createdAt) || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Müştəri</p>
              <p className="font-medium text-gray-900 truncate">{customerFull}</p>
              {company && <p className="text-xs text-gray-600 truncate">{company}</p>}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-available">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Var</p>
            <p className="text-lg font-bold text-emerald-600">{available}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-unavailable">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Yoxdur</p>
            <p className="text-lg font-bold text-rose-600">{unavailable}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center" data-testid="warehouse-summary-remaining">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Qalır</p>
            <p className="text-lg font-bold text-gray-700">{remaining}</p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2.5">
          {(order.items || []).map((item, idx) => {
            const product = productMap.get(item.productId);
            const image = product?.images?.[0];
            const barcode = product?.barcode || product?.sku || '';
            const brand = product?.brand || '';
            const name =
              (typeof item.productName === 'object' ? item.productName?.az : item.productName) ||
              product?.name?.az || product?.name?.en || '-';
            const status = checks[idx.toString()];
            const rowSaving = savingIdx === idx;

            return (
              <div
                key={idx}
                className={`bg-white rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${
                  status === 'available'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : status === 'unavailable'
                    ? 'border-rose-300 bg-rose-50/40'
                    : 'border-gray-200'
                }`}
                data-testid={`warehouse-item-${idx}`}
              >
                <div className="flex gap-3 items-start">
                  {/* Image */}
                  {image ? (
                    <img
                      src={image}
                      alt={String(name)}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center">
                      <Package className="h-7 w-7 text-gray-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {brand && (
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{brand}</p>
                    )}
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
                      <span className="text-lg font-bold text-gray-900" data-testid={`warehouse-item-qty-${idx}`}>
                        {item.quantity}
                      </span>
                      <span className="text-xs text-gray-500">ədəd</span>
                    </div>
                  </div>
                </div>

                {/* Status buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => toggleStatus(idx, 'available')}
                    disabled={rowSaving}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                      status === 'available'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700'
                    } ${rowSaving ? 'opacity-60 cursor-wait' : ''}`}
                    data-testid={`warehouse-item-mark-available-${idx}`}
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Var
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatus(idx, 'unavailable')}
                    disabled={rowSaving}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                      status === 'unavailable'
                        ? 'bg-rose-600 border-rose-600 text-white shadow'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:text-rose-700'
                    } ${rowSaving ? 'opacity-60 cursor-wait' : ''}`}
                    data-testid={`warehouse-item-mark-unavailable-${idx}`}
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                    Yoxdur
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Anbardar qeydi
            <span className="text-xs text-gray-500 font-normal ml-1">— müştəri görəcək</span>
          </label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            placeholder="Məs.: Çatışmayan mallar barədə əlavə qeyd, alternativ təklif və.s."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
            data-testid="warehouse-note-input"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">
              {noteSavedAt
                ? `Saxlandı ✓ ${new Date(noteSavedAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`
                : ' '}
            </p>
            <button
              type="button"
              onClick={saveNote}
              disabled={noteSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              data-testid="warehouse-note-save"
            >
              {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Yadda saxla
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          Bu səhifədə yalnız operativ məlumat göstərilir. Qiymət və ödəniş məlumatları məxfidir.
        </p>
      </div>
    </div>
  );
};

export default WarehouseOrderPage;
