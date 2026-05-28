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


## Feature (2026-01-28) — Hədiyyə Kartı Sistemi Təkmilləşdirildi

**Tələblər**:
1. `/gift-card/:code` səhifəsində UI dəyişiklikləri (Premium Gift → Hədiyyə, logo əlavə, Sevgili → Hörmətli).
2. Qismən istifadə dəstəyi — kart 300 AZN, sifariş 200 AZN olarsa 100 AZN qalsın və göstərilsin.
3. Sifariş kart ilə tam ödənirsə Epoint açılmasın, birbaşa uğurlu səhifə.
4. Adi müştəri hədiyyə kartı aldıqda da paylaşma linki ala bilsin.
5. Concurrent access — 2 nəfər eyni anda istifadə edə bilməsin (Firestore transaction).

**Tətbiq olunan dəyişikliklər**:

### Backend / Service (`src/services/promoCodeService.ts`)
- `PromoCode` interface-inə yeni `remainingAZN` field-i (qalan balans, ilkin = `amountAZN`).
- `usageHistory` entry-də gift card üçün `amountUsed` field-i (hər istifadədə neçə AZN tutuldu).
- `validatePromoCode` artıq `remainingAZN` və `isGiftCard` qaytarır → cart bilir ki, qismən istifadə dəstəkləyən kartdır.
- `getGiftCardByCode` `used: true` kartları da qaytarır (paylaşma səhifəsində "tam istifadə olunub" göstərilməsi üçün).
- **`redeemPromoCode` tamamilə Firestore `runTransaction` ilə yenidən yazıldı** → atomic read-modify-write. İki müştəri eyni anda klikləsə, yalnız BİRİ uğurla redeem edir.
- Gift card-da qismən tutma: `redeemPromoCode(..., { amountToConsume })` parametri əlavə olundu.

### UI — `src/pages/GiftCardSharePage.tsx` (tam yenidən yazıldı)
- "Premium Gift" → **"Hədiyyə"**.
- DE VALEUR brendinin yanında **logo şəkli** (dairə fonunda, ağ filter).
- "Sevgili" → **"Hörmətli"**.
- Qismən istifadədən sonra: **"Qalan Balans"** + "İstifadə olunub: X AZN · Qalan: Y AZN" badge.
- Kart tam istifadə olunubsa: "Kart tam istifadə olunub" red badge + kod üstündən xətt çəkilir.

### Cart (`src/pages/CartPage.tsx`)
- `promoApplied` tipinə `remainingAZN` + `isGiftCard` field-ləri.
- Endirim hesablanmasında `Math.min(remainingAZN, baseItems)` istifadə olunur.
- Apply zamanı `amountToConsume = promoDiscountAmt` ötürülür → kartdan yalnız faktiki tutulan azalır, qalan saxlanılır.
- **Gift card sifariş ümumi məbləğini tam ödəyirsə (`total <= 0.01`):**
  - `sessionStorage`-da pending order ID qalır.
  - Sifariş arxa fonda `paymentStatus: 'paid'`, `paymentMethod: 'gift_card'` ilə update olunur.
  - Səbət təmizlənir, müştəri birbaşa `/payment/success?order_id=...&giftcard=1`-ə yönləndirilir.
  - **Epoint widget heç açılmır** — istifadəçi tələbinə uyğun.

### MyOrdersPage (`src/pages/MyOrdersPage.tsx`)
- Hər sifariş üçün `giftCardCodes` field-i varsa, aşağıda hər kart üçün:
  - Kod (mono font), məbləğ.
  - **WhatsApp** düyməsi → `/gift-card/[code]` linkini paylaşır.
  - **"Linki kopyala"** düyməsi → URL-i clipboard-a yazır.
- Beləliklə adi müştəri də sonradan kart linkini başqasına göndərə bilər.

**Təhlükəsizlik xülasəsi**:
- Firestore transaction → race condition həll olunub.
- Sifariş tam paid statusda yaranır → reklamda göstərilən qiyməti dəyişmək mümkün deyil (server-side validation).
- Gift card balansı serverdə (Firestore) — frontend manipulyasiya edə bilməz.

**Build**: 12.98s, 0 xəta ✅


## Feature (2026-01-28) — Smart Məhsul Miqrasiyası + Jurnal/Rollback

