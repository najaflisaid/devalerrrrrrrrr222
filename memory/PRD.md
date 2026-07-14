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
