# DE VALEUR — Checkout Auth & Inline Epoint

## Original Problem Statement (Azerbaijani)
Ödəniş zamanı:
1. Müştəri əvvəlcədən qeydiyyatdadırsa — nömrəsini və şifrəsini yazıb davam etsin (yenidən qeydiyyatdan keçməsin).
2. Qeydiyyatlı müştəri eyni nömrə ilə yenidən qeydiyyat etmək istəyirsə — bildiriş ver: "bu nömrə ilə qeydiyyat mövcuddur".
3. E-point sistemi (Epoint) eyni səhifədə inline açılsın (xarici linkə yönləndirmə yox). Müştəri scroll edib kart məlumatlarını və ya Apple Pay ilə ödəsin.

## Architecture
- Frontend: React + Vite + TypeScript (single-page e-commerce store)
- Auth/DB: Firebase Auth + Firestore (`users` collection — phone is unique)
- Payments: Epoint.az hosted widget (inline iframe via `/api/1/token/widget`)
- Backend: FastAPI + Vercel serverless functions (`/api/epoint/*`)

## Implemented (2026-01)
- **Checkout auth tabs** in `CartPage.tsx`: "Yeni qeydiyyat" / "Hesabım var" (testid: `checkout-auth-tabs`).
  - Logged-in users skip auth entirely.
  - Register tab: Ad / Soyad / Telefon / Şifrə / Şifrə təkrar.
  - Login tab: yalnız Telefon + Şifrə + "Şifrəni unutmusuz?" + "Yeni qeydiyyat" linkləri.
- **Auto duplicate-phone detection** (400 ms debounced Firestore query while typing). When phone already exists, page auto-switches to login tab and shows hint `checkout-existing-account-hint`.
- **Server-side duplicate guards** kept: register catch handles `auth/email-already-in-use` and pre-query for matching `users.phone == +994XXXXXXXXX`.
- **Inline Epoint widget**: `fetchEpointWidgetUrl()` is called from checkout's Pay button (`handleEpointCheckout('widget')`). The iframe renders directly inside the checkout left column (`inline-epoint-widget` / `inline-epoint-iframe`). Apple Pay / Google Pay / Card form rendered by Epoint inside iframe. PostMessage listener handles success/error.
- Removed external redirect path from the default Pay button; old `EpointWidgetModal` no longer used in CartPage.

## Verified (testing agent iteration_6)
- 6/8 checks PASS: tabs render, default register fields visible, login form visible, validation rings, auto-switch on duplicate, address/delivery validation.
- 1 HIGH bug fixed: `flagMissing(testId, '')` was overwriting `errorMessage` with empty string — now skips the toast update when `message === ''`.
- 1 env-blocked: inline iframe E2E (Epoint widget endpoint returned HTTP 403 in preview env — Epoint merchant keys need configuring in admin/payments Firestore doc).

## Files Touched
- `/app/src/pages/CartPage.tsx` (main changes)

## Next Action Items
- Configure valid Epoint widget API credentials (admin → Sayt Parametrləri → Epoint) so the inline iframe can be exercised end-to-end in preview.
- Optional: split `CartPage.tsx` (1500+ lines) into sub-components (`<CheckoutAuthSection/>`, `<CheckoutDelivery/>`, `<InlineEpointWidget/>`).

## Future / Backlog
- Apple Pay native button outside iframe (Payment Request API direct) for one-tap on iOS Safari.
- "Remember me" on login tab to skip auth on subsequent same-device purchases.
