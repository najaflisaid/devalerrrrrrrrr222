import React, { useState, useEffect } from 'react';
import { Package, Eye, Check, X, Clock, Loader2, Trash2, Edit, Save, Minus, Plus, User, Calendar, Search, ChevronDown, Users, List } from 'lucide-react';
import { getB2BOrders, updateB2BOrderStatus, deleteB2BOrder, updateB2BOrderNote, updateOrderItemQuantity, removeOrderItem, updateB2BOrderCustomerInfo, updateB2BOrderPaymentInfo, updateB2BOrderCheckedItems } from '../../services/b2bOrderService';
import { productService } from '../../services/productService';

interface B2BOrder {
  id: string;
  customerName: string;
  customerLastname?: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  items: any[];
  totalAmount: number;
  discountAmount: number;
  status: string;
  createdAt: any;
  notes?: string;
  deliveredAt?: any;
  adminNote?: string;
  signature?: string;
  signedAt?: any;
  totalDebt?: number;
  paymentDeadline?: string;
}

const B2BOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<B2BOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [editingCustomerOrderId, setEditingCustomerOrderId] = useState<string | null>(null);
  const [customerEditData, setCustomerEditData] = useState({
    customerName: '',
    customerLastname: '',
    customerPhone: '',
    companyName: ''
  });
  const [editingPaymentOrderId, setEditingPaymentOrderId] = useState<string | null>(null);
  const [paymentEditData, setPaymentEditData] = useState({
    totalDebt: '',
    paymentDeadline: ''
  });

  // NEW: search + group-by-customer accordion
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  // Per-order "show all items" toggle (default shows first 5)
  const [expandedOrderItems, setExpandedOrderItems] = useState<Set<string>>(new Set());

  const toggleExpandedOrderItems = (orderId: string) => {
    setExpandedOrderItems((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // Toggle checkmark (confirmation) for a specific item in an order
  const toggleItemChecked = async (order: B2BOrder, itemIndex: number) => {
    if (!order.id) return;
    const existing: number[] = Array.isArray((order as any).checkedItems)
      ? [...(order as any).checkedItems]
      : [];
    const idx = existing.indexOf(itemIndex);
    if (idx >= 0) existing.splice(idx, 1);
    else existing.push(itemIndex);

    // Optimistic local update
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? ({ ...o, checkedItems: existing } as any) : o))
    );
    try {
      await updateB2BOrderCheckedItems(order.id, existing);
    } catch (err) {
      console.error(err);
      alert('Təsdiq yadda saxlana bilmədi');
    }
  };

  const toggleCustomer = (key: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  
  useEffect(() => {
    loadProducts();
    loadOrders();
  }, [statusFilter]);

  const loadProducts = async () => {
    try {
      const productsData = await productService.getAll();
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getB2BOrders(statusFilter === 'all' ? undefined : statusFilter);
      setOrders(data as B2BOrder[]);
      return data as B2BOrder[];
    } catch (error) {
      console.error('Error loading orders:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateB2BOrderStatus(orderId, newStatus);
      loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Status dəyişdirilə bilmədi');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Bu sifarişi silmək istədiyinizə əminsiniz?')) {
      return;
    }
    try {
      await deleteB2BOrder(orderId);
      loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
      alert('Sifariş uğurla silindi');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Sifariş silinə bilmədi');
    }
  };

  const handleEditNote = (order: B2BOrder) => {
    setEditingNoteOrderId(order.id);
    setNoteText(order.adminNote || '');
  };

  const handleSaveNote = async (orderId: string) => {
    try {
      await updateB2BOrderNote(orderId, noteText);
      loadOrders();
      setEditingNoteOrderId(null);
      setNoteText('');
      alert('Qeyd uğurla yadda saxlanıldı');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Qeyd yadda saxlanıla bilmədi');
    }
  };

  const handleCancelNote = () => {
    setEditingNoteOrderId(null);
    setNoteText('');
  };

  const handleEditCustomer = (order: B2BOrder) => {
    setEditingCustomerOrderId(order.id);
    setCustomerEditData({
      customerName: order.customerName || '',
      customerLastname: order.customerLastname || '',
      customerPhone: order.customerPhone || '',
      companyName: order.companyName || ''
    });
  };

  const handleSaveCustomer = async (orderId: string) => {
    try {
      await updateB2BOrderCustomerInfo(orderId, customerEditData);
      loadOrders();
      setEditingCustomerOrderId(null);
      alert('Müştəri məlumatları yeniləndi');
    } catch (error) {
      console.error('Error saving customer info:', error);
      alert('Müştəri məlumatları yenilənə bilmədi');
    }
  };

  const handleCancelCustomerEdit = () => {
    setEditingCustomerOrderId(null);
    setCustomerEditData({
      customerName: '',
      customerLastname: '',
      customerPhone: '',
      companyName: ''
    });
  };

  const handleEditPayment = (order: B2BOrder) => {
    setEditingPaymentOrderId(order.id);
    setPaymentEditData({
      totalDebt: order.totalDebt?.toString() || '',
      paymentDeadline: order.paymentDeadline || ''
    });
  };

  const handleSavePayment = async (orderId: string) => {
    try {
      await updateB2BOrderPaymentInfo(orderId, {
        totalDebt: paymentEditData.totalDebt ? parseFloat(paymentEditData.totalDebt) : undefined,
        paymentDeadline: paymentEditData.paymentDeadline || undefined
      });
      loadOrders();
      setEditingPaymentOrderId(null);
      alert('Ödəniş məlumatları yeniləndi');
    } catch (error) {
      console.error('Error saving payment info:', error);
      alert('Ödəniş məlumatları yenilənə bilmədi');
    }
  };

  const handleCancelPaymentEdit = () => {
    setEditingPaymentOrderId(null);
    setPaymentEditData({
      totalDebt: '',
      paymentDeadline: ''
    });
  };



  const handleUpdateItemQuantity = async (orderId: string, itemIndex: number, newQuantity: number, oldQuantity: number, productId: string) => {
    if (newQuantity < 1) {
      alert('Miqdar minimum 1 olmalıdır');
      return;
    }

    try {
      await updateOrderItemQuantity(orderId, itemIndex, newQuantity, oldQuantity, productId);
      const updatedOrders = await loadOrders();
      if (selectedOrder?.id === orderId) {
        const updatedOrder = updatedOrders.find(o => o.id === orderId);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }
      alert('Miqdar yeniləndi');
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Miqdar yenilənə bilmədi');
    }
  };

  const handleRemoveItem = async (orderId: string, itemIndex: number, productId: string, quantity: number) => {
    if (!confirm('Bu məhsulu sifarişdən silmək istədiyinizə əminsiniz?')) {
      return;
    }

    try {
      const result = await removeOrderItem(orderId, itemIndex, productId, quantity);
      const updatedOrders = await loadOrders();

      if (result.deleted) {
        setSelectedOrder(null);
        alert('Sifariş tamamilə silindi (son məhsul idi)');
      } else {
        if (selectedOrder?.id === orderId) {
          const updatedOrder = updatedOrders.find(o => o.id === orderId);
          if (updatedOrder) {
            setSelectedOrder(updatedOrder);
          }
        }
        alert('Məhsul sifarişdən silindi');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Məhsul silinə bilmədi');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivering': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Gözləyir';
      case 'accepted': return 'Qəbul olundu';
      case 'preparing': return 'Hazırlanır';
      case 'ready': return 'Hazırdır';
      case 'delivering': return 'Çatdırılma xidmətində';
      case 'delivered': return 'Təhvil verildi';
      default: return status;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('az-AZ') + ' ' + d.toLocaleTimeString('az-AZ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900">B2B Sifarişlər</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Müştəri, şirkət, telefon, email..."
              className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent w-72"
              data-testid="b2b-orders-search"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label="Təmizlə"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="inline-flex p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'grouped' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="b2b-orders-view-grouped"
            >
              <Users className="h-4 w-4" /> Müştərilər üzrə
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'flat' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="b2b-orders-view-flat"
            >
              <List className="h-4 w-4" /> Hamısı
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
          >
            <option value="all">Status: Hamısı</option>
            <option value="pending">Gözləyir</option>
            <option value="accepted">Qəbul olundu</option>
            <option value="preparing">Hazırlanır</option>
            <option value="ready">Hazırdır</option>
            <option value="delivering">Çatdırılma xidmətində</option>
            <option value="delivered">Təhvil verildi</option>
            <option value="cancelled">Ləğv edildi</option>
          </select>

          {(() => {
            const map: Record<string, { name: string; count: number }> = {};
            orders.forEach((o) => {
              const k = (o.customerEmail || `${o.customerName || ''}|${o.customerPhone || ''}`).toLowerCase();
              const nm = [o.customerName, o.customerLastname].filter(Boolean).join(' ').trim() || (o.customerEmail || '—');
              if (!map[k]) map[k] = { name: nm, count: 0 };
              map[k].count += 1;
            });
            const list = Object.entries(map).sort((a, b) => a[1].name.localeCompare(b[1].name));
            return (
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent max-w-[260px] truncate"
                data-testid="b2b-orders-customer-filter"
              >
                <option value="all">Müştəri: Hamısı ({list.length})</option>
                {list.map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name} ({v.count})
                  </option>
                ))}
              </select>
            );
          })()}
        </div>
      </div>

      {(() => {
        const q = searchQuery.trim().toLowerCase();

        const filteredOrders = orders.filter((o) => {
          // customer filter
          if (customerFilter !== 'all') {
            const k = (o.customerEmail || `${o.customerName || ''}|${o.customerPhone || ''}`).toLowerCase();
            if (k !== customerFilter) return false;
          }
          // search
          if (!q) return true;
          const hay = [
            o.customerName, o.customerLastname, o.customerEmail,
            o.customerPhone, o.companyName, o.id, o.notes, o.adminNote,
          ].filter(Boolean).join(' ').toLowerCase();
          return hay.includes(q);
        });

        // Build customer groups for grouped mode (key = email || name+phone)
        const getKey = (o: B2BOrder) =>
          (o.customerEmail || `${o.customerName || ''}|${o.customerPhone || ''}`).toLowerCase();
        const grouped: Record<string, { customer: B2BOrder; orders: B2BOrder[]; total: number }> = {};
        filteredOrders.forEach((o) => {
          const k = getKey(o);
          if (!grouped[k]) grouped[k] = { customer: o, orders: [], total: 0 };
          grouped[k].orders.push(o);
          grouped[k].total += (o.totalAmount || 0);
        });
        const groupList = Object.entries(grouped).sort((a, b) =>
          (b[1].orders.length - a[1].orders.length)
        );

        // Orders list to render inside the flat-like card map below
        // Flat → filteredOrders
        // Grouped → only orders for expanded customers
        let visibleOrders: B2BOrder[] = filteredOrders;
        if (viewMode === 'grouped') {
          visibleOrders = [];
          groupList.forEach(([key, g]) => {
            if (expandedCustomers.has(key)) visibleOrders.push(...g.orders);
          });
        }

        // Build a unified render list — inline customer headers BEFORE each group in grouped mode
        type RenderItem =
          | { type: 'header'; key: string; group: { customer: B2BOrder; orders: B2BOrder[]; total: number } }
          | { type: 'order'; order: B2BOrder };
        const renderList: RenderItem[] = [];
        if (viewMode === 'grouped') {
          groupList.forEach(([key, g]) => {
            renderList.push({ type: 'header', key, group: g });
            if (expandedCustomers.has(key)) {
              g.orders.forEach((o) => renderList.push({ type: 'order', order: o }));
            }
          });
        } else {
          filteredOrders.forEach((o) => renderList.push({ type: 'order', order: o }));
        }

        return (
          <>
            {/* Summary */}
            <div className="text-sm text-gray-500">
              {q
                ? `${filteredOrders.length} nəticə (${orders.length} ümumi sifarişdən)`
                : `${orders.length} sifariş`}
              {viewMode === 'grouped' && ` · ${groupList.length} müştəri`}
            </div>

            {/* Grouped + flat rendering using a single interleaved list */}
            <div className="grid gap-4" data-testid="b2b-orders-list">
              {renderList.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  {viewMode === 'grouped' ? (
                    <>
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Müştəri tapılmadı</p>
                    </>
                  ) : (
                    <>
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Sifariş tapılmadı</p>
                    </>
                  )}
                </div>
              )}

              {renderList.map((item) => {
                if (item.type === 'header') {
                  const key = item.key;
                  const g = item.group;
                  const isOpen = expandedCustomers.has(key);
                  const name = [g.customer.customerName, g.customer.customerLastname].filter(Boolean).join(' ').trim() || '—';
                  return (
                    <div
                      key={`h-${key}`}
                      className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${isOpen ? 'ring-1 ring-black/5 shadow-sm' : ''}`}
                      data-testid={`b2b-customer-${key}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCustomer(key)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold flex-shrink-0">
                            {name.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {g.customer.companyName && !g.customer.companyName.includes('@') && <span>{g.customer.companyName} · </span>}
                              {g.customer.customerEmail || g.customer.customerPhone || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex flex-col items-end">
                            <span className="text-sm font-semibold text-gray-900">
                              {g.orders.length} sifariş
                            </span>
                            <span className="text-xs text-gray-500">
                              Cəmi: {g.total.toFixed(2)} ₼
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>
                    </div>
                  );
                }
                const order = item.order;
                return (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  {editingCustomerOrderId === order.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customerEditData.customerName}
                          onChange={(e) => setCustomerEditData({ ...customerEditData, customerName: e.target.value })}
                          placeholder="Ad"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-black"
                        />
                        <input
                          type="text"
                          value={customerEditData.customerLastname}
                          onChange={(e) => setCustomerEditData({ ...customerEditData, customerLastname: e.target.value })}
                          placeholder="Soyad"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-black"
                        />
                      </div>
                      <input
                        type="text"
                        value={customerEditData.companyName}
                        onChange={(e) => setCustomerEditData({ ...customerEditData, companyName: e.target.value })}
                        placeholder="Şirkət adı"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-black"
                      />
                      <input
                        type="text"
                        value={customerEditData.customerPhone}
                        onChange={(e) => setCustomerEditData({ ...customerEditData, customerPhone: e.target.value })}
                        placeholder="Telefon"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-black"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveCustomer(order.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          <Save className="h-3 w-3" /> Yadda saxla
                        </button>
                        <button
                          onClick={handleCancelCustomerEdit}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
                        >
                          <X className="h-3 w-3" /> Ləğv et
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 break-words">
                          {order.customerName} {order.customerLastname || ''}
                        </h3>
                        <button
                          onClick={() => handleEditCustomer(order)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Müştəri məlumatlarını redaktə et"
                        >
                          <User className="h-4 w-4" />
                        </button>
                      </div>
                      {order.companyName && !order.companyName.includes('@') && (
                        <p className="text-sm text-gray-700 font-medium">{order.companyName}</p>
                      )}
                      <p className="text-sm text-blue-600 font-medium break-all">{order.customerEmail || 'Email yoxdur'}</p>
                      {order.customerPhone && !order.customerPhone.includes(' ') && order.customerPhone.length < 20 && (
                        <p className="text-sm text-gray-600">{order.customerPhone}</p>
                      )}
                    </>
                  )}
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                  <p className="text-xs text-gray-500 mt-2">{formatDate(order.createdAt)}</p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Məhsullar</h4>
                <div className="space-y-2">
                  {(() => {
                    const items = order.items || [];
                    const isAllShown = expandedOrderItems.has(order.id || '');
                    const displayed = isAllShown ? items : items.slice(0, 5);
                    const checkedSet = new Set<number>(
                      Array.isArray((order as any).checkedItems) ? (order as any).checkedItems : []
                    );
                    const confirmedCount = checkedSet.size;

                    return (
                      <>
                        {displayed.map((item: any, index: number) => {
                          const product = products.find(p => p.id === item.productId);
                          const productImage = product?.images?.[0];
                          const isChecked = checkedSet.has(index);
                          return (
                            <div
                              key={index}
                              className={`flex items-center gap-2 sm:gap-3 rounded-lg p-2 sm:p-3 transition-colors ${
                                isChecked ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                              }`}
                              data-testid={`b2b-order-item-${order.id}-${index}`}
                            >
                              {/* Confirmation checkbox */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItemChecked(order, index);
                                }}
                                className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                  isChecked
                                    ? 'bg-green-600 border-green-600 text-white'
                                    : 'bg-white border-gray-300 hover:border-green-500'
                                }`}
                                aria-label={isChecked ? 'Təsdiqi geri al' : 'Təsdiqlə'}
                                data-testid={`b2b-order-item-check-${order.id}-${index}`}
                              >
                                {isChecked && <Check className="h-4 w-4" strokeWidth={3} />}
                              </button>

                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={item.productName?.az || item.productName}
                                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md flex-shrink-0 border border-gray-200"
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center border border-gray-200">
                                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs sm:text-sm font-medium line-clamp-2 break-words ${
                                  isChecked ? 'text-gray-600 line-through' : 'text-gray-900'
                                }`}>
                                  {item.productName?.az || item.productName}
                                </p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-gray-600">
                                  <span className="font-semibold text-gray-900">Miqdar: {item.quantity}</span>
                                  <span className="font-medium">{item.regularPrice?.toFixed(2)}₼</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {items.length > 5 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedOrderItems(order.id || '')}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                            data-testid={`b2b-order-toggle-items-${order.id}`}
                          >
                            {isAllShown ? (
                              <>Daha az göstər (ilk 5) <ChevronDown className="h-4 w-4 rotate-180" /></>
                            ) : (
                              <>Daha çox göstər ({items.length - 5} əlavə) <ChevronDown className="h-4 w-4" /></>
                            )}
                          </button>
                        )}

                        {/* Progress summary */}
                        {items.length > 0 && (
                          <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
                            <span>
                              Təsdiqlənmiş:{' '}
                              <span className="font-semibold text-green-700">{confirmedCount}</span>
                              {' / '}
                              {items.length}
                            </span>
                            {confirmedCount > 0 && confirmedCount < items.length && (
                              <span className="text-amber-700">{items.length - confirmedCount} qalır</span>
                            )}
                            {confirmedCount === items.length && (
                              <span className="text-green-700 font-semibold">Hamısı təsdiqləndi ✓</span>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-4 bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Model sayı</p>
                  <p className="text-base sm:text-lg font-semibold">{order.items.length}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Ümumi miqdar</p>
                  <p className="text-base sm:text-lg font-semibold">{order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)} ədəd</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Endirimsiz qiymət</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-500 line-through break-words">
                    {((order as any).subtotal || order.items.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0)).toFixed(2)}₼
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Endirim</p>
                  <p className="text-base sm:text-lg font-semibold text-green-600 break-words">-{order.discountAmount.toFixed(2)}₼</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Ödəniləcək məbləğ</p>
                  <p className="text-base sm:text-lg font-bold text-blue-600 break-words">{order.totalAmount.toFixed(2)}₼</p>
                </div>
              </div>

              {/* Ödəniş Məlumatları Bölməsi */}
              <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    Ödəniş Məlumatları
                  </p>
                  {editingPaymentOrderId !== order.id && (
                    <button
                      onClick={() => handleEditPayment(order)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {editingPaymentOrderId === order.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Əvvəlki borc (₼)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentEditData.totalDebt}
                          onChange={(e) => setPaymentEditData({ ...paymentEditData, totalDebt: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                          data-testid={`b2b-prev-debt-input-${order.id}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Ümumi borc (avtomatik) (₼)</label>
                        <input
                          type="text"
                          value={(
                            (parseFloat(paymentEditData.totalDebt) || 0) +
                            (order.totalAmount || 0)
                          ).toFixed(2)}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 bg-gray-50 rounded-lg text-gray-700 font-semibold"
                          data-testid={`b2b-total-debt-display-${order.id}`}
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Əvvəlki borc + qaimə məbləği ({(order.totalAmount || 0).toFixed(2)}₼)</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Yeni qaimə üzrə ödənişin tamamlanma tarixi</label>
                      <input
                        type="date"
                        value={paymentEditData.paymentDeadline}
                        onChange={(e) => setPaymentEditData({ ...paymentEditData, paymentDeadline: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSavePayment(order.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
                      >
                        <Save className="h-3 w-3" /> Yadda saxla
                      </button>
                      <button
                        onClick={handleCancelPaymentEdit}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
                      >
                        <X className="h-3 w-3" /> Ləğv et
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Əvvəlki borc</p>
                      <p className="text-lg font-bold text-gray-900">
                        {order.totalDebt ? `${order.totalDebt.toFixed(2)}₼` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ümumi borc</p>
                      <p className="text-lg font-bold text-red-600">
                        {(((order.totalDebt || 0) + (order.totalAmount || 0))).toFixed(2)}₼
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Yeni qaimə üzrə ödənişin tamamlanma tarixi</p>
                      <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {order.paymentDeadline ? new Date(order.paymentDeadline).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {editingNoteOrderId === order.id ? (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Admin Qeydi</label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Müştəriyə göstəriləcək qeyd daxil edin..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleSaveNote(order.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <Save className="h-4 w-4" />
                      Yadda saxla
                    </button>
                    <button
                      onClick={handleCancelNote}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                    >
                      <X className="h-4 w-4" />
                      Ləğv et
                    </button>
                  </div>
                </div>
              ) : order.adminNote ? (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-blue-900">Admin Qeydi:</p>
                    <button
                      onClick={() => handleEditNote(order)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-blue-800">{order.adminNote}</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                >
                  <Eye className="h-4 w-4" />
                  Detallar
                </button>

                {!order.adminNote && editingNoteOrderId !== order.id && (
                  <button
                    onClick={() => handleEditNote(order)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors text-sm"
                  >
                    <Edit className="h-4 w-4" />
                    Qeyd əlavə et
                  </button>
                )}

                <button
                  onClick={() => handleDeleteOrder(order.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </button>

                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black w-full sm:w-auto"
                >
                  <option value="pending">Gözləyir</option>
                  <option value="accepted">Qəbul olundu</option>
                  <option value="preparing">Hazırlanır</option>
                  <option value="ready">Hazırdır</option>
                  <option value="delivering">Çatdırılma xidmətində</option>
                  <option value="delivered">Təhvil verildi</option>
                </select>
              </div>

              {order.deliveredAt && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-900">Müştəri tərəfindən təslim alındı</p>
                  <p className="text-sm text-green-800">{formatDate(order.deliveredAt)}</p>
                  {order.signature && (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-green-900 mb-1">Müştəri İmzası</p>
                      <img
                        src={order.signature}
                        alt="Customer Signature"
                        className="border border-green-300 rounded-lg bg-white p-2 max-w-[200px]"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
              })}
      </div>
          </>
        );
      })()}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Sifariş Detalları</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold mb-2">Müştəri Məlumatları</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p><span className="font-medium">Ad Soyad:</span> {selectedOrder.customerName} {selectedOrder.customerLastname || ''}</p>
                  {selectedOrder.companyName && !selectedOrder.companyName.includes('@') && (
                    <p><span className="font-medium">Şirkət:</span> {selectedOrder.companyName}</p>
                  )}
                  <p><span className="font-medium">Email:</span> {selectedOrder.customerEmail}</p>
                  {selectedOrder.customerPhone && !selectedOrder.customerPhone.includes(' ') && selectedOrder.customerPhone.length < 20 && (
                    <p><span className="font-medium">Telefon:</span> {selectedOrder.customerPhone}</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Məhsullar</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item: any, index: number) => {
                    const product = products.find(p => p.id === item.productId);
                    const productImage = product?.images?.[0];
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <div className="flex gap-3 sm:gap-4">
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={item.productName.az}
                              className="w-20 h-20 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0">
                              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm sm:text-base break-words">{item.productName.az}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 mt-2 text-xs sm:text-sm">
                              <p className="break-words">Miqdar: {item.quantity}</p>
                              <p className="break-words">Qiymət: {item.regularPrice}₼</p>
                              <p className="col-span-1 sm:col-span-2 font-semibold break-words">
                                Cəmi: {(item.regularPrice * item.quantity).toFixed(2)}₼
                              </p>
                            </div>
                          </div>
                        </div>
                        {selectedOrder.status !== 'delivered' && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                            <button
                              onClick={() => handleUpdateItemQuantity(selectedOrder.id, index, item.quantity - 1, item.quantity, item.productId)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-lg transition-colors text-xs sm:text-sm"
                            >
                              <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                              Azalt
                            </button>
                            <button
                              onClick={() => handleUpdateItemQuantity(selectedOrder.id, index, item.quantity + 1, item.quantity, item.productId)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors text-xs sm:text-sm"
                            >
                              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                              Artır
                            </button>
                            <button
                              onClick={() => handleRemoveItem(selectedOrder.id, index, item.productId, item.quantity)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors text-xs sm:text-sm ml-auto"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              Sil
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span>Endirimsiz Qiymət:</span>
                  <span className="font-semibold text-gray-500 line-through">
                    {((selectedOrder as any).subtotal || selectedOrder.items.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0)).toFixed(2)}₼
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Ümumi Endirim:</span>
                  <span className="font-semibold text-green-600">-{selectedOrder.discountAmount.toFixed(2)}₼</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                  <span>Ödəniləcək Məbləğ:</span>
                  <span className="text-blue-600">{selectedOrder.totalAmount.toFixed(2)}₼</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Müştəri Qeydləri</h4>
                  <p className="bg-gray-50 rounded-lg p-4">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.adminNote && (
                <div>
                  <h4 className="font-semibold mb-2">Admin Qeydi</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">{selectedOrder.adminNote}</p>
                  </div>
                </div>
              )}

              {selectedOrder.deliveredAt && (
                <div>
                  <h4 className="font-semibold mb-2">Təslim Alındı</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 mb-3">{formatDate(selectedOrder.deliveredAt)}</p>
                    {selectedOrder.signature && (
                      <div>
                        <p className="text-sm font-semibold text-green-900 mb-2">Müştəri İmzası</p>
                        <img
                          src={selectedOrder.signature}
                          alt="Customer Signature"
                          className="border border-green-300 rounded-lg bg-white p-2 max-w-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BOrdersTab;
