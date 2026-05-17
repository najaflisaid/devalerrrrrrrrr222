/**
 * Epoint.az — Get Payment Status (Vercel Serverless Function)
 */
import crypto from 'crypto';

const EPOINT_GET_STATUS_URL = 'https://epoint.az/api/1/get-status';

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ status: 'error' }); return; }

  try {
    const { public_key, private_key, transaction, order_id } = req.body || {};
    if (!public_key || !private_key) {
      res.status(400).json({ status: 'error', message: 'public_key/private_key tələb olunur' });
      return;
    }
    if (!transaction && !order_id) {
      res.status(400).json({ status: 'error', message: 'transaction və ya order_id tələb olunur' });
      return;
    }

    const payload = { public_key };
    if (transaction) payload.transaction = transaction;
    if (order_id) payload.order_id = order_id;

    const jsonStr = JSON.stringify(payload);
    const dataB64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
    const signature = crypto.createHash('sha1').update(private_key + dataB64 + private_key).digest('base64');

    const epointRes = await fetch(EPOINT_GET_STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: dataB64, signature }).toString(),
    });

    if (epointRes.status >= 400) {
      res.status(502).json({ status: 'error', message: `Epoint cavabı: HTTP ${epointRes.status}` });
      return;
    }

    const body = await epointRes.json();
    res.status(200).json({
      status: String(body.status || 'unknown'),
      payment_status: String(body.payment_status || body.status || ''),
      transaction: String(body.transaction || transaction || ''),
      raw: body,
    });
  } catch (err) {
    console.error('[Epoint get-status] Error:', err);
    res.status(500).json({ status: 'error', message: String(err?.message || err) });
  }
}
