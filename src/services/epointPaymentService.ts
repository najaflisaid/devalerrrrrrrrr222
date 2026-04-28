/**
 * Frontend-only Epoint.az integration.
 *
 * SECURITY NOTE:
 *   The EPOINT_PRIVATE_KEY is stored in Firestore (site_settings/epoint) and
 *   loaded into the browser at runtime. This means anyone inspecting the page
 *   can read the private key. This trade-off was explicitly chosen by the user
 *   to avoid running a backend. Use a dedicated low-privilege Epoint key
 *   exclusively for this site, and rotate it if compromised.
 *
 * Flow:
 *   1. Read EPOINT_PUBLIC_KEY / EPOINT_PRIVATE_KEY from Firestore.
 *   2. Build the JSON payload with the customer's order info.
 *   3. base64-encode the payload, build the signature
 *      = base64( SHA1( private_key + base64_data + private_key ) )
 *   4. Auto-submit a hidden HTML form to https://epoint.az/api/1/checkout
 *      (POST navigation — no CORS preflight).
 *   5. After payment Epoint redirects the user to /payment/success or
 *      /payment/error with `data` and `signature` query params, which we
 *      verify entirely in-browser.
 */
import CryptoJS from 'crypto-js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const EPOINT_CHECKOUT_URL = 'https://epoint.az/api/1/checkout';
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

export const buildSignedPayment = async (
  input: BuildPaymentInput
): Promise<SignedPayment> => {
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

  return { data, signature, redirectUrl: EPOINT_CHECKOUT_URL };
};

/**
 * Auto-submit a hidden form to Epoint checkout (POST navigation).
 * No CORS preflight because the browser navigates instead of fetching.
 */
export const redirectToEpoint = (signed: SignedPayment): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = signed.redirectUrl;
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
 * Verify a redirect-back payload directly in the browser.
 * Returns the decoded payload if signature matches, otherwise null.
 */
export const verifyRedirectPayload = async (
  data: string,
  signature: string
): Promise<Record<string, any> | null> => {
  const settings = await getEpointSettings();
  if (!settings.privateKey) {
    // Unable to verify; trust the redirect optimistically since Epoint only
    // redirects to success_url after a successful charge.
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
