/**
 * Instagram Graph API webhook handler (Vercel Serverless Function)
 *
 * GET  /api/webhooks/instagram — Meta verification handshake
 * POST /api/webhooks/instagram — Inbound DM receiver + AI auto-reply
 */
import {
  getAiInboxConfig,
  verifyMetaSignature,
  readRawBody,
  persistMessage,
  isMessageProcessed,
  markMessageProcessed,
  getConvAiEnabled,
  getConversationHistory,
  generateAiReply,
  sendInstagramText,
  setCors,
} from '../ai-inbox/_shared.js';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const cfg = await getAiInboxConfig();

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const token = url.searchParams.get('hub.verify_token');
    if (mode === 'subscribe' && challenge && token === cfg.meta_verify_token) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(challenge);
      return;
    }
    res.status(403).json({ error: 'verification_failed' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch {
    res.status(400).json({ error: 'bad_body' });
    return;
  }

  const sig = req.headers['x-hub-signature-256'];
  if (!verifyMetaSignature(raw, sig, cfg.meta_app_secret)) {
    res.status(403).json({ error: 'invalid_signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8') || '{}');
  } catch {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  if (payload.object !== 'instagram' && payload.object !== 'page') {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  // Respond fast, process async
  res.status(200).json({ status: 'ok' });
  processInstagramPayload(cfg, payload).catch((e) =>
    console.error('[ig-webhook] processing error', e)
  );
}

async function processInstagramPayload(cfg, payload) {
  for (const entry of payload.entry || []) {
    for (const evt of entry.messaging || []) {
      const msg = evt.message || {};
      if (msg.is_echo) continue; // skip echo of our own sent message
      const mid = msg.mid;
      const senderId = evt.sender?.id;
      if (!mid || !senderId) continue;

      if (await isMessageProcessed(mid)) continue;
      await markMessageProcessed(mid, 'instagram');

      let text = msg.text || '';
      const hasText = Boolean(text);
      if (!text) {
        const attachments = msg.attachments || [];
        if (attachments.length > 0) text = `[${attachments[0].type || 'attachment'} göndərildi]`;
        else text = '[mesaj]';
      }

      const convId = await persistMessage({
        platform: 'instagram',
        userExternalId: senderId,
        userName: senderId,
        messageId: mid,
        direction: 'inbound',
        text,
        by: 'customer',
      });

      if (cfg.global_enabled && cfg.ig_enabled && hasText && (await getConvAiEnabled(convId))) {
        try {
          const history = await getConversationHistory(convId, 8);
          const ctx = history.filter((h) => h.id !== mid);
          const reply = await generateAiReply({
            cfg,
            platform: 'instagram',
            inboundText: text,
            history: ctx,
          });
          if (reply) {
            const sendRes = await sendInstagramText({
              cfg,
              recipientIgsid: senderId,
              text: reply,
            });
            if (sendRes.success) {
              await persistMessage({
                platform: 'instagram',
                userExternalId: senderId,
                userName: senderId,
                messageId: sendRes.message_id || `ai_${mid}_${Date.now()}`,
                direction: 'outbound',
                text: reply,
                by: 'ai',
              });
            } else {
              console.warn('[ig-webhook] AI send failed', sendRes);
            }
          }
        } catch (e) {
          console.error('[ig-webhook] AI reply error', e);
        }
      }
    }
  }
}
