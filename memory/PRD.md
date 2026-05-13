# DE VALEUR — PRD (Living Document)

## Problem statement
> 1. "best sellers bolmunu ana sehifede daha yaxsi et ve sagdaki sekli sil"
> 2. "ana sehifeni eyni bu dizaynda et ama asagi etdikde scrolu animasiya ile gelsin"
> 3. "ANA sehifeni bahali markalarin sayti kimi et bloglar falanda olsun"
> 4. **Hero Section** — tam ekran, mərkəzdə məhsul, "SEAMASTER PLANET OCEAN" tipli incə tipoqrafiya
> 5. **Scroll Animasiyaları** — fade-in + yüngül zoom + axıcı staggered keçidlər
> 6. **Rəng Palitrası** — təmiz ağ fon, tünd boz/qara mətnlər, qızıl/metalik vurğular
> 7. **Whitespace** — məhsul kartları böyük boşluqlarla
> 8. **"Discover" düymələri** — hover-də rəng/altxətt animation
> 9. **Naviqasiya** — şəffaf hero üzərində, scroll-da sabitləşir
> 10. **Texniki**: Framer Motion / GSAP, Montserrat + Playfair Display

## Tech stack
- Vite + React + TypeScript
- TailwindCSS, Lucide icons
- **Framer Motion 12.38** — premium scroll animasiyaları (yağ kimi axıcı)
- Firebase Firestore (məhsullar, blog_posts, banners, brands)
- i18next (az / ru / en)
- Fontlar: **Playfair Display** (başlıqlar) + **Montserrat** (UI)

## Ana səhifə arxitekturası (lüks brend axını)

```
1. Hero                  — cinematic full-bleed (88vh), Ken Burns zoom + Playfair typography
2. CollectionTiles       — horizontal scroll tiles
3. BestSellersSection    — premium editorial grid + framer stagger reveal
4. FeaturedStorySection  — Omega tipli half-half + scroll-linked parallax (useScroll/useTransform)
5. BrandShowcase         — premium brendlər
6. HomeProductBanners    — "Signature Selection" banner grid
7. HomeBlogSection       — "Jurnal" editorial blog feed (1 feature + 2 stack)
8. NewsTiles             — admin elanlar
9. CategoryBanner        — kateqoriya çağırışı
```

## Bu sessiyada görülmüş işlər (Luxury brand redesign)

### Hero (tamamilə yenidən yazıldı)
File: `/app/src/components/Hero.tsx`
- Cinematic tam yüksəklik (`clamp(560px, 88vh, 920px)`) full-bleed image/video.
- Framer Motion ilə Ken Burns yumşaq zoom (initial scale 1.12 → 1.0, duration = slide duration).
- AnimatePresence ilə crossfade slide keçidləri (cubic-bezier 0.22,1,0.36,1).
- Editorial overlay: surtitle (uppercase tracking-[0.4em]) + böyük Playfair başlıq (clamp 34px → 84px) + "Discover the collection" CTA with underline.
- Slide counter "01 / 02" + gold accent xətlər.
- Animated scroll hint xətti (infinite scaleY pulse).

### FeaturedStorySection (yenidən yazıldı)
File: `/app/src/components/FeaturedStorySection.tsx`
- Framer Motion `useScroll` + `useTransform` ilə scroll-linked parallax:
  - Şəkil: y 0 → -12%, scale 1.15 → 1.0 (bölmə tam ekranı keçəndə)
  - Mətn: y 8% → -4% (əksinə yumşaq qalxma)
- whileInView staggered fade-in: eyebrow → title → body → CTA (0.15s gecikmə ilə).

### BestSellersSection (framer motion ilə əlavə polish)
File: `/app/src/components/BestSellersSection.tsx`
- Grid framer-motion variants ilə staggered fade-up + zoom (opacity 0 + y 32 + scale 0.96 → 1.0).
- Daha çox whitespace (`gap-x-5/8 gap-y-10/16`).
- Luxury off-white background `#FAF9F7` + 2 ambient gold orb.

