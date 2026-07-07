import React, { useEffect, useRef } from 'react';
import { X, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Modal that hosts the Epoint widget URL in an iframe.
 *
 * The widget URL (returned by /api/1/token/widget) renders a hosted page
 * that automatically detects the device and shows:
 *  - Apple Pay sheet on iOS Safari
 *  - Google Pay sheet on Chrome / Android
 *  - Card form as fallback
 *
 * On payment completion, the iframe posts a message to the parent window:
 *   { status: 'success' | 'error', payment: { ... } }
 * We listen for that message here and call onSuccess/onError accordingly.
 */
interface Props {
  url: string;
  onClose: () => void;
  onSuccess: (payment?: any) => void;
  onError: (message?: string) => void;
}

const EpointWidgetModal: React.FC<Props> = ({ url, onClose, onSuccess, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Accept only events from the iframe we control
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Epoint widget posts: { status: 'success'|'error', payment: {...} }
      if (typeof data.status !== 'string') return;
      if (handledRef.current) return;

      const status = String(data.status).toLowerCase();
      if (status === 'success') {
        handledRef.current = true;
        onSuccess(data.payment);
      } else if (status === 'error' || status === 'failed' || status === 'declined') {
        handledRef.current = true;
        const msg =
          data?.payment?.message || data?.message || data?.description || 'Ödəniş tamamlanmadı';
        onError(String(msg));
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSuccess, onError]);

  // Prevent background scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      data-testid="epoint-widget-modal"
    >
      <div className="relative bg-white w-full max-w-[520px] h-[88vh] sm:h-[720px] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/10">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={1.6} />
            <span className="text-[12px] uppercase tracking-[0.18em] text-black/70 truncate">
              Təhlükəsiz ödəniş — Epoint
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bağla"
            className="text-black/50 hover:text-black transition-colors"
            data-testid="epoint-widget-close"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Iframe */}
        <div className="relative flex-1 bg-white">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin text-black/30 mx-auto mb-2" />
              <p className="text-[12px] text-black/45">Ödəniş yüklənir...</p>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={url}
            title="Epoint Payment"
            className="absolute inset-0 w-full h-full bg-white border-0"
            allow="payment *; publickey-credentials-get *; clipboard-write"
            data-testid="epoint-widget-iframe"
          />
        </div>

        <div className="px-4 sm:px-5 py-2.5 border-t border-black/10 text-center">
          <p className="text-[10px] text-black/40 uppercase tracking-[0.18em]">
            Apple Pay · Google Pay · Visa · Mastercard
          </p>
        </div>
      </div>
    </div>
  );
};

export default EpointWidgetModal;
