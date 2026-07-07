/**
 * POST /api/ai-inbox/test
 * Generate an AI preview reply (no actual send). Used by the admin UI to
 * preview persona output.
 *
 * Body: { text: string, config?: { provider, model, custom_api_key, use_custom_key, persona } }
 * If `config` is provided, used directly; otherwise reads from Firestore.
 */
import { getAiInboxConfig, generateAiReply, setCors } from './_shared.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const text = (body.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'text required' });

    let cfg = await getAiInboxConfig();
    if (body.config) {
      cfg = { ...cfg, ...body.config };
    }

    const reply = await generateAiReply({
      cfg,
      platform: 'test',
      inboundText: text,
      history: [],
    });

    res.status(200).json({ ok: true, reply: reply || '' });
  } catch (e) {
    console.error('[ai-inbox/test]', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
