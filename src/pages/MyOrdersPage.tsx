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
  Phone,
  ChevronDown,
  ChevronUp,
  Tag,
  Ticket,
  MessageCircle,
  Headphones,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getUserOrders,
  customerConfirmDelivered,
  STATUS_LABELS_AZ,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../services/customerOrderService';
import { getUserAssignedCodes, type PromoCode } from '../services/promoCodeService';
import { getEpointRedirectUrl } from '../services/epointPaymentService';

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
  surname: string;
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
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [signOrderId, setSignOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [profileExtra, setProfileExtra] = useState<{
    discountPercentage?: number;
    discountExpiresAt?: any;
    discountUsed?: boolean;
  }>({});
  const [assignedCodes, setAssignedCodes] = useState<PromoCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState<string>('+994777577277');
  // Inline Epoint retry widget — same iframe flow as CartPage. Rendered as
  // full-screen overlay so it works reliably both in standalone deploys and
  // inside embedded/sandbox iframes where top-level redirects can be blocked.
  const [retryWidgetUrl, setRetryWidgetUrl] = useState<string | null>(null);
  const [retryIframeReady, setRetryIframeReady] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    if (!userId || role !== 'customer') {
      navigate('/');
      return;
    }
    void load(userId);
    void loadProfileExtra(userId);
    // Load support phone from siteSettings/whatsapp.sender_display (or fall back to default)
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'siteSettings', 'whatsapp'));
        if (snap.exists()) {
          const data: any = snap.data();
          if (data.sender_display) setSupportPhone(String(data.sender_display));
        }
      } catch { /* ignore — default kept */ }
    })();
    // Müştəriyə təyin olunmuş hələ istifadə edilməmiş promo kodları yüklə
    getUserAssignedCodes(userId)
      .then(setAssignedCodes)
      .catch(() => setAssignedCodes([]));
  }, [navigate]);

  // Listen for Epoint iframe postMessage results during retry payment flow
  useEffect(() => {
    if (!retryWidgetUrl) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (typeof data.status !== 'string') return;
      const status = String(data.status).toLowerCase();
      const orderId = sessionStorage.getItem('pending_epoint_order_id') || '';
      if (status === 'success') {
        setRetryWidgetUrl(null);
        setRetryIframeReady(false);
        navigate(`/payment/success${orderId ? `?orderId=${orderId}` : ''}`);
      } else if (status === 'error' || status === 'failed' || status === 'declined') {
        setRetryWidgetUrl(null);
        setRetryIframeReady(false);
        setPayingOrderId(null);
        alert('Ödəniş tamamlanmadı. Yenidən cəhd edin.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [retryWidgetUrl, navigate]);

  // Lock body scroll while retry widget open (fullscreen overlay)
  useEffect(() => {
    if (!retryWidgetUrl) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [retryWidgetUrl]);

  const handleRetryPayment = async (order: CustomerOrder) => {
    if (!order.id) return;
    try {
      setPayingOrderId(order.id);
      setRetryIframeReady(false);
      sessionStorage.setItem('pending_epoint_order_id', order.id);
      const url = await getEpointRedirectUrl({
        orderId: order.id,
        amount: order.totalAmount,
        description: `DE VALEUR sifariş #${order.id.slice(0, 10)}`,
      });
      setRetryWidgetUrl(url);
    } catch (err: any) {
      console.error('Retry payment error:', err);
      sessionStorage.removeItem('pending_epoint_order_id');
      alert('Ödəniş başladıla bilmədi: ' + (err?.message || 'Naməlum xəta'));
      setPayingOrderId(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      /* ignore */
    }
  };

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
      surname: localStorage.getItem('userSurname') || '',
      phone: localStorage.getItem('userPhone') || latest?.customerPhone || '',
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
              <div className="mb-4">
                <p className="text-base font-semibold text-gray-900 truncate" data-testid="profile-name">
                  {[profile.name, profile.surname].filter(Boolean).join(' ') || 'Hörmətli müştəri'}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mt-1">Şəxsi məlumatlar</p>
              </div>

              <div className="space-y-2.5 text-sm">
                {profile.phone && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span data-testid="profile-phone">{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Support / contact card — always shown */}
            <div
              className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 shadow-sm"
              data-testid="profile-support-card"
            >
              <div className="flex items-center gap-2 mb-3">
                <Headphones className="h-4 w-4 text-emerald-700" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">Bizimlə əlaqə</p>
              </div>
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                Sualınız varsa? Komandamız sizə kömək etməkdən məmnun olar.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                <a
                  href={`tel:${supportPhone.replace(/\s/g, '')}`}
                  className="text-sm font-mono font-semibold text-gray-900 hover:text-emerald-700 transition-colors"
                  data-testid="profile-support-phone"
                >
                  {supportPhone}
                </a>
              </div>
              <a
                href={`https://wa.me/${supportPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Salam, ${[profile.name, profile.surname].filter(Boolean).join(' ') || 'müştəri'} olaraq DE VALEUR-dan dəstək almaq istəyirəm.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                data-testid="profile-whatsapp-support-btn"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp ilə yaz
              </a>
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

            {/* Sizə təyin olunmuş promo kodlar — admin hər kəs üçün ümumi yox, KONKRET sizin üçün yaradıb */}
            {assignedCodes.length > 0 && (
              <div
                className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm"
                data-testid="profile-assigned-codes-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="h-4 w-4 text-emerald-700" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">Sizə hədiyyə kod{assignedCodes.length > 1 ? 'lar' : ''}</p>
                </div>
                <div className="space-y-2">
                  {assignedCodes.map((c) => (
                    <div
                      key={c.code}
                      className="relative bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-3"
                      data-testid={`assigned-code-${c.code}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-2xl font-bold text-emerald-900 tabular-nums leading-tight">
                            {c.code}
                          </p>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            {c.discount}% endirim · birdəfəlik
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopyCode(c.code)}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 inline-flex items-center gap-1 flex-shrink-0"
                          data-testid={`copy-code-${c.code}`}
                          title="Kodu köçür"
                        >
                          {copiedCode === c.code ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </>
                          ) : (
                            'Köçür'
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-emerald-700/70 mt-2 leading-snug">
                        Səbətdə "Endirim kodu" hissəsinə daxil edib tətbiq edin.
                      </p>
                    </div>
                  ))}
                </div>
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
                  // Even after a courier captured a receiver's signature on the customer's
                  // behalf, the actual account holder may still want to add their own
                  // signature later.
                  const canSelfSignLater = !!order.receiverSignature && !order.customerSignature;

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
                                Sifariş № {order.orderNumber ?? order.id?.slice(0, 6)}
                              </p>
                              <span className="text-xs text-gray-400">·</span>
                              <p className="text-xs text-gray-500 truncate">
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {order.items.length} məhsul · {order.totalAmount.toFixed(2)} AZN
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
                            <div className="my-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-5 w-5 text-amber-600" />
                                <p className="text-sm text-amber-800 font-medium">
                                  Ödəniş gözləyir
                                </p>
                              </div>
                              <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                                Bu sifariş üçün ödəniş tamamlanmayıb. İndi yenidən ödəyə bilərsiniz.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRetryPayment(order)}
                                disabled={payingOrderId === order.id}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                data-testid={`retry-payment-btn-${order.id}`}
                              >
                                {payingOrderId === order.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Ödəniş səhifəsi açılır...
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="h-4 w-4" />
                                    Yenidən Ödə
                                  </>
                                )}
                              </button>
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
                                    className="w-12 h-12 object-contain bg-white border border-gray-100 rounded-md flex-shrink-0 p-0.5"
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
                                    {item.quantity} × {item.price.toFixed(2)} AZN
                                  </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {(item.price * item.quantity).toFixed(2)} AZN
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Hədiyyə kartı kodları — müştəri özünə və ya
                              başqasına hədiyyə kartı alıbsa, hər kart üçün
                              paylaşma linki və WhatsApp düyməsi göstərilir.
                              Beləliklə müştəri sonradan da kartı kiminsə ilə
                              paylaşa bilər. */}
                          {Array.isArray((order as any).giftCardCodes) && (order as any).giftCardCodes.length > 0 && (
                            <div className="my-3 bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 rounded-lg p-3" data-testid={`my-order-giftcards-${order.id}`}>
                              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-2">
                                <Ticket className="h-3.5 w-3.5" />
                                Hədiyyə Kartı Kodları
                              </p>
                              <div className="space-y-1.5">
                                {(order as any).giftCardCodes.map((g: { code: string; amount: number }, gi: number) => {
                                  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gift-card/${g.code}`;
                                  const waText = encodeURIComponent(`Sizə DE VALEUR hədiyyə kartı göndərildi! ${shareUrl}`);
                                  return (
                                    <div key={gi} className="flex flex-wrap items-center gap-2 bg-white border border-amber-100 rounded px-2.5 py-1.5">
                                      <span className="font-mono text-sm font-semibold tracking-widest text-gray-900">{g.code}</span>
                                      <span className="text-[11px] text-gray-500">· {g.amount.toFixed(0)} AZN</span>
                                      <div className="ml-auto flex items-center gap-1">
                                        <a
                                          href={`https://wa.me/?text=${waText}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                          data-testid={`my-order-giftcard-wa-${order.id}-${gi}`}
                                        >
                                          <MessageCircle className="h-3 w-3" />
                                          WhatsApp
                                        </a>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(shareUrl);
                                              alert('Hədiyyə kartı linki kopyalandı!');
                                            } catch { /* noop */ }
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                          data-testid={`my-order-giftcard-copy-${order.id}-${gi}`}
                                        >
                                          Linki kopyala
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                            <div className="text-sm">
                              <span className="text-gray-500">Cəmi: </span>
                              <span className="text-lg font-bold text-gray-900">
                                {order.totalAmount.toFixed(2)} AZN
                              </span>
                            </div>
                            {(inDelivery || canSelfSignLater) && (
                              <button
                                onClick={() => setSignOrderId(order.id!)}
                                disabled={confirmingId === order.id}
                                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                data-testid={`my-order-confirm-${order.id}`}
                              >
                                <PenLine className="h-4 w-4" />
                                {canSelfSignLater ? 'Mən də öz imzamı atıram' : 'Təhvil aldım (imza)'}
                              </button>
                            )}
                          </div>

                          {order.deliveryMethodName && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">Çatdırılma üsulu: </span>
                              {order.deliveryMethodName}
                              {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                                <span className="text-gray-400"> · {order.deliveryFee.toFixed(2)} AZN</span>
                              )}
                            </div>
                          )}

                          {!order.customerSignature && order.receiverSignature && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
                                <Bike className="h-3 w-3" /> Sifarişi sizdən başqası təhvil aldı:
                              </p>
                              <p className="text-xs text-gray-800 mb-1">
                                <span className="font-semibold">
                                  {order.receiverName} {order.receiverSurname}
                                </span>
                                {order.receiverPosition && (
                                  <span className="text-gray-500"> — {order.receiverPosition}</span>
                                )}
                              </p>
                              {order.receiverSignedAt?.toDate && (
                                <p className="text-[10px] text-gray-500 mb-1">
                                  {order.receiverSignedAt.toDate().toLocaleString('az-AZ')}
                                </p>
                              )}
                              <img
                                src={order.receiverSignature}
                                alt="receiver signature"
                                className="h-20 bg-white rounded-lg border border-gray-200 px-2"
                                data-testid={`my-order-receiver-only-${order.id}`}
                              />
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
                              {order.receiverSignature && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
                                    <Bike className="h-3 w-3" /> Sifarişi sizdən başqası təhvil aldı:
                                  </p>
                                  <p className="text-xs text-gray-800 mb-1">
                                    <span className="font-semibold">
                                      {order.receiverName} {order.receiverSurname}
                                    </span>
                                    {order.receiverPosition && (
                                      <span className="text-gray-500"> — {order.receiverPosition}</span>
                                    )}
                                  </p>
                                  {order.receiverSignedAt?.toDate && (
                                    <p className="text-[10px] text-gray-500 mb-1">
                                      {order.receiverSignedAt.toDate().toLocaleString('az-AZ')}
                                    </p>
                                  )}
                                  <img
                                    src={order.receiverSignature}
                                    alt="receiver signature"
                                    className="h-20 bg-white rounded-lg border border-gray-200 px-2"
                                    data-testid={`my-order-receiver-signature-${order.id}`}
                                  />
                                </div>
                              )}
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

      {/* Inline Epoint retry widget — full-screen overlay iframe (works in
          embedded/sandbox contexts where top-level redirects are blocked). */}
      {retryWidgetUrl && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col"
          data-testid="retry-epoint-widget"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-black/[0.02] flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={1.6} />
              <span className="text-[11px] uppercase tracking-[0.18em] text-black/70 truncate">
                Təhlükəsiz ödəniş — Epoint
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setRetryWidgetUrl(null);
                setRetryIframeReady(false);
                setPayingOrderId(null);
                sessionStorage.removeItem('pending_epoint_order_id');
              }}
              aria-label="Ödənişi bağla"
              className="text-[11px] uppercase tracking-[0.16em] text-black/55 hover:text-black transition-colors flex items-center gap-1 py-1 px-2"
              data-testid="retry-epoint-close"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Geri
            </button>
          </div>
          <div className="relative flex-1 w-full bg-white">
            <iframe
              src={retryWidgetUrl}
              title="Epoint Payment Retry"
              className="absolute inset-0 w-full h-full bg-white border-0 block"
              allow="payment *; publickey-credentials-get *; clipboard-write"
              loading="eager"
              data-testid="retry-epoint-iframe"
              onLoad={(e) => {
                setRetryIframeReady(true);
                // After Epoint completes payment it redirects the iframe to
                // our success/error URL (same origin). Break out and navigate
                // the parent window so the customer lands on the proper page.
                try {
                  const ifr = e.currentTarget as HTMLIFrameElement;
                  const href = ifr.contentWindow?.location?.href || '';
                  if (!href) return;
                  if (
                    href.includes('/payment/success') ||
                    href.includes('/payment/error') ||
                    href.includes('/payment/result')
                  ) {
                    window.location.href = href;
                  }
                } catch {
                  // Cross-origin while still on epoint.az — ignore.
                }
              }}
            />
            {!retryIframeReady && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-white"
                data-testid="retry-epoint-skeleton"
              >
                <Loader2 className="w-7 h-7 text-black/30 animate-spin mb-3" strokeWidth={1.5} />
                <p className="text-[12px] text-black/55">Ödəniş açılır...</p>
                <p className="text-[10px] text-black/35 mt-1 uppercase tracking-[0.18em]">
                  Bir neçə saniyə
                </p>
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-black/10 text-center bg-black/[0.02] flex-shrink-0">
            <p className="text-[10px] text-black/45 uppercase tracking-[0.18em]">
              Apple Pay · Google Pay · Visa · Mastercard
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
