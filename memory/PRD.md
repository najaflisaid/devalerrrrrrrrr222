# DE VALEUR — PRD

## Original problem statement
DE VALEUR e-commerce sayt (Vite + React + TypeScript + Firebase + FastAPI). User uploaded existing project. Iterative changes requested via Azerbaijani.

## What's implemented (running log)

### Iteration 1 — Phone-based auth (May 2026)
- Replaced email login/registration with phone-only flow
- Synthetic email format: `phone994XXXXXXXXX@devaleur.az` (Firebase Auth requires email)
- +994 prefix automatic, user enters 9 digits
- Cart guest checkout: removed email field, only Name + Surname + Address + Phone
- Backward-compat fallback for legacy users registered with real email

### Iteration 2 — WhatsApp password-reset infrastructure (May 2026)
**Backend (`/app/backend/server.py`):**
- Firebase Admin SDK initialised (graceful — endpoints return 503 if service-account JSON missing)
- WhatsApp Cloud API service: `whatsapp_send_text`, `whatsapp_send_template`
- Endpoints:
  - `POST /api/auth/forgot-password` — customer self-serve reset
  - `POST /api/admin/customers/reset-password` — admin trigger (returns temp password)
  - `GET/POST /api/admin/whatsapp-config` — admin reads/writes credentials in Firestore `siteSettings/whatsapp`
  - `POST /api/admin/whatsapp-test` — send a test message
- Admin endpoints protected by `X-Admin-Secret` header (default `devaleur-admin-2026`)
- New temp password generator: format `XX-NNNN` (avoids ambiguous chars)
- Password resets logged to Firestore `passwordResets` collection

**Frontend:**
- `CustomerLogin.tsx` — added: 3rd "forgot" mode, password confirm field on register, terms checkbox + privacy/policy links
- `ChangePasswordPage` (new at `/change-password`) — re-auth + update Firebase Auth password
- `Header.tsx` — logged-in account dropdown now has Sifarişlərim / Şifrəni dəyiş / Çıxış
- `WhatsAppSettingsTab` (new admin tab) — phone_id, access_token (masked), business_account_id, api_version, sender_display, test send
- AdminPanel customers list — green WhatsApp icon: "Şifrəni sıfırla və WhatsApp-a göndər" → backend → modal showing temp password

## Pending — needs user to provide credentials

1. **Meta WhatsApp Cloud API credentials** (set via `/admin` → WhatsApp tab):
   - WHATSAPP_PHONE_ID
   - WHATSAPP_ACCESS_TOKEN (Permanent system-user token)
   - WHATSAPP_BUSINESS_ACCOUNT_ID
2. **Firebase Service Account JSON** for password reset:
   - Download from Firebase Console → Project Settings → Service Accounts → Generate new private key
   - Place at `/app/backend/firebase-service-account.json` OR set `FIREBASE_SERVICE_ACCOUNT_JSON` env
   - Without it: forgot-password and admin reset endpoints return 503

## Tech stack
- Frontend: Vite 5 + React 18 + TypeScript + Tailwind + Firebase JS SDK
- Backend: FastAPI + httpx + emergentintegrations + firebase-admin
- DB: Firestore (Firebase) — backend uses Admin SDK
- Auth: Firebase Auth (synthetic emails for phone auth)

## Backlog / Future
- WhatsApp message templates (currently uses free-form text; for first-contact transactional outside 24h window, Meta requires approved templates — `password_reset_otp` template should be created in WhatsApp Manager)
- SMS fallback if WhatsApp delivery fails (deferred per user request)
- B2B request flow still uses email-based auth (intentional — kept)
- Password reset rate limiting (in-memory or Redis)

## Test credentials
See `/app/memory/test_credentials.md`
