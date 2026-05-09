import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck,
  Search,
  ArrowLeft,
  Lock,
  X,
  CheckCircle2,
  AlertCircle,
  Eraser,
  Package,
  Mail,
  LogOut,
  History,
  ShoppingBag,
  Building2,
} from 'lucide-react';
import {
  getCustomersWithPendingDeliveries,
  getOrdersAwaitingReceiverSignature,
  getRecentlySignedB2BOrders,
  saveReceiverSignature,
} from '../services/b2bOrderService';
import {
  getRetailCustomersWithPendingDeliveries,
  getRetailOrdersAwaitingReceiverSignature,
  getRecentlySignedRetailOrders,
  saveCustomerReceiverSignature,
} from '../services/customerOrderService';
import {
  loginCourier,
  logoutCourier,
  getCurrentCourierSession,
  CourierSession,
} from '../services/courierService';

type SectionKey = 'b2b' | 'retail';

interface PendingCustomer {
  email: string;
  name: string;
  lastname?: string;
  company?: string;
  phone?: string;
  address?: string;
  pendingCount: number;
}

const DeliveryPage: React.FC = () => {
  const [session, setSession] = useState<CourierSession | null>(() => getCurrentCourierSession());

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active section
  const [section, setSection] = useState<SectionKey>('b2b');

  // Customers + history per section
  const [b2bCustomers, setB2bCustomers] = useState<PendingCustomer[]>([]);
  const [retailCustomers, setRetailCustomers] = useState<PendingCustomer[]>([]);
  const [b2bRecent, setB2bRecent] = useState<any[]>([]);
  const [retailRecent, setRetailRecent] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [allOrdersForCustomer, setAllOrdersForCustomer] = useState<any[]>([]);

  const [receiverName, setReceiverName] = useState('');
  const [receiverSurname, setReceiverSurname] = useState('');
  const [receiverPosition, setReceiverPosition] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // ───────────────────── Load data ─────────────────────
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    (async () => {
      try {
        const [b2bList, retailList, b2bHist, retailHist] = await Promise.all([
          getCustomersWithPendingDeliveries(),
          getRetailCustomersWithPendingDeliveries(),
          getRecentlySignedB2BOrders(3),
          getRecentlySignedRetailOrders(3),
        ]);
        setB2bCustomers(b2bList as any);
        setRetailCustomers(retailList as any);
        setB2bRecent(b2bHist);
        setRetailRecent(retailHist);
      } catch (e: any) {
        setError(e?.message || 'Məlumatlar yüklənmədi');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, reloadTick]);

  const customers = section === 'b2b' ? b2bCustomers : retailCustomers;
  const recentSigned = section === 'b2b' ? b2bRecent : retailRecent;

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.email, c.name, c.lastname, c.company, c.phone, c.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [customers, search]);

  // ───────────────────── Customer selected ─────────────────────
  const onSelectCustomer = async (c: PendingCustomer) => {
    setSelectedCustomer(c);
    setError('');
    try {
      const orders =
        section === 'b2b'
          ? await getOrdersAwaitingReceiverSignature(c.email)
          : await getRetailOrdersAwaitingReceiverSignature(c.email);
      setAllOrdersForCustomer(orders);
      setSelectedOrder(orders[0] || null);
    } catch (e: any) {
      setError(e?.message || 'Sifariş yüklənmədi');
    }
  };

  // ───────────────────── Canvas drawing ─────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedOrder) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const evt: any =
        (e as TouchEvent).touches?.[0] ||
        (e as TouchEvent).changedTouches?.[0] ||
        e;
      return { x: evt.clientX - r.left, y: evt.clientY - r.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      setHasInk(true);
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const stop = () => {
      isDrawingRef.current = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', stop);
    };
  }, [selectedOrder]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const handleSubmit = async () => {
    setError('');
    if (!selectedOrder || !canvasRef.current) return;
    if (!receiverName.trim() || !receiverSurname.trim() || !receiverPosition.trim()) {
      setError('Ad, soyad və vəzifə sahələri məcburidir.');
      return;
    }
    if (!hasInk) {
      setError('Zəhmət olmasa imzanı çəkin.');
      return;
    }

    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const payload = {
        receiverName,
        receiverSurname,
        receiverPosition,
        receiverPhone,
        receiverSignature: dataUrl,
      };
      if (section === 'b2b') {
        await saveReceiverSignature(selectedOrder.id, payload);
      } else {
        await saveCustomerReceiverSignature(selectedOrder.id, payload);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedOrder(null);
        setSelectedCustomer(null);
        setAllOrdersForCustomer([]);
        setReceiverName('');
        setReceiverSurname('');
        setReceiverPosition('');
        setReceiverPhone('');
        setHasInk(false);
        setReloadTick((n) => n + 1);
      }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Yadda saxlanmadı');
    } finally {
      setSubmitting(false);
    }
  };

  // ═════════════════════ LOGIN GATE ═════════════════════
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full" data-testid="delivery-login-gate">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Truck className="h-7 w-7 text-gray-700" />
            </div>
          </div>
          <h1 className="text-2xl font-playfair text-center text-gray-900 mb-1">Çatdırılma paneli</h1>
          <p className="text-sm text-gray-500 text-center mb-5">DE VALEUR — Kuryer girişi</p>

          {loginError && (
            <div className="bg-red-50 text-red-600 text-sm p-2.5 rounded-lg mb-3 text-center" data-testid="delivery-login-error">
              {loginError}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              setLoginLoading(true);
              try {
                const s = await loginCourier(loginEmail, loginPassword);
                setSession(s);
              } catch (err: any) {
                setLoginError(err?.message || 'Giriş alınmadı');
              } finally {
                setLoginLoading(false);
              }
            }}
          >
            <div className="relative mb-3">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                autoFocus
                data-testid="delivery-login-email"
              />
            </div>
            <div className="relative mb-4">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Şifrə"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                data-testid="delivery-login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400"
              data-testid="delivery-login-submit"
            >
              {loginLoading ? 'Giriş edilir...' : 'Daxil ol'}
            </button>
          </form>
          <p className="text-[11px] text-gray-400 text-center mt-4">
            Giriş məlumatlarını admin verir.
          </p>
        </div>
      </div>
    );
  }

  // ═════════════════════ ORDER → SIGNATURE FORM ═════════════════════
  if (selectedOrder && selectedCustomer) {
    const totalItems = (selectedOrder.items || []).reduce(
      (s: number, it: any) => s + (it.quantity || 0),
      0
    );
    const headerTitle =
      section === 'b2b'
        ? selectedCustomer.company ||
          `${selectedCustomer.name || ''} ${selectedCustomer.lastname || ''}`.trim()
        : selectedCustomer.name || selectedCustomer.email;

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => {
              setSelectedOrder(null);
              setSelectedCustomer(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
            data-testid="delivery-back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">
              {section === 'b2b' ? 'B2B' : 'Müştəri'} — sifariş #
              {selectedOrder.orderNumber || selectedOrder.id.slice(0, 6)}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">{headerTitle}</p>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 py-5 space-y-5">
          {success && (
            <div
              className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm flex gap-2"
              data-testid="delivery-success"
            >
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              İmza uğurla qeydə alındı! Sifariş siyahısına qayıdırsınız...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Order details */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Sifariş təfərrüatları</h2>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
              <span className="text-gray-500">Sifariş №:</span>
              <span className="font-mono text-gray-900 text-right">
                #{selectedOrder.orderNumber || '—'}
              </span>
              <span className="text-gray-500">Məhsul sayı:</span>
              <span className="font-semibold text-gray-900 text-right">{totalItems}</span>
              <span className="text-gray-500">Məbləğ:</span>
              <span className="font-semibold text-gray-900 text-right">
                {Number(selectedOrder.totalAmount || 0).toFixed(2)} AZN
              </span>
              <span className="text-gray-500">Tarix:</span>
              <span className="text-gray-700 text-right">
                {selectedOrder.createdAt?.toDate?.().toLocaleDateString('az-AZ') || '—'}
              </span>
            </div>

            <details className="mt-3 group">
              <summary className="text-xs text-gray-600 cursor-pointer select-none">
                Məhsulların siyahısı ({(selectedOrder.items || []).length})
              </summary>
              <ul className="mt-2 space-y-1.5 text-xs">
                {(selectedOrder.items || []).map((it: any, i: number) => (
                  <li key={i} className="flex justify-between gap-2 text-gray-700">
                    <span className="truncate">
                      {it.productName?.az || it.productName?.ru || it.productName || it.productId}
                    </span>
                    <span className="text-gray-500">×{it.quantity}</span>
                  </li>
                ))}
              </ul>
            </details>

            {allOrdersForCustomer.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="text-[11px] text-gray-500 uppercase tracking-wider">
                  Başqa sifariş seç
                </label>
                <select
                  value={selectedOrder.id}
                  onChange={(e) => {
                    const found = allOrdersForCustomer.find((o) => o.id === e.target.value);
                    if (found) setSelectedOrder(found);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  data-testid="delivery-order-switcher"
                >
                  {allOrdersForCustomer.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNumber || o.id.slice(0, 6)} —{' '}
                      {Number(o.totalAmount || 0).toFixed(2)} AZN
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Receiver info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Təhvil alanın məlumatları</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Ad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                  placeholder="Adı"
                  data-testid="delivery-receiver-name"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Soyad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiverSurname}
                  onChange={(e) => setReceiverSurname(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                  placeholder="Soyadı"
                  data-testid="delivery-receiver-surname"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Vəzifə <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={receiverPosition}
                onChange={(e) => setReceiverPosition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                placeholder={
                  section === 'b2b'
                    ? 'Məs: Anbardar, Menecer, Mağaza müdiri...'
                    : 'Məs: Qohum, Qonşu, Resepşn...'
                }
                data-testid="delivery-receiver-position"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Telefon (məsləhət)</label>
              <input
                type="tel"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                placeholder="+994 50 123 45 67"
                data-testid="delivery-receiver-phone"
              />
            </div>
          </div>

          {/* Signature canvas */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">İmza</h2>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
                data-testid="delivery-signature-clear"
              >
                <Eraser className="h-3 w-3" /> Sil
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Aşağıdakı sahəyə imzanı çəkdirin.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <canvas
                ref={canvasRef}
                className="block w-full touch-none"
                style={{ height: 200 }}
                data-testid="delivery-signature-canvas"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || success}
            className="w-full bg-gray-900 text-white py-3.5 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400"
            data-testid="delivery-signature-submit"
          >
            {submitting ? 'Qeydə alınır...' : success ? '✓ Qeyd olundu' : 'İmzanı təsdiqlə və yadda saxla'}
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════ CUSTOMER LIST ═════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Truck className="h-6 w-6 text-gray-700" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              Çatdırılma — {session.name}
            </h1>
            <p className="text-xs text-gray-500 truncate">{session.email}</p>
          </div>
          <button
            onClick={() => {
              logoutCourier();
              setSession(null);
              setLoginEmail('');
              setLoginPassword('');
            }}
            className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1"
            data-testid="delivery-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Çıxış
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Section tabs */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-white border border-gray-200 p-1.5 rounded-xl">
          <button
            onClick={() => {
              setSection('b2b');
              setSearch('');
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              section === 'b2b'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid="delivery-section-b2b"
          >
            <Building2 className="h-4 w-4" />
            B2B ({b2bCustomers.length})
          </button>
          <button
            onClick={() => {
              setSection('retail');
              setSearch('');
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              section === 'retail'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid="delivery-section-retail"
          >
            <ShoppingBag className="h-4 w-4" />
            Müştəri ({retailCustomers.length})
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              section === 'b2b'
                ? 'Şirkət, ad, email, telefon ilə axtar...'
                : 'Müştəri adı, email, telefon ilə axtar...'
            }
            className="w-full pl-9 pr-9 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            data-testid="delivery-search-input"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Yüklənir...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm" data-testid="delivery-empty-state">
            {customers.length === 0
              ? section === 'b2b'
                ? 'Hazırda "Çatdırılmadadır" statusunda B2B sifariş yoxdur.'
                : 'Hazırda yolda olan müştəri sifarişi yoxdur.'
              : 'Axtarışa uyğun nəticə tapılmadı.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCustomers.map((c) => {
              const initial = (c.company || c.name || c.email || '?').charAt(0).toUpperCase();
              const titleLine =
                section === 'b2b'
                  ? c.company || `${c.name || ''} ${c.lastname || ''}`.trim() || c.email
                  : c.name || c.email;
              return (
                <button
                  key={c.email}
                  onClick={() => onSelectCustomer(c)}
                  className="w-full text-left bg-white border border-gray-200 hover:border-gray-900 rounded-xl p-4 transition-all flex items-center gap-3 group"
                  data-testid={`delivery-customer-${c.email}`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 group-hover:bg-gray-900 group-hover:text-white flex items-center justify-center text-xs font-semibold transition-all">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{titleLine}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-semibold rounded-full whitespace-nowrap">
                    {c.pendingCount} sifariş
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Recently signed (auto-disappears after 3 days) */}
        {recentSigned.length > 0 && (
          <div className="mt-8" data-testid="delivery-recent-signed">
            <div className="flex items-center gap-2 mb-3 px-1">
              <History className="h-4 w-4 text-gray-500" />
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Son 3 günün imzalanmış sifarişləri
              </h2>
            </div>
            <div className="space-y-2">
              {recentSigned.map((o) => {
                const when = o.receiverSignedAt?.toDate
                  ? o.receiverSignedAt.toDate().toLocaleString('az-AZ', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                const title =
                  section === 'b2b'
                    ? o.companyName || `${o.customerName || ''} ${o.customerLastname || ''}`.trim()
                    : o.customerName || o.customerEmail;
                return (
                  <div
                    key={o.id}
                    className="bg-white border border-gray-100 rounded-lg p-3 flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        #{o.orderNumber || o.id.slice(0, 6)} · {title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {o.receiverName} {o.receiverSurname}
                        {o.receiverPosition ? ` — ${o.receiverPosition}` : ''}
                        {when ? ` · ${when}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-3">
              İmzalandıqdan 3 gün sonra avtomatik silinir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryPage;
