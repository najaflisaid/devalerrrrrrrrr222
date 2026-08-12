# De Valeur — PRD

Existing luxury watches/accessories e-commerce. Stack: React + Vite + TypeScript, Firebase/Firestore/Auth/Storage, FastAPI backend (AI chat, Epoint payments, WhatsApp). Preview: https://ai-chat-share-3.preview.emergentagent.com

## Feature: Zəmanət Servisi (Warranty / Service Handover) — added 2026-06
Goal: When a customer has a product problem, they hand the product to a store branch, sign a handover act; the store worker accepts it to service; admin advances status; when the repaired item returns to the branch the customer is notified and signs to pick it up.

### User decisions
- Customer registers normally (existing phone-based auth), then accesses warranty from the **menu** (not a separate public link).
- Act fields kept minimal (name/surname come from account): **brand, model number, fault description, branch**, + finger/mouse **signature**.
- Admin **accepts to service by selecting a worker's name** (from existing workers). Status "Servisə qəbul olundu" shows on the customer page.
- Admin can advance status; when set to **Filiala qaytarıldı (at_branch)** the customer page shows a notification and re-opens a **pickup signature**. Customer signs → completed.

### Implementation
- Service: `src/services/warrantyService.ts` — CRUD + realtime on Firestore collection `warranty_services`.
  Statuses: `submitted → accepted → in_service → at_branch → completed`.
- Customer page: `src/pages/WarrantyServicePage.tsx` at route `/warranty` (login-gated). Create-act form + live list with stepper/status, at_branch pickup signature.
- Admin tab: `src/components/admin/WarrantyServiceTab.tsx` — filters (status + branch), accept (worker dropdown from `workers`, optional worker signature), status buttons (Servisə göndərildi / Filiala qaytarıldı), signatures display, delete. Registered in `AdminPanel.tsx` under "Sifarişlər" group, id `warrantyService`.
- Menu links in `Header.tsx`: desktop `header-warranty-link`, account dropdown `account-warranty`, mobile `mobile-warranty-link` (customer role only).
- Reuses existing `InlineSignaturePad`. Branches from `worker_branches`, brands from products.

### Status
- Customer flow: TESTED end-to-end (iteration_16, 100%). 3 branches load; act created; status badge "Təhvil verildi"; menu links present.
- Admin flow: IMPLEMENTED + compiles (production build passes) but NOT yet verified end-to-end — needs an admin login credential.

### Backlog / Next
- P0: Verify admin-side flow (accept → status → at_branch → customer pickup) with an admin account.
- P1: Optional WhatsApp/notification push when status becomes at_branch (currently in-app only on the link).
- P2: Use Firestore auto-id / counter for act numbers instead of Date.now() slice.

## Fix: Instagram Story share — product image not loading + minimalist redesign (2026-06)
- Root cause: product images are on Cloudflare R2 / external CDNs (e.g. cdn.saatvesaat.com.tr). The Story canvas loads them via same-origin proxy /api/img-proxy. Production (Vercel) had NO img-proxy function (404); preview FastAPI proxy had a host whitelist that excluded external CDNs → canvas drew a placeholder.
- Fixes: (1) added /api/img-proxy handler inside existing api/og.js (reused to stay under Vercel function limit) + vercel.json rewrite /api/img-proxy → /api/og?type=img-proxy; (2) relaxed backend/server.py img-proxy to allow any public host with an SSRF guard; (3) redesigned minimal/pure/silhouette templates to smooth white→soft-tint gradients (no hard split) keeping brand/price/6-month credit.
- Verified: iteration_18 — backend proxy 200 + ACAO:* for arbitrary + real product hosts; end-to-end modal renders the product on all templates, no CORS/error warning; pixel-stat confirms real content. Works via same-origin proxy on iOS too.

