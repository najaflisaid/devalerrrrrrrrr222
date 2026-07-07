/**
 * WhatsApp Cloud API webhook handler (Vercel Serverless Function)
 *
 * GET  /api/webhooks/whatsapp — Meta verification handshake
 * POST /api/webhooks/whatsapp — Inbound message receiver + AI auto-reply
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
  convDocId,
  generateAiReply,
  sendWhatsAppText,
  setCors,
} from './_shared.js';

export const config = {
  api: { bodyParser: false }, // we need raw body for signature verification
};

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const cfg = await getAiInboxConfig();

  // ---- Verification (GET) -------------------------------------------------
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

  // ---- POST: inbound messages --------------------------------------------
  let raw;
  try {
    raw = await readRawBody(req);
  } catch (e) {
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

  if (payload.object !== 'whatsapp_business_account') {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  // Process asynchronously so we can return 200 quickly
  res.status(200).json({ status: 'ok' });
  processWhatsAppPayload(cfg, payload).catch((e) =>
    console.error('[wa-webhook] processing error', e)
  );
}

async function processWhatsAppPayload(cfg, payload) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const contacts = value.contacts || [];
      const nameMap = {};
      for (const c of contacts) {
        if (c.wa_id) nameMap[c.wa_id] = c.profile?.name || '';
      }

      for (const msg of value.messages || []) {
        const msgId = msg.id;
        const fromId = msg.from;
        if (!msgId || !fromId) continue;

        if (await isMessageProcessed(msgId)) continue;
        await markMessageProcessed(msgId, 'whatsapp');

        const msgType = msg.type || 'text';
        let text = '';
        if (msgType === 'text') text = msg.text?.body || '';
        else if (msgType === 'image') text = '[şəkil göndərildi]';
        else if (msgType === 'audio') text = '[səs mesajı göndərildi]';
        else if (msgType === 'video') text = '[video göndərildi]';
        else text = `[${msgType} mesajı]`;

        const convId = await persistMessage({
          platform: 'whatsapp',
          userExternalId: fromId,
          userName: nameMap[fromId] || '',
          messageId: msgId,
          direction: 'inbound',
          text,
          by: 'customer',
        });

        // AI auto-reply
        if (
          cfg.global_enabled &&
          cfg.wa_enabled &&
          msgType === 'text' &&
          (await getConvAiEnabled(convId))
        ) {
          try {
            const history = await getConversationHistory(convId, 8);
            // Drop the just-added message from history
            const ctx = history.filter((h) => h.id !== msgId);
            const reply = await generateAiReply({
              cfg,
              platform: 'whatsapp',
              inboundText: text,
              history: ctx,
            });
            if (reply) {
              const sendRes = await sendWhatsAppText({ cfg, toPhone: fromId, text: reply });
              if (sendRes.success) {
                await persistMessage({
                  platform: 'whatsapp',
                  userExternalId: fromId,
                  userName: nameMap[fromId] || '',
                  messageId: sendRes.message_id || `ai_${msgId}_${Date.now()}`,
                  direction: 'outbound',
                  text: reply,
                  by: 'ai',
                });
              } else {
                console.warn('[wa-webhook] AI send failed', sendRes);
              }
            }
          } catch (e) {
            console.error('[wa-webhook] AI reply error', e);
          }
        }
      }
    }
  }
}
