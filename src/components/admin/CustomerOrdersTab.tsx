import React, { useEffect, useState } from 'react';
import { Loader2, Package, Truck, CheckCircle2, Clock, XCircle, Trash2, CreditCard, Bike, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import {
  getAllCustomerOrders,
  updateCustomerOrderStatus,
  deleteCustomerOrder,
  STATUS_LABELS_AZ,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../../services/customerOrderService';
import { playNewOrderSound, unlockAudio } from '../../utils/notificationSound';

const SOUND_PREF_KEY = 'admin_sound_notifications_enabled';

const PAYMENT_STATUSES: CustomerOrderStatus[] = ['pending_payment', 'accepted', 'cancelled', 'payment_failed'];
const PRODUCT_STATUSES: CustomerOrderStatus[] = ['preparing', 'courier_handover', 'on_the_way', 'delivered'];

const statusBadge = (status: CustomerOrderStatus) => {
  const map: Record<CustomerOrderStatus, string> = {
    pending_payment: 'bg-amber-100 text-amber-800',
    payment_failed: 'bg-red-100 text-red-800',
    accepted: 'bg-emerald-100 text-emerald-800',
    preparing: 'bg-blue-100 text-blue-800',
    courier_handover: 'bg-indigo-100 text-indigo-800',
    on_the_way: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  return map[status];
};

const statusIcon = (status: CustomerOrderStatus) => {
  if (status === 'accepted') return <CreditCard className="h-4 w-4" />;
  if (status === 'preparing') return <Package className="h-4 w-4" />;
  if (status === 'courier_handover') return <ShoppingBag className="h-4 w-4" />;
  if (status === 'on_the_way') return <Truck className="h-4 w-4" />;
  if (status === 'delivered') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'pending_payment') return <Clock className="h-4 w-4" />;
  if (status === 'payment_failed' || status === 'cancelled') return <XCircle className="h-4 w-4" />;
  return null;
};

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Test/preview üçün — qlobal `playNewOrderSound` istifadə olunur (TTS "Yeni sifariş daxil oldu" + custom MP3 + beep fallback).
const previewOrderSound = () => {
  // İstifadəçi kliki olduğu üçün audio kilidlənmir, amma yenə də speech synth-i hazır vəziyyətə gətir
  unlockAudio();
  void playNewOrderSound();
};

const CustomerOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerOrderStatus>('all');
  const [search, setSearch] = useState('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(SOUND_PREF_KEY);
      return v === null ? true : v === 'true';
    } catch { return true; }
  });

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem(SOUND_PREF_KEY, String(next)); } catch { /* ignore */ }
    // When turning ON, play a preview so the admin can hear what the
    // notification will sound like (and unlocks WebAudio in the same gesture).
    if (next) {
      previewOrderSound();
    }
  };

  // Manual test button — always plays the sound regardless of preference.
  const handleTestSound = () => {
    previewOrderSound();
  };

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllCustomerOrders();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: CustomerOrderStatus) => {
    try {
      await updateCustomerOrderStatus(orderId, status);
      await load();
    } catch (e) {
      alert('Status dəyişdirilə bilmədi: ' + (e as Error).message);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('Bu sifarişi silmək istədiyinizə əminsiniz?')) return;
    try {
      await deleteCustomerOrder(orderId);
      await load();
    } catch (e) {
      alert('Silinmədi: ' + (e as Error).message);
    }
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.customerAddress,
        String(o.orderNumber || ''),
        o.id || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-customer-orders-tab">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Müştəri Sifarişləri</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
            title={soundEnabled ? 'Səs bildirişi aktivdir' : 'Səs bildirişi söndürülüb'}
            data-testid="admin-sound-toggle"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? 'Səs aç' : 'Səssiz'}
          </button>
          {/* Manual sound test button — useful for verifying audio works */}
          <button
            type="button"
            onClick={handleTestSound}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            title="Bildiriş səsini sınaqdan keçir"
            data-testid="admin-sound-test"
          >
            <Volume2 className="h-4 w-4 text-amber-500" />
            Səsi sınaqdan keçir
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Müştəri, email, telefon, sifariş #"
            className="px-3 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-black"
            data-testid="admin-customer-orders-search"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black"
            data-testid="admin-customer-orders-status-filter"
          >
            <option value="all">Status: Hamısı</option>
            <optgroup label="Ödənişlə bağlı">
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS_AZ[s]}</option>
              ))}
            </optgroup>
            <optgroup label="Məhsulla bağlı">
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS_AZ[s]}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} sifariş</div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Sifariş tapılmadı</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-xl p-5"
              data-testid={`admin-customer-order-${order.id}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Sifariş</p>
                  <p className="text-lg font-semibold text-gray-900">
                    #{order.orderNumber ?? order.id?.slice(0, 6)}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusBadge(order.status)}`}
                  >
                    {statusIcon(order.status)}
                    {STATUS_LABELS_AZ[order.status]}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">Epoint • {order.paymentStatus || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Müştəri</p>
                  <p className="font-medium text-gray-900">{order.customerName}</p>
                  <p className="text-gray-600">{order.customerEmail}</p>
                  <p className="text-gray-600">{order.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">
                    {order.isPickup ? 'Filialdan götürmə' : 'Çatdırılma ünvanı'}
                  </p>
                  {order.isPickup && order.pickupBranchName ? (
                    <>
                      <p className="text-gray-900 font-medium text-sm leading-tight">{order.pickupBranchName}</p>
                      {order.pickupBranchAddress && (
                        <p className="text-gray-600 text-xs mt-0.5">{order.pickupBranchAddress}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-700">{order.customerAddress}</p>
                  )}
                  {order.deliveryMethodName && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">Üsul:</span> {order.deliveryMethodName}
                      {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                        <span> · {order.deliveryFee.toFixed(2)} AZN</span>
                      )}
                    </p>
                  )}
                  {order.notes && (
                    <p className="text-xs text-amber-700 mt-1">Qeyd: {order.notes}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                    {item.image ? (
                      <img src={item.image} alt={item.productName} className="w-12 h-12 object-cover rounded-md" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × {item.price.toFixed(2)} AZN
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{(item.price * item.quantity).toFixed(2)} AZN</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="text-gray-500">Cəmi: </span>
                  <span className="text-lg font-bold text-gray-900">{order.totalAmount.toFixed(2)} AZN</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id!, e.target.value as CustomerOrderStatus)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black"
                    data-testid={`admin-customer-order-status-${order.id}`}
                  >
                    <optgroup label="Ödənişlə bağlı">
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS_AZ[s]}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Məhsulla bağlı">
                      {PRODUCT_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS_AZ[s]}</option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    onClick={() => handleDelete(order.id!)}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                    data-testid={`admin-customer-order-delete-${order.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {order.customerSignature && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
                    <Bike className="h-3 w-3" /> Müştəri imzası (Təhvil aldı):
                  </p>
                  <img
                    src={order.customerSignature}
                    alt="signature"
                    className="h-20 bg-gray-50 rounded border border-gray-200"
                  />
                </div>
              )}

              {order.receiverSignature && (
                <div className="mt-3 pt-3 border-t border-gray-100" data-testid={`admin-customer-receiver-${order.id}`}>
                  <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
                    <Bike className="h-3 w-3" /> Kuryer imzası (digər şəxs təhvil aldı):
                  </p>
                  <p className="text-xs text-gray-800 mb-1">
                    <span className="font-semibold">
                      {order.receiverName} {order.receiverSurname}
                    </span>
                    {order.receiverPosition && (
                      <span className="text-gray-500"> — {order.receiverPosition}</span>
                    )}
                    {order.receiverPhone && (
                      <span className="text-gray-500"> · {order.receiverPhone}</span>
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
                    className="h-20 bg-gray-50 rounded border border-gray-200"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersTab;
