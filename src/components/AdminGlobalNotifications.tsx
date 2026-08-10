import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { Bell, ShoppingBag, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { playNewOrderSound, unlockAudio } from '../utils/notificationSound';

/**
 * Admin üçün QLOBAL real-vaxt sifariş bildirişi.
 *
 * Bu komponent App.tsx-də həmişə render olunur, amma yalnız `userRole === 'admin'`
 * olduqda Firestore listener-ləri başladır. Beləcə admin /products, /admin və ya
 * istənilən başqa səhifədə olsun, yeni müştəri/B2B sifarişi gələndə dərhal
 * "Yeni sifariş daxil oldu" səsi gəlir.
 *
 * Sayğaclar AdminPanel-dəki badge-lər üçün eyni `localStorage` last-seen açarlarını
 * istifadə edir, ona görə də iki listener arasında konflikt yoxdur — bu listener
 * yalnız səs çalır, AdminPanel mount olduqda öz badge sayğacını ayrıca aparır.
 */
const B2B_ACK_KEY = 'admin_b2b_orders_last_seen_ms';
const CUSTOMER_ORDERS_ACK_KEY = 'admin_customer_orders_last_seen_ms';

const getRole = () => {
  try {
    return localStorage.getItem('userRole');
  } catch {
    return null;
  }
};

const AdminGlobalNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(() => getRole());
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [b2bCount, setB2bCount] = useState<number>(0);
  const prevCustomerRef = useRef<number>(-1);
  const prevB2BRef = useRef<number>(-1);
  // last-seen məlumatlarını localStorage-dən reaktiv izləmək üçün storage event-i dinləyirik
  const [tick, forceTick] = useState(0);

  // Rol dəyişikliyini izlə (login/logout/role-change)
  useEffect(() => {
    const onChange = () => setRole(getRole());
    window.addEventListener('storage', onChange);
    window.addEventListener('userRoleChanged', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('userRoleChanged', onChange);
    };
  }, []);

  // last-seen açarları AdminPanel tərəfindən "ack" zamanı yenilənir; storage event-də force-tick
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === B2B_ACK_KEY ||
        e.key === CUSTOMER_ORDERS_ACK_KEY
      ) {
        forceTick((n) => n + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    // Admin panel ack edəndə eyni tabda da reaktiv olsun
    const onLocalAck = () => forceTick((n) => n + 1);
    window.addEventListener('adminOrdersAcknowledged', onLocalAck);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('adminOrdersAcknowledged', onLocalAck);
    };
  }, []);

  // İlk istifadəçi gesture ilə audio kilidini aç
  useEffect(() => {
    if (role !== 'admin') return;
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [role]);

  // Müştəri sifarişləri — real-vaxt
  useEffect(() => {
    if (role !== 'admin') {
      prevCustomerRef.current = -1;
      setCustomerCount(0);
      return;
    }
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(CUSTOMER_ORDERS_ACK_KEY) || '0');
    } catch {
      /* ignore */
    }
    prevCustomerRef.current = -1;
    const unsub = onSnapshot(
      collection(db, 'customer_orders'),
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const data: any = d.data();
          // Bütün yeni sifarişləri göstər — `pending_payment` və `payment_failed` də daxil
          // (admin başlanan amma bitməmiş ödənişləri də görsün). Yalnız admin tərəfindən
          // ləğv olunmuş və ya artıq oxunmuş sifarişlər badge-də sayılmır.
          if (data.status === 'cancelled') return;
          if (data.isReadByAdmin) return;
          // ROOT FIX: paidAt prioritetli — sifariş əvvəl `pending_payment` kimi yaranır,
          // sonra ödəniş uğurlu olanda `paidAt` qoyulur. Bu vaxt admin əvvəlcədən tab-ı
          // açıb `lastSeen=now` etmiş ola bilər; createdAt ondan kiçik, paidAt böyükdür.
          const paid = data?.paidAt?.toMillis ? data.paidAt.toMillis() : 0;
          const created = data?.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : typeof data?.createdAt === 'number'
            ? data.createdAt
            : data?.createdAt instanceof Date
            ? data.createdAt.getTime()
            : 0;
          const ms = Math.max(paid, created);
          if (ms > lastSeen) count += 1;
        });
        // İlk snapshot-da səs vermə, yalnız ARTIM olduqda
        if (prevCustomerRef.current !== -1 && count > prevCustomerRef.current) {
          playNewOrderSound();
        }
        prevCustomerRef.current = count;
        setCustomerCount(count);
      },
      (err) => {
        console.error('Global customer orders snapshot error:', err);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tick]);

  // B2B sifarişləri — real-vaxt
  useEffect(() => {
    if (role !== 'admin') {
      prevB2BRef.current = -1;
      setB2bCount(0);
      return;
    }
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(B2B_ACK_KEY) || '0');
    } catch {
      /* ignore */
    }
    prevB2BRef.current = -1;
    // Bütün B2B sifarişlərini izlə — yalnız `cancelled` və `delivered` statusları və
    // ya artıq oxunmuş (isReadByAdmin) sifarişlər badge-də sayılmır.
    const unsub = onSnapshot(
      collection(db, 'b2bOrders'),
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const data: any = d.data();
          if (data.status === 'cancelled' || data.status === 'delivered') return;
          if (data.isReadByAdmin) return;
          const ms = data?.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : typeof data?.createdAt === 'number'
            ? data.createdAt
            : data?.createdAt instanceof Date
            ? data.createdAt.getTime()
            : 0;
          if (ms > lastSeen) count += 1;
        });
        if (prevB2BRef.current !== -1 && count > prevB2BRef.current) {
          playNewOrderSound();
        }
        prevB2BRef.current = count;
        setB2bCount(count);
      },
      (err) => {
        console.error('Global B2B orders snapshot error:', err);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tick]);

  // Yalnız admin üçün və ən az 1 yeni sifariş varsa floating bildiriş göstər
  if (role !== 'admin') return null;
  const total = customerCount + b2bCount;
  if (total <= 0) return null;

  const handleClick = () => {
    // Admin panelinə keçərkən "Müştəri Sifarişləri" prioritetdir; B2B yoxdursa o, var isə o
    const targetTab = customerCount > 0 ? 'customerOrders' : 'b2bOrders';
    try {
      sessionStorage.setItem('admin_target_tab', targetTab);
    } catch {
      /* ignore */
    }
    navigate('/admin');
  };

  // X düyməsi — bildirişi bağla. Bütün cari sifarişləri "görüldü" kimi işarələ
  // (last-seen = indi) ki, admin yenidən daxil olanda bu bildiriş TƏKRAR görünməsin.
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    try {
      localStorage.setItem(CUSTOMER_ORDERS_ACK_KEY, String(now));
      localStorage.setItem(B2B_ACK_KEY, String(now));
    } catch {
      /* ignore */
    }
    // AdminPanel badge-ləri və bu komponentin listener-ləri yenilənsin
    window.dispatchEvent(new Event('adminOrdersAcknowledged'));
    setCustomerCount(0);
    setB2bCount(0);
    prevCustomerRef.current = 0;
    prevB2BRef.current = 0;
  };

  return (
    <div className="fixed top-20 right-5 z-[9998]" data-testid="admin-global-order-wrap">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2.5 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-2xl shadow-red-500/40 ring-4 ring-red-500/20 transition-all animate-pulse hover:animate-none"
        data-testid="admin-global-order-badge"
        aria-label={`${total} yeni sifariş`}
      >
        <span className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-white text-red-600 text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-red-600">
            {total > 99 ? '99+' : total}
          </span>
        </span>
        <span className="text-sm font-semibold">
          {customerCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" /> {customerCount} yeni sifariş
            </span>
          )}
          {customerCount > 0 && b2bCount > 0 && <span className="opacity-60 mx-1">·</span>}
          {b2bCount > 0 && <span>B2B: {b2bCount}</span>}
        </span>
      </button>

      {/* Bağla (X) düyməsi — sağ üst küncdə */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute -top-2.5 -right-1 h-7 w-7 rounded-full bg-white text-red-600 shadow-md ring-2 ring-red-600 flex items-center justify-center hover:bg-red-50 transition-colors"
        data-testid="admin-global-order-dismiss"
        aria-label="Bildirişi bağla"
        title="Bağla"
      >
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
    </div>
  );
};

export default AdminGlobalNotifications;
