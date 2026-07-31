# De Valeur — AI Chat Fix

## Original Problem
User: "ai chat islemir duzelt AQ.Ab8RN6J6B4CZ...pRPYb2hV1ffFjxGjA — gemini api keydir. ele etki forntendde islesimn ve adminde yazdigim qaydalara uygun danissin musderi ile"

Kullanıcı isteği: AI chat müştəri ilə admin panelində yazılan qaydalara uyğun danışsın.

## Fix Applied (14 Jul 2026)
- **Backend AI provider migrated: NVIDIA gpt-oss-20b → Google Gemini (gemini-flash-lite-latest)**
- Backend `/api/chat` endpoint (server.py) rewritten to call Google Generative Language API using user-provided Gemini key.
- Fallback model chain added: `gemini-flash-lite-latest → gemini-3.1-flash-lite → gemini-3-flash-preview → gemini-3.5-flash` — retries automatically on HTTP 429/503 (rate limit / overload).
- Backend `/api/seo/generate` also switched to Gemini for consistency.
- Vercel serverless equivalent (`api/chat.js`) rewritten to use Gemini so production deploys behave the same.
- `load_dotenv()` moved before env-var reads so `backend/.env` values load correctly.
- `backend/.env` created with `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACKS`.
- Root project dependencies installed (`yarn install --ignore-engines`) so Vite dev server starts under supervisor.

## Admin Rules Enforcement (verified)
The `AiKnowledge.aiInstructions` field (Firestore `ai_knowledge/main`) is injected into the Gemini `systemInstruction` under `⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI` with an explicit reminder that admin rules override the persona defaults. Verified by:
- Test 1: instruction "Cavab başında hər zaman 'Salam əziz müştəri!' yaz" → AI complied.
- Test 2: instruction "Kişi məhsulu qadına təklif etmə" → AI recommended only women's watches.
- Test 3 (frontend E2E): "kişi üçün klassik saat, 300 manat" → AI returned real catalog matches (Festina F16822/A2 269 AZN, Ducati DTWGC0002003 299 AZN) rendered as product cards.

## Architecture
- Frontend: Vite + React + TypeScript (`/app/src`), calls `/api/chat` from `AiChatWidget.tsx` → `aiChatService.ts`.
- Backend: FastAPI at :8001 (`/app/backend/server.py`) — hot-reload via supervisor.
- AI provider: Google Gemini REST API (v1beta).
- Vite dev proxy + Kubernetes ingress both route `/api/*` → :8001.
- Vercel deploy path is preserved by the parallel `/app/api/chat.js` serverless function.

## Files Changed
- `/app/backend/server.py`  (Gemini migration + fallback + load_dotenv order)
- `/app/backend/.env`       (created — GEMINI_API_KEY, model, fallbacks)
- `/app/api/chat.js`        (Vercel function rewritten to Gemini)

## Backlog / P1
- Move Gemini API key to Vercel dashboard env var and remove the hard-coded fallback in `api/chat.js`.
- Free-tier quota on some Gemini models is 0 — consider enabling a paid tier for gemini-3.5-flash if premium quality is needed.
- Add token/cost logging per chat session so admin can monitor usage.

## Fix: Epoint Payment Order Not Saved (Jan 2026)
- **Problem**: Customer completed Epoint payment successfully, but order did not appear in admin "customer_orders" section nor in customer's "Sifarişlərim" page.
- **Root cause**: `CartPage.tsx` fired `createCustomerOrder(...)` as a fire-and-forget background write (`orderWritePromise.catch(...)`) then immediately proceeded to open the Epoint iframe. On some connections/paths, the Firestore `setDoc` request was still in-flight when the browser navigated on Epoint's redirect — the write never reached Firestore.
- **Fix**: Reverted the checkout flow to `await createCustomerOrder(...)` before initiating Epoint payment (restores previously-working behaviour). Also updated the gift-card-fully-covers branch and removed the now-unused `reserveCustomerOrderId` import.
- Files changed: `src/pages/CartPage.tsx`.

## Fix: Retry Payment ("Yenidən Ödə") Not Opening Epoint (Jan 2026)
- **Reported**: When customer's initial order payment failed, pressing "Yenidən Ödə" in Sifarişlərim page did nothing.
- **Root cause (2 layers)**:
  1. `MyOrdersPage.handleRetryPayment` used `startEpointPayment` (full-page `window.location.href=` redirect). In embedded/sandbox iframe contexts this can be silently blocked.
  2. Epoint enforces uniqueness on `order_id`. Retrying with the same Firestore doc id caused Epoint to reject with `{status:'error', message:'Duplicate order_id value'}`.
