# De Valeur — Product Requirement Document

## Original Problem Statement
Mövcud React + Vite + TypeScript + Firebase (Firestore + Auth) layihəsi — De Valeur lüks məhsul ticarət saytı. Çoxdilli (AZ/RU/EN), B2B portal, admin panel, işçi idarəetmə sistemi və QR-kod izləməsi mövcuddur.

## Tech Stack
- React 18 + TypeScript + Vite 5
- Tailwind CSS, Playfair Display + Inter (fonts)
- Firebase (Firestore, Auth, Storage)
- i18next (AZ / RU / EN)
- React Router 7
- Web3Forms (B2B sifariş emaili — limit problemi)

## User Personas
- **Müştəri**: Sayta baxır, məhsul alır (Epoint ödənişi + sifariş izləmə + kredit ərizəsi)
- **B2B partner**: Loginlə daxil olur, b2b qiymətlərlə sifariş verir (email vasitəsilə)
- **Admin**: /admin paneldən bütün məzmunu idarə edir
- **İşçi**: /workers QR kod ilə davamiyyət

## Sessions Done
### 2026-01-27 (current session)
1. **Preview bərpası**: `yarn install` ilə vite quraşdırıldı, frontend supervisor altında işə salındı
2. **B2B sifariş "Quota exceeded" xətası**: `CartPage.tsx`-də `sendB2BOrderEmail` çağırışı try/catch-ə alındı. Web3Forms email kvotası dolsa da, sifariş Firebase-də yaradılır və istifadəçiyə uğur bildirişi göstərilir
3. **Haqqımızda səhifəsi tam admin nəzarəti** (`AboutManagementTab.tsx`):
   - Səhifə başlığı + sloqan (3 dil)
   - Hekayə başlığı + məzmunu (3 dil)
   - Şəkil URL
   - **4 statistika kartı (idarə oluna bilən: ikon, dəyər, etiket, 3 dildə)** — yeni əlavə oluna və silinə bilər
   - Missiya başlığı + mətni (3 dil)
