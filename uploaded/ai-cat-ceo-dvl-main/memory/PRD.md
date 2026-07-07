# De Valeur — PRD

## Problem statement (latest — 2026-01, Gemini AI chat + admin-only media upload)
- Media upload yalnız admin panelində olsun, istifadəçi səhifələrində yox
- Saytın sağında De Valeur AI chat olsun (istifadəçi üçün)
- Gemini API açarı ilə (yeni "AQ." prefix formatı) — frontend-only, Vercel env-siz
- Chat forması yumru, De Valeur logosu, minimalist dizayn, responsive

## Implemented (this iteration — Gemini 2.5 Flash + rounded UI)
- 2026-01: **AI Chat Service Gemini-yə keçirildi** (`src/services/aiChatService.ts`):
  - OpenAI backend proxy silindi; Gemini 2.5 Flash `generativelanguage.googleapis.com/v1beta`
  - Yeni "AQ." prefix auth key formatı (`x-goog-api-key` header ilə)
  - API açar hardcoded — heç bir Vercel env variable lazım deyil
  - Gemini "thinking" modu söndürüldü (`thinkingBudget: 0`) — cavab sürətli və ucuz
  - Multi-turn history (max 8 mesaj), system prompt (De Valeur persona), safety settings
  - 25s timeout, 429/5xx üçün 1 dəfə retry
  - Terminal test: 94 total tokens → OpenAI 4o-mini ilə müqayisədə ~25× ucuz
- 2026-01: **AI Chat panel yumru dizayn** (`AiChatWidget.tsx`):
  - `rounded-3xl` əlavə olundu → daha yumşaq və luxury görünüş
  - Genişlik `min(380px, calc(100vw - 20px))`, hündürlük `min(600px, calc(100vh - 40px))`
  - Mobil: `bottom-4 right-4`, desktop: `sm:bottom-5 sm:right-5`
  - De Valeur logosu header + launcher-də (mövcud idi, saxlandı)
  - Gold accent line, minimal buttons, animasiyalı online nöqtəsi
- 2026-01: **Media upload istifadəçi səhifələrindən uzaqda** — yalnız admin komponentlərində:
  - `AdminPanel.tsx` (məhsul), `BannerManagementTab.tsx`, `BestSellersBannerTab.tsx`, `ProductBannersTab.tsx`
  - İstifadəçi tərəfli komponentlər (Header, Product, Cart və s.) toxunulmadı
- 2026-01: **AiChatWidgetGate saxlanıldı** — admin/b2b/worker rollarında AI chat göstərilmir (yalnız retail müştəri + qonaqlar)

## Verified
- Build: `npx vite build` → uğurlu (17.18s)
- Gemini API terminal test: cavab AZ dilində, 94 total tokens
- AI Launcher screenshot: bottom-right küncdə görünür, "BIZƏ YAZ" + logo + yaşıl nöqtə

## Setup notes
- Gemini API açar (`AQ.Ab8RN6K-_cQpHcnCijKMXuIr6Z7Y060m2Uf62VuwjFyhC-WZBg`) — frontend-də hardcoded
- Cloudflare Worker R2 upload üçün hələ də lazımdır (media upload)
- Vercel-də HEÇ BİR env variable əlavə etmək lazım deyil

## Backlog
- P1: Gemini API açarını .env-ə köçürmək (təhlükəsizlik üçün) — `VITE_GEMINI_API_KEY`
- P2: Streaming response (token-by-token)
- P2: Domain restriction Gemini açar üzərində (Google AI Studio-da HTTP referrer restriction)
- P3: Digər admin tab-larda MediaInputRow: HomeSectionsTab, AboutManagementTab

---

## Problem statement (previous — 2026-01, Cloudflare R2 + Worker)
- Frontend-only media upload (Vercel env-siz), universal MediaInputRow, Cloudflare Worker

## Implemented (this iteration — R2 Worker + universal MediaInputRow)
- 2026-01: **Cloudflare Worker** `worker/r2-upload-worker.js`:
  - R2 binding (`BUCKET`) və `PUBLIC_URL` env var ilə işləyir — heç bir S3 API açarı Worker-də saxlanmır
  - Endpoints: `POST /upload` (multipart form-data, "file" + "folder"), `GET /health`
  - CORS bütün origin-lərə açıq (`*`), preflight dəstəyi
  - Icazə verilən uzantılar: jpg/png/webp/gif/svg/avif/heic + mp4/webm/mov/m4v + pdf
  - Fayl adı UUID + uzantı (kolliziya yox); `Cache-Control: public, immutable, 1 il`
  - Maksimum 100 MB (video üçün kifayət)
- 2026-01: **Universal `MediaInputRow` komponenti** (`src/components/admin/MediaInputRow.tsx`):
  - Bir sətirdə [URL input] + [Yüklə düyməsi] + [Sil]
  - `accept` prop: `image` | `video` | `any`
  - Progress bar (XMLHttpRequest upload progress)
  - Preview support (image + video HTML5 player)
  - `maxSizeMB` konfiqurasiya edilə bilir (default: image 10 MB, video 100 MB)