- **Fix**:
  1. Switched retry flow to inline iframe overlay (same pattern as CartPage) using `getEpointRedirectUrl`. Added state, postMessage listener, body-scroll lock, and full-screen overlay with testids `retry-epoint-widget`, `retry-epoint-iframe`, `retry-epoint-close`, `retry-epoint-skeleton`.
  2. Retry now sends a unique per-attempt id: `${firestoreOrderId}-r${Date.now().toString(36)}`. sessionStorage now stores TWO keys: `pending_epoint_order_id` (raw, for Firestore updateDoc) and `pending_epoint_transaction_id` (suffixed, for Epoint /get-status).
  3. `PaymentSuccessPage.finalize` refactored: uses `firestoreOrderId` (raw) for `updateDoc`/`getDoc` and `epointOrderId` (suffixed) for `/get-status`. Regex fallback `/-r[a-z0-9]+$/i` strips suffix from callback data if sessionStorage was cleared.
  4. `PaymentErrorPage` clears both sessionStorage keys.
- Files changed: `src/pages/MyOrdersPage.tsx`, `src/pages/PaymentSuccessPage.tsx`, `src/pages/PaymentErrorPage.tsx`.
- Verified by testing_agent iteration_12 — real epoint.az payment page rendered successfully inside the retry iframe.

## Feature: AI-Powered Product Add (via Barcode/SKU) — Admin Panel (Jan 2026)
- **Kim üçün**: Admin. `Məhsullar → Məhsul əlavə et` bölməsində məhsulu əl ilə doldurmaq əvəzinə barkod və ya SKU daxil edərək AI-nin internet axtarışı ilə avtomatik doldurma.
- **İşləmə axını**:
  1. Admin `Məhsul əlavə et` düyməsinə basır → 'Yeni Məhsul' forması açılır. Formanın yuxarısında AI toggle görünür.
  2. Toggle-i ON edir → barkod/SKU input + Skan et (kamera) + AI Axtar düymələri açılır.
  3. Xüsusi saytlar (istəyə görə) daxil edir (məs: `casio.com, seiko.com`).
  4. AI Axtar → backend `/api/ai/product-lookup` → Gemini + `google_search` tool → struktura salınmış JSON qaytarır (AZ/EN/RU tərcümələri daxil).
  5. Nəticə paneli: ad + təsvir (3 dil tab), brend/model/kateqoriya rozetkaları, xüsusiyyətlər, texniki məlumat, şəkil grid (checkbox seç + ⭐ ilə əsas şəkil təyin et).
  6. `Formaya köçür` düyməsi ilə seçilmiş məlumatlar əsas 'Yeni Məhsul' formasına aktarılır (kateqoriya Firestore-dan ən uyğun olanla eşlənir, yeni yaradılmır).
  7. Admin qiyməti əl ilə yazır (AI qiymət qaytarmır — spec) və `Məhsul əlavə et` düyməsi ilə Firestore-a yazır.
- **Fayllar**:
  - Backend: `/app/api/ai/product-lookup.js` (Vercel serverless, mövcud Gemini API açarını istifadə edir, `google_search` tool ilə web axtarışı, groundinq metadata-dan şəkil URL-ləri, kvota xətası üçün AZ dilli graceful mesaj).
  - Frontend: `/app/src/components/admin/AiProductLookup.tsx` (toggle, barkod input, html5-qrcode kamera skan, AI axtar, nəticə paneli, şəkil grid, apply).
  - İnteqrasiya: `/app/src/components/admin/AdminPanel.tsx` (lazy-import + handleAiApply + `showAddProduct` bloku içində Suspense render).
- **Testing**: iteration_13 UI 100% pass. AI end-to-end axtarış test edilə bilmədi çünki Gemini API açarı kvotası bitib (429 quota exceeded — Google AI Studio-da billing yoxlanmalıdır).
- **Yeni asılılıq**: `html5-qrcode` (kamera barkod skan üçün).
- **Yeni testid-lər**: ai-product-lookup-panel, ai-lookup-toggle, ai-lookup-query, ai-lookup-scan-btn, ai-lookup-search-btn, ai-lookup-loading, ai-lookup-error, ai-lookup-lang-{az|en|ru}, ai-lookup-image-{i}, ai-lookup-image-select-{i}, ai-lookup-image-cover-{i}, ai-lookup-apply-btn, ai-lookup-scanner-modal, ai-lookup-scanner-close.

