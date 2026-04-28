import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Loader2,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  CreditCard,
  PenLine,
  RotateCcw,
  Bike,
} from 'lucide-react';
import {
  getUserOrders,
  customerConfirmDelivered,
  STATUS_LABELS_AZ,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../services/customerOrderService';

const statusBadge = (status: CustomerOrderStatus) => {
  const map: Record<CustomerOrderStatus, string> = {
    pending_payment: 'bg-amber-100 text-amber-800',
    payment_failed: 'bg-red-100 text-red-800',
    preparing: 'bg-blue-100 text-blue-800',
    courier_handover: 'bg-indigo-100 text-indigo-800',
    on_the_way: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  return map[status];
};

const STAGES: { key: CustomerOrderStatus; label: string; icon: any }[] = [
  { key: 'pending_payment', label: 'Ödəniş', icon: CreditCard },
  { key: 'preparing', label: 'Hazırlanır', icon: Package },
  { key: 'courier_handover', label: 'Kuryerə verildi', icon: Bike },
  { key: 'on_the_way', label: 'Yolda', icon: Truck },
  { key: 'delivered', label: 'Təhvil aldı', icon: CheckCircle2 },
];

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const stageIndex = (status: CustomerOrderStatus): number => {
  if (status === 'pending_payment' || status === 'payment_failed') return 0;
  if (status === 'preparing') return 1;
  if (status === 'courier_handover') return 2;
  if (status === 'on_the_way') return 3;
  if (status === 'delivered') return 4;
  return 0;
};

// ─── Signature pad (canvas) ────────────────────────────────
interface SigPadProps {
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
  loading: boolean;
}
const SignaturePad: React.FC<SigPadProps> = ({ onConfirm, onClose, loading }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#111';
    }
  }, []);

  const getPos = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: any) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };
  const move = (e: any) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastRef.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    setHasSignature(true);
  };
  const end = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };
  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="signature-pad-modal"
      >
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Təhvil aldığınızı təsdiqləyin</h3>
          <p className="text-xs text-gray-500 mt-0.5">İmzanızı aşağıdakı sahədə çəkin</p>
        </div>
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-44 touch-none cursor-crosshair bg-white"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
            data-testid="signature-canvas"
          />
        </div>
        <div className="flex items-center justify-between mt-3 gap-2">
          <button
            onClick={clear}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            data-testid="signature-clear"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Təmizlə
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200"
            >
              Ləğv et
            </button>
            <button
              onClick={confirm}
              disabled={!hasSignature || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              data-testid="signature-confirm"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Təsdiq et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [signOrderId, setSignOrderId] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    if (!userId || role !== 'customer') {
      navigate('/');
      return;
    }
    void load(userId);
  }, [navigate]);

  const load = async (userId: string) => {
    setLoading(true);
    try {
      const list = await getUserOrders(userId);
      setOrders(list);
    } catch (e) {
      console.error('Load orders failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmWithSignature = async (signatureDataUrl: string) => {
    if (!signOrderId) return;
    setConfirmingId(signOrderId);
    try {
      await customerConfirmDelivered(signOrderId, signatureDataUrl);
      const userId = localStorage.getItem('userId');
      if (userId) await load(userId);
      setSignOrderId(null);
    } catch (e) {
      alert('Təsdiq baş tutmadı: ' + (e as Error).message);
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Sifarişlərim</h1>
          <p className="text-gray-500 mt-1">Bütün sifarişləriniz və mərhələləri</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center" data-testid="my-orders-empty">
            <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">Hələ sifarişiniz yoxdur</h2>
            <p className="text-gray-500 mb-6">Məhsullara baxmağa başlayın və ilk sifarişinizi verin.</p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              data-testid="my-orders-shop-btn"
            >
              Məhsullara bax
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const idx = stageIndex(order.status);
              return (
                <div
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6"
                  data-testid={`my-order-${order.id}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-5">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Sifariş №</p>
                      <p className="text-2xl font-bold text-gray-900">
                        #{order.orderNumber ?? order.id?.slice(0, 6)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadge(order.status)}`}
                      data-testid={`my-order-status-${order.id}`}
                    >
                      {STATUS_LABELS_AZ[order.status]}
                    </span>
                  </div>

                  {/* Stage timeline */}
                  {order.status !== 'cancelled' && order.status !== 'payment_failed' && (
                    <div className="mb-5">
                      <div className="grid grid-cols-5 gap-1">
                        {STAGES.map((stg, i) => {
                          const Icon = stg.icon;
                          const reached = i <= idx;
                          return (
                            <div key={stg.key} className="flex flex-col items-center text-center">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 transition-colors ${
                                  reached
                                    ? i === idx
                                      ? 'bg-gray-900 text-white'
                                      : 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <span
                                className={`text-[10px] sm:text-[11px] font-medium leading-tight ${
                                  reached ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {stg.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="relative mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gray-900 transition-all"
                          style={{ width: `${(idx / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {order.status === 'payment_failed' && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <p className="text-sm text-red-700">Ödəniş uğursuz oldu. Səbətdən yenidən cəhd edin.</p>
                    </div>
                  )}

                  {order.status === 'pending_payment' && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <p className="text-sm text-amber-700">Ödəniş gözləyir. Tezliklə təsdiqlənəcək.</p>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-2 mb-4">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gray-200 rounded-md flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {item.price.toFixed(2)} ₼
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {(item.price * item.quantity).toFixed(2)} ₼
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                    <div className="text-sm">
                      <span className="text-gray-500">Cəmi: </span>
                      <span className="text-lg font-bold text-gray-900">{order.totalAmount.toFixed(2)} ₼</span>
                    </div>
                    {order.status === 'on_the_way' && (
                      <button
                        onClick={() => setSignOrderId(order.id!)}
                        disabled={confirmingId === order.id}
                        className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                        data-testid={`my-order-confirm-${order.id}`}
                      >
                        <PenLine className="h-4 w-4" />
                        Təhvil aldım (imza)
                      </button>
                    )}
                  </div>

                  {order.customerAddress && (
                    <div className="mt-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Çatdırılma ünvanı: </span>
                      {order.customerAddress}
                    </div>
                  )}
                  {order.deliveryMethodName && (
                    <div className="mt-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Çatdırılma üsulu: </span>
                      {order.deliveryMethodName}
                      {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                        <span className="text-gray-400"> · {order.deliveryFee.toFixed(2)} ₼</span>
                      )}
                    </div>
                  )}
                  {order.customerSignature && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">İmzanız:</p>
                      <img
                        src={order.customerSignature}
                        alt="signature"
                        className="h-16 bg-gray-50 rounded border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {signOrderId && (
        <SignaturePad
          loading={!!confirmingId}
          onClose={() => setSignOrderId(null)}
          onConfirm={handleConfirmWithSignature}
        />
      )}
    </div>
  );
};

export default MyOrdersPage;
