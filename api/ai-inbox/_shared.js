/**
 * Shared helpers for AI Inbox serverless functions.
 * - Reads/writes Firestore via REST API (rules are open in this project).
 * - Calls AI providers (OpenAI / Anthropic / Gemini).
 * - Sends messages via WhatsApp Cloud API / Instagram Graph API.
 *
 * No external NPM dependencies — uses native fetch.
 */

const FIREBASE_PROJECT_ID = 'devaleur-11742';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const DEFAULT_PERSONA =
  'Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi WhatsApp/Instagram müştəri xidmətləri köməkçisisən. ' +
  'Müştərilərə Azərbaycan dilində (və ya yazıldığı dildə) mehriban, peşəkar və qısa cavab ver. ' +
  'Saat brendləri, ödəniş, çatdırılma, qaytarma haqqında kömək et. Konkret məhsul soruşulsa, müştərini saytımıza yönləndir: https://devaleur.az. ' +
  'Cavablar maks 3-4 cümlə olsun, robot kimi deyil, təbii danışıq tonunda.';

// ---------------------------------------------------------------------------
// Firestore REST helpers (rules are open in this project)
// ---------------------------------------------------------------------------

const encodeValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue) } };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const k of Object.keys(v)) fields[k] = encodeValue(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
};

const decodeValue = (f) => {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return parseInt(f.integerValue, 10);
  if ('doubleValue' in f) return f.doubleValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('nullValue' in f) return null;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in f) {
    const out = {};
    const fs = f.mapValue.fields || {};
    for (const k of Object.keys(fs)) out[k] = decodeValue(fs[k]);
    return out;
  }
  return null;
};

const decodeDoc = (doc) => {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const k of Object.keys(doc.fields)) out[k] = decodeValue(doc.fields[k]);
  return out;
};

const encodeFields = (obj) => {
  const fields = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    fields[k] = encodeValue(obj[k]);
  }
  return fields;
};

export async function firestoreGetDoc(path) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET failed: ${r.status}`);
  const data = await r.json();
  return decodeDoc(data);
}

export async function firestoreSetDoc(path, obj, merge = true) {
  const fields = encodeFields(obj);
  // PATCH with updateMask for merge, or without for full replace
  let url = `${FIRESTORE_BASE}/${path}`;
  if (merge) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const params = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    url += `?${params}`;
  }
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Firestore PATCH ${path} failed: ${r.status} ${t.slice(0, 200)}`);
  }
}

export async function firestoreCreateDocWithId(collection, id, obj) {
  // Use PATCH (idempotent set with id)
  await firestoreSetDoc(`${collection}/${id}`, obj, false);
}

// ---------------------------------------------------------------------------
// AI Inbox config
// ---------------------------------------------------------------------------

export async function getAiInboxConfig() {
  const defaults = {
    global_enabled: false,
    wa_enabled: true,
    ig_enabled: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    use_custom_key: false,
    custom_api_key: '',
    persona: DEFAULT_PERSONA,
    instagram_page_id: '',
    instagram_access_token: '',
    instagram_api_version: 'v22.0',
    whatsapp_phone_id: '',
    whatsapp_access_token: '',
    whatsapp_api_version: 'v22.0',
    meta_verify_token: process.env.META_VERIFY_TOKEN || 'devaleur-meta-2026',
    meta_app_secret: process.env.META_APP_SECRET || '',
  };
  try {
    const doc = await firestoreGetDoc('siteSettings/aiInbox');
    if (!doc) return defaults;
    return { ...defaults, ...doc };
  } catch (e) {
    console.error('[ai-inbox] config read failed', e);
    return defaults;
  }
}

// ---------------------------------------------------------------------------
// Meta signature verification (X-Hub-Signature-256)
// ---------------------------------------------------------------------------

import crypto from 'crypto';

