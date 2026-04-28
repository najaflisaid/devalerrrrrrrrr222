import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Clock, CheckCircle, Truck, Home, AlertCircle, Calendar, X, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { productService } from '../services/productService';
import SignaturePad from '../components/SignaturePad';
import { 
  subscribeToActiveNotifications, 
  markNotificationAsRead,
  B2BNotification,
  NotificationType
} from '../services/b2bNotificationService';

interface B2BOrder {
  id: string;
  customerEmail: string;
  customerName: string;
  customerLastname?: string;
  customerPhone?: string;
  companyName?: string;
  items: any[];
  totalAmount: number;
  status: string;
  createdAt: any;
  deliveredAt?: any;
  adminNote?: string;
  signature?: string;
  signedAt?: any;
  totalDebt?: number;
  totalDebtOverride?: number;
  paymentDeadline?: string;
}

const getStatusConfig = (t: any) => ({
  pending: { label: t('b2b.statusPending'), icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  accepted: { label: t('b2b.statusAccepted'), icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
  preparing: { label: t('b2b.statusPreparing'), icon: Package, color: 'text-orange-600 bg-orange-50' },
  ready: { label: t('b2b.statusReady'), icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  delivering: { label: t('b2b.statusDelivering'), icon: Truck, color: 'text-purple-600 bg-purple-50' },
  delivered: { label: t('b2b.statusDelivered'), icon: Home, color: 'text-gray-600 bg-gray-50' }
});

const B2BOrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<B2BNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  // Sifarişlərin açılıb-bağlanma vəziyyəti — default bağlı (yığcam)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  useEffect(() => {
    loadProducts();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        loadOrders(user.email);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    const unsubscribe = subscribeToActiveNotifications(userEmail, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [userEmail]);

  // Click outside to close notification panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setShowNotificationPanel(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotificationPanel(false);
      }
    };

    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNotificationPanel]);

  const loadProducts = async () => {
    try {
      const productsData = await productService.getAll();
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadOrders = async (email: string) => {
    try {
      setLoading(true);
      console.log('Loading orders for email:', email);
      const ordersRef = collection(db, 'b2bOrders');

      // Try without orderBy first to avoid index issues
      const q = query(
        ordersRef,
        where('customerEmail', '==', email)
      );

      const snapshot = await getDocs(q);
      console.log('Found orders:', snapshot.size);

      const ordersData = snapshot.docs.map(doc => {
        console.log('Order data:', doc.id, doc.data());
        return {
          id: doc.id,
          ...doc.data()
        };
      }) as B2BOrder[];

      // Sort manually by createdAt
      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusConfig = getStatusConfig(t);
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  };

  const handleConfirmDelivery = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowSignaturePad(true);
  };

  const handleSaveSignature = async (signatureData: string) => {
    if (!selectedOrderId) return;

    try {
      const orderRef = doc(db, 'b2bOrders', selectedOrderId);
      await updateDoc(orderRef, {
        signature: signatureData,
        signedAt: Timestamp.now(),
        deliveredAt: Timestamp.now(),
        status: 'delivered'
      });

      if (userEmail) {
        await loadOrders(userEmail);
      }

      setShowSignaturePad(false);
      setSelectedOrderId(null);
      alert(t('b2b.receivedSuccess'));
    } catch (error) {
      console.error('Error saving signature:', error);
      alert(t('b2b.error'));
    }
  };

  const getNotificationTypeConfig = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return { textColor: 'text-green-900' };
      case 'warning':
        return { textColor: 'text-yellow-900' };
      case 'error':
        return { textColor: 'text-red-900' };
      default:
        return { textColor: 'text-blue-900' };
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    setDismissedNotifications([...dismissedNotifications, notificationId]);
    if (userEmail) {
      await markNotificationAsRead(notificationId, userEmail);
    }
  };

  const visibleNotifications = notifications.filter(n => !dismissedNotifications.includes(n.id || ''));
  const unreadCount = userEmail 
    ? visibleNotifications.filter(n => !n.readBy?.includes(userEmail)).length 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('b2b.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Başlıq və Bildiriş İkonu */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">{t('b2b.myOrders')}</h1>
          
          {/* Bildiriş İkonu */}
          <div className="relative" ref={notificationPanelRef}>
            <button
              onClick={() => setShowNotificationPanel(!showNotificationPanel)}
              className="relative p-3 rounded-full bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm z-50"
            >
              <Bell className="h-6 w-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Boz Fon Overlay */}
            {showNotificationPanel && (
              <>
                <div 
                  className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 animate-fadeIn"
                  onClick={() => setShowNotificationPanel(false)}
                />
                
                {/* Bildiriş Paneli */}
                <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col animate-slideDown">
                {/* Başlıq */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-gray-900">Bildirişlər</h3>
                    {unreadCount > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{unreadCount} yeni bildiriş</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowNotificationPanel(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Bildirişlər Siyahısı */}
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  {visibleNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Bell className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-center font-medium">Bildiriş yoxdur</p>
                      <p className="text-gray-400 text-sm text-center mt-1">Yeni bildirişlər burada görünəcək</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {visibleNotifications.map((notification) => {
                        const config = getNotificationTypeConfig(notification.type);
                        const isUnread = userEmail ? !notification.readBy?.includes(userEmail) : true;
                        
                        return (
                          <div
                            key={notification.id}
                            className={`px-4 sm:px-6 py-4 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer ${
                              isUnread ? 'border-l-4 border-blue-500' : ''
                            }`}
                            onClick={() => {
                              if (isUnread && notification.id) {
                                handleDismissNotification(notification.id);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Məzmun */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className={`font-semibold text-sm ${config.textColor}`}>
                                    {notification.title}
                                  </h4>
                                  {isUnread && (
                                    <span className="flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full mt-1"></span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400">
                                    {notification.createdAt?.toDate ? 
                                      notification.createdAt.toDate().toLocaleDateString('az-AZ', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'
                                    }
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissNotification(notification.id!);
                                    }}
                                    className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                                  >
                                    Bağla
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Alt hissə */}
                {visibleNotifications.length > 0 && (
                  <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                      onClick={() => {
                        visibleNotifications.forEach(n => {
                          if (n.id) handleDismissNotification(n.id);
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium w-full text-center"
                    >
                      Hamısını oxunmuş kimi işarələ
                    </button>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">{t('b2b.noOrders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedOrders.has(order.id);

              const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
              const itemsCount = order.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;
              const dateShort = (() => {
                const d = orderDate;
                const pad = (n: number) => n.toString().padStart(2, '0');
                return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
              })();
              const dateFormatted = (() => {
                const d = orderDate;
                const pad = (n: number) => n.toString().padStart(2, '0');
                return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
              })();

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
                  {/* COMPACT HEADER — order #, date, items, status (NO amount) */}
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="w-full px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50 transition-colors text-left"
                    data-testid={`b2b-order-toggle-${order.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${statusInfo.color} flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            #{(order as any).orderNumber ?? order.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-500 flex-shrink-0">{dateShort}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {itemsCount} məhsul
                        </p>
                      </div>

                      <div className="text-gray-400 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </button>

                  {/* EXPANDED DETAILS */}
                  {isExpanded && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 border-t border-gray-100 bg-gray-50/30">
                    <div className="pt-4 flex items-center justify-between mb-3 text-xs text-gray-500">
                      <span>{dateFormatted}</span>
                      <span className="font-bold text-blue-600 text-lg">{order.totalAmount?.toFixed(2)} ₼</span>
                    </div>
                      <h3 className="font-semibold mb-3 text-sm">{t('b2b.products')}</h3>
                      <div className="space-y-3">
                        {order.items?.map((item: any, index: number) => {
                          const product = products.find(p => p.id === item.productId);
                          const productImage = product?.images?.[0];
                          return (
                            <div key={index} className="flex gap-3 items-center">
                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={item.productName?.az || item.productName}
                                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                                />
                              ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-200">
                                  <Package className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm break-words line-clamp-2">{item.productName?.az || item.productName}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                  <p className="text-xs text-gray-600">
                                    <span className="font-semibold text-gray-900">{t('b2b.quantity')}:</span> {item.quantity} {t('b2b.unit')}
                                  </p>
                                  <p className="text-xs font-medium text-gray-900 break-words">{item.regularPrice?.toFixed(2)} ₼</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    <div className="border-t border-gray-200 mt-4 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="text-sm text-gray-600 space-y-0.5">
                          <p><span className="font-medium">{t('b2b.name')}:</span> {order.customerName} {order.customerLastname || ''}</p>
                          {order.companyName && !order.companyName.includes('@') && (
                            <p><span className="font-medium">{t('b2b.companyName')}:</span> {order.companyName}</p>
                          )}
                          <p className="break-all"><span className="font-medium">{t('b2b.email')}:</span> {order.customerEmail}</p>
                          {order.customerPhone && !order.customerPhone.includes(' ') && order.customerPhone.length < 20 && (
                            <p><span className="font-medium">{t('b2b.phone')}:</span> {order.customerPhone}</p>
                          )}
                        </div>
                        <div className="text-right space-y-1.5 sm:border-l sm:border-gray-200 sm:pl-3">
                          <div>
                            <p className="text-[11px] text-gray-500">{t('b2b.subtotal') || 'Endirimsiz qiymət'}</p>
                            <p className="text-sm text-gray-400">
                              {((order as any).subtotal || order.items?.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0) || 0).toFixed(2)} ₼
                            </p>
                          </div>
                          {(order as any).discountAmount > 0 && (
                            <div>
                              <p className="text-[11px] text-green-600">{t('b2b.discount') || 'Endirim'}</p>
                              <p className="text-sm font-medium text-green-600">-{(order as any).discountAmount?.toFixed(2)} ₼</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[11px] text-gray-500">{t('b2b.totalAmount')}</p>
                            <p className="text-xl font-bold text-blue-600">{order.totalAmount?.toFixed(2)} ₼</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ödəniş Məlumatları */}
                    {(order.totalDebt || order.paymentDeadline) && (
                      <div className="border-t border-gray-200 mt-4 pt-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <p className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                            {t('b2b.paymentInfo') || 'Ödəniş Məlumatları'}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {order.totalDebt !== undefined && order.totalDebt !== null && (
                              <div data-testid={`b2b-prev-debt-${order.id}`}>
                                <p className="text-[11px] text-gray-600">Əvvəlki borc</p>
                                <p className="text-lg font-bold text-gray-900">{order.totalDebt.toFixed(2)} ₼</p>
                              </div>
                            )}
                            {order.totalDebt !== undefined && order.totalDebt !== null && (
                              <div data-testid={`b2b-total-debt-${order.id}`}>
                                <p className="text-[11px] text-gray-600">Ümumi borc</p>
                                <p className="text-lg font-bold text-red-600">{(order.totalDebtOverride !== undefined && order.totalDebtOverride !== null
                                  ? order.totalDebtOverride
                                  : ((order.totalDebt || 0) + (order.totalAmount || 0))
                                ).toFixed(2)} ₼</p>
                              </div>
                            )}
                            {order.paymentDeadline && (
                              <div data-testid={`b2b-payment-deadline-${order.id}`}>
                                <p className="text-[11px] text-gray-600">Yeni qaimə üzrə ödənişin tamamlanma tarixi</p>
                                <p className="text-sm font-bold text-gray-900 flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(order.paymentDeadline).toLocaleDateString('az-AZ', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  }).replace(/\//g, '.')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.adminNote && (
                      <div className="border-t border-gray-200 mt-4 pt-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-blue-900 mb-0.5 text-sm">{t('b2b.adminNote')}</p>
                              <p className="text-xs text-blue-800">{order.adminNote}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.deliveredAt && (
                      <div className="border-t border-gray-200 mt-4 pt-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold text-green-900 mb-0.5 text-sm">{t('b2b.receivedTitle')}</p>
                              <p className="text-xs text-green-800">
                                {order.deliveredAt?.toDate ?
                                  order.deliveredAt.toDate().toLocaleDateString(i18n.language === 'az' ? 'az-AZ' : i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) :
                                  new Date(order.deliveredAt).toLocaleDateString(i18n.language === 'az' ? 'az-AZ' : i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                }
                              </p>
                              {order.signature && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold text-green-900 mb-1">{t('b2b.customerSignature')}</p>
                                  <img
                                    src={order.signature}
                                    alt="Customer Signature"
                                    className="border border-green-300 rounded-lg bg-white p-2 w-24 h-auto"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'delivering' && !order.deliveredAt && (
                      <div className="border-t border-gray-200 mt-4 pt-4">
                        <p className="text-xs font-bold text-red-600 mb-3 leading-relaxed">
                          {t('b2b.receiveWarning')}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConfirmDelivery(order.id); }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {t('b2b.receiveButton')}
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showSignaturePad && (
          <SignaturePad
            onSave={handleSaveSignature}
            onClose={() => {
              setShowSignaturePad(false);
              setSelectedOrderId(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default B2BOrdersPage;
