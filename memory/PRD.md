# De Valeur — AI Inbox (WhatsApp & Instagram) PRD

## Original Problem Statement
> "admin panelde bir bolme yarat ve men isdeyiremki vatsap ve instagram mesajlarimi AI ozu cavablasin musderilerin yazdiqi mesajlari"

Translation: Create an admin panel section where AI auto-replies to WhatsApp and Instagram customer messages.

User choices (Jan 2026):
- Best AI — admin must be able to change provider/model/API key from the admin panel
- Real WhatsApp Business API + Instagram Graph API (no demo / one-shot ready)
- All admin functions, mobile-responsive
- Language: Azerbaijani UI

## Architecture
- Existing stack reused: FastAPI backend (`/app/backend/server.py`), React + TypeScript + Vite frontend (`/app/src`), Firebase Firestore for persistence, `emergentintegrations.llm.chat.LlmChat` for AI calls (Emergent Universal LLM Key — supports OpenAI, Anthropic, Gemini).
- New backend endpoints:
  - `GET/POST /api/webhooks/whatsapp` — Meta verification + inbound receiver
  - `GET/POST /api/webhooks/instagram` — Meta verification + inbound receiver
  - `GET/POST /api/admin/ai-inbox/config` — admin config CRUD
  - `GET /api/admin/ai-inbox/conversations` + `/messages` + `/reply` + `/toggle-ai`
  - `POST /api/admin/ai-inbox/test` — AI preview
- New frontend tab: `AiInboxTab.tsx` under "AI & Analitika" group.
- Webhook signature verification via `X-Hub-Signature-256` HMAC-SHA256 (bypassed when secret empty in dev mode).
- Pipeline: inbound webhook → Firestore dedupe by message id → persist → AI generate (if enabled) → send via WhatsApp Cloud / Instagram Graph API → persist outbound.

## What's been implemented (2026-01-28)
- ✅ Backend AI Inbox module (~600 lines) appended to `server.py`.
- ✅ Frontend `AiInboxTab.tsx` (3 sub-tabs: Inbox / AI Settings / Setup guide), responsive.
- ✅ Added to AdminPanel sidebar, added `aiInbox` to `DEFAULT_OPEN_SECTIONS`.
- ✅ EMERGENT_LLM_KEY env added; default Az persona configured.
- ✅ Backend testing: 19/19 pytest cases PASS. Real AI reply confirmed in Azerbaijani.

## Prioritized backlog
**P0** — Mount Firebase Admin service account JSON in production (currently dev returns 503 on config writes). Admin must paste real `META_APP_SECRET` from Settings tab.

**P1** — Background task for AI generation (return 200 in <2s); media inbound (image/audio); WhatsApp template fallback outside 24h window.

**P2** — Per-customer tags/notes; sentiment labels; AI analytics tab.

## Next tasks
1. Provide Firebase service account JSON in production.
2. Admin → AI Inbox → Settings → fill IG Page ID + Page Access Token + Meta App Secret → enable global AI.
3. Configure Meta App Dashboard webhooks (URLs + verify token from Setup tab).
4. Send test WhatsApp/Instagram message — verify auto-reply.