## 2026-01 · AI Konsultant fixes (session)
- **Statistika (Stats) tab could hang/fail silently** — `computeStats()` executed up to 60 subcollection queries serially, which could time out on slow connections. Now runs them in parallel via `Promise.allSettled`, sample reduced to 40 sessions, added robust timestamp parsing (`seconds`, `toMillis`, `Date`), sorts client-side by lastActive desc, and logs errors to console for easier debugging.
- **Söhbətlər (Conversations) chat pane grew downward without scrolling** — replaced `min-h-[640px]` with bounded `h-[calc(100vh-260px)] max-h-[820px]` on the grid, added `h-full min-h-0` to both panes and inner scroll containers so `overflow-y-auto` actually clips messages inside a fixed viewport.

Files touched:
- `src/services/chatSessionService.ts` — computeStats parallelized + resilient
- `src/components/admin/AiConsultantTab.tsx` — bounded heights + console.error on stats

## 2026-01 · AI Konsultant — Contact capture / Read receipts / Sound test
### Features added
1. **Real customer detection (phone + name capture)**
   - `detectContactInfo()` in `chatSessionService.ts` — regex-based phone extractor (AZ/RU/international) + Az/Ru/En name-pattern detection with stop-word filtering.
   - Customer-side `AiChatWidget` calls `captureSessionContact()` after every user message; stores `contactCaptured`, `contactPhone`, `contactName`, `contactCapturedAt` on the session.
   - Admin-side `AdminChatNotifier` shows a special orange "📞 Əlaqə məlumatları alındı!" toast (with contact name + phone) and plays a distinctive 5-note ascending chime (`playContactCapturedSound`).
   - Contact toasts persist longer (45s vs 15s for regular toasts).
   - `AiConsultantTab` conversation list now shows a "REAL" badge + orange left border + phone number + contact name as title for contacted sessions; the chat header displays the phone as a `tel:` link.

2. **WhatsApp-style read receipts (blue double-check)**
   - Session doc gains `lastReadByCustomerTs` (serverTimestamp).
   - `markSessionRead()` called from `AiChatWidget` whenever the widget is open OR messages update.
   - In `AiConsultantTab` conversations view each admin bubble now shows a `CheckCheck` icon — grey when only "sent", **sky-blue** when the customer's `lastReadByCustomerTs` ≥ the message's ts.

3. **"Sınaq" sound test button**
   - Added next to the mute toggle in Söhbətlər header.
   - Plays `playNewSessionSound()` even when mute is on (temporarily unmutes, then restores state after 1.5s).

Files:
- `src/services/chatSessionService.ts` — new fields + helpers (`markSessionRead`, `detectContactInfo`, `captureSessionContact`)
- `src/components/AiChatWidget.tsx` — call `captureSessionContact` on user send + `markSessionRead` on open/messages
- `src/components/admin/AdminChatNotifier.tsx` — contact toast kind + distinct sound + sticky
- `src/components/admin/AiConsultantTab.tsx` — read-receipt double-check, REAL badge, phone header, Sınaq button
- `src/utils/chatSounds.ts` — `playContactCapturedSound` (5-note ascending)

## 2026-01 · AI Konsultant — Typing indicator / Contacts CRM / AI prompt update
1. **"Yazır…" indikatoru** (`customerTyping`, `customerTypingAt` fields):
   - Customer widget: throttled write to Firestore on textarea change (max once/3s), auto-clear after 4s of inactivity, immediate clear on send/blur.
   - Admin panel: subscribeSession already delivers the field; ConversationsSection re-renders every 2s via `typingTick` interval to hide stale indicators (>8s old). Animated 3-dot bubble via new CSS classes `dv-dot` / `dv-typing-appear` in `src/index.css`.

2. **Kontaktlar CRM (yeni sub-tab)** — `ContactsSection` in `AiConsultantTab.tsx`:
   - Real-time list of sessions with `contactCaptured=true`, sorted by `contactCapturedAt` desc.
   - Search by name / phone / last message.
   - Per-row actions: click-to-copy phone, WhatsApp deep link (`wa.me/…` with pre-filled greeting), `tel:` link, and jump-to-conversation (pre-selects session in Söhbətlər tab via `pendingSelect`).
   - CSV export with UTF-8 BOM, opens in Excel with Azerbaijani characters intact.
   - Empty state guides the admin about how contacts are captured.

