import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Package, Gift, Copy, Check, Share2, MessageCircle } from 'lucide-react';
import { verifyRedirectPayload } from '../services/epointPaymentService';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCart } from '../context/CartContext';
import { createGiftCardPromoCode } from '../services/promoCodeService';
import { getEpointSettings } from '../services/epointPaymentService';
import { isCustomGiftCardId } from '../utils/giftCard';
import { useNotify } from '../components/ui/NotificationProvider';

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

interface IssuedGiftCode {
  code: string;
  amount: number;
}

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const { toast } = useNotify();
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [giftCodes, setGiftCodes] = useState<IssuedGiftCode[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Show toast notification whenever state resolves
  useEffect(() => {
    if (state === 'success') {
      toast('Ödəniş uğurla tamamlandı! Sifarişiniz qəbul edildi.', 'success');
    } else if (state === 'error') {
      toast('Ödəniş təsdiqlənmədi. Zəhmət olmasa yenidən cəhd edin.', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const data = params.get('data');
    const signature = params.get('signature');
    const pendingId = sessionStorage.getItem('pending_epoint_order_id');

    const issueGiftCardsForOrder = async (resolvedOrderId: string) => {
      try {
        const orderSnap = await getDoc(doc(db, 'customer_orders', resolvedOrderId));
        if (!orderSnap.exists()) return;
        const orderData: any = orderSnap.data() || {};

        // Skip if codes already issued for this order
        if (orderData.giftCardsIssued) return;

        const orderItems: any[] = orderData.items || [];
        if (!orderItems.length) return;

        // Look up each product to find isGiftCard==true
        // Sintetik gift-card-custom-* ID-ləri Firestore-da yoxdur — onları
        // ID prefiksinə görə birbaşa gift-card kimi qəbul edirik.
        const issued: IssuedGiftCode[] = [];
        for (const it of orderItems) {
          if (!it?.productId) continue;
          try {
            let isGift = false;
            let amount = Number(it.price || 0);

            if (isCustomGiftCardId(it.productId)) {
              isGift = true;
              if (!amount) {
                amount = Number(it.productId.replace(/^gift-card-custom-/, '')) || 0;
              }
            } else {
              const prodSnap = await getDoc(doc(db, 'products', it.productId));
              if (!prodSnap.exists()) continue;
              const pData: any = prodSnap.data();
              if (!pData.isGiftCard) continue;
              isGift = true;
              if (!amount) amount = Number(pData.price || 0);
            }

            if (!isGift || !amount) continue;

            // Sifariş üzərində hədiyyə kartı metadata var (göndərən/alıcı/mesaj)
            const shareMeta = orderData.giftCardMeta as
              | { senderName?: string; recipientName?: string; recipientPhone?: string; message?: string }
              | undefined;

            // Generate one promo code per quantity
            const qty = Number(it.quantity || 1);
            for (let q = 0; q < qty; q++) {
              const created = await createGiftCardPromoCode(
                amount,
                'gift-card-purchase',
                orderData.userId
                  ? { userId: orderData.userId, userEmail: orderData.customerEmail, userName: orderData.customerName }
                  : undefined,
                shareMeta
                  ? {
                      senderName: shareMeta.senderName || orderData.customerName || '',
                      recipientName: shareMeta.recipientName || '',
                      recipientPhone: shareMeta.recipientPhone || '',
                      message: shareMeta.message || '',
                      source: 'purchase',
                    }
                  : undefined
              );
              issued.push({ code: created.code, amount });
            }
          } catch (err) {
            console.warn('Failed to issue gift card for item', it, err);
          }
        }

        if (issued.length > 0) {
          setGiftCodes(issued);
          await updateDoc(doc(db, 'customer_orders', resolvedOrderId), {
            giftCardsIssued: true,
            giftCardCodes: issued,
          });
        }
      } catch (e) {
        console.warn('Gift card issuance failed:', e);
      }
    };

    const finalize = async (resolvedOrderId?: string) => {
      const targetId = resolvedOrderId || pendingId;
      if (targetId) {
        // Server-side verification via Epoint /api/1/get-status
        // (matches the official OpenCart plugin's callback flow)
        try {
          const settings = await getEpointSettings();
          if (settings.publicKey && settings.privateKey && BACKEND_URL) {
            const r = await fetch(`${BACKEND_URL}/api/epoint/get-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                public_key: settings.publicKey,
                private_key: settings.privateKey,
                order_id: targetId,
              }),
            });
            if (r.ok) {
              const j = await r.json();
              const ok =
                String(j?.status).toLowerCase() === 'success' ||
                String(j?.payment_status).toLowerCase() === 'success';
              if (!ok) {
                try {
                  await updateDoc(doc(db, 'customer_orders', targetId), {
                    status: 'payment_failed',
                    paymentStatus: 'failed',
                  });
                } catch { /* ignore */ }
                sessionStorage.removeItem('pending_epoint_order_id');
                setState('error');
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Epoint get-status verification failed (will trust redirect):', e);
        }

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
        await issueGiftCardsForOrder(targetId);
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
            setState('error');
          } else {
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

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

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
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 max-w-lg w-full text-center" data-testid="payment-success-card">
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

        {/* Gift card codes — show prominently if issued */}
        {giftCodes.length > 0 && (
          <div className="mb-6 text-left bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 rounded-xl p-5" data-testid="gift-codes-block">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-amber-700" />
              <p className="text-sm font-semibold text-amber-900">Hədiyyə Kartı Kodlarınız</p>
            </div>
            <p className="text-xs text-amber-800/80 mb-4">
              Bu kodları alış-veriş zamanı promo kod kimi istifadə edə bilərsiniz. Hər kod yalnız bir dəfə işlədilir.
            </p>
            <div className="space-y-2">
              {giftCodes.map((g, i) => {
                const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gift-card/${g.code}`;
                const waText = encodeURIComponent(`Sizə DE VALEUR hədiyyə kartı göndərildi! ${shareUrl}`);
                return (
                  <div
                    key={`${g.code}-${i}`}
                    className="bg-white border border-amber-200 rounded-lg p-3"
                    data-testid={`gift-code-row-${i}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="font-mono text-base font-semibold text-gray-900 tracking-widest">{g.code}</p>
                        <p className="text-xs text-gray-500">Dəyər: {g.amount.toFixed(2)} AZN</p>
                      </div>
                      <button
                        onClick={() => handleCopy(g.code)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-800"
                        data-testid={`gift-code-copy-${i}`}
                      >
                        {copied === g.code ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Köçürüldü
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Köçür
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-100">
                      <a
                        href={`https://wa.me/?text=${waText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                        data-testid={`gift-code-whatsapp-${i}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp ilə göndər
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            setCopied(`link-${g.code}`);
                            setTimeout(() => setCopied(null), 2000);
                          } catch { /* ignore */ }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        data-testid={`gift-code-share-link-${i}`}
                      >
                        {copied === `link-${g.code}` ? (
                          <><Check className="w-3.5 h-3.5" /> Link kopyalandı</>
                        ) : (
                          <><Share2 className="w-3.5 h-3.5" /> Linki paylaş</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
