# De Valeur — PRD

## Problem statement (latest request)
Ana səhifədə "Dəyər hədiyyə edin" (GiftFinder) bölməsindən sonra LV-üslubunda maraqlı asimmetrik məhsul kart şəbəkəsi yarat. Scroll edərkən kartlar fərqli istiqamətdən açılsın (yuxarı/aşağı/sol/sağ), kartların içindəki məhsul şəkilləri də yuxarı/sol/sağdan animasiya ilə girsin. Donma olmasın. Məhsullar hələlik random — admin idarəetməsi sonradan.

## Architecture
- React 18 + Vite + TypeScript, Tailwind, framer-motion (12.38), Firebase, i18next
- Home section sırası `App.tsx` → `DEFAULT_SECTION_ORDER`, admin tab ilə də idarə oluna bilər
- Mövcud `productService.getAll()` random məhsul seçimi üçün istifadə olunur

## Implemented (this iteration)
- 2026-05-29: `src/components/LuxuryGiftCardsSection.tsx` yaradıldı
  - 4 sütunlu (mobil 2 sütun) asimmetrik grid, bəzi kartlar `row-span-2` ilə hündür
  - 5 fərqli kart gəliş istiqaməti: up / down / left / right / scale
  - 3 fərqli inner image istiqaməti: up / left / right (gecikmə ilə)
  - Easing: cubic-bezier(0.22, 1, 0.36, 1), 0.9-0.95s duration, stagger 0.08s
  - `productService.getAll()` → filter enabled & has images → Fisher-Yates shuffle → 9 məhsul
  - Click → `/product/:id`, heart icon (UI only), hover lift + shadow + image scale
  - i18n az/ru/en başlıq və CTA mətnləri
  - `data-testid` -ləri: luxury-gifts-section / luxury-gifts-title / luxury-gift-card-{idx}
- `App.tsx` -də `luxuryGifts` açarı `giftFinder` -dən sonra `DEFAULT_SECTION_ORDER` -ə əlavə olundu

## Verified
- TypeScript: yeni faylda və edit edilən App.tsx-də heç bir yeni TS xətası yoxdur (mövcud unrelated xətalar saxlanılır)
- Runtime screenshot: section render olur, 9 kart, başlıq "Sevərək seçildi", asimmetrik grid

## Backlog / next
- P1: Admin panelə Luxury Gifts üçün məhsul seçim tab-ı (sıralama, manuel seçim, eyebrow/title/subtitle CMS)
- P1: Wishlist heart button-u real funksionallıqla bağlamaq
- P2: "Compare" və "Quick view" overlay
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
