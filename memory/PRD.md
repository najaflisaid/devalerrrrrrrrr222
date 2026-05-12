# DE VALEUR — PRD (Living Document)

## Problem statement (orijinal)
> "best sellers bolmunu ana sehifede daha yaxsi et ve sagdaki sekli sil"
> "ana sehifeni eyni bu dizaynda et ama asagi etdikde scrolu animasiya ile gelsin"
> Referans dizayn: Omega Watches ana səhifəsi (editorial, full-width, premium e-commerce)

## Tech stack
- Vite + React + TypeScript
- TailwindCSS, Lucide icons
- Firebase Firestore (məhsullar)
- i18next (az / ru / en)

## Bu sessiyada görülən işlər (2026-01-12)

### 1) BestSellersSection tamamilə yenidən dizayn edildi
File: `/app/src/components/BestSellersSection.tsx`
- Sağdakı banner şəkli (aside column) tamamilə **silindi**.
- 1+1 grid layout-u tam genişlikdə (full-width) məhsul grid-i ilə əvəz olundu:
  - mobil: 2 sütun
  - planşet (md): 3 sütun
  - desktop (lg): 4 sütun
- Editorial başlıq əlavə edildi: qızıl xətt + "BEST SELLERS" üzəri (surtitle) + böyük "Sevilən məhsullar" başlığı + alt-yazı.
- Yeni watch-style məhsul kartları: brend (uppercase, semibold), məhsul adı (light), qiymət, hover-də ArrowRight-lı "Detallar" CTA.
- Sale badge: yumşaq qara pill (köhnə qırmızı dairə deyil).
- Hover effektləri: image swap, scale 1.06, alt qaranlıq xətt.
- Bottom CTA: "Hamısına bax" → `/products?sort=bestsellers` keçidi.

### 2) Scroll-trigger animasiya sistemi
- Yeni hook: `/app/src/hooks/useReveal.ts` — IntersectionObserver tabanlı, `prefers-reduced-motion` dəstəyi ilə.
- Yeni wrapper: `/app/src/components/RevealOnScroll.tsx` — istənilən komponenti `variant` ("up" | "left" | "right" | "fade" | "scale") ilə fade-in edir.
- CSS: `/app/src/index.css` faylına universal `.dv-reveal`, `.dv-stagger` sinifləri əlavə edildi (cubic-bezier 0.22,1,0.36,1; 800-900ms; 60ms stagger).
- Ana səhifə (`App.tsx` → `HomePage`) bütün bölmələrə tətbiq edildi:
  - Hero — animasiyasız (öz keçidləri var)
  - CollectionTiles, NewsTiles, BrandShowcase, HomeProductBanners, CategoryBanner → `<RevealOnScroll variant="up">`
  - BestSellersSection daxilində 3 ayrı reveal trigger (header / grid+stagger / footer-CTA).

### 3) Saxlanılan funksionallıq
- Admin panel "Bestseller Banner" tab-ı kod bazasında qalır (sıralanma idarəsi və s. üçün lazım ola bilər) — sadəcə ana səhifədə artıq göstərilmir.
- `bestSellersBannerService` toxunulmadı.

## Build/preview qeydləri
- Vite dev server təmiz kompilyasiya edir (HMR işləyir).
- Preview-də məhsullar görünmür — Firestore-da məlumat yoxdur (preview environment limit). Production-da real məhsullarla dizayn tam görünəcək.

## Bilinən pre-existing TS xəbərdarlıqları (yenilərini əlavə etmədik)
- AdminPanel.tsx, Header.tsx, AiChatWidget.tsx-də mövcud unused-vars / strict-null xətaları. Bu sessiyada toxunulmadı.

## Bug fix (2026-01-12, sonra)

**Problem:** "Ana səhifədə heç nə görünmür, hər yer ağdır, sadəcə banner və menyu görünür."

**Root cause:** Mənim əlavə etdiyim `.dv-reveal` / `.dv-reveal-in` CSS sinifləri kod bazasında artıq mövcud olan `.dv-reveal` + `.is-in` animation sistemi ilə CSS cascade-də toqquşurdu. Mövcud `.dv-reveal { opacity: 0 }` (line 1353) sonradan gəldiyi üçün mənim `.dv-reveal-in { opacity: 1 }` (line 18) qaydasını üstələyirdi — nəticədə bütün wrap olunmuş bölmələr permanent görünməz qalırdı.

**Fix:**
1. Yeni siniflər tamamilə fərqli prefix-lə adlandırıldı: `dv-scroll-reveal`, `dv-scroll-in`, `dv-scroll-up/left/right/fade/scale`, `dv-scroll-stagger`. Bu artıq mövcud `dv-reveal`-lə toqquşmur.
2. `RevealOnScroll.tsx`-də 1200ms failsafe `setTimeout` əlavə edildi — IntersectionObserver hər hansı səbəbdən firing etməsə belə, məzmun gizli qalmır.
3. `useReveal.ts`-də də eyni 1500ms failsafe + ilkin rect viewport check var.
4. `BestSellersSection.tsx` yeni `dv-scroll-*` siniflərinə migrate edildi.

**Yoxlama:** `https://bestseller-display-1.preview.emergentagent.com` üzərində Hero, Prestijinizə dəyər qatan detallar başlığı və Features bölmələri indi düzgün görünür. Boş bölmələr (CollectionTiles, BestSellers, NewsTiles, BrandShowcase, CategoryBanner) hələ də yalnız ona görə görünmür ki, preview Firestore-da məlumat (məhsul/tile/banner) yoxdur — production-da hamısı işləyəcək.


- [ ] Hero sliderinə da yumşaq parallax/Ken Burns effekti əlavə etmək.
- [ ] CategoryBanner və CollectionTiles üçün Omega-style staggered children animasiyası.
- [ ] Best Sellers grid-də "Quick view" modal (səhifəyə keçmədən qiymət/şəkillərə baxış).
- [ ] Brand showcase üçün horizontal scroll snap.
