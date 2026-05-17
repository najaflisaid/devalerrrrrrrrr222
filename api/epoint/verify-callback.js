/**
 * Epoint.az — Verify Callback Signature (Vercel Serverless Function)
 * Epoint-dən redirect-back gələn data + signature-ni yoxlayır.
 */
import crypto from 'crypto';

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ valid: false }); return; }

  try {
    const { private_key, data, signature } = req.body || {};
    if (!private_key || !data || !signature) {
      res.status(400).json({ valid: false });
      return;
    }

    const expected = crypto.createHash('sha1').update(private_key + data + private_key).digest('base64');
    if (expected !== signature) {
      res.status(200).json({ valid: false });
      return;
    }

    try {
      const decoded = Buffer.from(data, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);
      res.status(200).json({ valid: true, payload });
    } catch {
      res.status(200).json({ valid: false });
    }
  } catch (err) {
    console.error('[Epoint verify-callback] Error:', err);
    res.status(500).json({ valid: false });
  }
}
