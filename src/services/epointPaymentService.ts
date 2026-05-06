/**
 * Frontend-only Epoint.az integration.
 *
 * SECURITY NOTE:
 *   The EPOINT_PRIVATE_KEY is stored in Firestore (site_settings/epoint) and
 *   loaded into the browser at runtime. Use a dedicated low-privilege Epoint
 *   key exclusively for this site, and rotate it if compromised.
 *
 * Flow (with Apple Pay / Google Pay support):
 *   1. Read EPOINT_PUBLIC_KEY / EPOINT_PRIVATE_KEY from Firestore.
 *   2. Build the JSON payload with order info.
 *   3. Compute base64 data + signature
 *      = base64( SHA1( private_key + base64_data + private_key ) ).
 *   4. PRIMARY: Try the widget endpoint (/api/1/token/widget) which returns a
 *      hosted page that automatically presents Apple Pay (iOS / Safari) and
 *      Google Pay (Android / Chrome) buttons in addition to card form.
 *      Navigate the TOP-LEVEL window to that widget_url so it never appears
 *      embedded in an iframe.
 *   5. FALLBACK: If the widget endpoint is blocked by CORS or returns error,
 *      submit a hidden form to /api/1/checkout with target="_top" (standard
 *      hosted card checkout, escapes any iframe wrapper).
 *   6. After payment Epoint redirects the user to /payment/success or
 *      /payment/error with `data` and `signature` query params, verified
 *      entirely in-browser.
 */
import CryptoJS from 'crypto-js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const EPOINT_CHECKOUT_URL = 'https://epoint.az/api/1/checkout';
const EPOINT_WIDGET_URL = 'https://epoint.az/api/1/token/widget';
const SETTINGS_DOC = doc(db, 'site_settings', 'epoint');

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

export const saveEpointSettings = async (settings: EpointSettings): Promise<void> => {
  await setDoc(SETTINGS_DOC, settings, { merge: true });
};

const utf8ToBase64 = (text: string): string =>
  CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));

const sha1Base64 = (text: string): string =>
  CryptoJS.enc.Base64.stringify(CryptoJS.SHA1(text));

export interface BuildPaymentInput {
  orderId: string;
  amount: number;
  currency?: string;
  language?: 'az' | 'en' | 'ru';
  description?: string;
}

export interface SignedPayment {
  data: string;
  signature: string;
  redirectUrl: string;
}

const buildPayload = async (input: BuildPaymentInput) => {
  const settings = await getEpointSettings();
  if (!settings.publicKey || !settings.privateKey) {
    throw new Error(
      'Epoint açarları konfiqurasiya edilməyib. Admin paneldən "Sayt Parametrləri → Epoint" hissəsinə açarları daxil edin.'
    );
  }
  const successUrl = settings.successUrl || `${window.location.origin}/payment/success`;
  const errorUrl = settings.errorUrl || `${window.location.origin}/payment/error`;
  const resultUrl = settings.resultUrl || `${window.location.origin}/payment/result`;

  const payload = {
    public_key: settings.publicKey,
    amount: input.amount.toFixed(2),
    currency: input.currency || 'AZN',
    language: input.language || 'az',
    order_id: input.orderId,
    description: input.description || 'DE VALEUR sifariş ödənişi',
    success_redirect_url: successUrl,
    error_redirect_url: errorUrl,
    result_url: resultUrl,
  };

  const json = JSON.stringify(payload);
  const data = utf8ToBase64(json);
  const signature = sha1Base64(`${settings.privateKey}${data}${settings.privateKey}`);
  return { data, signature, settings };
};

export const buildSignedPayment = async (
  input: BuildPaymentInput
): Promise<SignedPayment> => {
  const { data, signature } = await buildPayload(input);
  return { data, signature, redirectUrl: EPOINT_CHECKOUT_URL };
};

/**
 * Try to fetch a widget_url which renders the hosted payment page with
 * Apple Pay / Google Pay buttons (auto-detected by device). Returns null
 * on failure (e.g. CORS or non-success response) so caller can fall back.
 */
export const fetchEpointWidgetUrl = async (
  input: BuildPaymentInput
): Promise<string | null> => {
  try {
    const { data, signature } = await buildPayload(input);
    const fd = new FormData();
    fd.append('data', data);
    fd.append('signature', signature);
    const res = await fetch(EPOINT_WIDGET_URL, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.status === 'success' && typeof json.widget_url === 'string') {
      return json.widget_url;
    }
    return null;
  } catch (err) {
    // Likely CORS or network error — caller should fall back to standard form POST.
    console.warn('Epoint widget endpoint failed, falling back to standard checkout:', err);
    return null;
  }
};

/**
 * Submit a hidden form to Epoint checkout with target="_top" so the
 * payment page always opens as a full top-level navigation (escapes any
 * iframe / webview wrapper). NEVER renders inside an iframe.
 */
export const redirectToEpoint = (signed: SignedPayment): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = signed.redirectUrl;
  form.target = '_top';
  form.style.display = 'none';

  const dataInput = document.createElement('input');
  dataInput.name = 'data';
  dataInput.value = signed.data;
  form.appendChild(dataInput);

  const sigInput = document.createElement('input');
  sigInput.name = 'signature';
  sigInput.value = signed.signature;
  form.appendChild(sigInput);

  document.body.appendChild(form);
  form.submit();
};

/**
 * High-level entry point: try widget URL first (Apple/Google Pay support),
 * then fall back to the standard hosted checkout. In both cases the
 * payment page opens as a top-level navigation, never inside an iframe.
 */
export const startEpointPayment = async (input: BuildPaymentInput): Promise<void> => {
  const widgetUrl = await fetchEpointWidgetUrl(input);
  if (widgetUrl) {
    // Top-level navigation (escapes any iframe wrapper such as Emergent preview
    // or merchant webview). Apple Pay (iOS Safari) / Google Pay (Android Chrome)
    // are presented automatically by the hosted widget page.
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = widgetUrl;
        return;
      }
    } catch {
      // Cross-origin top window access blocked — fall through to same-window nav.
    }
    window.location.href = widgetUrl;
    return;
  }

  // Fallback: standard checkout via signed form POST with target="_top".
  const signed = await buildSignedPayment(input);
  redirectToEpoint(signed);
};

/**
 * Verify a redirect-back payload directly in the browser.
 * Returns the decoded payload if signature matches, otherwise null.
 */
export const verifyRedirectPayload = async (
  data: string,
  signature: string
): Promise<Record<string, any> | null> => {
  const settings = await getEpointSettings();
  if (!settings.privateKey) {
    try {
      const json = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  const expected = sha1Base64(`${settings.privateKey}${data}${settings.privateKey}`);
  if (expected !== signature) return null;
  try {
    const json = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
    return JSON.parse(json);
  } catch {
    return null;
  }
};