3. **AI system prompt update** (`api/chat.js`):
   - Added a "📞 ƏLAQƏ MƏLUMATLARINI TOPLAMA" block to `DEVALEUR_PERSONA`.
   - New `contactCaptured` flag in `POST /api/chat` request. Client (`aiChatService.ts` + `AiChatWidget.tsx`) sends it based on the live session state (`sessionContactCaptured`).
   - Server computes `userTurnCount` from history and injects a contextual instruction:
     - turn 1-2: "don't ask yet"
     - turn 3-4: "now politely ask for name + WhatsApp — once, tied to sales advice"
     - turn 5+: "if already asked and no answer, don't repeat"
     - contactCaptured=true: "customer already shared; do NOT ask again"

Files:
- `src/services/chatSessionService.ts` — `setCustomerTyping` helper + `customerTyping/customerTypingAt` fields.
- `src/components/AiChatWidget.tsx` — throttled typing signal on input, auto-clear on send/blur.
- `src/components/admin/AiConsultantTab.tsx` — ContactsSection component + typing-bubble render + Kontaktlar sub-tab.
- `src/index.css` — `dv-dot` / `dv-typing-appear` keyframes.
- `src/services/aiChatService.ts` — pass `contactCaptured` to backend.
- `api/chat.js` — extended persona + turn-aware `contactHint`.

## 2026-01 · AI Konsultant + Analytics — Codes / Sort / Active / Live visitors
1. **5-digit deterministic customer code** (`sessionShortCode`):
   - djb2 hash → 5-digit number (10000-99999) derived from session id.
   - Session list, conversation header and avatar now show `#12345` instead of `Müştəri abcdef` / first 2 UUID chars. Contacts with a captured name keep the real name.

2. **Session start timestamp** (`formatSessionStart` → `DD.MM.YY HH:MM`):
   - Session list right column now shows the session start time (e.g. `01.01.26 11:50`) instead of relative "5 dəq" of last active. Chat header adds "başladı 01.01.26 11:50" next to language/msg count.

3. **Sort by last customer message**:
   - New `lastUserMessageAt` field written by `logMessage` when role=`user`.
   - `subscribeAllSessions` now sorts client-side by `lastUserMessageAt` desc (fallback `lastActive`). Whoever wrote last floats to the top.

4. **Customer sound + unread badge when widget is minimised**:
   - `AiChatWidget` no longer tears down its Firestore subscriptions when the panel closes — subscription lives for the component lifetime. `playCustomerReceiveSound()` keeps firing on new admin messages.
   - New `unreadAdminCount` counter renders a pulsing red badge (with `9+` cap) on the launcher pill when admin messages arrive while the panel is closed. Cleared on next open.

5. **Green online dot for active customers**:
   - `isSessionActive(s)` = `customerTyping` still-fresh OR `lastActive` within last 3 min.
   - Session list avatar gets a pulsing emerald dot + inline `· aktiv` tag; chat header shows an "onlayn" chip too.
   - ConversationsSection tick timer (`setTypingTick`) runs every 2 s regardless of selection so stale "active" states fade automatically.

6. **Live visitor count in Analitika**:
   - New `services/presenceService.ts` — Page-Visibility-aware heartbeat every 25 s writes `sitePresence/{tabId}` doc (lastSeen/path/referrer/UA). SessionStorage-scoped tab id avoids inflating counts on refresh; best-effort delete on `pagehide`.
   - `subscribeLiveVisitors` filters to docs with `lastSeen < 60s` and re-emits every 15 s so stale visitors drop off cleanly.
   - `AnalyticsTab` renders a full-width emerald "Canlı ziyarətçilər" hero banner above the KPI cards: pulsing count + top 4 pages by visitor count with page names ("Ana səhifə", `/products/…`, etc.).
   - Hooked into `App.tsx` — idle-callback deferred so it doesn't slow first paint.

Files touched:
- `src/services/chatSessionService.ts` — `sessionShortCode`, `formatSessionStart`, `lastUserMessageAt`, client-side sort
- `src/services/presenceService.ts` — NEW (heartbeat + subscribe helpers)
- `src/App.tsx` — mounts the presence heartbeat lazily
- `src/components/AiChatWidget.tsx` — long-lived subscription + unread badge
- `src/components/admin/AiConsultantTab.tsx` — codes, start times, active dot, ticker
- `src/components/admin/AnalyticsTab.tsx` — LiveVisitorsBanner + subscribeLiveVisitors wiring

Notes:
- `sitePresence` collection is written by every visitor — Firestore free-tier friendly for a boutique storefront (≈ 4 writes/min per open tab).
- Presence docs are shallow (path/UA/lastSeen). Consider a scheduled cloud function later to prune docs older than 24h if the collection grows.
