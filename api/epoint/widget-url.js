/**
 * Epoint.az — Widget URL (Vercel Serverless Function)
 * Apple Pay / Google Pay iframe widget üçün.
 */
import crypto from 'crypto';

const EPOINT_WIDGET_URL = 'https://epoint.az/api/1/token/widget';

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'error', message: 'Method not allowed' }); return; }

  try {
    const { public_key, private_key, amount, order_id, description } = req.body || {};
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

    const payload = {
      public_key,
      amount: parseFloat(Number(amount).toFixed(2)),
      order_id: String(order_id),
      description: description || `Order #${order_id}`,
    };

    const jsonStr = JSON.stringify(payload);
    const dataB64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
    const signature = crypto.createHash('sha1').update(private_key + dataB64 + private_key).digest('base64');

    const epointRes = await fetch(EPOINT_WIDGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: dataB64, signature }).toString(),
    });

    if (epointRes.status >= 400) {
      res.status(502).json({ status: 'error', message: `Epoint widget HTTP ${epointRes.status}` });
      return;
    }

    let respBody;
    try {
      respBody = await epointRes.json();
    } catch {
      res.status(502).json({ status: 'error', message: 'Epoint düzgün cavab qaytarmadı' });
      return;
    }

    if ((respBody.status || '').toLowerCase() !== 'success' || !respBody.widget_url) {
      res.status(200).json({
        status: 'error',
        message: respBody.message || respBody.description || 'Widget URL alınmadı',
      });
      return;
    }

    res.status(200).json({ status: 'success', widget_url: String(respBody.widget_url) });
  } catch (err) {
    console.error('[Epoint widget-url] Error:', err);
    res.status(500).json({ status: 'error', message: String(err?.message || err) });
  }
}