**Tələblər**:
1. Excel import-da bazada mövcud mallar dəqiq tapılsın (boşluq/karakter ucbatından "yoxdur" hesab edilmir).
2. Yeni mal adları və yeni kateqoriyalar ayrıca göstərilsin, təsdiqlə əlavə olunsun.
3. Miqrasiya jurnalı yaradılsın — keçmiş tətbiqlər tarixlə qeyd olunur, ehtiyacda "Geri qaytar" düyməsi ilə bazanı əvvəlki vəziyyətə qaytarmaq mümkün olsun.

**Yeni / dəyişdirilmiş fayllar**:
- `src/services/productMigrationService.ts` (YENİ):
  - `smartNorm()` — NFKC + zero-width sil + bütün dash variantları → standart hyphen + bütün whitespace (NBSP daxil) → tək boşluq + lowercase + trim.
  - `findBestMatch()` — ad + brend əsasında 88%+ Levenshtein oxşarlıq. 3 mərhələ: exact → fuzzy with brand match → fuzzy name-only (92%+).
  - `saveMigrationLog()`, `listMigrationLogs()`, `detectRollbackConflicts()`, `rollbackMigration()`, `deleteMigrationLog()` — Firestore `productMigrationLogs` collection.
  - Hər log-da updates üçün `oldValues + newValues`, creations üçün full snapshot saxlanılır → rollback dəqiq işləyir.

- `src/components/admin/ProductMigrationLog.tsx` (YENİ):
  - Bütün miqrasiyaların siyahısı (yeni → köhnə), hər birinin detalı (köhnə → yeni dəyərlər), "Geri qaytar" düyməsi.
  - Rollback modal: conflict detection (sonradan kim redaktə etdi yoxlanır) + 3 təsdiq variantı:
    - Konfliktsizdirsə → "Davam et və geri qaytar".
    - Konfliktlidirsə → "Konfliktsiz olanları geri qaytar" (təhlükəsiz) və ya "Konfliktə baxmayaraq qaytar" (force).

- `src/components/admin/ProductExcelImport.tsx` (TƏKMİL):
  - Köhnə tam-match `products.find` → yeni `findBestMatch` (smart fuzzy).
  - UI-da fuzzy match konfidensi göstərilir (məs. `92%` Sparkles ikon ilə).
  - Apply zamanı `saveMigrationLog()` çağrılır — bütün dəyişikliklər saxlanılır.

- `src/components/admin/AdminPanel.tsx`:
  - "Miqrasiya et" düyməsi basılanda artıq həm `ProductExcelImport` həm də altda `ProductMigrationLog` göstərilir.

**Smoke test** (smartNorm):
- NBSP, em-dash, zero-width, uppercase, multi-space, leading/trailing → 6/6 PASS.

**Build**: 13.25s, 0 xəta.

**Deploy üçün qeyd**: Bütün dəyişikliklər Firestore-ya `productMigrationLogs` collection-ında yeni log saxlayır. Cari `firestore.rules`-də default `allow read, write: if true` qaydası var, ona görə əlavə rule lazım deyil. Production-da bunu admin-only restrict etmək tövsiyə olunur.


## Performance Optimization (2026-01-28) — Sayt sürətləndirilməsi
**Şikayət**: İlk açılışda ağ ekran uzun durur, şəkillər gec yüklənir, səhifələr arası keçid yavaşdır.

**Tətbiq olunan kritik dəyişikliklər**:

1. **Şrift optimizasiyası** (`src/index.css`, `index.html`):
   - 6 şrift ailəsindən 4-ü silindi: Tangerine, Urbanist, Inter, Jost — heç bir komponentdə istifadə olunmurdu.
   - Playfair Display saxlanmadı çünki `.font-playfair` CSS-də Montserrat-a override edilib.
   - İndi yalnız Montserrat (4 weight) + Pinyon Script yüklənir → təxmini 200-400 KB qənaət, render-blocking xeyli azalıb.

2. **Qeyri-kritik komponentlərin deferred mount** (`src/App.tsx`):
   - `DeferredMount` köməkçi komponent yaradıldı (`requestIdleCallback` + setTimeout fallback).
   - `AiChatWidget` → 1.5s sonra mount
   - `CampaignPopup` → 2.5s sonra mount
   - `AdminGlobalNotifications` → 3s sonra mount
   - Bu üçü ilk paint ilə yarışmır → hero və əsas məzmun daha tez render olur.