- 2026-01: **`imageUploadService.ts` yenidən yazıldı**:
  - Worker URL hardcoded fallback ilə (`https://silent-pine-862b.najaflisaid35.workers.dev`)
  - `VITE_R2_WORKER_URL` env var ilə override etmək mümkündür (opsional)
  - `uploadMediaToR2(file, folder, onProgress)` universal funksiyası
  - Vercel serverless function silindi (`api/r2-upload.js`) — artıq lazım deyil
- 2026-01: **Admin panellərində MediaInputRow inteqrasiyası**:
  - `AdminPanel.tsx` — məhsul şəkilləri (yeni + redaktə)
  - `BannerManagementTab.tsx` — ana bannerlər (şəkil + video, Firebase Storage-dan R2-yə köçürüldü)
  - `BestSellersBannerTab.tsx` — bestseller sağ banner (şəkil)
  - `ProductBannersTab.tsx` — məhsul bannerləri (şəkil + video)
- 2026-01: **Dependencies təmizləndi**:
  - `@aws-sdk/client-s3`, `formidable` silindi (artıq lazım deyil, Worker binding istifadə edir)

## Setup guide
Tam təlimat: `/app/CLOUDFLARE_R2_SETUP.md`
1. R2 bucket + Public URL (artıq hazırdır: `devaleur` bucket, `pub-8757540...r2.dev`)
2. R2 bucket-də CORS policy əlavə et
3. Cloudflare Worker yarat → `worker/r2-upload-worker.js` kodunu yapışdır
4. Worker Bindings-də R2 bucket-i (`BUCKET`) və env var-i (`PUBLIC_URL`) qoş
5. Worker URL-i `imageUploadService.ts`-də yenilə (əgər fərqlidirsə)
6. Deploy → test

## Verified
- Build: `npx vite build` → uğurlu (17.02s)
- Lint: yeni fayllarda 0 issue
- Vercel env variable-lara ehtiyac YOX

## Backlog
- P1: Drag & drop file upload
- P1: Client-side image compression (WebP conversion)
- P2: Digər tab-larda da MediaInputRow: HomeSectionsTab, AboutManagementTab, GiftCardsTab, ComingSoonTab
- P2: Worker auth (admin token yoxlaması)
- P3: Cloudflare Images inteqrasiyası (auto-resize + WebP)

---

## Problem statement (previous — 2026-01, iteration 3)
- Müştəri linki anbardar linkindən FƏRQLİ olsun (`/customer-receive/order/:orderId`); səhifədə müştəri hər malın qarşısında quş qoyub təhvil aldığını qeyd edir + ad/soyad/vəzifə + imza atır → admin görür.
- PDF-də şəkillər yarımçıq düşür (çoxu görünmür) — düzəlt; kompakt et: ~40 model 1 səhifəyə sığsın, 40-ı keçəndə avtomatik 2-ci səhifəyə keçsin.

## Architecture
- React 18 + Vite + TypeScript, Tailwind, framer-motion, Firebase Firestore, i18next
- Excel parse: `xlsx`
- PDF: `jspdf` + `jspdf-autotable` + **NotoSans TTF** (`/app/public/fonts/NotoSans-{Regular,Bold}.ttf`) → Azərbaycan əlifbası dəstəyi
- PDF şəkilləri: **fetch + blob + object URL → canvas → toDataURL** (CORS-friendly, "tainted canvas" xətası baş vermir)
- Real-time sinxronizasiya: Firestore `onSnapshot`

## Implemented (this iteration — Ayrı müştəri linki + PDF düzəlişi)
- 2026-01: **Yeni route**: `/customer-receive/order/:orderId` (`src/pages/CustomerReceivePage.tsx`)
  - Tək kliklə hər mala quş qoymaq (cards-as-buttons UI)
  - Progress sayğacı: Cəmi / Təhvil aldım / Qalır
  - Vəzifə + Ad/Soyad + İmza + **Təsdiq** düyməsi
  - Təsdiqdən sonra səhifə oxunur, imza locked banner görünür
- 2026-01: **WarehouseOrderPage sadələşdirildi** — yalnız anbardar rejimi (customer mode silindi; ayrıca route-a köçürüldü)
- 2026-01: **WhatsApp share buttons yeniləndi**:
  - "Anbardara göndər" → `/warehouse/order/{id}` (yığım siyahısı)
  - "Müştəriyə göndər" → `/customer-receive/order/{id}` (təhvil-təslim — fərqli URL)
