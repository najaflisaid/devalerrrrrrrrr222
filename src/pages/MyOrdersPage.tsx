import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Tag,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getUserOrders,
  customerConfirmDelivered,
  STATUS_LABELS_AZ,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../services/customerOrderService';

const statusBadge = (status: CustomerOrderStatus) => {
  const map: Record<CustomerOrderStatus, string> = {
    pending_payment: 'bg-amber-100 text-amber-800 border-amber-200',
    payment_failed: 'bg-red-100 text-red-700 border-red-200',
    accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    preparing: 'bg-blue-100 text-blue-800 border-blue-200',
    courier_handover: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    on_the_way: 'bg-purple-100 text-purple-800 border-purple-200',
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-gray-200 text-gray-700 border-gray-300',
  };
  return map[status];
};

const STAGES: { key: CustomerOrderStatus; label: string; icon: any }[] = [
  { key: 'accepted', label: 'Qəbul olundu', icon: CreditCard },
  { key: 'preparing', label: 'Hazırlanır', icon: Package },
  { key: 'courier_handover', label: 'Hazırdır', icon: Bike },
  { key: 'on_the_way', label: 'Çatdırılır', icon: Truck },
  { key: 'delivered', label: 'Təhvil aldı', icon: CheckCircle2 },
];

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const stageIndex = (status: CustomerOrderStatus): number => {
  if (status === 'pending_payment' || status === 'payment_failed') return -1;
  if (status === 'accepted') return 0;
  if (status === 'preparing') return 1;
  if (status === 'courier_handover') return 2;
  if (status === 'on_the_way') return 3;
  if (status === 'delivered') return 4;
  return -1;
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
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
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

interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
  discountPercentage?: number;
  discountExpiresAt?: any;
  discountUsed?: boolean;
}

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [signOrderId, setSignOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [profileExtra, setProfileExtra] = useState<{
    discountPercentage?: number;
    discountExpiresAt?: any;
    discountUsed?: boolean;
  }>({});

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    if (!userId || role !== 'customer') {
      navigate('/');
      return;
    }
    void load(userId);
    void loadProfileExtra(userId);
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

  // Read discount fields from /users/{userId} where users.id == userId
  const loadProfileExtra = async (userId: string) => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
      if (!usersSnap.empty) {
        const data: any = usersSnap.docs[0].data();
        setProfileExtra({
          discountPercentage: data.discountPercentage,
          discountExpiresAt: data.discountExpiresAt,
          discountUsed: data.discountUsed,
        });
      }
    } catch (e) {
      console.warn('Could not load profile extras:', e);
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

  const profile: CustomerProfile = useMemo(() => {
    const latest = orders[0];
    return {
      name: localStorage.getItem('userName') || latest?.customerName || 'Hörmətli müştəri',
      email: localStorage.getItem('userEmail') || latest?.customerEmail || '',
      phone: latest?.customerPhone || '',
      discountPercentage: profileExtra.discountPercentage,
      discountExpiresAt: profileExtra.discountExpiresAt,
      discountUsed: profileExtra.discountUsed,
    };
  }, [orders, profileExtra]);

  // Discount validity check: not used + not expired + > 0
  const activeDiscount = useMemo(() => {
    const pct = profile.discountPercentage;
    if (!pct || pct <= 0) return null;
    if (profile.discountUsed) return null;
    const exp = profile.discountExpiresAt;
    if (exp) {
      const expDate = exp?.toDate ? exp.toDate() : new Date(exp);
      if (expDate.getTime() < Date.now()) return null;
      return { pct, expiresAt: expDate };
    }
    return { pct, expiresAt: null };
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Sifarişlərim</h1>
          <p className="text-gray-500 mt-1">Bütün sifarişləriniz və mərhələləri</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-8">
          {/* ── Compact profile sidebar ─────────────────────── */}
          <aside className="lg:sticky lg:top-24 self-start space-y-4" data-testid="my-orders-profile">
            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center text-white text-lg font-bold ring-2 ring-[#D4AF37]/30">
                  {(profile.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Müştəri</p>
                  <p className="text-base font-semibold text-gray-900 truncate" data-testid="profile-name">
                    {profile.name}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                {profile.email && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="break-all" data-testid="profile-email">{profile.email}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span data-testid="profile-phone">{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Personal discount card — only shown when admin has set an active discount */}
            {activeDiscount && (
              <div
                className="relative bg-gradient-to-br from-[#FBF7EF] via-[#F4ECDC] to-[#FBF7EF] border border-[#D4AF37]/40 rounded-2xl p-5 overflow-hidden"
                data-testid="profile-discount-card"
              >
                <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#D4AF37]" aria-hidden="true" />
                <span className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#D4AF37]" aria-hidden="true" />
                <span className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#D4AF37]" aria-hidden="true" />
                <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#D4AF37]" aria-hidden="true" />
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-[#8C6A1A]" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8C6A1A] font-bold">Şəxsi endirim</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#8C6A1A] leading-none">
                    {activeDiscount.pct}
                  </span>
                  <span className="text-2xl font-semibold text-[#8C6A1A]">%</span>
                </div>
                <p className="text-xs text-[#8C6A1A]/80 mt-2 leading-relaxed">
                  Sizə xüsusi olaraq təqdim edilən endirim. Növbəti sifarişinizdə avtomatik tətbiq olunur.
                </p>
                {activeDiscount.expiresAt && (
                  <p className="text-[10px] text-[#8C6A1A]/70 mt-1.5">
                    Etibarlıdır:{' '}
                    {activeDiscount.expiresAt.toLocaleDateString('az-AZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            )}
          </aside>

          {/* ── Orders list (compact) ──────────────────────── */}
          <div>
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
              <div className="space-y-3">
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const idx = stageIndex(order.status);
                  const inDelivery =
                    order.status === 'on_the_way' || order.status === 'courier_handover';

                  return (
                    <div
                      key={order.id}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                      data-testid={`my-order-${order.id}`}
                    >
                      {/* Compact header — clickable to expand */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : (order.id || null))
                        }
                        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 text-left transition-colors"
                        data-testid={`my-order-toggle-${order.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {order.items[0]?.image ? (
                            <img
                              src={order.items[0].image}
                              alt=""
                              className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-100"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-md flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-base font-semibold text-gray-900">
                                #{order.orderNumber ?? order.id?.slice(0, 6)}
                              </p>
                              <span className="text-xs text-gray-400">·</span>
                              <p className="text-xs text-gray-500 truncate">
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {order.items.length} məhsul · {order.totalAmount.toFixed(2)} ₼
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusBadge(order.status)}`}
                            data-testid={`my-order-status-${order.id}`}
                          >
                            {STATUS_LABELS_AZ[order.status]}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </button>

                      {/* Status badge — mobile only (under header) */}
                      <div className="sm:hidden px-4 pb-2 -mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusBadge(order.status)}`}
                        >
                          {STATUS_LABELS_AZ[order.status]}
                        </span>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div
                          className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/40"
                          data-testid={`my-order-details-${order.id}`}
                        >
                          {/* Stage timeline */}
                          {order.status !== 'cancelled' &&
                            order.status !== 'payment_failed' &&
                            order.status !== 'pending_payment' && (
                              <div className="my-4">
                                <div className="grid grid-cols-5 gap-1">
                                  {STAGES.map((stg, i) => {
                                    const Icon = stg.icon;
                                    const reached = idx >= 0 && i <= idx;
                                    return (
                                      <div key={stg.key} className="flex flex-col items-center text-center">
                                        <div
                                          className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors ${
                                            reached
                                              ? i === idx
                                                ? 'bg-gray-900 text-white ring-2 ring-[#D4AF37]/40'
                                                : 'bg-emerald-600 text-white'
                                              : 'bg-gray-100 text-gray-400'
                                          }`}
                                        >
                                          <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <span
                                          className={`text-[9px] sm:text-[10px] font-medium leading-tight ${
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
                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-gray-900 to-[#D4AF37] transition-all"
                                    style={{
                                      width: `${idx >= 0 ? (idx / 4) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                          {order.status === 'payment_failed' && (
                            <div className="my-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                              <XCircle className="h-5 w-5 text-red-600" />
                              <p className="text-sm text-red-700">
                                Ödəniş uğursuz oldu. Səbətdən yenidən cəhd edin.
                              </p>
                            </div>
                          )}

                          {order.status === 'pending_payment' && (
                            <div className="my-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                              <Clock className="h-5 w-5 text-amber-600" />
                              <p className="text-sm text-amber-700">
                                Ödəniş gözləyir. Tezliklə təsdiqlənəcək.
                              </p>
                            </div>
                          )}

                          {/* Items */}
                          <div className="space-y-2 my-3">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-gray-100">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.productName}
                                    className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
                                    <Package className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                    {item.productName}
                                  </p>
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

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                            <div className="text-sm">
                              <span className="text-gray-500">Cəmi: </span>
                              <span className="text-lg font-bold text-gray-900">
                                {order.totalAmount.toFixed(2)} ₼
                              </span>
                            </div>
                            {inDelivery && (
                              <button
                                onClick={() => setSignOrderId(order.id!)}
                                disabled={confirmingId === order.id}
                                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                data-testid={`my-order-confirm-${order.id}`}
                              >
                                <PenLine className="h-4 w-4" />
                                Təhvil aldım (imza)
                              </button>
                            )}
                          </div>

                          {order.deliveryMethodName && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">Çatdırılma üsulu: </span>
                              {order.deliveryMethodName}
                              {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                                <span className="text-gray-400"> · {order.deliveryFee.toFixed(2)} ₼</span>
                              )}
                            </div>
                          )}

                          {order.customerSignature && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 mb-2 inline-flex items-center gap-1">
                                <PenLine className="h-3 w-3" /> İmzanız:
                              </p>
                              <img
                                src={order.customerSignature}
                                alt="signature"
                                className="h-20 bg-white rounded-lg border border-gray-200 px-2"
                                data-testid={`my-order-signature-${order.id}`}
                              />
                              <div
                                className="mt-3 bg-gradient-to-r from-emerald-50 to-[#FBF7EF] border border-emerald-200 rounded-lg p-3 flex items-start gap-2.5"
                                data-testid={`my-order-delivery-notice-${order.id}`}
                              >
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">
                                  <p className="font-semibold text-emerald-900">
                                    Sifariş uğurla təhvil verildi.
                                  </p>
                                  <p className="text-emerald-800/80 text-xs mt-0.5">
                                    De Valeur-i seçdiyiniz üçün təşəkkür edirik.
                                    {order.customerConfirmedAt && (
                                      <span className="block mt-1 text-[11px] opacity-70">
                                        Təsdiq vaxtı: {formatDate(order.customerConfirmedAt)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
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
