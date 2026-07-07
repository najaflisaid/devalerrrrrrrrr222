# Test credentials

## Admin API secret (X-Admin-Secret header)
Default: `devaleur-admin-2026`
Override via env `ADMIN_API_SECRET` in `/app/backend/.env`.
Frontend admin panel reads from `localStorage.adminApiSecret` (set via WhatsApp Settings tab).

## WhatsApp Cloud API
NOT YET CONFIGURED — owner will provide:
- WHATSAPP_PHONE_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_BUSINESS_ACCOUNT_ID
- Display sender number: +994777577277 (changeable via admin panel)

## Firebase Service Account
NOT YET CONFIGURED — owner needs to download from Firebase Console
(Project Settings → Service Accounts → Generate new private key)
and save as `/app/backend/firebase-service-account.json`.

## Customer test accounts
- None pre-seeded; create via the registration flow (phone + name + surname + password + accept terms).
- Testing agent (iteration_6, 2026-01) created: phone **559867215** / password **test123456**
  (Firebase Auth synthetic email: `phone994559867215@devaleur.az`).
  This phone now triggers duplicate-detection auto-switch in checkout.