- 2026-01: **PDF tamamilə rewrite** (`src/utils/orderPdf.ts`):
  - **CORS fix**: `loadImageAsDataUrl()` fetch+blob+object URL strategiyası → Firebase Storage və başqa CORS-li serverlərdən şəkillər tam yüklənir; fallback: crossOrigin Image
  - **Kompakt layout**: image 22pt × 22pt; row min 26pt; fontSize 7.5; cellPadding 2.5 → A4-də təxminən 30-34 sətr 1 səhifədə; 40+ keçdikdə avtomatik səhifələnir
  - **Multi-page**: autoTable avtomatik səhifələyir; header hər səhifədə təkrarlanır; footer (Təslim edən/alan + summary) yalnız son səhifədə
  - **Səhifə nömrəsi** (1/N format) hər səhifənin sağ-aşağısında
  - JPEG ilə təsvirlər saxlanılır (PNG yerinə) — fayl ölçüsü ~2-3 dəfə kiçik
  - Şəkillər paralel yüklənir (concurrency 8) — bir-birini gözləmir

## Verified
- TypeScript: `npx tsc --noEmit` → exit 0
- Production build: `npx vite build` → uğurlu, 17.69s
- ESLint: bütün dəyişdirilmiş fayllarda 0 issue
- Smoke test: `/customer-receive/order/test-invalid-id` → "Sifariş tapılmadı" düzgün render edildi
- Smoke test: `/warehouse/order/test-invalid-id` → düzgün render olunur

## Previous iterations
- 2026-01 (v2): Anbardar açıq link, PDF (ilk versiya), WhatsApp share, "Var/Yox" → "Əlavə olundu/Mövcud deyil", təsdiq+imza flow
- 2026-01 (v1): Barkod field, axtarış, Excel miqrasiya `Barkod` sütunu, ilkin PDF & anbardar səhifəsi
- 2026-01 (Excel v2): Excel məhsul miqrasiyası yenidən işləndi

## Architecture
- React 18 + Vite + TypeScript, Tailwind, framer-motion, Firebase Firestore, i18next
- Excel parse: `xlsx`
- PDF: `jspdf` + `jspdf-autotable` + **NotoSans TTF** (`/app/public/fonts/NotoSans-{Regular,Bold}.ttf`) → Azərbaycan əlifbası dəstəyi
- Real-time sinxronizasiya: Firestore `onSnapshot`

## Implemented (this iteration — B2B təhvil-təslim v2)
- 2026-01: **PDF təhvil-təslim aktı yeniləndi** (`src/utils/orderPdf.ts`):
  - NotoSans şrifti runtime fetch ilə yüklənir (cache-li, lazy)
  - Başlıq "Təhvil-təslim aktı"; bütün mətnlər Azərbaycan əlifbasında
  - Satış qiyməti sütunu əlavə olundu (regular/sale price avtomatik resolve)
  - Footer: iki sütun — Təslim edən + Təslim alan; hər birində Vəzifə və Ad/Soyad sahələri + imza xətti
- 2026-01: **WarehouseOrderPage tamamilə rewrite** (`src/pages/WarehouseOrderPage.tsx`):
  - 3 rejim: `warehouse` (anbardar) → `customer` (müştəri təhvil) → `done` (bağlı)
  - Anbardar rejimi: status select, "Əlavə olundu"/"Mövcud deyil" düymələri, qeyd, vəzifə+ad+imza, **Təsdiq**
  - Müştəri rejimi: read-only siyahı + "Təhvil aldım" checkbox (yalnız "əlavə olundu" mallar), çatışmayan mallar bannerı, vəzifə+ad+imza, **Təsdiq**
  - Done rejimi: locked, hər iki imza göstərilir
  - Müştəri təsdiqindən sonra `status='delivered'` avtomatik təyin olunur
- 2026-01: **Yeni service funksiyaları** (`src/services/b2bOrderService.ts`):
  - `updateB2BOrderStatusFromWarehouse` — status real-time admin/müştəriyə yayılır
  - `finalizeB2BOrderWarehouse` — vəzifə+ad+imza, `warehouseFinalized=true`
  - `updateB2BOrderCustomerReceiveChecks` — müştəri təhvil aldığı malları işarələyir
  - `finalizeB2BOrderCustomerReceive` — müştəri imza atır, sifariş `delivered` statusuna keçir
- 2026-01: **WhatsApp paylaşma mesajları yeniləndi**:
  - Yalnız şirkət adı, müştəri adı yoxdur
  - "Anbardara göndər": "Yığım siyahısı: {url}"
  - "Müştəriyə göndər" (yeni düymə): "Təhvil-təslim siyahısı: {url}"
  - Hər iki düymə həm admin (B2BOrdersTab), həm B2B müştəri (B2BOrdersPage) tərəfində
- 2026-01: **Admin və müştəri sifariş kartlarında**:
  - Çatışmayan məhsulların adı/brendi/miqdarı göstərilir (rose-50 banner)
  - Anbardar yığımı edən + müştəri təhvil alan imzaları + vəzifə + ad/soyad real-time görünür
  - "Əlavə olundu"/"Mövcud deyil" terminologiyası

## Verified
- TypeScript: `npx tsc --noEmit` → exit 0
- Production build: `npx vite build` → uğurlu, 18.35s
- ESLint: bütün dəyişdirilmiş fayllarda 0 issue
- Smoke test: `/warehouse/order/test-invalid-id` → "Sifariş tapılmadı" düzgün render
- Font endpoint: `/fonts/NotoSans-Regular.ttf` → 200 OK (825 KB)

