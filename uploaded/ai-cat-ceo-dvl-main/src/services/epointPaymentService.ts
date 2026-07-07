/**
 * Epoint.az integration — server-side flow.
 *
 * Frontend reads the merchant keys from Firestore (site_settings/epoint),
 * sends them to our backend (/api/epoint/create-payment) which then calls
 * the official Epoint endpoint (https://epoint.az/api/1/request) using the
 * exact contract from the official WooCommerce plugin:
 *
 *   data      = base64(json_encode(payload))
 *   signature = base64(sha1(private_key + data + private_key, raw_binary=1))
 *
 * Doing the call server-side avoids browser CORS, ensures byte-perfect JSON
 * (Python's json.dumps with separators(",", ":") == PHP json_encode), and
 * keeps the signature contract identical to the official plugin so Epoint
 * always accepts the request.
 *
 * After payment, Epoint redirects back to success/error URL. Optionally a
 * server-to-server result_url can be configured. Both paths can be verified
 * via /api/epoint/verify-callback (kept for redirect query params).
 */
import CryptoJS from 'crypto-js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const SETTINGS_DOC = doc(db, 'site_settings', 'epoint');

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (import.meta as any).env?.REACT_APP_BACKEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export interface EpointSettings {
  publicKey: string;
  privateKey: string;
  successUrl: string;
  errorUrl: string;
  resultUrl: string;
}

export const getEpointSettings = async (): Promise<EpointSettings> => {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) {
    return { publicKey: '', privateKey: '', successUrl: '', errorUrl: '', resultUrl: '' };
  }
  const d = snap.data() as Partial<EpointSettings>;
  return {
    publicKey: d.publicKey || '',
    privateKey: d.privateKey || '',
    successUrl: d.successUrl || '',
    errorUrl: d.errorUrl || '',
    resultUrl: d.resultUrl || '',
  };
};

// In-memory cache for Epoint settings — eliminates the extra Firestore read
// on every "Ödənişə keç" click (settings rarely change at runtime).
let _epointSettingsCache: EpointSettings | null = null;
let _epointSettingsPromise: Promise<EpointSettings> | null = null;

export const getEpointSettingsCached = (): Promise<EpointSettings> => {
  if (_epointSettingsCache) return Promise.resolve(_epointSettingsCache);
  if (_epointSettingsPromise) return _epointSettingsPromise;
  _epointSettingsPromise = getEpointSettings().then((s) => {
    _epointSettingsCache = s;
    return s;
  }).finally(() => {
    _epointSettingsPromise = null;
  });
  return _epointSettingsPromise;
};

/**
 * Preload Epoint settings into the in-memory cache. Call this when the
 * checkout panel opens so the actual "Pay" click no longer pays the
 * Firestore round-trip latency.
 */
export const preloadEpointSettings = (): void => {
  void getEpointSettingsCached();
};

export const saveEpointSettings = async (settings: EpointSettings): Promise<void> => {
  await setDoc(SETTINGS_DOC, settings, { merge: true });
};

export interface BuildPaymentInput {
  orderId: string;
  amount: number;
  currency?: string;
  language?: 'az' | 'en' | 'ru';
  description?: string;
  isInstallment?: boolean;
}

const sha1Base64 = (text: string): string =>
  CryptoJS.enc.Base64.stringify(CryptoJS.SHA1(text));

/**
 * High-level entry point. Calls our FastAPI backend which performs the
 * server-side payment-request to Epoint and returns a `redirect_url`.
 * Then we navigate the browser to that URL — Epoint's hosted page presents
 * card form, plus Apple Pay (iOS Safari) and Google Pay (Android Chrome)
 * automatically based on the device/browser capabilities.
 */
export const startEpointPayment = async (input: BuildPaymentInput): Promise<void> => {
  const url = await getEpointRedirectUrl(input);

  // Top-level navigation so Apple Pay / Google Pay can render correctly
  // (escape any iframe wrapper such as the Emergent preview).
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    /* cross-origin top — fall through to same-window nav */
  }
  window.location.href = url;
};

/**
 * Same backend call as startEpointPayment but returns the redirect URL
 * instead of navigating. Useful when we want to embed the hosted Epoint
 * checkout page inside an iframe on our own page (no redirect).
 */
