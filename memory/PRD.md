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