## Previous iteration (Barkod + ilkin PDF/Anbardar v1 — referans)
- 2026-01: Barkod field məhsula əlavə olundu; admin formaları, axtarış (Header, Products, Admin), Excel miqrasiya şablonu (`Barkod` sütunu, aliaslar EAN/UPC/штрихкод/QR), ilkin PDF və ilkin anbardar səhifəsi (`/warehouse/order/:orderId`)

## Previous iteration (Excel miqrasiya v2 — referans üçün)
- 2026-01-XX: Excel məhsul miqrasiyası tam yenidən işləndi (`src/components/admin/ProductExcelImport.tsx`, `src/services/productMigrationService.ts`, `src/types/index.ts`)
  - **Yeni "Məhsul kodu" (SKU) sütunu** şablonda — birinci növbədə bununla tapılır.
  - **Multi-stage match**: SKU → exact(brand+name) → exact(name) → fuzzy(opsional, defolt OFF, 95%+).
  - Köhnə 88% fuzzy threshold-un səbəb olduğu "miqdar yanlış məhsula düşür" bug-u həll edildi.
  - **Firestore writeBatch** ilə atomik yazılar (450 op/batch chunks) — race condition aradan qaldırıldı.
  - **Excel sətr deduplikasiyası**: eyni məhsula düşən sətrlər birləşdirilir (add modunda toplanır, replace modunda son sətr; xəbərdarlıq göstərilir).
  - **Qiymət rejimi**: "Excel-dəki ilə yenilə" (defolt) və ya "Toxunma".
  - **Cache invalidation**: apply/rollback sonrası `invalidateProductsCachePublic()` çağrılır — B2B/customer tərəfdə güncəl miqdarlar görünür.
  - **Tərəqqi indikatoru**: batch tətbiqi zamanı progress bar.
  - **Migration log v2**: priceMode field əlavə olundu, rollback writeBatch ilə atomik.
  - Product type-a `sku?: string` field əlavə olundu (geriyə uyumlu).
- Hash test: 8 kritik ssenari (SKU match, normalize, cross-product false match, fuzzy threshold, brand fallback) — hamısı uğurlu.

## Verified
- TypeScript build: `yarn build` uğurlu (15s, no errors)
- Unit-level matching test: 8/8 passed
- Lint: heç bir issue yoxdur

## Backlog / next
- P1: Testing subagent ilə end-to-end admin paneldə real Firestore ilə test
- P2: Şəkil URL-i Excel-də göstərib avtomatik download (advance feature)
- P2: SKU-suz mövcud məhsullara SKU yazmaq üçün toplu utility tab
- P3: CSV export — bütün məhsulları yenilənmiş şablon formatında çıxar

- P2: Reduced-motion media query-də motion-u tam söndür (framer hazırda da hörmət edir, sınamaq)

## 2026-05-29 (iter 2) — Luxury Gifts təkmilləşdirməsi
- Layout dəyişdirildi: 4×4 sabit "kəpənək" simmetriyası (12 slot, explicit gridColumnStart/gridRowStart, 4 hündür + 8 kiçik kart)
- Şəkillər: hamısı `object-contain` + uniform padding — kart ölçüsündən asılı olmayaraq məhsul tam görünür (saatlar/sneakerlar daha kəsilmir)
- Animasiya: kart səviyyəsində `scaleY 0→1` qarmon effekti, alternativ transformOrigin (top/bottom) — kəpənək açılışı; daxili şəkil ayrıca 3 istiqamətdən (up/left/right) sürüşür
- Admin: `HomeSectionsTab.tsx` -ə yeni sub-tab `luxuryGifts` əlavə olundu (eyebrow/title/subtitle/cta + 12 slot product picker). `SECTION_LABELS` -ə əlavə olundu — sıralama listinə avtomatik düşür (yuxarı/aşağı düymələri ilə yer dəyişmək olar).
- contentService: `luxuryGifts` HomepageSections-a əlavə olundu, default `sectionOrder` -a `'luxuryGifts'` daxil edildi (giftFinder-dən sonra), getHomepageSections merge logic-ə əlavə olundu
- Mobil: 2-sütunlu fallback grid, eyni 12 slot ardıcıllığı ilə

