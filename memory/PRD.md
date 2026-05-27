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


## Update (2026-01-27)
- Unified product page design: `/products/:id` route (from homepage banners & search) now uses the same `ProductPage` component as `/product/:id` (from filter/listing). Both routes render identical UI including green "Kreditlə Al" button.
- Modified: /app/src/App.tsx (removed ProductDetailsPage import, unified route to ProductPage).


## Update (2026-01-27) — Admin Products UX
- **Filterlər forma açıq olduqda gizlənir**: Admin "Məhsul əlavə et" düyməsinə basanda axtarış, qiymət aralığı, kateqoriya/brend/stok/görünürlük filterlər və miqrasiya paneli avtomatik gizlənir — yalnız yeni məhsul formu görünür.
- **Stok inputu auto-select**: Default dəyər boş (`''`), placeholder `0`. Mövcud dəyər olsa belə input fokus alanda `e.target.select()` ilə avtomatik seçilir, klaviatura yazışı ilə dərhal əvəz olunur (artıq əvvəlcədən `0`-ı silmək lazım deyil). Saxlanmada boş = 0.
- **Tarixə görə sıralama**: Admin → Məhsullar siyahısı artıq `createdAt` üzrə azalan sıraya görə düzülür (ən son əlavə edilən yuxarıda). Hər kartda kateqoriya altında əlavə edilmə tarixi `dd.MM.yyyy HH:mm` formatında göstərilir (testid: `product-created-at-<id>`).
- **1-ci şəklin canlı ProductCard önizləməsi**: Yeni `ProductImagePreview` komponenti (`/app/src/components/admin/ProductImagePreview.tsx`) — admin URL daxil edən kimi şəklin saytdakı `aspect-square` ProductCard-da necə oturduğunu eyni stillərlə (gradient, sale badge, qiymət, brend, qəlb/səbət ikonları) göstərir. Şəklin təbii ölçüləri oxunur və tövsiyə verilir: yaşıl (≥800×800px kvadrat), sarı (qeyri-kvadrat nisbət), qırmızı (<400px). Add və Edit formaları üçün aktivdir.
- **Auto-tərcümə (Az→Ru/En)**: Növbəti iteration üçün təxirə salındı (user istəyi).
- Modified: `/app/src/components/admin/AdminPanel.tsx` (filter wrapper, stock default + onFocus, sort by createdAt, date display, preview integration, Calendar icon import).
- Added: `/app/src/components/admin/ProductImagePreview.tsx`.
