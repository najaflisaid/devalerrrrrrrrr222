import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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
  const [role, setRole] = useState<string | null>(() => getRole());
  const prevCustomerRef = useRef<number>(-1);
  const prevB2BRef = useRef<number>(-1);
  // last-seen məlumatlarını localStorage-dən reaktiv izləmək üçün storage event-i dinləyirik
  const [, forceTick] = useState(0);

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
          // Yalnız aktiv (oxunmamış) sifarişlər sayılır
          if (
            data.status === 'pending_payment' ||
            data.status === 'cancelled' ||
            data.status === 'payment_failed'
          )
            return;
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
      },
      (err) => {
        console.error('Global customer orders snapshot error:', err);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // B2B sifarişləri — real-vaxt
  useEffect(() => {
    if (role !== 'admin') {
      prevB2BRef.current = -1;
      return;
    }
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(B2B_ACK_KEY) || '0');
    } catch {
      /* ignore */
    }
    prevB2BRef.current = -1;
    const q = query(collection(db, 'b2bOrders'), where('status', '==', 'pending'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          const data: any = d.data();
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
      },
      (err) => {
        console.error('Global B2B orders snapshot error:', err);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return null;
};

export default AdminGlobalNotifications;
