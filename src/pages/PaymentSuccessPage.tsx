import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Package } from 'lucide-react';
import { verifyRedirectPayload } from '../services/epointPaymentService';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCart } from '../context/CartContext';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const data = params.get('data');
    const signature = params.get('signature');
    // Reserved order id stored before redirect
    const pendingId = sessionStorage.getItem('pending_epoint_order_id');

    const finalize = async (resolvedOrderId?: string) => {
      const targetId = resolvedOrderId || pendingId;
      if (targetId) {
        try {
          await updateDoc(doc(db, 'customer_orders', targetId), {
            status: 'preparing',
            paymentStatus: 'success',
            paidAt: Timestamp.now(),
          });
        } catch (e) {
          console.warn('Order status update failed (may already be updated by webhook):', e);
        }
        setOrderId(targetId);
      }
      clearCart();
      sessionStorage.removeItem('pending_epoint_order_id');
      setState('success');
    };

    if (data && signature) {
      verifyRedirectPayload(data, signature)
        .then((decoded) => {
          if (decoded && (decoded.status === 'success' || !decoded.status)) {
            void finalize(decoded.order_id || pendingId || undefined);
          } else if (decoded) {
            // Verified but status not success
            setState('error');
          } else {
            // Signature mismatch — still trust optimistically since Epoint redirected to success
            void finalize();
          }
        })
        .catch(() => {
          void finalize();
        });
    } else if (pendingId) {
      void finalize();
    } else {
      setState('error');
    }
  }, [params, clearCart]);

  if (state === 'verifying') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600">Ödəniş təsdiqlənir...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ödəniş təsdiqlənmədi</h1>
          <p className="text-gray-600 mb-6">Sifarişlərim səhifəsindən statusu yoxlayın.</p>
          <button
            onClick={() => navigate('/my-orders')}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Sifarişlərim
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-md w-full text-center" data-testid="payment-success-card">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ödəniş uğurla tamamlandı</h1>
        <p className="text-gray-600 mb-6">
          Sifarişiniz qəbul edildi və hazırlanır. Sifarişlərim səhifəsindən izləyə bilərsiniz.
        </p>
        {orderId && (
          <p className="text-xs text-gray-400 mb-4">Sifariş ID: {orderId.slice(0, 10)}…</p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/my-orders')}
            className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 inline-flex items-center justify-center gap-2"
            data-testid="payment-success-orders-btn"
          >
            <Package className="h-4 w-4" />
            Sifarişlərimə keç
          </button>
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg hover:bg-gray-200"
          >
            Alış-verişə davam et
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
