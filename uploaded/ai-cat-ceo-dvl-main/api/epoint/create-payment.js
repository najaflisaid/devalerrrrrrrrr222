/**
 * Epoint.az — Create Payment (Vercel Serverless Function)
 * 
 * Frontend (window.location.origin/api/epoint/create-payment) → bu function → epoint.az
 * CORS-u həll edir, signature-i server tərəfdə hesablayır.
 */
import crypto from 'crypto';

const EPOINT_REQUEST_URL = 'https://epoint.az/api/1/request';
const EPOINT_PAYMENT_REQUEST_URL = 'https://epoint.az/api/1/payment-request';

const buildPayload = (publicKey, privateKey, payload) => {
  // PHP-style compact JSON (no spaces) — matches official WooCommerce plugin
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
  const signRaw = privateKey + dataB64 + privateKey;
  const signature = crypto.createHash('sha1').update(signRaw).digest('base64');
  return { dataB64, signature };
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const {
      public_key,
      private_key,
      amount,
      order_id,
      currency = 'AZN',
      language = 'az',
      description = 'DE VALEUR sifariş ödənişi',
      success_redirect_url,
      error_redirect_url,
      result_url,
      is_installment,
    } = body;

    if (!public_key || !private_key) {
      res.status(400).json({ status: 'error', message: 'public_key və private_key tələb olunur' });
      return;
    }
    if (!amount || amount <= 0) {
      res.status(400).json({ status: 'error', message: 'amount yanlışdır' });
      return;
    }
    if (!order_id) {
      res.status(400).json({ status: 'error', message: 'order_id tələb olunur' });
      return;
    }

    const lang = ['az', 'en', 'ru'].includes(language) ? language : 'az';

    const payload = {
      public_key,
      amount: parseFloat(amount.toFixed ? amount.toFixed(2) : Number(amount).toFixed(2)),
      currency,
      language: lang,
      order_id: String(order_id),
      description: description || `Order #${order_id}`,
    };
    if (success_redirect_url) payload.success_redirect_url = success_redirect_url;
    if (error_redirect_url) payload.error_redirect_url = error_redirect_url;
    if (result_url) payload.result_url = result_url;
    if (is_installment) payload.is_installment = parseInt(is_installment, 10);

    const { dataB64, signature } = buildPayload(public_key, private_key, payload);

    // Try payment-request endpoint first, fallback to /api/1/request
    let epointRes;
    try {
      epointRes = await fetch(EPOINT_PAYMENT_REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: dataB64, signature }).toString(),
      });

      const text = await epointRes.clone().text();
      if (epointRes.status >= 400 || text.toLowerCase().slice(0, 200).includes('<html')) {
        epointRes = await fetch(EPOINT_REQUEST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: dataB64, signature }).toString(),
        });
      }
    } catch (netErr) {
      console.error('[Epoint] Network error:', netErr);
      res.status(502).json({ status: 'error', message: `Epoint ilə əlaqə qurulmadı: ${netErr.message}` });
      return;
    }

    if (epointRes.status >= 400) {
      const errText = await epointRes.text().catch(() => '');
      console.warn('[Epoint] HTTP', epointRes.status, errText.slice(0, 500));
      res.status(502).json({ status: 'error', message: `Epoint cavabı uğursuz (HTTP ${epointRes.status})` });
      return;
    }

    let respBody;
    try {
      respBody = await epointRes.json();
    } catch {
      res.status(502).json({ status: 'error', message: 'Epoint düzgün cavab qaytarmadı' });
      return;
    }

    const status = (respBody.status || '').toLowerCase();
    if (status !== 'success') {
      res.status(200).json({
        status: 'error',
        message: respBody.message || respBody.description || 'Epoint xətası',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      transaction: String(respBody.transaction || ''),
      redirect_url: String(respBody.redirect_url || ''),
    });
  } catch (err) {
    console.error('[Epoint create-payment] Error:', err);
    res.status(500).json({ status: 'error', message: String(err?.message || err) });
  }
}
