# DE VALEUR — PRD (Living Document)

## Problem statement
> 1. "best sellers bolmunu ana sehifede daha yaxsi et ve sagdaki sekli sil"
> 2. "ana sehifeni eyni bu dizaynda et ama asagi etdikde scrolu animasiya ile gelsin" (Omega referansı ilə)
> 3. "ANA sehifeni bahali markalarin sayti kimi et bloglar falanda olsun ana sehifede en cox satilanlar daha yaxsi olsun"

## Tech stack
- Vite + React + TypeScript
- TailwindCSS, Lucide icons
- Firebase Firestore (məhsullar, blog_posts, banners, brands)
- i18next (az / ru / en)

## Ana səhifə arxitekturası (lüks brend axını)

```
1. Hero                  — full-bleed banner / video carousel
2. CollectionTiles       — horizontal scroll tiles (admin-managed)
3. BestSellersSection    — ⭐ premium editorial grid (yenidən qurulmuş)
4. FeaturedStorySection  — ⭐ yeni: Omega tipli half-half image+text
5. BrandShowcase         — premium brendlər
6. HomeProductBanners    — "Signature Selection" banner grid
7. HomeBlogSection       — ⭐ yeni: ana səhifədə Jurnal (3 ən son blog yazısı)
8. NewsTiles             — admin elanlar
9. CategoryBanner        — kateqoriya çağırışı
```

## Bu sessiyada görülmüş işlər

### Bu iterasiya (ana səhifə luxury-brand redesign)
- **YENİ**: `FeaturedStorySection.tsx` — half-half image + editorial text bölmə (KOLLEKSİYA HEKAYƏSİ eyebrow + Atelyelərdə doğulan zaman başlığı + body + CTA).
- **YENİ**: `HomeBlogSection.tsx` — ana səhifədə "JURNAL" editorial blok. 1 böyük feature + 2 yığcam stack. Firestore `blog_posts` collection-undan götürür. İllüstrasiya, tarix, başlıq, snippet, "Oxu →" CTA.
- **YENİLƏNDİ**: `BestSellersSection.tsx` — luxury off-white `#FAF9F7` background + 2 ambient gold orb decoration. Fallback əlavə edildi — əgər heç bir məhsul `isBestseller=true` deyilsə, ümumi məhsullardan ilk 12-ni göstərir (bölmə boş qalmasın).
- **YENİLƏNDİ**: `App.tsx` HomePage — bölmələr yeni lüks brend ardıcıllığında düzüldü.

### Əvvəlki iterasiyalar
- `useReveal` hook + `RevealOnScroll` wrapper + universal `dv-scroll-*` CSS sistem.
- BestSellersSection-da sağdakı banner-aside silindi, full-width editorial grid quruldu (4 col desktop / 3 col tablet / 2 col mobil), watch-style kartlar.
- CSS toqquşması (`dv-reveal` → `dv-scroll-reveal`) düzəldildi, 1.2s failsafe.

## Build/preview qeydləri
- Vite dev server təmiz kompilyasiya edir (HMR işləyir).
- Preview Firestore-da məhsullar var (524 docs), amma heç biri `isBestseller=true` deyil — fallback işləyir.
- Hero banner data yox → Hero placeholder cream görünür.
- Blog posts boş ola bilər → HomeBlogSection yalnız yazı varsa render olunur.

## Backlog (P1 / P2)
- [ ] Hero sliderinə Ken Burns / parallax effekti.
- [ ] FeaturedStorySection-u admin-managed et (image + title + body + CTA Firestore-dan).
- [ ] Best Sellers altında "Just sold" social-proof ticker.
- [ ] CategoryBanner üçün stagger animasiya.
- [ ] "Quick view" modal Best Sellers kartlarında.
- [ ] HomeBlogSection title/CTA admin tərəfindən tərcümə oluna bilsin.

## Pre-existing TS xəbərdarlıqları
- Bu sessiyada yenidən toxunulmadı, mövcud unused-vars / strict-null xətaları AdminPanel, Header, AiChatWidget-də qalır.