export const getEpointRedirectUrl = async (input: BuildPaymentInput): Promise<string> => {
  const settings = await getEpointSettingsCached();
  if (!settings.publicKey || !settings.privateKey) {
    throw new Error(
      'Epoint açarları konfiqurasiya edilməyib. Admin paneldən "Sayt Parametrləri → Epoint" hissəsinə açarları daxil edin.'
    );
  }

  if (!BACKEND_URL) {
    throw new Error('Backend URL təyin olunmayıb.');
  }

  const successUrl = settings.successUrl || `${window.location.origin}/payment/success`;
  const errorUrl = settings.errorUrl || `${window.location.origin}/payment/error`;
  const resultUrl = settings.resultUrl || '';

  const payload = {
    public_key: settings.publicKey,
    private_key: settings.privateKey,
    amount: +input.amount.toFixed(2),
    order_id: input.orderId,
    currency: input.currency || 'AZN',
    language: input.language || 'az',
    description: input.description || 'DE VALEUR sifariş ödənişi',
    success_redirect_url: successUrl,
    error_redirect_url: errorUrl,
    ...(resultUrl ? { result_url: resultUrl } : {}),
    ...(input.isInstallment ? { is_installment: 1 } : {}),
  };

  const res = await fetch(`${BACKEND_URL}/api/epoint/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `Backend cavabı uğursuz oldu (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const body = await res.json();
  if (body?.status !== 'success' || !body?.redirect_url) {
    throw new Error(body?.message || 'Epoint ödəniş URL-i alınmadı');
  }

  return body.redirect_url as string;
};

/**
 * Fetch the Epoint widget URL for Apple Pay / Google Pay (iframe flow).
 * Per official docs: payload = { public_key, amount, order_id, description }
 * The returned URL is meant to be embedded in an iframe; the widget will
 * render Apple Pay sheet on iOS Safari, Google Pay sheet on Chrome/Android,
 * and a card form as fallback. Listen on `window.message` for completion:
 *   { status: 'success', payment: {...} } or { status: 'error', ... }
 */
export const fetchEpointWidgetUrl = async (input: {
  orderId: string;
  amount: number;
  description?: string;
}): Promise<string> => {
  const settings = await getEpointSettings();
  if (!settings.publicKey || !settings.privateKey) {
    throw new Error(
      'Epoint açarları konfiqurasiya edilməyib. Admin paneldən "Sayt Parametrləri → Epoint" hissəsinə açarları daxil edin.'
    );
  }
  if (!BACKEND_URL) {
    throw new Error('Backend URL təyin olunmayıb.');
  }

  const res = await fetch(`${BACKEND_URL}/api/epoint/widget-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: settings.publicKey,
      private_key: settings.privateKey,
      amount: +input.amount.toFixed(2),
      order_id: input.orderId,
      description: input.description || 'DE VALEUR sifariş',
    }),
  });

  if (!res.ok) {
    let msg = `Backend cavabı uğursuz (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const body = await res.json();
  if (body?.status !== 'success' || !body?.widget_url) {
    throw new Error(body?.message || 'Widget URL alınmadı');
  }
  return body.widget_url as string;
};

/**
 * Verify the redirect-back payload (data + signature) coming from Epoint.
 * Tries the backend verify endpoint first (canonical), falls back to local
 * SHA-1 with the private key from Firestore for offline verification.
 */
export const verifyRedirectPayload = async (
  data: string,
  signature: string
): Promise<Record<string, any> | null> => {
  // Primary: backend verify (uses the merchant private key from request)
  try {
    const settings = await getEpointSettings();
    if (settings.privateKey && BACKEND_URL) {
      const res = await fetch(`${BACKEND_URL}/api/epoint/verify-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          private_key: settings.privateKey,
          data,
          signature,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.valid && body?.payload) return body.payload;
        if (body?.valid === false) return null;
      }
    }
  } catch {
    /* fall through to local fallback */
  }

  // Fallback: local SHA-1 verification
  try {
    const settings = await getEpointSettings();
    if (settings.privateKey) {
      const expected = sha1Base64(`${settings.privateKey}${data}${settings.privateKey}`);
      if (expected !== signature) return null;
    }
    const json = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
    return JSON.parse(json);
  } catch {
    return null;
  }
};