## Feature: Category view analytics (2026-06)
- Tracks how many times each category listing is opened. analyticsService.trackCategoryView() → Firestore 'category_view_counts/{slug}' {category,count,lastViewed}, 60s per-category throttle. Hooked in ProductsPage when ?category= is active.
- Admin → Analitika → Ümumi statistika: new 'Kateqoriya baxışları' card shows MOST viewed + LEAST viewed category with counts, plus a ranked list with bars and delete.
- Verified: iteration_19 (100%).

## Feature: Brand views + Category trend analytics (2026-06)
- trackBrandView() → 'brand_view_counts/{slug}' (60s throttle), hooked in ProductsPage on ?brand=. Admin card 'Brend baxışları' = most/least viewed brands + counts + ranked list.
- trackCategoryView() now also writes daily bucket 'category_view_daily/{slug}__{date}'. getCategoryTrends() aggregates last7 vs prev7 (+%/'yeni') and last30. Admin card 'Kateqoriya trendi'.
- Verified: iteration_20 (100%). Trend uses data collected going forward (prev-7 empty at launch → shows 'yeni').

## Fix + Feature: Admin chat notifications & Telegram (2026-06)
- SlowReplyBar: one X dismisses ALL waiting chats, auto-hides after 10s, shows once per new waiting chat. (tested iteration_21)
- Unviewed chats: AiConsultantTab chat list highlights admin-unviewed sessions blue + dot (session-unviewed-<id>); clears on view; persists via localStorage 'dv_admin_chat_seen_v1'. (tested iteration_21)
- Telegram: server-side notify (token/chat_id in env). FastAPI POST /api/telegram/notify + GET /api/telegram/chat-info (find group id). Vercel: og.js ?type=telegram-notify + rewrite /api/telegram/notify. Frontend AiChatWidget fires notifyNewChat (first user msg) + notifyContact (phone shared). backend/.env has TELEGRAM_BOT_TOKEN (token valid: @De_valeur_assistant_bot), TELEGRAM_CHAT_ID=-5447107741 (group 'De Valeur'). ACTIVE in preview (test sends ok:true). for prod set Vercel env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.

## Fix: AI chatbot not working (2026-06)
- Root cause: preview backend had no GEMINI_API_KEY (backend/.env didn't exist) → /api/chat returned 500.
- Fix: added GEMINI_API_KEY (existing key from api/chat.js fallback) to backend/.env. Model gemini-flash-lite-latest. Verified iteration_22 (100%). Production (Vercel api/chat.js) already has same key as fallback.

## Session 2026-06 (re-uploaded zip): AI chat + admin behavior rules + Telegram fixes
- Root cause across all issues: uploaded ZIP did not include backend/.env, so GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID were all empty. Also Vite deps not installed at /app root (frontend FATAL: 'vite: not found').
- Fix 1 (AI chat): recreated /app/backend/.env with GEMINI_API_KEY (gemini-flash-lite-latest). Ran `yarn install --ignore-engines` at /app root (node 20 vs supabase engine req). Chat verified iteration_23 (100%).
- Fix 2 (admin behavior rules): backend ChatKnowledge model was missing conversationExamples → dialogue examples set in admin panel (AiKnowledgeTab) were dropped. Added ChatConversationExample model + conversationExamples formatting in _format_knowledge (server.py) mirroring api/chat.js. aiInstructions ('🎯 AI Davranış Komandaları') already worked as top-priority prompt section; verified AI obeys custom rules + examples via curl.
- Fix 3 (Telegram): added TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID=-5447107741 (group 'De Valeur') to backend/.env. GET /api/telegram/chat-info raw_ok:true; POST /api/telegram/notify returns ok:true for new_session + contact. Frontend AiChatWidget fires notifyNewChat on first customer msg + notifyContact on phone. Verified iteration_24 (100%).
- NOTE: backend/.env holds secrets and is git-ignored — will be lost if the app is re-zipped/exported. For Vercel prod, set the same env vars in the Vercel dashboard.
