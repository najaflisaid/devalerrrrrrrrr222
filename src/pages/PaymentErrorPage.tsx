import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, RotateCw } from 'lucide-react';
import { useNotify } from '../components/ui/NotificationProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PaymentErrorPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useNotify();

  useEffect(() => {
    // Mark pending order as payment_failed (Epoint redirected here)
    const pendingId = sessionStorage.getItem('pending_epoint_order_id');
    if (pendingId) {
      updateDoc(doc(db, 'customer_orders', pendingId), {
        status: 'payment_failed',
        paymentStatus: 'failed',
      }).catch(() => undefined);
    }
    // Pending sessiya açarı təmizlənir ki, səbət axını yenilənsin.
    sessionStorage.removeItem('pending_epoint_order_id');
    sessionStorage.removeItem('pending_epoint_transaction_id');
    toast('Ödəniş uğursuz oldu. Sifarişiniz "ödəniş gözləyir" statusunda saxlanıldı.', 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-md w-full text-center" data-testid="payment-error-card">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="h-12 w-12 text-red-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Ödəniş uğursuz oldu</h1>
        <p className="text-gray-600 mb-2">
          Sifarişiniz <strong>ödəniş gözləyir</strong> statusunda saxlanıldı.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Səbətiniz silinmədi — yenidən cəhd edə və ya başqa kart istifadə edə bilərsiniz.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/cart')}
            className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"
            data-testid="payment-error-retry-btn"
          >
            <RotateCw className="h-4 w-4" />
            Səbətə qayıt və yenidən ödə
          </button>
          <button
            onClick={() => navigate('/my-orders')}
            className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg hover:bg-gray-200"
          >
            Sifarişlərim
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentErrorPage;
