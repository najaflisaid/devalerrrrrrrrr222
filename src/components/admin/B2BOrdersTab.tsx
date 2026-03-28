import React, { useState, useEffect } from 'react';
import { Package, Eye, Check, X, Clock, Loader2, Trash2, Edit, Save, Minus, Plus } from 'lucide-react';
import { getB2BOrders, updateB2BOrderStatus, deleteB2BOrder, updateB2BOrderNote, updateOrderItemQuantity, removeOrderItem } from '../../services/b2bOrderService';
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
}

const B2BOrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<B2BOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');

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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">B2B Sifarişlər</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
          >
            <option value="all">Hamısı</option>
            <option value="pending">Gözləyir</option>
            <option value="accepted">Qəbul olundu</option>
            <option value="preparing">Hazırlanır</option>
            <option value="ready">Hazırdır</option>
            <option value="delivering">Çatdırılma xidmətində</option>
            <option value="delivered">Təhvil verildi</option>
            <option value="cancelled">Ləğv edildi</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Sifariş tapılmadı</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 break-words">
                    {order.customerName} {order.customerLastname || ''}
                  </h3>
                  {order.companyName && (
                    <p className="text-sm text-gray-700 font-medium">{order.companyName}</p>
                  )}
                  <p className="text-sm text-blue-600 font-medium break-all">{order.customerEmail || 'Email yoxdur'}</p>
                  {order.customerPhone && (
                    <p className="text-sm text-gray-600">{order.customerPhone}</p>
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
                  {order.items?.map((item: any, index: number) => {
                    const product = products.find(p => p.id === item.productId);
                    const productImage = product?.images?.[0];
                    return (
                      <div key={index} className="flex items-center gap-2 sm:gap-3 bg-gray-50 rounded-lg p-2 sm:p-3">
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
                          <p className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-2 break-words">
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
          ))
        )}
      </div>

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
                  {selectedOrder.companyName && (
                    <p><span className="font-medium">Şirkət:</span> {selectedOrder.companyName}</p>
                  )}
                  <p><span className="font-medium">Email:</span> {selectedOrder.customerEmail}</p>
                  {selectedOrder.customerPhone && (
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