4. **Missiya bölməsinin yenidən dizaynı** (`AboutPage.tsx`):
   - "Couture Manifesto" stilində: cream/ivory fon (#FBF7EF → #F4ECDC gradient)
   - Sol tərəfdə vertikal "MAISON · DE VALEUR · MANIFESTE" wordmark
   - Böyük qızılı dırnaq işarəsi
   - Qızılı corner brackets (4 küncdə)
   - Drop-cap (ilk hərf qızılı, 4.5rem)
   - Playfair italic mətn
   - "ANNO · MMX" + "NOTRE MISSION" eyebrows
   - "De Valeur" imzası altda

## Pending / Backlog
- **P0 (BLOKUR)**: İstifadəçi Epoint API açarlarını (`EPOINT_PUBLIC_KEY`, `EPOINT_PRIVATE_KEY`) əldə edib `/app/backend/.env`-ə əlavə etməlidir. Sonra `sudo supervisorctl restart backend`. Açarlar olmadan ödəniş axını işləməyəcək.
- **P0**: Real production deploy zamanı `/app/backend/.env`-də `EPOINT_SUCCESS_URL`, `EPOINT_ERROR_URL`, `EPOINT_RESULT_URL` real domeyni göstərməlidir
- **P1**: Web3Forms əvəzinə Resend və ya admin paneldə real-time bildiriş zəngi (email kvota probleminin həqiqi həlli)
- **P2**: Firestore index-ləri (test_reports/iteration_5.json-dan: attendance_requests, performance kolleksiyaları üçün)
- **P2**: Admin session persistence (workers/admin paneldə tab navigasiyası problemi)
- **P3**: PWA dəstəyi mobil cihazlar üçün

### 2026-01-28 (current session) — Frontend-only Epoint ödəniş sistemi
1. **Backend tamamilə silindi** — yalnız `/api/health` saxlanılır. Bütün ödəniş axını brauzerdə.
2. **Frontend Epoint imzalama** (`/app/src/services/epointPaymentService.ts`):
   - `crypto-js` ilə SHA1 sandwich signature
   - HTML form auto-submit ilə Epoint checkout-a redirect (CORS-suz)
   - Açarlar Firestore-da `site_settings/epoint` sənədində
3. **Admin paneldə yeni `Epoint Açarları` tabı** (`EpointSettingsTab.tsx`):
   - Public Key + Private Key (göstər/gizlət)
   - Success/Error/Result URL-ləri redaktə edilə bilir
   - Təhlükəsizlik xəbərdarlığı (private key brauzerdə görünür)
4. **Müştəri sifariş sistemi**:
   - `customer_orders` Firestore kolleksiyası
   - `/app/src/services/customerOrderService.ts` — CRUD + status idarəetməsi
5. **Yeni səhifələr**:
   - `/my-orders` — Sifariş tarixçəsi + vizual timeline (Ödəniş → Hazırlanır → Yoldadır → Təhvil verildi)
   - `/payment/success` — frontend-də signature verify, sifariş statusunu `preparing` edir
   - `/payment/error` — sifarişi `payment_failed` edir
   - `/payment/result` — Epoint webhook üçün stub
6. **Cart ödəniş axını** (yalnız müştəri):
   - WhatsApp əvəzinə "Epoint ilə ödə"
   - Modal: telefon, ünvan, qeyd → Epoint
   - B2B email flow saxlanılır
7. **WhatsApp düymələri silindi**: ProductPage, ProductDetailsPage, ProductCard
8. **"Sifarişlərim" linki Header-də** (desktop + mobil)
9. **Admin Panel — `Müştəri Sifarişləri` tabı** (`CustomerOrdersTab.tsx`): bütün sifarişlər, status idarəetməsi, axtarış

### 2026-01-29 — Mobile UX iteration
1. **Sticky/floating mobil filter düyməsi** (`ProductsPage.tsx`): bottom-left fixed `Filtr` düyməsi (lg:hidden) — istifadəçi harada olursa olsun bir tıklamayla filterə çatır. Açanda avtomatik yuxarıya scroll edir.
2. **Mobil filter scroll-to-top fix** (`ProductsPage.tsx` `scrollToTop`): seçimdən sonra mobildə panel bağlanır + `requestAnimationFrame` + `documentElement.scrollTop = 0` fallback (Safari/Chrome mobile).
3. **Gold-line sticky-hover düzəlişi** (`index.css` `.dv-menu-item`): `@media (hover: hover) and (pointer: fine)` ilə wrap edildi — mobilde tap-dan sonra qızılı sol-xətt artıq yapışmır.
4. **Footer tam brendlər/kateqoriyalar** (`Footer.tsx`): `slice(0, 6)` limit silindi, `max-h-72 overflow-y-auto` əlavə edildi.
5. **AI chat launcher kiçildildi** (`AiChatWidget.tsx`): logo bubble 40→28px, padding və font ölçüsü azaldıldı.
6. **Banner hover arrows** (`Hero.tsx`): `<section>`-a `group` əlavə, ox düymələri `opacity-0 group-hover:opacity-100` + slide animasiyası ilə yalnız hover-da görünür.
7. **Best sellers mobil swipe** (`index.css`): `@media (max-width: 767px)` altında marquee animasiyası disable, `overflow-x: auto` + `scroll-snap-type: x mandatory` + `-webkit-overflow-scrolling: touch` — barmaqla rahat swipe.

### 2026-01-30 — Analytics collapse & Order phase separation
1. **Analitika tab — "Daha çox göstər" toggle** (`AnalyticsTab.tsx`): `topViews`, `topSearches`, `carts`, `wishlists` siyahıları default olaraq yalnız 5 element göstərir. Kart sonunda `Daha çox göstər (N)` / `Daha az göstər` toggle düyməsi ilə açılır. Səhifə artıq sonsuza qədər uzanmır.
2. **Müştəri Sifarişləri — 3 ayrı status bölgəsi** (`CustomerOrdersTab.tsx`):
   - **Ödəniş** kartı (CreditCard ikonu): Ödənildi / Gözləyir / Uğursuz + "Manual təsdiq et" düyməsi
   - **Hazırlanma** kartı (Package ikonu): Gözləyir / Hazırlanır / Hazırlandı / Ləğv edildi + "Hazırlanmağa başla" və "Hazırdır" düymələri
   - **Çatdırılma** kartı (Truck ikonu): Gözləmədə / Kuryerə verildi / Yoldadır / Təhvil verildi — dropdown ilə keçid
   - Tone'a uyğun rənglər: emerald/amber/blue/indigo/purple/red.
   - Ümumi `status` field-i hələ də unified — admin hər sahəni dəyişdikdə müvafiq mərhələyə keçirir.
3. **MyOrdersPage redesign** (`MyOrdersPage.tsx`):
   - **Couture-stil hero**: gold lines + "MAISON · DE VALEUR" eyebrow + Playfair düzgün başlıq
   - **Sol sidebar (320px sticky)**: gold corner brackets + müştəri profili (avatar+ad+email+telefon+ünvan), Statistika kartı (4 metrika: Sifariş/Tamamlandı/Çatdırılır/Cəmi xərc), gold accent şüar kartı "100% etibarlı çatdırılma"
   - **Sağ tərəf**: Sifariş kartları daha böyük (Playfair sifariş №, gradient progress bar gold accent ilə)
   - **İmza axını**: status `courier_handover` VƏ `on_the_way` zamanı imza düyməsi göstərilir (əvvəlcədən yalnız on_the_way idi)
   - **Çatdırılma bildirişi**: imzanın altında emerald-gold gradient ilə "Sifariş uğurla təhvil verildi. De Valeur-i seçdiyiniz üçün təşəkkür edirik." mətni və təsdiq vaxtı.

### 2026-01-30 (Part 2) — Notifications, sound, double-toast & mobile filter polish
1. **Müştəri sifariş səs bildirişi** (`AdminPanel.tsx`):
   - `playOrderSound()` WebAudio API ilə "ding-dong" iki tonlu (A5 → E5) sintezator (xarici fayl yox).
   - `prevCustomerOrdersCountRef` və `prevB2BOrdersCountRef` — count artanda (yeni sifariş gəldikdə) səsini çal.
   - `audioUnlockedRef` ilk istifadəçi gesture-undən sonra səsin işləməsinə icazə verir (browser autoplay policy üçün).
   - İlk snapshot zamanı səs çalmır (initial mount-da prev=-1).
2. **Wishlist double-toast bug** (`WishlistPage.tsx`): `addToCart()` daxilində artıq notification əlavə edilir; `WishlistPage.handleAddToCart` da əlavə `addNotification` çağırırdı → ikiqat. Düzəldildi.
3. **AI Chat launcher minimallaşdırma** (`AiChatWidget.tsx`): "De Valeur AI" mətni və `Sparkles` ikonası söndürüldü. İndi 48×48 dairəvi düymə yalnız logo və online status nöqtəsi göstərir.
4. **Mobil header → ProductsPage navigation scroll-to-top** (`Header.tsx`): mobil burger-menyudan brend/kateqoriya seçilərkən `closeMobileMenu()` sonrası `window.scrollTo(0,0)` əlavə edildi — istifadəçi yeni filterin nəticələrini başdan görür.
5. **Floating filter button — scroll-aware** (`ProductsPage.tsx`): `showFloatingFilter` state + scroll listener. `scrollY > 240px` olanda göstərilir, üst inline "Filtr" düyməsi görünəndə gizlənir (opacity-0 + pointer-events-none + transform-3px slide animasiyası).

### 2026-01-30 (Part 3) — Status revert, profile minimisation, marquee+swipe combo
1. **Yeni status `accepted`** (`customerOrderService.ts`):
   - `pending_payment / accepted / cancelled / payment_failed` (Ödənişlə bağlı)
   - `preparing / courier_handover (Hazırdır) / on_the_way (Çatdırılma xidmətində) / delivered` (Məhsulla bağlı)
   - Etiketlər: `Ödəniş gözləyir / Qəbul olundu / Hazırlanır / Hazırdır / Çatdırılma xidmətində / Təhvil verildi / Ləğv olundu`
2. **Admin CustomerOrdersTab — köhnə tək-status üslubu bərpa edildi** (`CustomerOrdersTab.tsx`):
   - Tək status badge + tək dropdown
   - Dropdown `<optgroup>` ilə qruplandırılıb: "Ödənişlə bağlı" və "Məhsulla bağlı"
   - **Səs aç/bağla toggle** (Volume2/VolumeX) əlavə edildi, `localStorage.admin_sound_notifications_enabled` ilə persistent.
   - `playOrderSound` (AdminPanel.tsx) preference-i oxuyur — `false` olanda səs çalmır.
3. **MyOrdersPage minimalist redesign** (`MyOrdersPage.tsx`):
   - Statistika kartı **silindi**
   - "MAISON · DE VALEUR" hero **silindi**
   - Trust kartı ("100% etibarlı çatdırılma") **silindi**
   - Sidebar yalnız: avatar + Ad + Email + Telefon (ünvan **göstərilmir**)
   - **Şəxsi endirim kartı**: admin paneldən təyin edilən `discountPercentage` aktiv (etibarlı + istifadə olunmayıb) olduqda gold-frame kartında %-lə göstərilir.
   - **Sifariş siyahısı kompakt**: tək sətir kart (#, tarix, məhsul sayı, cəmi). Üzərinə basanda açılır — timeline, məhsullar, çatdırılma üsulu, imza, təhvil bildirişi.
4. **Mobile bestsellers — marquee + swipe combo** (`index.css`):
   - Mobildə `dv-marquee-left/right` animasiyası **bərpa edildi**.
   - `overflow-x: auto` + `-webkit-overflow-scrolling: touch` saxlanıldı.
   - `:active` / `:focus-within` zamanı animation-play-state paused — istifadəçi swipe etdikdə hərəkət dayanır.
5. **Mobile filter button — aktiv filter sayğacı** (`ProductsPage.tsx`):
   - `activeFilterCount` 8 fərqli filtri sayır (kateqoriya, brend, cinsiyyət, endirim, comingSoon, stok, qiymət range, axtarış).
   - `> 0` olanda gold badge `Filtr • N` görünür (yalnız panel bağlı vəziyyətdə).

### 2026-01-30 (Part 4) — Worker login minimal & dashboard polish
1. **WorkerLogin.tsx**: "De Valeur · İşçi Paneli" eyebrow + "Xoş gəldiniz" + "Hesabınızla daxil olun" silindi. Yerinə **De Valeur logosu** (h-12/h-14) + altında kiçik `uppercase tracking-[0.35em] "Giriş edin"` mətni.
2. **WorkerDashboard TrainingsSection — collapsible**: 6-padding kartdan başlığa kliklənən tam toggle button. Sayğac (material sayı) və ChevronUp/Down ilə. Default bağlı — istifadəçi açanda materiallar görünür → uzun sıra səhifəni uzatmır.
3. **"Sənin yerin" badge — gosterişli minimal**: 
   - Sparkles ikonu əlavə edildi
   - Gold radial-gradient shimmer underlay (opacity 50)
   - Top-right kiçik gold nöqtə (corner flourish)
   - Soft gold shadow `0_4px_20px_-4px_rgba(212,175,55,0.45)`
   - Border ikiqat → tək (təmizlənmiş)

### 2026-01-30 (Part 5) — Cart quantity bug & sound diagnostics
1. **Cart hydration ikiqat artma bug-ı düzəldildi** (`CartContext.tsx`):
   - **Səbəb**: hər `onAuthStateChanged` çağırışında (səhifə yenilənməsi, token refresh, reconnect) cart `local + remote` cəmləndirilirdi. Local və remote eyni olduğu üçün hər yenilənmədə miqdarlar **ikiqat artırdı** (1→2→4→8...).
   - **Düzəliş 1**: `hasHydratedRef` — hər sessiyada hydration yalnız bir dəfə icra olunur.
   - **Düzəliş 2**: merge məntiqi `existing.quantity + ci.quantity` → `Math.max(existing.quantity, ci.quantity)`. Beləliklə qonaq cart-ı ilə remote cart-ın hər ikisi varsa belə miqdar köpəlmir.
2. **Səs bildirişi etibarlılığı və test düyməsi** (`AdminPanel.tsx`, `CustomerOrdersTab.tsx`):
   - `playOrderSound` artıq `audioUnlockedRef` üzərindən gate olunmur — birbaşa cəhd edir, autoplay policy bloklasa səssiz keçir.
   - `AudioContext` `state === 'suspended'` olarsa `ctx.resume()` çağırılır, sonra tonlar çalınır.
   - **Toggle ON zamanı preview**: "Səs aç" düyməsinə basanda eyni səs çalınır → admin nə səs eşidəcəyini bilir.
   - **"Səsi sınaqdan keçir" düyməsi**: tək kliklə səsi yoxlamaq üçün; preference-dən asılı olmadan səs çalır.
   - Bu həm WebAudio-nu unlock edir (gesture-da çağırılır), həm də səs sınağı verir.

### 2026-01-30 (Part 6) — Worker UX text + analytics phone
1. **WorkerLogin layout** (`WorkerLogin.tsx`): "Giriş edin" mətni logo altından çıxarıldı, email field-in **üstünə** köçürüldü. Logo təmiz qalır.
2. **Sales graph titles** — il referansı silindi:
   - `WorkerDashboard.tsx`: "{year} ili üzrə aylıq satış qrafikim" → **"Satış qrafikiniz"**
   - `MonthlySalesChart.tsx`: "{year} - Yanvar — Dekabr" → **"Yanvar — Dekabr"**
3. **ConfidentialityNotice — istifadəçi mətni** (`WorkerDashboard.tsx`): istifadəçinin verdiyi rəsmi mətnlə tam əvəzləndi:
   - "Hörmətli əməkdaş," başlanğıcı, "kommersiya sirri ... məxfilik rejiminə tabedir", "Diqqət!", "qəti surətdə qadağandır", "intizam tənbehi, maddi və qanunvericiliklə nəzərdə tutulmuş hüquqi məsuliyyətlər", "Anladım və qəbul edirəm" təsdiq mətni — bütün cümlələr orijinal mətnə uyğun.
4. **Müştəri telefonu analitikada** (`AnalyticsTab.tsx` + `CartContext.tsx` + `WishlistContext.tsx` + `types`):
   - `customer_carts` və `customer_wishlists` Firestore mirror-larında **`userPhone`** field əlavə edildi (`localStorage.userPhone`-dan oxunur)
   - AnalyticsTab "Müştəri Səbətləri" və "Wishlist" kartlarında ad+email-in **altında telefon** göstərilir.

### 2026-01-30 (Part 7) — StatsBand mobile responsive
- **`StatsBand.tsx` mobil səliqəyə salındı**:
  - Big number font: `text-3xl` → **`text-[28px]`** mobildə (xırda ekrana sığır)
  - Eyebrow tracking: `0.3em` → **`0.18em`** mobildə (uzun sözlər kəsilmir)
  - Eyebrow font: `text-[11px]` → **`text-[9px]`** mobildə + `leading-tight` + `break-words`
  - Grid gap: `gap-8` → **`gap-y-6 gap-x-3`** mobildə
  - **5-ci element (İl beynəlxalq zəmanət)**: mobildə `col-span-2` → tam enli ortalanır, `md` desktopda yenə `col-span-1`
  - **Vertikal divider line**: hər mobil cüt arasında zərif `bg-black/5` xətti (yalnız mobile)

## Pending / Backlog
- **P0**: Admin /admin → "Epoint Açarları" tabından `EPOINT_PUBLIC_KEY` və `EPOINT_PRIVATE_KEY`-i daxil edib yadda saxlamaq
- **P1**: Resend / Twilio ilə sifariş status email/SMS bildirişi
- **P2**: Firestore index-ləri
- **P2**: Admin session persistence
- **P3**: PWA dəstəyi

## Key Files Modified / Created
### Yaradıldı
- `/app/src/services/customerOrderService.ts`
- `/app/src/services/epointPaymentService.ts` (frontend-only crypto-js ilə)
- `/app/src/pages/MyOrdersPage.tsx`
- `/app/src/pages/PaymentSuccessPage.tsx`
- `/app/src/pages/PaymentErrorPage.tsx`
- `/app/src/pages/PaymentResultPage.tsx`
- `/app/src/components/admin/CustomerOrdersTab.tsx`
- `/app/src/components/admin/EpointSettingsTab.tsx`

### Redaktə edildi
- `/app/backend/server.py` (Epoint endpoints silindi, yalnız /api/health)
- `/app/src/App.tsx` (yeni route-lar)
- `/app/src/pages/CartPage.tsx` (Epoint flow)
- `/app/src/pages/ProductPage.tsx`, `ProductDetailsPage.tsx`, `ProductCard.tsx` (WhatsApp silindi)
- `/app/src/components/Header.tsx` (Sifarişlərim linki)
- `/app/src/components/admin/AdminPanel.tsx` (yeni tablar)
