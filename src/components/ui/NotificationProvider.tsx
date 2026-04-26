import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; tone: ToastTone; }

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

interface NotificationCtx {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
}

const Ctx = createContext<NotificationCtx | null>(null);

export const useNotify = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotify must be used inside <NotificationProvider>');
  return c;
};

let toastCounter = 1;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = toastCounter++;
    setToasts(prev => [...prev, { id, message, tone }]);
    setTimeout(() => removeToast(id), 3500);
  }, []);

  const askConfirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const o: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...o, resolve });
    });
  }, []);

  // ─────────────────────────────────────────────
  // Override window.alert globally to use toasts.
  // window.confirm / prompt qalır — sync olduğu üçün
  // bunları aşkar şəkildə `useNotify().confirm` ilə əvəz edirik.
  // ─────────────────────────────────────────────
  const originalAlert = useRef<typeof window.alert | null>(null);
  useEffect(() => {
    originalAlert.current = window.alert;
    window.alert = (msg?: any) => {
      const text = String(msg ?? '');
      const lower = text.toLowerCase();
      const tone: ToastTone =
        lower.includes('xəta') || lower.includes('xeta') || lower.includes('error') ||
        lower.includes('yanlış') || lower.includes('bilmədi') || lower.includes('problem')
          ? 'error'
          : 'success';
      showToast(text, tone);
    };
    // Eyni zamanda qlobal helper-ləri də export et — istəyən birbaşa istifadə edə bilər
    (window as any).__siteToast = showToast;
    (window as any).__siteConfirm = askConfirm;
    return () => {
      if (originalAlert.current) window.alert = originalAlert.current;
      delete (window as any).__siteToast;
      delete (window as any).__siteConfirm;
    };
  }, [showToast, askConfirm]);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const isDanger = confirmState?.variant === 'danger';

  return (
    <Ctx.Provider value={{ toast: showToast, confirm: askConfirm }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl flex items-start gap-2 text-sm max-w-sm border ${
              t.tone === 'success' ? 'bg-gray-900 text-white border-gray-800' :
              t.tone === 'error'   ? 'bg-red-600 text-white border-red-700' :
                                     'bg-white text-gray-900 border-gray-200'
            }`}
            data-testid={`site-toast-${t.tone}`}
            role="status"
          >
            {t.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
            {t.tone === 'error' && <AlertCircle className="h-4 w-4 text-white mt-0.5 shrink-0" />}
            {t.tone === 'info' && <AlertCircle className="h-4 w-4 text-gray-700 mt-0.5 shrink-0" />}
            <span className="whitespace-pre-line leading-relaxed flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="opacity-60 hover:opacity-100 -mr-1 -mt-0.5 p-0.5 rounded"
              aria-label="Bağla"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" data-testid="site-confirm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${isDanger ? 'text-red-500' : 'text-amber-500'}`} />
                <h3 className="font-semibold text-gray-900 text-sm">
                  {confirmState.title || 'Təsdiq'}
                </h3>
              </div>
              <button onClick={() => handleConfirmClose(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{confirmState.message}</p>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => handleConfirmClose(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  {confirmState.cancelLabel || 'Ləğv et'}
                </button>
                <button onClick={() => handleConfirmClose(true)}
                  className={`px-4 py-2 text-sm rounded-lg text-white ${
                    isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-black'
                  }`}
                  data-testid="site-confirm-ok">
                  {confirmState.confirmLabel || 'Təsdiqlə'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
};

// Helper — qlobal istifadə üçün (provider yüklənibsə işləyir)
export const siteConfirm = (opts: ConfirmOptions | string): Promise<boolean> => {
  const fn = (window as any).__siteConfirm as ((o: ConfirmOptions | string) => Promise<boolean>) | undefined;
  if (fn) return fn(opts);
  // fallback to native if provider isn't mounted
  return Promise.resolve(window.confirm(typeof opts === 'string' ? opts : opts.message));
};

export const siteToast = (message: string, tone: ToastTone = 'success') => {
  const fn = (window as any).__siteToast as ((m: string, t?: ToastTone) => void) | undefined;
  if (fn) fn(message, tone);
};
