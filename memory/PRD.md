# De Valeur — Product Requirements Doc

## Original problem
Site: De Valeur (luxury watches/accessories, Vite + React + Firebase + Vercel serverless).
Issue: "bu saytdakı ai chat bölməsi işləmir" — the on-site AI sales chat widget was broken.
User provided NVIDIA Integrate API credentials + model (openai/gpt-oss-20b) and asked to fix the chat.

Later request (2026-07-07): "AI ilə SEO et bütün məhsullara" — use AI to generate SEO for all products.

## What was implemented

### 2026-01-07 — NVIDIA-powered AI chat
- Switched AI chat provider from OpenAI to NVIDIA Integrate API (OpenAI-compatible).
  - `/app/api/chat.js` (Vercel serverless): now calls `https://integrate.api.nvidia.com/v1/chat/completions` with model `openai/gpt-oss-20b`.
  - `/app/backend/server.py` `/api/chat`: replaced `emergentintegrations.LlmChat` with direct httpx call to the same NVIDIA endpoint.
  - `/app/api/ai-inbox/_shared.js` (WhatsApp/Instagram inbox): default OpenAI base URL now points to NVIDIA and unknown gpt-4 models fall back to `openai/gpt-oss-20b`.
- `session_id` in FastAPI `ChatRequest` is now optional (frontend contract mirrors Vercel API which doesn't pass it → previously produced 422).
- Added Vite dev-proxy `/api → http://localhost:8001` so the widget works in preview identically to production Vercel behaviour.
- `max_tokens` raised to 4096 and reply extraction now falls back to `reasoning_content` when `content` is empty (gpt-oss quirk).

### 2026-07-07 — AI SEO for all products
- **Backend** (`/app/backend/server.py`):
  - New endpoint `POST /api/seo/generate` — takes one product's data (multilingual name/desc, brand, category, gender, price) and returns AI-generated SEO metadata in **AZ / RU / EN**.
  - Uses NVIDIA `openai/gpt-oss-20b` with `reasoning_effort=low` and `max_tokens=4096` so JSON output is emitted reliably.
  - Robust JSON extractor tolerates fenced/leading commentary in gpt-oss output.
  - Auto-generates URL slug from brand + English name with Azerbaijani → ASCII transliteration.
  - Response shape: `{ success, seo: { az, ru, en, slug }, error?, raw? }` where each lang block has `title`, `description`, `keywords`, `imageAlt`.
- **Types** (`/app/src/types/index.ts`): extended `Product` interface with optional `seo` object (title, description, keywords, imageAlt each keyed by az/ru/en + slug + generatedAt + generatedBy).
- **Admin UI** (`/app/src/components/admin/AiSeoTab.tsx`):
  - New "AI SEO" tab under **AI & Analitika** section in the admin panel.
  - Shows overall SEO coverage (X / Y products).
  - Product list with SEO status badges (green = has SEO, gray = missing).
  - Per-product **AI ilə yarat / Yenidən yarat** button.
  - Batch runner: **"Boş olanları AI ilə doldur"** — iterates through filtered products, saves each result to Firestore immediately, with pause/resume/stop controls and live progress bar.
  - Preview per language (AZ / RU / EN switcher) with character-length badges to flag titles/descriptions outside SEO best-practice ranges.
  - Expandable rows show full 3-language breakdown + copyable slug.
  - Log panel with success/failure list.
- **Product page SEO injection** (`/app/src/pages/ProductPage.tsx`):
  - New `useEffect` reads `product.seo` and dynamically updates `<title>`, `<meta name="description">`, `<meta name="keywords">`, Open Graph (`og:title`, `og:description`, `og:type=product`, `og:image`, `og:image:alt`, `og:url`), Twitter Card, and canonical URL.
  - Injects JSON-LD `Product` schema with brand, offers (price/availability), sku, image — enables Google rich results.
  - Falls back to product name/description when AI SEO not yet generated so pages are never SEO-empty.
  - Product image `alt` now uses AI-generated imageAlt when available.

## Verified
- `POST /api/chat` returns valid Azerbaijani sales reply with `[[PRODUCT:ID]]` markers.
- `POST /api/seo/generate` (tested via localhost + preview URL) returns proper AZ/RU/EN SEO JSON in ~5–10s per product with valid Cyrillic Russian, Azerbaijani (ə/ı/ö/ü/ç/ş/ğ), and idiomatic English.
- Admin panel builds without TS errors; new AI SEO tab appears under "AI & Analitika" group.
- Product page dynamically writes SEO tags to `<head>` on route change (verified in code — ProductPage useEffect).

## Backlog / next
- P1: Also update `/app/api/og-product.js` serverless OG image generator to read the AI-generated `imageAlt` for social share cards.
- P1: Client-side sitemap.xml regeneration to include new slugs.
- P2: Bulk export of all SEO data to Excel/CSV for the marketing team.
- P2: Unit test for `POST /api/seo/generate` in CI to catch provider regressions.
- P2: Add "translate existing SEO" button in case Firestore already has manual az-only SEO.

## Enhancement idea (upsell)
Because the site now has structured SEO per language, a great next step for revenue would be to generate **Google Merchant Center product feeds** (XML) directly from the same `product.seo` data — enabling free Google Shopping listings and pushing high-intent buyers straight to product pages.
