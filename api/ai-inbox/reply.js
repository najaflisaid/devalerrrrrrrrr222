/**
 * POST /api/ai-inbox/reply
 * Manual admin reply — sends a message via WhatsApp/Instagram and persists to Firestore.
 *
 * Body: { conv_id: string, text: string }
 * Reads conversation from Firestore, looks up platform + recipient, sends via Meta API.
 */
import {
  getAiInboxConfig,
  firestoreGetDoc,
  persistMessage,
  sendWhatsAppText,
  sendInstagramText,
  setCors,
} from './_shared.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const convId = (body.conv_id || '').toString().trim();
    const text = (body.text || '').toString().trim();
    if (!convId || !text) return res.status(400).json({ error: 'conv_id və text tələb olunur' });

    const conv = await firestoreGetDoc(`aiInboxConversations/${convId}`);
    if (!conv) return res.status(404).json({ error: 'Söhbət tapılmadı' });

    const cfg = await getAiInboxConfig();
    const platform = conv.platform;
    const toId = conv.user_external_id;

    let sendRes;
    if (platform === 'whatsapp') {
      sendRes = await sendWhatsAppText({ cfg, toPhone: toId, text });
    } else if (platform === 'instagram') {
      sendRes = await sendInstagramText({ cfg, recipientIgsid: toId, text });
    } else {
      return res.status(400).json({ error: `Naməlum platform: ${platform}` });
    }

    if (!sendRes.success) {
      return res.status(502).json({ error: sendRes.message || 'Göndərilmədi', detail: sendRes });
    }

    const msgId = sendRes.message_id || `manual_${Date.now()}`;
    await persistMessage({
      platform,
      userExternalId: toId,
      userName: conv.user_name || toId,
      messageId: msgId,
      direction: 'outbound',
      text,
      by: 'admin',
    });

    res.status(200).json({ ok: true, message_id: msgId });
  } catch (e) {
    console.error('[ai-inbox/reply]', e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