## 2026-05-29 (iter 3) — Luxury Gifts polish + global UI fixes
- **Luxury Gifts animasiya tezliyi**: duration 0.85s→0.55s, delay/index 0.07→0.04, viewport.amount 0.05, margin '20% 0px 20% 0px' — kartlar daha tez və hamısı bir bütün kimi açılır
- **Luxury Gifts CTA**: yuxarı-sağdakı "Hamısına bax" silindi, yalnız aşağıda ortada — daha kompakt
- **Bg blend**: Luxury Gifts arxa fonu `linear-gradient(to bottom, #fff 0%, #fafaf8 14%, #fafaf8 86%, #fff 100%)` — yuxarı/aşağı bölmələrlə (giftFinder & homeProductBanners ikisi də white) yumşaq keçid
- **CollectionTiles**: "Keçid et" K-clipping fix (overflow-hidden silindi, initial -translate-x-1 silindi); mobil başlıq 22px→15px, sm 24px→20px
- **Header axtarış paneli**: "Trend axtarışlar" etiketi silindi, yalnız kateqoriya quick-pick-lər
- **BrandSlider (footer scroll)**: logoları əlavə edildi (Firestore `brands` collection-undan `logo` field-i ilə), hər element `/brand/:slug` linki ilə klikləndirilə bilər, hover-də opacity artır
- **BrandShowcase**: max 6→9 brend (3×3 grid), aspect 4/5→3/4 (daha hündür/böyük portret kartlar), CTA button-u kompaktlaşdırıldı (gap-3→gap-2, px-7→px-5, tracking azaldıldı)
- **ProductCarousel arrow nav**: w-12/h-12→w-9/h-9 (mobile), w-14→w-10 (desktop), shadow-sm əlavə edildi — daha incə
- **Brand/Category case consistency**: bütün `capitalize` CSS-ləri silindi (Header search title, ProductPage breadcrumb, ProductPage spec values, ProductsPage filter mobile/desktop) — admin-in daxil etdiyi case (SAATLAR / Saatlar / saatlar) hər yerdə eyni qalır

## Backlog (deferred from user feedback)
- Admin → İstifadəçilər: qeydiyyat tarixi + ardıcıllıq sütunu

## 2026-01 (iter — category merge + UX polish)
**Problem statement**: Admin paneldə "Kateqoriya birləşdir" aləti əlavə etmək (case-insensitive dublikatları tək kanonik formaya gətirmək), axtarış UX təkmilləşdirmək (ə hərfi düzgün renderlənsin, çoxdilli + brend axtarış ağıllı olsun), səhifə yüklənmə zamanı brendlənmiş logo loader göstərmək, admin paneldə məhsul/sifariş şəkillərinə hover zoom əlavə etmək.

### Implemented (this iteration)
- **Kateqoriya merge aləti** (`AdminPanel.tsx`):
  - "Dublikatları birləşdir" düyməsi (amber) → modal ilə case-insensitive dublikat qruplarını göstərir
  - Hər qrup üçün admin kanonik versiyanı seçir (radio); qalan versiyaların məhsulları (`products.category`) və brendlərin `categoryNames` massivləri kanonik nameAz-a köçürülür
  - Dublikat kateqoriya sənədləri silinir; alt-kateqoriyaların `parentId`-si kanonikə yönləndirilir
  - `data-testid`-lər: `admin-merge-categories-btn`, `merge-categories-modal`, `merge-group-{i}`, `merge-option-{id}`, `merge-confirm-btn`
- **Font: `font-futura` → Montserrat** (`tailwind.config.js`):
  - Bütün `font-futura` className-ləri artıq Montserrat ailəsinə düşür — Azərbaycan dilinin "ə/ş/ç/ı/ö/ü/ğ" hərfləri düzgün renderlənir, header düymələri (MENYU, AXTARIŞ, Hədiyyə) menyu fontu ilə eyni görünür
- **Logo Loader** (`components/LogoLoader.tsx` + `index.css`):
  - Minimalist: yalnız mərkəzlənmiş De Valeur logosu + `dv-logo-pulse` (1.55s ease-in-out, opacity 0.55→1, scale 0.985→1.04) — spinner və progress bar yoxdur
  - `App.tsx` -də Suspense fallback (`PageFallback`) artıq `<LogoLoader fullScreen={false} />` qaytarır (hər səhifə dəyişikliyində görünür)
  - `prefers-reduced-motion: reduce` → animasiya söndürülür, opacity 0.85-də qalır
- **Ağıllı axtarış** (`Header.tsx`):
  - Multi-token: "Festina saat" → həm Festina, həm Saat kriteriyalarını qarşılayan məhsullar
  - i18n synonym map: "watches" / "часы" yazanda "Saat" kateqoriyalı bütün məhsullar gəlir
  - Hardcoded fallback synonyms (Saat/Часы/Watches, Çanta/Сумки/Bags, Eynək/Очки/Sunglasses, Ətir/Парфюм/Perfume və s.) — i18n resurs gec yüklənsə də işləyir
  - Gender hints: "kişi" / "qadın" / "men" / "women" → uyğun gender filtri
  - Skorlu sıralama: tam uyğunluq (brend=q, category=q) > qismi uyğunluq > bestseller/stok bonus; nəticə limiti 24→60
  - Verifikasiya: "saat"→24+, "watches"→60, "часы"→60, "festina"→49
- **Şəkil hover zoom** (`.dv-img-zoom` CSS class):
  - Admin paneldə məhsul siyahısı thumb (`AdminPanel.tsx`)
  - Müştəri sifarişləri item şəkilləri (`CustomerOrdersTab.tsx`)
  - B2B sifariş item şəkilləri (`B2BOrdersTab.tsx`)
  - Hover-də `scale(2.6)` + zərif drop shadow + `z-index 50` → klik etmədən şəkli yaxından görmək mümkün

