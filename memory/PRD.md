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
