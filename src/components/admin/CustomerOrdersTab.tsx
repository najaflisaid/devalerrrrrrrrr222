import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  CreditCard,
  Bike,
  ChevronDown,
} from 'lucide-react';
import {
  getAllCustomerOrders,
  updateCustomerOrderStatus,
  deleteCustomerOrder,
  STATUS_LABELS_AZ,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../../services/customerOrderService';

const STATUS_OPTIONS: CustomerOrderStatus[] = [
  'pending_payment',
  'preparing',
  'courier_handover',
  'on_the_way',
  'delivered',
  'cancelled',
  'payment_failed',
];

// ─── Derived sub-status helpers ─────────────────────────────
type PaymentPhase = 'pending' | 'paid' | 'failed';
type OperationPhase = 'pending' | 'preparing' | 'ready' | 'cancelled';
type DeliveryPhase = 'pending' | 'handed' | 'on_the_way' | 'delivered';

const derivePayment = (o: CustomerOrder): PaymentPhase => {
  if (o.status === 'payment_failed' || o.paymentStatus === 'failed') return 'failed';
  if (o.status === 'pending_payment') return 'pending';
  return 'paid';
};
const deriveOperation = (o: CustomerOrder): OperationPhase => {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'pending_payment' || o.status === 'payment_failed') return 'pending';
  if (o.status === 'preparing') return 'preparing';
  return 'ready';
};
const deriveDelivery = (o: CustomerOrder): DeliveryPhase => {
  if (o.status === 'delivered') return 'delivered';
  if (o.status === 'on_the_way') return 'on_the_way';
  if (o.status === 'courier_handover') return 'handed';
  return 'pending';
};