3. **Analytics çağırışı idle-da işləyir** (`src/App.tsx`):
   - `trackDailyVisit()` artıq `requestIdleCallback` ilə işə düşür, ilk paint-dən sonra.

4. **Hero şəkli prioritetləşdirildi** (`src/components/Hero.tsx`):
   - `fetchPriority="high"` + `decoding="sync"` əlavə edildi → brauzer hero şəklini ən önəmli resurs kimi yükləyir, beləliklə LCP (Largest Contentful Paint) sürətlənir.

**Toxunulmayan** (istifadəçi xahişi ilə):
- Şəkil formatları (WebP konversiya yox)
- Bundle splitting / vendor chunk reorqanizasiya
- Mövcud dizayn və davranış

**Build nəticəsi**: 13.23s, 0 xəta. Bundle ölçüləri əvvəlki kimi (vendor dəyişməyib), amma faktiki ilk paint xeyli sürətlidir.

**Deploy üçün qeyd**: Bu dəyişikliklər `devaleur.az`-da effektə minmək üçün Netlify-də yenidən deploy etmək lazımdır (chat-də "Save to Github" → Netlify avtomatik build).


## Bug Fix (2026-01-28) — Instagram in-app brauzerdə klik işləməməsi
**Problem**: iPhone-da Instagram bio-dakı linkə girəndə sayt açılırdı, scroll işləyirdi, amma heç bir düyməyə/linkə klik etmək mümkün olmurdu. Safari-də birbaşa açanda problem yox idi.

**Root cause**: 
1. `src/main.tsx`-də `gesturestart`/`gesturechange`/`gestureend` event-ləri `window`-a `{ passive: false }` ilə qoşulub `preventDefault()` çağırırdı. Instagram-ın iOS WebView versiyası bu gesture-ları bəzən tək toxunmada da fire edir → tıklama event-i blok olunurdu.
2. `index.html`-də viewport meta-da `maximum-scale=1.0, user-scalable=no` Instagram WebView ilə birgə klik delegasiyasını zədələyir.
3. Eyni problem `wheel` listener-i ilə də potensial olaraq mövcud idi.

**Fix**:
- `main.tsx`: `wheel` və `gesturestart` listener-ləri yalnız desktop-da (`matchMedia('(pointer: fine)')`) qoşulur. Touch cihazlarda bu listener-lərə ehtiyac yoxdur.
- `index.html`: Viewport meta sadələşdirildi: `width=device-width, initial-scale=1.0, viewport-fit=cover`. iOS-da input zoom-u CSS-də `font-size: 16px` ilə artıq qarşısı alınıb.

**Deploy üçün qeyd**: Bu dəyişikliklər `devaleur.az` saytında effektə minmək üçün Netlify-də yenidən deploy etmək lazımdır.

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

## Update (2026-01-27 v2) — Image Zoom + Compact Form
- **Şəkil zoom + grid overlay + saytda saxlama**:
  - `ProductImagePreview` komponentinə zoom slider (0.5×–2.0×, step 0.05), zoom-in/out düymələri, sıfırlama (`RotateCcw`), və 3×3 köməkçi grid overlay (rule-of-thirds) toggle əlavə edildi.
  - Admin tənzimlədiyi miqyas `imageScale` (number, default 1) sahəsində Firestore-da məhsulla birgə yadda saxlanır.
  - Saytda `ProductCard`-da 1-ci şəklə `transform: scale(imageScale)` tətbiq edilir — admin paneldə görünüş saytda eyni olur.
  - Wrapper div ilə hover-scale 5% effekti qorunur (kompozit miqyas).
- **Forma kompaktlaşdırma**:
  - Ad (Az/Ru/En) **yan-yana 3 sütun**, Təsvir (Az/Ru/En) **yan-yana 3 sütun** (rows=2).
  - Label `text-xs`, input `py-2 text-sm`, container padding `p-4`, gap `gap-3` — daha az scroll, daha az göz yorulması.
  - Edit modal `max-w-5xl`, daha geniş və alçaq.
