# De Valeur — AI Chat Frontend Migration

## Original problem statement
"sk-proj-... bu mənim keyimdir, ən ucuzu olsun chatgpt mini gpt-4o-mini, AI chat frontend-də olsun."

## What was done (Jan 2026)
- AI chat (De Valeur AI assistant) moved from FastAPI backend (`/api/chat`) to **direct OpenAI call from the browser**.
- New file `src/services/aiChatService.ts` replicates the full backend prompt logic (persona, catalog summary, knowledge base, history) and calls `https://api.openai.com/v1/chat/completions` with model **`gpt-4o-mini`** (cheapest GPT-4 class model) using the user-supplied API key from `VITE_OPENAI_API_KEY`.
- `src/components/AiChatWidget.tsx` now imports `sendChatMessage` from the new service instead of `fetch(${BACKEND_URL}/api/chat)`.
- API key is read from `/app/.env` (Vite root). Key was added there.
- Backend `/api/chat` still exists but is no longer called by the frontend.

## Architecture
- **Frontend**: Vite + React + TS at `/app/src` (run via supervisor `frontend`).
- **Chat flow**: User → AiChatWidget → `aiChatService.sendChatMessage` → OpenAI (gpt-4o-mini) → reply with `[[PRODUCT:id]]` markers → widget renders product mini-cards.
- **Catalog**: loaded once via `productService.getAll()` from Firestore on first open.
- **Knowledge base**: loaded via `getAiKnowledge()` from Firestore.

## Security note (must communicate)
The OpenAI key is now embedded in the browser bundle (Vite env var). Anyone visiting the site can extract the key. For production, consider:
- A lightweight server-side proxy (the existing FastAPI `/api/chat` already does this), OR
- A Cloudflare Worker / Vercel Edge Function with the key stored as a server secret, OR
- OpenAI key restrictions + monthly spend cap on the OpenAI dashboard.

## Backlog / next ideas
- P1: Add a simple proxy (cheap, e.g. Vercel function) so the key isn't exposed.
- P2: Streaming responses (token-by-token) for faster perceived speed.
- P2: Per-user rate limiting (since key is exposed).
- P3: Image upload (gpt-4o-mini supports vision) — let customers send a photo of a watch they like.