const formatDate = (raw: any) => {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Tri-status badge component ─────────────────────────────
interface PhaseCardProps {
  icon: React.ReactNode;
  title: string;
  state: string;
  tone: 'gray' | 'amber' | 'blue' | 'indigo' | 'purple' | 'green' | 'red';
  children?: React.ReactNode;
}
const TONE_MAP: Record<PhaseCardProps['tone'], string> = {
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

const PhaseCard: React.FC<PhaseCardProps> = ({ icon, title, state, tone, children }) => (
  <div className={`border rounded-xl p-3 ${TONE_MAP[tone]}`}>
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold opacity-80">
      <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      {title}
    </div>
    <div className="text-sm font-bold mt-1">{state}</div>
    {children && <div className="mt-2">{children}</div>}
  </div>
);

const CustomerOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerOrderStatus>('all');
  const [search, setSearch] = useState('');

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
        <div className="flex flex-wrap gap-2">
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
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS_AZ[s]}
              </option>
            ))}
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
          {filtered.map((order) => {
            const payment = derivePayment(order);
            const operation = deriveOperation(order);
            const delivery = deriveDelivery(order);

            // Payment card
            const paymentMeta = (() => {
              if (payment === 'paid') return { state: 'Ödənildi', tone: 'green' as const };
              if (payment === 'failed') return { state: 'Uğursuz', tone: 'red' as const };
              return { state: 'Gözləyir', tone: 'amber' as const };
            })();
            // Operation card
            const operationMeta = (() => {
              if (operation === 'cancelled') return { state: 'Ləğv edildi', tone: 'red' as const };
              if (operation === 'ready') return { state: 'Hazırlandı', tone: 'green' as const };
              if (operation === 'preparing') return { state: 'Hazırlanır', tone: 'blue' as const };
              return { state: 'Gözləyir', tone: 'gray' as const };
            })();
            // Delivery card
            const deliveryMeta = (() => {
              if (delivery === 'delivered') return { state: 'Təhvil verildi', tone: 'green' as const };
              if (delivery === 'on_the_way') return { state: 'Yoldadır', tone: 'purple' as const };
              if (delivery === 'handed') return { state: 'Kuryerə verildi', tone: 'indigo' as const };
              return { state: 'Gözləmədə', tone: 'gray' as const };
            })();

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl p-5"
                data-testid={`admin-customer-order-${order.id}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Sifariş</p>
                    <p className="text-lg font-semibold text-gray-900">
                      #{order.orderNumber ?? order.id?.slice(0, 6)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(order.id!)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100"
                    data-testid={`admin-customer-order-delete-${order.id}`}
                    title="Sifarişi sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* ── Tri-status panel ─────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {/* Payment */}
                  <PhaseCard
                    icon={<CreditCard />}
                    title="Ödəniş"
                    state={paymentMeta.state}
                    tone={paymentMeta.tone}
                  >
                    {payment !== 'paid' ? (
                      <button
                        onClick={() => handleStatusChange(order.id!, 'preparing')}
                        className="w-full text-[11px] font-medium px-2 py-1 bg-white/70 hover:bg-white rounded-md border border-current/20 transition-colors"
                        data-testid={`payment-confirm-${order.id}`}
                      >
                        Manual təsdiq et
                      </button>
                    ) : (
                      <p className="text-[10px] opacity-70">
                        {order.paymentStatus === 'success' ? 'Epoint təsdiqi alındı' : 'Manual'}
                      </p>
                    )}
                  </PhaseCard>

                  {/* Operation */}
                  <PhaseCard
                    icon={<Package />}
                    title="Hazırlanma"
                    state={operationMeta.state}
                    tone={operationMeta.tone}
                  >
                    {operation === 'pending' && payment === 'paid' && (
                      <button
                        onClick={() => handleStatusChange(order.id!, 'preparing')}
                        className="w-full text-[11px] font-medium px-2 py-1 bg-white/70 hover:bg-white rounded-md border border-current/20 transition-colors"
                      >
                        Hazırlanmağa başla
                      </button>
                    )}
                    {operation === 'preparing' && (
                      <button
                        onClick={() => handleStatusChange(order.id!, 'courier_handover')}
                        className="w-full text-[11px] font-medium px-2 py-1 bg-white/70 hover:bg-white rounded-md border border-current/20 transition-colors"
                        data-testid={`operation-ready-${order.id}`}
                      >
                        Hazırdır
                      </button>
                    )}
                    {operation === 'ready' && (
                      <p className="text-[10px] opacity-70">Çatdırılma fazası aktivdir</p>
                    )}
                  </PhaseCard>

                  {/* Delivery */}
                  <PhaseCard
                    icon={<Truck />}
                    title="Çatdırılma"
                    state={deliveryMeta.state}
                    tone={deliveryMeta.tone}
                  >
                    {operation === 'ready' && delivery !== 'delivered' && (
                      <div className="relative">
                        <select
                          value={
                            delivery === 'handed'
                              ? 'courier_handover'
                              : delivery === 'on_the_way'
                              ? 'on_the_way'
                              : 'courier_handover'
                          }
                          onChange={(e) =>
                            handleStatusChange(order.id!, e.target.value as CustomerOrderStatus)
                          }
                          className="w-full text-[11px] font-medium px-2 py-1 pr-6 bg-white/70 hover:bg-white rounded-md border border-current/20 appearance-none cursor-pointer"
                          data-testid={`delivery-select-${order.id}`}
                        >
                          <option value="courier_handover">Kuryerə verildi</option>
                          <option value="on_the_way">Yoldadır</option>
                          <option value="delivered">Təhvil verildi</option>
                        </select>
                        <ChevronDown className="h-3 w-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    )}
                    {delivery === 'delivered' && order.customerSignature && (
                      <p className="text-[10px] opacity-70 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Müştəri imzası alındı
                      </p>
                    )}
                    {delivery === 'delivered' && !order.customerSignature && (
                      <p className="text-[10px] opacity-70">Manual təsdiq</p>
                    )}
                  </PhaseCard>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Müştəri</p>
                    <p className="font-medium text-gray-900">{order.customerName}</p>
                    <p className="text-gray-600">{order.customerEmail}</p>
                    <p className="text-gray-600">{order.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Çatdırılma ünvanı</p>
                    <p className="text-gray-700">{order.customerAddress}</p>
                    {order.deliveryMethodName && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Üsul:</span> {order.deliveryMethodName}
                        {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                          <span> · {order.deliveryFee.toFixed(2)} ₼</span>
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
                          {item.quantity} × {item.price.toFixed(2)} ₼
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{(item.price * item.quantity).toFixed(2)} ₼</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="text-sm">
                    <span className="text-gray-500">Cəmi: </span>
                    <span className="text-lg font-bold text-gray-900">{order.totalAmount.toFixed(2)} ₼</span>
                  </div>
                  {/* Cancel quick action */}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => handleStatusChange(order.id!, 'cancelled')}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                      data-testid={`admin-customer-order-cancel-${order.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Sifarişi ləğv et
                    </button>
                  )}
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
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Sifariş təsdiqlənmiş şəkildə təhvil verildi.
                      {order.customerConfirmedAt && (
                        <span className="opacity-70 ml-1">{formatDate(order.customerConfirmedAt)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending payment warning */}
                {order.status === 'pending_payment' && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                    <Clock className="h-3 w-3" />
                    Ödəniş hələ təsdiqlənməyib
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersTab;