### Verified
- TypeScript: yeni dəyişikliklər heç bir əlavə xəta yaratmır (pre-existing unrelated TS errors saxlanılır)
- Vite production build keçir: `✓ built in 12.97s`
- Live screenshot: ana səhifə, axtarış modalı (saat/watches/часы/festina), mega menyu — hamısı düzgün renderlənir
- Font: ə/ş/ç/ı hərfləri Montserrat-da təmiz görünür

### Backlog / next
- P1: Admin merge modalına "Preview before merge" — silinəcək sənədlərin ID-ləri göstərilsin
- P2: Axtarış input-da "Recent searches" siyahısı (LocalStorage)
- P2: LogoLoader-i ProductPage və CategoryPage daxili `<Suspense>` -lərinə də ötür

## 2026-01 (iter 2 — canonical category names + AZ diacritic search)
**Feedback**: User explained: kateqoriya adlarını "Eynəklər" → "EYNƏK", "Alışqanlar" → "ALIŞQAN" kimi adminə dəyişiblər, amma axtarış trending-i hələ köhnə adları (məhsullar üzərindən) göstərirdi. Həmçinin "eynek" (ə-siz yazılış) heç nə tapmırdı və loader logosu böyük idi.

### Implemented
- **Trending / footer / filter dropdown indi admin canonical adlarını göstərir**:
  - `Header.tsx` trending pick-lər `categoryTree` -dən (admin) gəlir, məhsulların `category` field-indən deyil
  - `Footer.tsx` artıq YALNIZ admin-də yaradılmış kateqoriyaları siyahıya salır — product-only "orphan" dublikatları (case fərqli, plural variant və s.) yox olur
  - `ProductsPage.tsx` filter dropdown-u öncə admin kateqoriyalarını göstərir (fallback: məhsulların kateqoriyaları)
- **Case-insensitive + substring filter matching** (`ProductsPage.tsx`):
  - Admin "EYNƏK" filtrini klikləyəndə məhsullarda hələ "Eynəklər" qalıbsa da nəticələr gəlir (qarşılıqlı substring + lowercase)
- **Azərbaycan diakritik normalizasiyası** (`Header.tsx` axtarış):
  - `normalizeAz()` köməkçi: ə→e, ş→s, ç→c, ı→i, ö→o, ü→u, ğ→g
  - Həm sorğu, həm məhsul sahələri (ad/brend/kateqoriya) normalizə edilib müqayisə edilir
  - Verifikasiya: "eynek" → 60, "sirga" → 17, "alisqan" → 60, "gumus" → 1 nəticə (əvvəl 0 idi)
- **LogoLoader kiçildildi**: `h-10/h-12/h-14` → `h-7/h-8` — daha minimalist, ekran ortasında kiçik və zərif görünür

## 2026-01 (iter 3 — mobile smooth scroll + iPhone Instagram/Brave fix)
**Feedback**: Mobil scroll yağ kimi olsun, yeni səhifə açılışları sürətli olsun. iPhone 11 Pro-da Instagram in-app brauzeri və Brave-də saytın klikləri işləmir (digər telefonlarda işləyir).

### Root cause analysis (iPhone Instagram/Brave klik problemi)
İki əsas səbəb:
1. **Firebase Auth IndexedDB tələbi**: Instagram in-app brauzeri və Brave (iOS) "Intelligent Tracking Prevention" ilə 3rd-party IndexedDB-i blok edir. `getAuth()` susqun şəkildə fail olur, modul exception atır, React hydration tamamlanmır → istifadəçi səhifəni görür amma klikləyə bilmir.
2. **Heç bir Error Boundary olmadığı üçün hər hansı runtime/chunk-load exception bütün tətbiqi sındırırdı** (xüsusilə dinamik import() chunk-ları Instagram WebView-də bəzən fail olur).

### Implemented
- **Firebase Auth resilient init** (`lib/firebase.ts`):
  - `initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence] })`
  - Persistence variantlarını ardıcıllıqla sınayır — IndexedDB blok edilsə də `inMemory` ilə həmişə işləyir
- **Global ErrorBoundary** (`components/ErrorBoundary.tsx` + `App.tsx`):
  - React.Component-əsaslı, `getDerivedStateFromError` + `componentDidCatch` ilə
  - Səhv baş verdikdə: De Valeur logosu + "Yenidən cəhd et" düyməsi → istifadəçi boş ekranda qalmır
  - Retry sessionStorage.clear() edib səhifəni yeniləyir
- **iOS mobil scroll smoothness** (`index.css`):
  - `-webkit-tap-highlight-color: rgba(0,0,0,0)` — boz tap flash gizlədir, klik daha cəld hiss olunur
  - `-webkit-overflow-scrolling: touch` body və bütün overflow-scroll konteynerlərə → native iOS momentum
  - `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` → şriftlər daha incə
  - Bütün `button/a/[role="button"]` elementlərə `touch-action: manipulation` — 300ms tap delay yox olur
  - Mobil ekranlarda `scroll-behavior: smooth` söndürüldü (native momentum daha yağlı), desktop-da qalır