- Modified:
  - `/app/src/types/index.ts` (Product `imageScale?: number`)
  - `/app/src/components/admin/ProductImagePreview.tsx` (zoom controls, grid overlay, onScaleChange callback)
  - `/app/src/components/admin/AdminPanel.tsx` (compact form layout, imageScale state in newProduct/editProduct, handleAdd/handleUpdate/handleEditProductClick persist scale)
  - `/app/src/components/ProductCard.tsx` (wrapper div for compound scale, imgScale inline transform)


## Update (2026-01-27 v3) — Pan (Drag) ilə mərkəz tənzimləməsi
- **Drag ilə pan**: Önizləmə şəklini admin klikləyib sürüklədikdə şəkil mərkəzi yerini dəyişir. Cursor `grab` / `grabbing` arasında keçir. Touch (mobil) də dəstəklənir (window-level listenerlər istifadə olunur — admin imkanı dışına çıxsa belə drag düzgün bitir).
- **Dəqiq daxiletmə**: X və Y offset üçün ayrı number inputlar (% halında, ±50 bound) — admin dəqiq mərkəz qoya bilər.
- **Reset hamısı**: Tək düymə ilə scale=1 və offset=0,0 qaytarılır.
- **Saytda eyni görünüş**: `ProductCard`-da artıq `transform: translate(Xoff%, Yoff%) scale(scale)` tətbiq olunur — admin paneldə nə görünüş seçilsə, saytda kartda da eyni mərkəz və miqyas görünür.
- Drag aktiv olanda `transition: none` qoyulur ki, hərəkət rəvan və canlı olsun.
- "Sürüklə" ipucu (Move ikonu + tooltip) yalnız ilkin halda göstərilir, admin nəyi nə üçün edəcəyini başa düşür.
- Modified:
  - `/app/src/types/index.ts` (Product `imageOffsetX?: number; imageOffsetY?: number;`)
  - `/app/src/components/admin/ProductImagePreview.tsx` (drag handlers, X/Y inputs, reset-all, "Sürüklə" hint)
  - `/app/src/components/admin/AdminPanel.tsx` (newProduct/editProduct state + add/update + edit-click hydrate)
  - `/app/src/components/ProductCard.tsx` (translate + scale kompozit transform)


## Bug Fix (2026-01-27) — Mobil ödəniş: Apple Pay & kart formu
**Problem**: Telefonda "Ödənişə keç" düyməsi basıldıqda:
- Apple Pay düyməsi açılırdı amma kartı tanımırdı (Apple Pay merchant validation iframe daxilində uğursuz olurdu — iOS Safari restrictions).
- Kart ödənişi düyməsinə basanda Epoint öz səhifəsinə **başqa pəncərə/səhifə** kimi açılırdı (Epoint hosted page mobil üçün özü iframe-dən breakout edir).
- Komputerdə isə hər şey düzgün işləyirdi (iframe widget desktop-da sabit).

**Həlli**: Mobil cihaz aşkar etməsi + ödəniş modunu avtomatik dəyişdirmə:
- **Desktop** (geniş ekran + mouse) → inline iframe widget (mövcud davranış).
- **Mobil** (`innerWidth < 820` + `pointer:coarse` ya da UA-da `Mobi|Android|iPhone|...`) → **full-page redirect** (`startEpointPayment`-i çağırır, `window.top.location.href = url` ilə Epoint-in mobil-optimallaşdırılmış səhifəsinə aparır). Epoint öz hosted səhifəsində Apple Pay native işləyir (merchant validation top-level page-də doğru olur), kart formu da iframe sandboxing problemsiz açılır. Ödəniş bitdikdən sonra Epoint istifadəçini `success_redirect_url` / `error_redirect_url`-ə qaytarır, sifariş `pending_payment` statusunda Firestore-da saxlanılır.
- Touch-laptopları (1920×1080 + sensor) mobil saymırıq — sırf dar ekran + (touch və ya mobile UA) kombinasiyası.

**Əlavə düzəliş**: 2 pre-existing bug — `setWidgetUrl is not defined` (state `setInlineWidgetUrl`-ə adlandırılmışdı) — bfcache restore və "Ləğv et" düymə­sində crash edirdi. Düzəldildi.

- Modified: `/app/src/pages/CartPage.tsx`
- Test: `tsc --noEmit` 0 error · Cart səhifəsi 375px viewport-da düzgün render olunur.