export function verifyMetaSignature(rawBodyBuf, signatureHeader, appSecret) {
  if (!appSecret) return true; // dev mode bypass
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  const mac = crypto.createHmac('sha256', appSecret).update(rawBodyBuf).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(mac));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// AI provider calls
// ---------------------------------------------------------------------------

function resolveAiKey(cfg) {
  if (cfg.use_custom_key && (cfg.custom_api_key || '').trim()) return cfg.custom_api_key.trim();
  // Fall back to shared OpenRouter key so provider works out of the box on Vercel
  // without extra env setup (OpenAI-compatible endpoint).
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.EMERGENT_LLM_KEY ||
    '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'
  );
}

export async function generateAiReply({ cfg, platform, inboundText, history }) {
  const provider = cfg.provider || 'openai';
  const model = cfg.model || 'gpt-4o-mini';
  const apiKey = resolveAiKey(cfg);
  if (!apiKey) throw new Error('AI API açarı təyin edilməyib');

  const persona = (cfg.persona || DEFAULT_PERSONA).trim();
  const systemMessage =
    persona + `\n\nKanal: ${platform.toUpperCase()}. Müştəri ilə birbaşa söhbət edirsən.`;

  // Build chat history (last 6 turns)
  const recent = (history || []).slice(-6);
  const messages = [{ role: 'system', content: systemMessage }];
  for (const h of recent) {
    if (!h.text) continue;
    messages.push({
      role: h.direction === 'outbound' ? 'assistant' : 'user',
      content: h.text,
    });
  }
  messages.push({ role: 'user', content: inboundText });

  if (provider === 'openai') {
    // Use OpenRouter (OpenAI-compatible) endpoint by default so the
    // shared OpenRouter key works out of the box. Override with env if needed.
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    const useModel = model && model.startsWith('gpt-4') ? 'openai/gpt-oss-20b:free' : model;
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://devaleur.az',
        'X-Title': process.env.OPENROUTER_TITLE || 'De Valeur AI Inbox',
      },
      body: JSON.stringify({ model: useModel, messages, temperature: 0.5, max_tokens: 400 }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`AI ${r.status}: ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    return (data?.choices?.[0]?.message?.content || '').trim();
  }

  if (provider === 'anthropic') {
    // Anthropic Messages API – separate system + messages (without system role)
    const anthMsgs = messages.filter((m) => m.role !== 'system');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: systemMessage,
        messages: anthMsgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Anthropic ${r.status}: ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    const parts = data?.content || [];
    return parts.map((p) => p.text || '').join('').trim();
  }

  if (provider === 'gemini') {
    // Gemini generateContent API
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemMessage }] },
        generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Gemini ${r.status}: ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return text.trim();
  }

  throw new Error(`Naməlum provider: ${provider}`);
}

// ---------------------------------------------------------------------------
// Outbound senders (Meta Graph API)
// ---------------------------------------------------------------------------

function normalizePhone(phone) {
  let cleaned = String(phone || '').replace(/[^\d]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  return cleaned;
}

export async function sendWhatsAppText({ cfg, toPhone, text }) {
  // Read WhatsApp creds — first from aiInbox config, fall back to legacy siteSettings/whatsapp doc
  let phoneId = cfg.whatsapp_phone_id || '';
  let token = cfg.whatsapp_access_token || '';
  const apiVersion = cfg.whatsapp_api_version || 'v22.0';
  if (!phoneId || !token) {
    try {
      const legacy = await firestoreGetDoc('siteSettings/whatsapp');
      if (legacy) {
        phoneId = phoneId || legacy.phone_id || '';
        token = token || legacy.access_token || '';
      }
    } catch {
      /* ignore */
    }
  }
  if (!phoneId || !token) {
    return { success: false, error: 'whatsapp_not_configured', message: 'WhatsApp credentials yoxdur' };
  }
  const to = normalizePhone(toPhone);
  if (to.length < 9) return { success: false, error: 'invalid_phone' };

  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (r.ok) {
    return { success: true, message_id: body?.messages?.[0]?.id, raw: body };
  }
  return {
    success: false,
    error: body?.error?.type || `http_${r.status}`,
    code: body?.error?.code,
    message: body?.error?.message || 'WhatsApp send failed',
    raw: body,
  };
}

export async function sendInstagramText({ cfg, recipientIgsid, text }) {
  const pageId = cfg.instagram_page_id || '';
  const token = cfg.instagram_access_token || '';
  const apiVersion = cfg.instagram_api_version || 'v22.0';
  if (!pageId || !token) {
    return { success: false, error: 'instagram_not_configured', message: 'Instagram credentials yoxdur' };
  }
  const url = `https://graph.facebook.com/${apiVersion}/${pageId}/messages`;
  const payload = {
    recipient: { id: recipientIgsid },
    message: { text },
    messaging_type: 'RESPONSE',
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (r.ok) {
    return { success: true, message_id: body?.message_id, raw: body };
  }
  return {
    success: false,
    error: body?.error?.type || `http_${r.status}`,
    code: body?.error?.code,
    message: body?.error?.message || 'Instagram send failed',
    raw: body,
  };
}

// ---------------------------------------------------------------------------
// Conversation persistence (Firestore)
// ---------------------------------------------------------------------------

export function convDocId(platform, userExternalId) {
  const prefix = platform === 'whatsapp' ? 'wa' : 'ig';
  const safe = String(userExternalId || '').replace(/[^a-zA-Z0-9]/g, '');
  return `${prefix}_${safe}`;
}

export async function persistMessage({
  platform,
  userExternalId,
  userName,
  messageId,
  direction,
  text,
  by, // 'customer' | 'ai' | 'admin'
}) {
  const convId = convDocId(platform, userExternalId);
  const convPath = `aiInboxConversations/${convId}`;
  const existing = await firestoreGetDoc(convPath);
  const now = new Date();

  if (!existing) {
    await firestoreSetDoc(
      convPath,
      {
        id: convId,
        platform,
        user_external_id: String(userExternalId),
        user_name: userName || String(userExternalId),
        ai_enabled: true,
        created_at: now,
        updated_at: now,
        last_message: (text || '').slice(0, 200),
        last_direction: direction,
        unread_count: direction === 'inbound' ? 1 : 0,
      },
      false // overwrite (new doc)
    );
  } else {
    const update = {
      updated_at: now,
      last_message: (text || '').slice(0, 200),
      last_direction: direction,
    };
    if (userName && userName !== existing.user_name) update.user_name = userName;
    if (direction === 'inbound') {
      update.unread_count = (existing.unread_count || 0) + 1;
    }
    await firestoreSetDoc(convPath, update, true);
  }

  await firestoreCreateDocWithId(`aiInboxConversations/${convId}/messages`, messageId, {
    id: messageId,
    direction,
    text: text || '',
    by: by || 'customer',
    created_at: now,
  });

  return convId;
}

export async function isMessageProcessed(messageId) {
  const doc = await firestoreGetDoc(`aiInboxProcessed/${messageId}`);
  return Boolean(doc);
}

export async function markMessageProcessed(messageId, platform) {
  await firestoreCreateDocWithId('aiInboxProcessed', messageId, {
    at: new Date(),
    platform,
  });
}

export async function getConversationHistory(convId, limit = 8) {
  // Firestore REST: list messages, then sort + limit client-side
  const url = `${FIRESTORE_BASE}/aiInboxConversations/${convId}/messages?pageSize=50&orderBy=created_at%20desc`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    const docs = (data.documents || []).map(decodeDoc).filter(Boolean);
    docs.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    return docs.slice(-limit);
  } catch {
    return [];
  }
}

export async function getConvAiEnabled(convId) {
  const doc = await firestoreGetDoc(`aiInboxConversations/${convId}`);
  if (!doc) return true;
  return doc.ai_enabled !== false;
}

// CORS helper
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');
}

// Read raw body for signature verification
export async function readRawBody(req) {
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf8');
  }
  // Fallback – stream read
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
