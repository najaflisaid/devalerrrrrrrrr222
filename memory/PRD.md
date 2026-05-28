# De Valeur — AI Inbox (WhatsApp & Instagram) PRD

## Original Problem Statement
> "admin panelde bir bolme yarat ve men isdeyiremki vatsap ve instagram mesajlarimi AI ozu cavablasin musderilerin yazdiqi mesajlari"

Followup: "backendde olmasin cunki men ancaq frontendi paylasiram" — User only ships the frontend repo (Vite + React) deployed to Vercel. No separate Python backend.

## Architecture (frontend-only, Vercel-deployed)
- **Vercel Serverless Functions** at `/app/api/*` (Node.js ESM) — auto-deployed with the Vite build:
  - `/api/webhooks/whatsapp.js` — GET verification + POST inbound message receiver + AI auto-reply + Meta send
  - `/api/webhooks/instagram.js` — same for Instagram DMs
  - `/api/ai-inbox/test.js` — AI preview (admin clicks "Cavabı yarat")
  - `/api/ai-inbox/reply.js` — manual admin reply (sends via Meta Graph API)
  - `/api/ai-inbox/_shared.js` — shared helpers: Firestore REST, Meta signature, AI providers (OpenAI / Anthropic / Gemini), WhatsApp/Instagram send
- **Persistence**: Firebase Firestore — collections `siteSettings/aiInbox`, `aiInboxConversations/{id}` + `messages` subcollection, `aiInboxProcessed/{messageId}` for dedup. Firestore security rules already allow public read/write (existing app design), so serverless functions use the REST API directly with no service account.
- **Frontend** (`/app/src/components/admin/AiInboxTab.tsx`):
  - Real-time inbox via `onSnapshot` (no polling)
  - 3 sub-tabs: Söhbətlər (Inbox) / AI Parametrləri / Quraşdırma
  - Settings write directly to Firestore from client SDK (admin role already gated)
  - Manual reply calls `/api/ai-inbox/reply` (serverless)
  - AI test calls `/api/ai-inbox/test` (serverless, uses current form config)
- Admin can change: provider (OpenAI/Anthropic/Gemini), model, custom AI API key, persona, WhatsApp creds, Instagram creds, Meta verify token, Meta app secret. All persisted in Firestore.

## What's been implemented (2026-01-28)
- ✅ 5 Vercel serverless function files (`/app/api/ai-inbox/`, `/app/api/webhooks/`)
- ✅ AiInboxTab.tsx rewritten to use Firebase client SDK + serverless functions (no Python backend dependency)
- ✅ Sidebar entry under "AI & Analitika" → "AI Inbox (WhatsApp & Instagram)"
- ✅ `aiInbox` added to `DEFAULT_OPEN_SECTIONS` so opens without password
- ✅ Python backend modifications reverted (the `/app/backend/server.py` AI Inbox block removed — only the existing De Valeur backend stays untouched)
- ✅ UI verified rendering all 3 sub-tabs on preview environment

## Required env vars (Vercel dashboard) — OPTIONAL
- `OPENAI_API_KEY` — fallback for OpenAI provider when admin hasn't set a custom key. Default is hardcoded same key as `/api/chat.js`.
- `META_VERIFY_TOKEN` — fallback verify token (default `devaleur-meta-2026`, also editable from admin UI).
- `META_APP_SECRET` — webhook HMAC signature verification (also editable from admin UI; admin UI value wins).

## Required Meta Dashboard config (one-time)
1. WhatsApp product → Webhook callback `https://YOUR_DOMAIN/api/webhooks/whatsapp` + verify token from Setup tab; subscribe to `messages` + `message_status`.
2. Instagram product → Webhook callback `https://YOUR_DOMAIN/api/webhooks/instagram` + same verify token; subscribe to `messages`.
3. App Settings → Basic → copy App Secret → paste into AI Inbox → Settings → Meta Webhook Security.

## Prioritized backlog
**P0** — Admin pastes WhatsApp + Instagram credentials (Page ID + Access Token + App Secret) into AI Inbox → Settings. Toggles "Bütün AI cavablar" on.

**P1** — Media handling for inbound (image/audio analysis), WhatsApp template fallback outside 24h window.

**P2** — Per-customer tags/notes, AI analytics tab, voice transcription.

## Next tasks
1. Deploy to Vercel (push to GitHub → "Save to Github" feature).
2. Configure Meta Dashboard webhooks per Setup tab instructions.
3. Send test WhatsApp/Instagram message → verify auto-reply in inbox.