### Header (transparent / solid yumşaq keçid)
File: `/app/src/components/Header.tsx` + `/app/src/index.css`
- Home page-də scrollY < 80 olarkən: `position: fixed` + `bg-transparent` + ağ ikonlar/mətnlər + logo `filter: invert(1)`.
- Scroll edildikdə və ya başqa səhifələrdə: `position: sticky` + ağ bg + qara mətnlər.
- 500ms cubic-bezier keçid.

### Global stil
File: `/app/src/index.css`
- Playfair Display @import (400/500/600 + italic).
- `.font-playfair` indi əsl Playfair font-family.
- `.dv-header-transparent` üçün universal stil sistemi.
- Scroll-reveal `dv-scroll-*` sistemi (toqquşmasız).

### App routing
File: `/app/src/App.tsx`
- HomePage 9-blok ardıcıllığında lüks brend axını ilə (Hero → Collections → BestSellers → FeaturedStory → Brands → ProductBanners → Blog → News → CategoryBanner).
- FeaturedStorySection və HomeBlogSection daxili reveal-larına malikdir.

## Build/preview qeydləri
- Vite təmiz kompilyasiya, HMR işləyir.
- Firestore-da 524 məhsul var, lakin heç biri `isBestseller=true` deyil — fallback ümumi məhsullardan ilk 12-ni istifadə edir.
- Hero default fallback: 2 Unsplash şəkli (Seamaster Planet Ocean + L'Heure Bleue) admin banner data olmadıqda göstərilir.

## Bu sessiya (Banner auto-snap rise effekti)

### HeroRisingPanel — gücləndirilmiş "səhifə kimi qalxan" animasiya
File: `/app/src/components/HeroRisingPanel.tsx`

Problem statement (az): "ana sehifede banneri asagi scrolla endirdikde asagidaki
banner sehife kimi yuxari ozu gelsin animasiya ile biraz scrolu asagi eden kimi
altdaki banner ozu qalxsin ve renglerde deyissin scrolu asagi eledikde sehife
kimi yuxari gelsinler."

İcra olunmuş dəyişikliklər:
- **Auto-snap (smooth)**: `useMotionValueEvent(scrollY, 'change')` ilə istifadəçi
  ≥40px scroll edən kimi `window.scrollTo({ top: snapTarget, behavior: 'smooth' })`
  işə düşür — panel öz-özünə tam qalxır. Yuxarı snap simmetrik şəkildə işləyir
  (≤40px-də sıfıra qayıdır).
- **Daha dramatik rise**: viewport-a görə dinamik `riseDistance` (55vh) və
  `snapTarget` (70vh). Köhnə 280→0 əvəzinə təxminən 560→0.
- **Rəng keçidi**: panel bg `#F4ECE0 → #FBF7F0 → #FFFFFF` scroll boyunca.
- **Hero dim overlay**: `fixed` qaranlıq gradient Hero üzərində; panel qalxdıqca
  Hero qaralır (opacity 0 → 0.55) → "səhifə üstə örtülür" effekti.
- **Gold accent xətti**: scaleX 0.4→1, opacity 0→1 — scroll ilə birlikdə uzanır.
- `prefers-reduced-motion`: snap deaktiv olunur.

Validation: Manual playwright screenshot — kiçik wheel(50px) scroll → 756px-ə
auto-snap; geri scroll(25px) → 0-a auto-snap. Console error yox.

## Bu sessiya (Omega-style ana səhifə redesign)

Problem statement: "ana sehife eyni https://www.omegawatches.com/ bunun kimi olsun".

### App.tsx — HomePage axını dəyişdirildi (rising panel silindi)
File: `/app/src/App.tsx`
Yeni axın:
1. Hero (stacked two-line title)
2. CollectionTiles
3. BestSellersSection (horizontal carousel)
4. **HeroSecondary** (NEW) — ikinci kolleksiya banneri
5. **RedCarpetSection** (NEW) — "Qırmızı xalçaya hazır" ikinci tematik carousel
6. **AmbassadorSection** (NEW) — split editorial + mini product carousel
7. FeaturedStorySection
8. **GiftFinderSection** (NEW) — mərkəzi dairəvi kart + Gift ikon
9. BrandShowcase, HomeProductBanners
10. HomeBlogSection (yenidən yazıldı: 4-lü minimal grid)
11. NewsTiles, CategoryBanner

`HeroRisingPanel` (auto-snap rising effekti) artıq import olunmur — Omega kimi
adi yumşaq scroll. Fayl saxlanılıb, lakin istifadə olunmur.

### Yeni komponentlər
- `/app/src/components/ProductCarousel.tsx` — generic horizontal məhsul carousel
  (snap-x scroll-snap + prev/next ox düymələri + lazy image hover-swap).
- `/app/src/components/HeroSecondary.tsx` — Omega "Constellation | Observatory"
  tipli ikinci hero; admin home banner-lərinin indeksi >= 1 olanları istifadə edir.
- `/app/src/components/RedCarpetSection.tsx` — ikinci tematik məhsul carousel
  (top-price məhsullar, ProductCarousel istifadə edir).
- `/app/src/components/AmbassadorSection.tsx` — sol şəkil + sağ editorial + 6
  məhsul mini-carousel; cream `#F4ECE0` arxa fon.
- `/app/src/components/GiftFinderSection.tsx` — mərkəzi card, dairəvi animasiyalı
  gold rings + Gift Lucide icon + ambient gradient orb.

### Yenidən yazılmış komponentlər
- `BestSellersSection.tsx` — grid-dən horizontal carousel-ə keçirildi
  (ProductCarousel istifadə edir, sağda "Hamısı" CTA).
- `HomeBlogSection.tsx` — Omega "News & Stories" tipli 4-lü minimal grid; hər
  kart: kvadrat şəkil + kateqoriya etiketi (#C9A961) + Playfair başlıq +
  qısa təsvir. Mobil 1 sütun, planşet 2, desktop 4.
- `Hero.tsx` — başlıq stacked two-line layout-a (Omega "seamaster | planet ocean"
  tipli) keçirildi: title `|` və ya `/` ilə bölünür → 1-ci sətr italic ortadan
  böyük, 2-ci sətr daha böyük standart Playfair.

### CSS
- `dv-spin-slow` keyframe əlavə olundu (GiftFinderSection dairəvi animasiya);
  `prefers-reduced-motion` deaktiv edir.

### Validation
- 8 əsas bölmə DOM-da görünür və düzgün pozisiyalarda (test ID-lər ilə yoxlandı):
  dv-hero @ 0, dv-bestsellers @ 1792, dv-hero-secondary @ 2576,
  dv-red-carpet @ 3496, dv-ambassador @ 4279, dv-featured-story @ 5208,
  dv-gift-finder @ 5928, dv-home-blog @ 7328. Total page height: 9556px.
- Screenshot-da bütün bölmələr Omega-stil təsdiqləndi.
- Firestore connection bir dəfə xəbərdarlıq verir (network), data offline cache
  vasitəsi ilə uğurla yüklənir.

### Hero — slide counter & scroll hint rafine dizayn (bu kiçik iterasiya)
File: `/app/src/components/Hero.tsx`
Köhnə "01 / 02 ━ ━" + plain "Aşağı + vertical line" əvəzlənildi:
- **Slide counter (bottom-right)**: böyük italic Playfair `01` (text-shadow ilə),
  yan tərəfdə soluq `/ 02`, altında qızıl gradient auto-cycle progress bar
  (slide dəyişəndə restart edir, banner duration boyunca dolur), altında
  klik-edilə bilən dot pagination (aktiv: 8px gold + 4px halo, passiv: 4px
  ağ/40).
- **Scroll hint (bottom-center)**: indi clickable button-dur; `window.scrollTo`
  ilə hero hündürlüyünün 86%-nə smooth scroll edir. Yuxarıda tracked uppercase
  label, ortada vertikal gradient track içində animasiyalı qızıl nöqtə
  (mouse-wheel hint), altında ChevronDown ikon (hover-də translate-y-1).

### CollectionTiles — editorial grid redesign (bu kiçik iterasiya)
File: `/app/src/components/CollectionTiles.tsx`
- Köhnə horizontal scroller + sıxıq kartlar tamamilə yenidən yazıldı:
  desktop **4 sütun grid** (md: 2, lg: 4), mobile horizontal snap fallback.
- Hər kart Omega/Cartier-tipli portret (`aspect-[3/4.2]`): full-bleed media +
  Ken Burns hover zoom (1.08x, 1800ms), vignette gradient overlay, alt hissədə
  gold accent xətti (hover-də 2.5x uzanır) + Playfair başlıq + "Kəşf et →" CTA
  underline reveal hover-də.
- Üstdə editorial header (centered): gold dashes + tracked uppercase
  "KOLLEKSİYALARIMIZ" + böyük Playfair `Kateqoriyalar` başlıq.
- **Dedupe**: admin data-da dublikat və başlıqsız element-lər var idi (SAATLAR /
  DERI MEHSULLAR / DERI MEHSULLAR / AKSESUARLAR / AKSESUARLAR / QELEMLER /
  QELEMLER). İndi `title_az` (lowercased) əsasında unique süzgəc + boş başlıqlı
  tile-lar atılır — nəticədə 4 təmiz kart render olunur.
- Framer Motion `whileInView` + `staggerChildren` ilə kartlar 36px-dən qalxır.

## Bu sessiya (Tam admin-managed ana səhifə)

Problem statement: "admin panelden ana sehifedeki herbirseyi idare etmek olsun".

### contentService.ts — HomepageSections genişləndirildi
File: `/app/src/services/contentService.ts`
- Yeni interface field-lər:
  - `featuredStory`: {enabled, eyebrow{az,ru,en}, title{az,ru,en} (whitespace-pre-line dəstəyi ilə), body{az,ru,en}, imageUrl, ctaLabel{az,ru,en}, ctaLink}
  - `ambassador`: yuxarıdakı + `productIds: string[]` (manual 6 məhsul)
  - `giftFinder`: enabled, eyebrow, title, body, ctaLabel, ctaLink
  - `redCarpet`: enabled, eyebrow, title, `productIds: string[]` (8–12 manual)
  - `sectionOrder: string[]` — section key-lər istənilən sıra ilə (Hero həmişə ən üstdə qalır)
- `DEFAULT_HOMEPAGE_SECTIONS`-a hamısı üçün məntiqli defaults yazıldı.
- `getHomepageSections` partial data + defaults merge edir; eyni mexanizm yeni
  field-lər üçün də işləyir.

### Section komponentləri admin-aware refactor
- `FeaturedStorySection.tsx` — bütün mətnlər/şəkil/CTA admin data-dan oxunur;
  scroll-linked parallax + animasiyalar saxlanılıb.
- `AmbassadorSection.tsx` — eyni + `productIds` boş olsa fallback bestsellers,
  doluysa məhsul carousel admin seçim sırası ilə render edir.
- `GiftFinderSection.tsx` — eyrow/title/body/cta hamısı admin-managed.
- `RedCarpetSection.tsx` — eyrow/title/`productIds` admin-managed; boş olarsa
  fallback ən bahalı 12 məhsul.
- Hər biri `enabled === false` olduqda `null` qaytarır.

### App.tsx — bölmələri admin sırasına görə render
- `HomePage` indi `getHomepageSections().sectionOrder` ilə bölmələri dinamik
  sıralayır. Hero hardcoded ən üstdə qalır.
- Default order ilə yeni section key əlavə olunduqda forward-compatible
  (`sec.sectionOrder + DEFAULT.filter(missing)`).

### HomeSectionsTab — admin UI 5 yeni blok
File: `/app/src/components/admin/HomeSectionsTab.tsx`
- Helper komponentlər: `SectionEditor` (header + enable/disable toggle wrapper),
  `ProductPicker` (axtarış inputu + chip list + scrollable seçim grid; maxCount
  konfiqurasiyalı), `SectionOrderList` (12 section adlı sıralama, ArrowUp/Down
  düymələri ilə move).
- Əlavə olunan bloklar:
  1. **Featured Story**: eyrebrow/title (textarea, \n dəstəyi)/body/imageUrl/
     ctaLabel/ctaLink + enable toggle.
  2. **Ambassador**: yuxarıdakı + ProductPicker (6 maks).
  3. **Hədiyyə tapıcı**: eyrebrow/title/body/ctaLabel/ctaLink.
  4. **Red Carpet**: eyrebrow/title + ProductPicker (12 maks).
  5. **Bölmələrin sırası**: 12 section üçün up/down arrow ilə yenidən sırala.
- Bütün form field-lərində unikal `data-testid` (`featured-story-image-url`,
  `ambassador-products`, `section-order-up-{key}` və s.).

### Validation
- TypeScript: dəyişdirdiyim fayllarda yeni xəta yoxdur (yalnız pre-existing
  `Features` import / pre-existing `index` unused).
- Playwright: bütün 9 əsas section data-testid-i mövcud, console error yox,
  Hero refined counter işləyir.

### FeaturedStorySection — mobil görünüş düzəlişi (bu kiçik iterasiya)
File: `/app/src/components/FeaturedStorySection.tsx`
Problem: mobil görünüşdə image column-un explicit hündürlüyü yox idi —
`<div>` absolute-positioned image-i ehtiva edirdi və grid-cols-1-də sıxılırdı
(0px boy). Title isə 34px ilə dar ekranda 2 sətrə düşür, boş yer dolurdu.

Həll:
- Image column-a aspect ratio verildi: `aspect-[4/5] sm:aspect-[16/10]
  lg:aspect-auto` — mobil-də şəkil tam görünür.
- Mobil-də parallax `y: textY` deaktiv edildi (`isMobile` resize listener ilə);
  parallax yalnız lg+ ekranlarda işləyir.
- Title responsive: `text-[26px] sm:text-[38px] md:text-[56px] lg:text-[68px]`
  — kiçik ekranlarda daha kompakt.
- Padding/margin azaldıldı mobil-də (`py-10 sm:py-14 md:py-20`),
  eyebrow tracking və ölçü incələşdirildi.
- Image üzərinə vertikal gradient overlay (mobil) → horizontal (desktop).

Playwright (390x844 viewport) ilə doğrulandı — şəkil 4:5, başlıq və CTA təmiz,
overflow yox.

## Backlog (P1 / P2)
- [ ] FeaturedStorySection-u admin-managed et (image + title + body + CTA Firestore-dan).
- [ ] Best Sellers altında "Just sold" social-proof ticker.
- [ ] Newsletter signup bölməsi (Footer üstü).
- [ ] CategoryBanner üçün stagger animasiya.
- [ ] "Quick view" modal Best Sellers kartlarında.
- [ ] HomeBlogSection title/CTA admin tərəfindən tərcümə oluna bilsin.
- [ ] B2B üçün xüsusi alt-header bar.

## Pre-existing TS xəbərdarlıqları
AdminPanel.tsx, Header.tsx, AiChatWidget.tsx-də mövcud unused-vars / strict-null xətaları (bu sessiyada toxunulmadı).
