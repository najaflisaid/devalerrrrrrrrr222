/**
 * CustomerReceivePage — açıq link (auth tələb etmir).
 *
 * Müştəri sifariş təhvil aldığı zaman bu linki açır:
 *   /customer-receive/order/:orderId
 *
 * Müştəri yalnız öz işini görür — anbardar yığım siyahısından FƏRQLİ səhifə:
 *   • Bütün sifariş malları siyahıda görünür (şəkil + ad + brend + barkod + miqdar)
 *   • Hər malın qarşısında "təhvil aldım" üçün quş qoymaq düyməsi
 *   • Aşağıda Vəzifə + Ad/Soyad + İmza sahələri
 *   • Təsdiq düyməsi → admin və müştəri panelindəkilərdə imza dərhal görünür
 *   • Təsdiqdən sonra linkdən düzəliş edilməz
 *
 * Qiymət / endirim / borc GÖSTƏRİLMİR.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Package, Check, Loader2, AlertCircle, ArrowLeft, Truck, ClipboardCheck, Lock,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { productService } from '../services/productService';
import InlineSignaturePad from '../components/InlineSignaturePad';
import {
  updateB2BOrderCustomerReceiveChecks,
  finalizeB2BOrderCustomerReceive,
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
  customerReceiveChecks?: Record<string, boolean>;
  customerReceiveName?: string;
  customerReceivePosition?: string;
  customerReceiveSignature?: string;
  customerFinalized?: boolean;
  customerFinalizedAt?: any;
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

const CustomerReceivePage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [receiverName, setReceiverName] = useState('');
  const [receiverPosition, setReceiverPosition] = useState('');
  const [receiverSignature, setReceiverSignature] = useState('');
  const [submittingFinalize, setSubmittingFinalize] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  // 1) Real-time subscribe
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
        setLoading(false);
      },
      (err) => {
        console.error('Customer receive snapshot error:', err);
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [orderId]);

  // 2) Product catalog
  useEffect(() => {
    productService
      .getAll(true)
      .then(setProducts)
      .catch((e) => console.warn('Customer receive: products load failed', e));
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

  const orderNumberDisplay =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `#${order.orderNumber}`
      : `#${order.id.slice(0, 8)}`;
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';

  const finalized = !!order.customerFinalized;
  const receiveChecks = order.customerReceiveChecks || {};
  const total = order.items?.length || 0;
  const receivedCount = Object.values(receiveChecks).filter(Boolean).length;
  const remaining = Math.max(0, total - receivedCount);

  const toggleReceive = async (idx: number) => {
    if (finalized) return;
    const prev = order.customerReceiveChecks || {};
    const updated = { ...prev };
    if (updated[idx.toString()]) {
      delete updated[idx.toString()];
    } else {
      updated[idx.toString()] = true;
    }
    try {
      setSavingIdx(idx);
      await updateB2BOrderCustomerReceiveChecks(order.id, updated);
    } catch (err) {
      console.error('Receive check update failed:', err);
      alert('Yadda saxlamaq alınmadı. Yenidən cəhd edin.');
    } finally {
      setSavingIdx(null);
    }
  };

  const handleFinalize = async () => {
    if (!receiverName.trim() || !receiverPosition.trim() || !receiverSignature) {
      alert('Vəzifə, ad/soyad və imza tamamlanmalıdır.');
      return;
    }
    try {
      setSubmittingFinalize(true);
      await finalizeB2BOrderCustomerReceive(order.id, {
        receiverName,
        receiverPosition,
        receiverSignature,
        customerReceiveChecks: order.customerReceiveChecks,
      });
    } catch (err) {
      console.error('Customer finalize failed:', err);
      alert('Təsdiq alınmadı. Yenidən cəhd edin.');
    } finally {
      setSubmittingFinalize(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img
            src="https://i.hizliresim.com/tmu65g6.png"
            alt="De Valeur"
            className="h-7"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              {finalized ? 'Təhvil təsdiqləndi' : 'Təhvil-təslim'}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">Sifariş {orderNumberDisplay}</p>
          </div>
          {finalized ? (
            <Lock className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <Truck className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        {/* Order meta */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
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

        {/* Progress summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Cəmi</p>
            <p className="text-lg font-bold text-gray-900">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700">Təhvil aldım</p>
            <p className="text-lg font-bold text-emerald-700" data-testid="customer-receive-checked-count">{receivedCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Qalır</p>
            <p className="text-lg font-bold text-gray-700">{remaining}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-3 px-1">
          Aldığınız hər məhsulun qarşısındakı düyməyə klikləyin. Bütün məhsulları yoxladıqdan sonra aşağıda
          vəzifə, ad/soyadınızı yazıb imzalayın və <strong>Təsdiq</strong> düyməsinə basın.
        </p>

        {/* Items list */}
        <div className="space-y-2.5">
          {(order.items || []).map((item, idx) => {
            const product = productMap.get(item.productId);
            const image = product?.images?.[0];
            const barcode = product?.barcode || product?.sku || '';
            const brand = product?.brand || '';
            const name =
              (typeof item.productName === 'object' ? item.productName?.az : item.productName) ||
              product?.name?.az || product?.name?.en || '-';
            const isReceived = !!receiveChecks[idx.toString()];
            const rowSaving = savingIdx === idx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleReceive(idx)}
                disabled={finalized || rowSaving}
                className={`w-full text-left bg-white rounded-2xl border-2 p-3 sm:p-4 shadow-sm transition-all ${
                  isReceived
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-gray-200 hover:border-emerald-300'
                } ${finalized ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                data-testid={`customer-item-${idx}`}
              >
                <div className="flex gap-3 items-center">
                  {/* Check button */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isReceived
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-gray-300'
                    } ${rowSaving ? 'opacity-60' : ''}`}
                    aria-hidden
                  >
                    {isReceived && <Check className="h-5 w-5" strokeWidth={3} />}
                  </div>

                  {/* Image */}
                  {image ? (
                    <img
                      src={image}
                      alt={String(name)}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {brand && (
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{brand}</p>
                    )}
                    <p className="font-semibold text-gray-900 text-sm leading-snug break-words">
                      {String(name)}
                    </p>
                    {barcode && (
                      <p className="mt-1 text-[11px] font-mono text-blue-700 bg-blue-50 inline-block px-1.5 py-0.5 rounded border border-blue-200">
                        {barcode}
                      </p>
                    )}
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Miqdar:</span>
                      <span className="text-base font-bold text-gray-900">{item.quantity}</span>
                      <span className="text-xs text-gray-500">ədəd</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* === TƏSDİQ BLOKU === */}
        {!finalized ? (
          <div className="bg-white rounded-2xl border-2 border-indigo-700 p-4 mt-5 shadow">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-5 w-5 text-indigo-700" />
              <h3 className="text-base font-bold text-gray-900">Təhvili təsdiqlə</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Təsdiqdən sonra bu linkdə düzəliş edilə bilməz. Yalnız admin paneldən düzəliş etmək mümkündür.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vəzifə</label>
                <input
                  type="text"
                  value={receiverPosition}
                  onChange={(e) => setReceiverPosition(e.target.value)}
                  placeholder="Məs.: Mağaza müdiri"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="customer-receiver-position"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ad, Soyad</label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Məs.: Aysel Hüseynova"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  data-testid="customer-receiver-name"
                />
              </div>
            </div>
            <div className="mt-3">
              <InlineSignaturePad
                label="İmza"
                value={receiverSignature}
                onChange={setReceiverSignature}
              />
            </div>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={
                submittingFinalize ||
                !receiverName.trim() ||
                !receiverPosition.trim() ||
                !receiverSignature
              }
              className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 bg-indigo-700 hover:bg-indigo-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              data-testid="customer-finalize-btn"
            >
              {submittingFinalize ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
              Təsdiq
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-5">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-bold text-emerald-900">Təhvil təsdiqləndi</p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-700">Təhvil alan</p>
            <p className="text-sm font-semibold text-emerald-900">
              {order.customerReceivePosition} — {order.customerReceiveName}
            </p>
            <p className="text-[10px] text-emerald-700 mt-0.5">{formatDate(order.customerFinalizedAt)}</p>
            {order.customerReceiveSignature && (
              <img
                src={order.customerReceiveSignature}
                alt="İmza"
                className="mt-2 bg-white border border-emerald-200 rounded-lg p-2 max-h-28"
                data-testid="customer-receive-signature-display"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerReceivePage;
