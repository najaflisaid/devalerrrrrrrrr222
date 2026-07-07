# De Valeur — Product Requirements Doc

## Original problem
Site: De Valeur (luxury watches/accessories, Vite + React + Firebase + Vercel serverless).
Issue: "bu saytdakı ai chat bölməsi işləmir" — the on-site AI sales chat widget was broken.
User provided NVIDIA Integrate API credentials + model (openai/gpt-oss-20b) and asked to fix the chat.

## What was implemented (2026-01-07)
- Switched AI chat provider from OpenAI to NVIDIA Integrate API (OpenAI-compatible).
  - `/app/api/chat.js` (Vercel serverless): now calls `https://integrate.api.nvidia.com/v1/chat/completions` with model `openai/gpt-oss-20b`.
  - `/app/backend/server.py` `/api/chat`: replaced `emergentintegrations.LlmChat` with direct httpx call to the same NVIDIA endpoint.
  - `/app/api/ai-inbox/_shared.js` (WhatsApp/Instagram inbox): default OpenAI base URL now points to NVIDIA and unknown gpt-4 models fall back to `openai/gpt-oss-20b`.
- `session_id` in FastAPI `ChatRequest` is now optional (frontend contract mirrors Vercel API which doesn't pass it → previously produced 422).
- Added Vite dev-proxy `/api → http://localhost:8001` so the widget works in preview identically to production Vercel behaviour.
- `max_tokens` raised to 4096 and reply extraction now falls back to `reasoning_content` when `content` is empty (gpt-oss quirk).
- Vision (image_url) blocks are text-only fallback in NVIDIA call because `gpt-oss-20b` is text-only.

## Verified
- `POST /api/chat` returns valid Azerbaijani sales reply with `[[PRODUCT:ID]]` markers.
- Chat widget in browser: opens → user message → AI reply displayed. Screenshot confirmed.

## Backlog / next
- P2: When switching site to vision model, restore `image_url` OpenAI multipart payload in `/api/chat.js`.
- P2: Add unit test for `/api/chat` in CI to catch provider regressions.