### Verified
- iPhone 11 Pro ekran ölçüsündə (375×812) test:
  - Mobil menyu açılır, admin kategoriyaları (DƏRİ, GÜMÜŞ, SAAT, ALIŞQAN) düzgün görünür
  - Scroll smooth — heç bir freeze yox
  - Header search düyməsi klik edir, axtarış inputu görünür
- Vite production build keçir (`✓ built in 13.31s`)

### Production deployment note
Bu dəyişiklikləri istifadəçinin saytında (`devaleur.az`) görmək üçün **yenidən deploy etmək lazımdır** — preview environment-də artıq işləyir.

## 2026-01 (iter 4 — mobile polish + 3-col menu + product grid)
**Feedback**: 
- Mobil scroll geri qayıdanda logo bannerin ortasına düşür
- "Dəri Məhsullar" kateqoriya kartında alt-alta yazılır — yan-yana olsun
- Best Sellers / Yeni Modellər: kompda 5 məhsul, telefonda 3 (azca böyüt)
- Ana səhifədə sağdan sola sürüşdürəndə bütün səhifə yerindən tərpənir
- Bildirişlər aşağı sağdan + daha nazik + minimal olsun
- Mobil menyu kompda olduğu kimi 3-sütunlu (Kateqoriya / Alt / Brend)

### Implemented
- **ProductCarousel basis** (BestSellers + bütün carousel-lar): `basis-[31%]` mobil (3 kart görünür), `lg/xl:basis-[19%]` desktop (5 kart). Test: mobil 3 kart, desktop 5 kart düzgün görünür.
- **CollectionTiles şrift kompakt**: `text-[14px] sm:text-[18px] lg:text-[26px]` + `whitespace-nowrap overflow-hidden text-ellipsis` — "Dəri Məhsullar" artıq tək sətirdə (Saatlar/Gümüşlər kimi).
- **Horizontal swipe lock**: `html, body { overflow-x: clip }` — sağdan sola sürüşdürəndə səhifə yerindən tərpənmir. `clip` `sticky`-ni sındırmır (`hidden` sındırırdı).
- **Toast (bildiriş) redesign**: aşağı sağ, `rounded-full` pill, `pl-3 pr-2 py-2`, `text-[12.5px]`, `backdrop-blur-md`, `dv-toast-in` slide-up animation — daha nazik, daha zərif, daha minimalist.
- **Mobil menyu — 3-sütunlu** (`Header.tsx`):
  - Panel `max-w-[520px] w-full` (sağdan kifayət qədər yer)
  - 3 sütun grid: KATEQORİYA | ALT (və ya BRENDLƏR əgər alt yox) | BRENDLƏR
  - Tap kateqoriya → alt-kategoriyalar/brendlər real vaxt yenilənir
  - "Hamısına bax" alt-sütunun altına əlavə olundu — kateqoriyaya keçid
  - data-testids: `mobile-menu-3col`, `mobile-category-toggle-{name}`, `mobile-subcategory-toggle-{name}`, `mobile-brand-{name}`

### Verified
- iPhone 11 Pro ölçüsündə (375×812) screenshots:
  - Mobil menyu 3-sütunlu görünür: DƏRİ aktiv → ÇANTA alt → ENZO NORİ, SILVERATOSO brendlər
  - BestSellers 3 məhsul kartı tam görünür
  - "Dəri Məhsul..." tək sətirdə ellipsis ilə
- Desktop (1440px): BestSellers 5 məhsul kartı
- Vite production build keçir: `✓ built in 13.92s`

## 2026-01 (iter 5 — SEO + OG önbaxış + dinamik məhsul önbaxışı)
**Feedback**: 
- Google axtarışında daha geniş sitelinks (kateqoriyalar, brendlər, əlaqə, haqqımızda, ünvanlar) avtomatik çıxsın
- Məhsul linki paylaşıldıqda OG önbaxışında məhsul şəkli açılsın, məhsul olmayan linklərdə 4×4 ağ arxa fonlu logo
- Title: "DE VALEUR — ..." em-dash əvəzinə "DE VALEUR | Prestijinizə dəyər qatan detallar"

### Implemented
- **Title + meta yeniləməsi** (`index.html`):
  - `<title>DE VALEUR | Prestijinizə dəyər qatan detallar</title>` (em-dash silindi, slogan əlavə)
  - og:title, twitter:title, description — hamısı yeni başlıq və tagline ilə
  - og:image → `/api/og-default` (1200×1200 ağ arxa fon SVG, slogan ilə)
  - og:type "website" (homepage), məhsullarda dinamik "product"
- **`/api/og-default.js`** (Vercel serverless):
  - 1200×1200 ağ arxa fonlu SVG qaytarır
  - De Valeur logo mərkəzdə + altında "PRESTIJINIZƏ DƏYƏR QATAN DETALLAR" tagline
  - Cache: 1 gün CDN + 1 həftə stale-while-revalidate
