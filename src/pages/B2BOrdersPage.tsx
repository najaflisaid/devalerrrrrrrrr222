import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Clock, CheckCircle, Truck, Home, AlertCircle, Calendar, X, Bell } from 'lucide-react';
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

    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
              className="relative p-3 rounded-full bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
            >
              <Bell className="h-6 w-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Bildiriş Paneli */}
            {showNotificationPanel && (
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
                            className={`px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                              isUnread ? 'bg-blue-50/30' : ''
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
            )}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">{t('b2b.noOrders')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;

              const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-gray-500">{t('b2b.orderNumber')} #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-500">
                          {orderDate.toLocaleDateString(i18n.language === 'az' ? 'az-AZ' : i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="font-medium">{statusInfo.label}</span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">{t('b2b.products')}</h3>
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
                                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-200">
                                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm sm:text-base break-words line-clamp-2">{item.productName?.az || item.productName}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                  <p className="text-xs sm:text-sm text-gray-600">
                                    <span className="font-semibold text-gray-900">{t('b2b.quantity')}:</span> {item.quantity} {t('b2b.unit')}
                                  </p>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{item.regularPrice?.toFixed(2)} ₼</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t mt-4 pt-4">
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          <p><span className="font-medium">{t('b2b.name')}:</span> {order.customerName} {order.customerLastname || ''}</p>
                          {order.companyName && !order.companyName.includes('@') && (
                            <p><span className="font-medium">{t('b2b.companyName')}:</span> {order.companyName}</p>
                          )}
                          <p><span className="font-medium">{t('b2b.email')}:</span> {order.customerEmail}</p>
                          {order.customerPhone && !order.customerPhone.includes(' ') && order.customerPhone.length < 20 && (
                            <p><span className="font-medium">{t('b2b.phone')}:</span> {order.customerPhone}</p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <div>
                            <p className="text-xs text-gray-500">{t('b2b.subtotal') || 'Endirimsiz qiymət'}</p>
                            <p className="text-sm text-gray-400">
                              {((order as any).subtotal || order.items?.reduce((sum: number, item: any) => sum + (item.regularPrice * item.quantity), 0) || 0).toFixed(2)} ₼
                            </p>
                          </div>
                          {(order as any).discountAmount > 0 && (
                            <div>
                              <p className="text-xs text-green-600">{t('b2b.discount') || 'Endirim'}</p>
                              <p className="text-sm font-medium text-green-600">-{(order as any).discountAmount?.toFixed(2)} ₼</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500">{t('b2b.totalAmount')}</p>
                            <p className="text-2xl font-bold text-blue-600">{order.totalAmount?.toFixed(2)} ₼</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ödəniş Məlumatları */}
                    {(order.totalDebt || order.paymentDeadline) && (
                      <div className="border-t mt-4 pt-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            {t('b2b.paymentInfo') || 'Ödəniş Məlumatları'}
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            {order.totalDebt !== undefined && order.totalDebt !== null && (
                              <div>
                                <p className="text-xs text-gray-600">Əvvəlki borc</p>
                                <p className="text-2xl font-bold text-gray-900">{order.totalDebt.toFixed(2)} ₼</p>
                              </div>
                            )}
                            {order.paymentDeadline && (
                              <div>
                                <p className="text-xs text-gray-600">Ödənişin tamamlanma tarixi</p>
                                <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
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
                      <div className="border-t mt-4 pt-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-blue-900 mb-1">{t('b2b.adminNote')}</p>
                              <p className="text-sm text-blue-800">{order.adminNote}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.deliveredAt && (
                      <div className="border-t mt-4 pt-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold text-green-900 mb-1">{t('b2b.receivedTitle')}</p>
                              <p className="text-sm text-green-800">
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
                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-green-900 mb-2">{t('b2b.customerSignature')}</p>
                                  <img
                                    src={order.signature}
                                    alt="Customer Signature"
                                    className="border border-green-300 rounded-lg bg-white p-2 w-28 h-auto"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.status === 'delivering' && !order.deliveredAt && (
                      <div className="border-t mt-4 pt-4">
                        <p className="text-sm font-bold text-red-600 mb-4 leading-relaxed">
                          {t('b2b.receiveWarning')}
                        </p>
                        <button
                          onClick={() => handleConfirmDelivery(order.id)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-5 w-5" />
                          {t('b2b.receiveButton')}
                        </button>
                      </div>
                    )}
                  </div>
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