- **`/api/og-product.js`** (Vercel serverless — məhsul önbaxış generator):
  - Firestore REST API ilə məhsulu fetch edir
  - index.html-i fetch edib OG meta-larını məhsula uyğun replace edir (title=məhsul adı + brend, image=məhsul ilk şəkli, description=ad·brend·qiymət·stok)
  - Bot User-Agent (WhatsApp/Telegram/Twitter/Facebook/Google/Discord/Slack/LinkedIn/iMessage/Slackbot və 20+ digər) → bu funksiya
  - Adi istifadəçilər (brauzer) → standart SPA index.html (heç bir performans cəzası)
  - Səhv olarsa standart index.html fallback edir
- **`vercel.json` conditional rewrite**:
  - `/product/:id` və `/products/:id` üçün — bot UA detected (regex) → `/api/og-product?id=:id`
  - Adi istifadəçilər üçün dəyişiklik yoxdur
- **Strukturlaşdırılmış data zənginləşdirildi** (`index.html` ItemList):
  - Kateqoriyalar əlavə olundu: Saatlar, Dəri Məhsullar, Gümüş, Eynəklər, Alışqanlar
  - Ünvanlar/Filiallar ayrıca sitelinks elementi
  - 15 SiteNavigationElement (öncə 10) — Google sitelinks üçün daha çox seçim

### Verified
- Build: dist/index.html içində title doğru: `DE VALEUR | Prestijinizə dəyər qatan detallar`
- Production build keçir (`✓ built in 13.98s`)

### Necə işləyir paylaşma zamanı
1. **Məhsul linki paylaşılır** (məs. `https://devaleur.az/product/abc123`):
   - WhatsApp/Telegram bot endpoint-ə gəlir → og-product.js Firestore-dan məhsulu alır → məhsul şəkli + adı + qiyməti ilə HTML qaytarır → bot OG-ni göstərir
2. **Adi sayt linki paylaşılır** (məs. `https://devaleur.az/`):
   - og:image = `/api/og-default` → 1200×1200 ağ arxa fonlu logo + slogan SVG
   - WhatsApp/Twitter/Facebook bunu önbaxışda göstərir
3. **Google axtarışı**:
   - 15 SiteNavigationElement strukturlaşdırılmış data Google-a sitelinks üçün xüsusi siqnaldır
   - sitemap.xml-də bütün vacib səhifələr var
   - Google avtomatik olaraq saytı analiz edib 3-6 sitelinks göstərəcək (adətən 2-4 həftə deploy-dan sonra)

### Production deployment qeydi
⚠️ Bu dəyişikliklər real saytda görünməsi üçün **Vercel deploy** olunmalıdır. Lokal preview-də `/api/*` Vercel funksiyaları işləmir.

## Update — Mobile Menu Accordion + Category Order (Jan 2026)
- Mobile menu now opens **full-width** (100vw) instead of half-panel.
- Categories now use **accordion pattern** with `+` / `×` toggle icons (Hermes-style).
  - Tapping `+` expands sub-categories / brands **downward inline**; another tap collapses (`×`).
  - Sub-categories also support in-line brand expansion.
  - Removed the old horizontal slide-stack (View 0 / 1 / 2) — everything is inline now.
- **Category display order (both mobile & desktop)**: `Saat → Gümüş → Dəri → …rest (admin order preserved)`.
  - Implemented via `getCategoryPriority()` + stable sort in `Header.tsx`.
  - Sub-categories are unchanged.

## Update — B2B & PDF Cleanup (Jan 2026)
### B2B Müştəri "Sifarişlərim" səhifəsi
- **Kateqoriya filteri gizlədildi** (ProductsPage — B2B istifadəçilər üçün mobil chip + desktop panel).
- **"PDF yüklə" düyməsi silindi** — yalnız admin paneldə qalır.
- **"Təhvilat" düyməsi** avtomatik gizlədilir müştəri imzalayandan sonra (`customerReceiveSignature` mövcud olduqda).
- Sifariş nömrəsindən "#" silindi. Bütün istifadəçi tərəfli səhifələrdə (My orders, B2B, admin B2B/Customer, Delivery, Courier).
- Sifariş kartlarında qısa tarix artıq ili də göstərir (dd.MM.yyyy).

### PDF (Təhvil-təslim aktı)
- Məhsul şəkilləri sütunu tamamilə çıxarıldı.
- "Miqdar" sütunu eni artırıldı (kəsilməsin).
- Sətir hündürlüyü dinamik: 30+ məhsul üçün 12pt → 40-a qədər model 1 səhifədə sığır.
- Loqo yüksək çözünürlükdə yüklənir (`maxSide=320`) — təmiz görünür.
- Səhifə altında "De Valeur — təhvil-təslim aktı." mətni silindi.
- Sifariş nömrəsi PDF-də "#"-siz göstərilir.
