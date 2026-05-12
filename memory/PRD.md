# DE VALEUR — PRD

## Original Problem Statement
Kuryer-lərin B2B və pərakəndə müştəri sifarişlərini təhvil verən digər
işçilərə (anbardar, menecer, mağaza müdiri, qonşu və s.) imzalatması üçün
`devaleur.az/delivery` paneli yaradılması.

## Architecture
- Frontend: Vite + React 18 + TypeScript + Tailwind
- Backend: FastAPI (mövcud, dəyişdirilmədi)
- DB: Firebase Firestore (couriers, b2bOrders, customer_orders kolleksiyaları)
- Hosting: Vercel/Netlify (production)

## Core Requirements (DONE)
- [x] Kuryer email + şifrə ilə login (admin idarə edir)
- [x] Müştəri / B2B tabları
- [x] B2B-də yalnız "Çatdırılmadadır" statuslu müştərilər görünür
- [x] Pərakəndədə yalnız "on_the_way" statuslu müştərilər görünür
- [x] Sonuncu imzalanmamış sifariş avtomatik açılır
- [x] Tehvil alanın Ad/Soyad/Vəzifə manual daxil edilir + canvas imza
- [x] İmza müştəri B2B/MyOrders panelində + admin paneldə görünür
- [x] Müştəri sonradan öz imzasını da əlavə edə bilir
- [x] 3 gündən sonra kuryer tarixçəsindən avtomatik yox olur
- [x] Admin paneldə "Çatdırılma — Kuryerlər" tabı (CRUD + son 30 günün imzaları)

## Files Touched
### New
- src/services/courierService.ts
- src/components/admin/CourierManagementTab.tsx

### Modified
- src/pages/DeliveryPage.tsx (tamamilə yenidən yazıldı)
- src/pages/MyOrdersPage.tsx
- src/pages/B2BOrdersPage.tsx
- src/services/b2bOrderService.ts
- src/services/customerOrderService.ts
- src/components/admin/AdminPanel.tsx
- src/components/admin/CustomerOrdersTab.tsx
- src/App.tsx

## Backlog / Next
- P2: Kuryerin imza atdıqdan sonra müştəriyə avtomatik bildiriş (SMS/Email)
- P2: Kuryerlər üçün gündəlik təhvil verilmiş sifarişlər statistikası
- P2: 3 günlük "history" üçün cron-job (frontend-də filtrlənir, gərək yox)

## Recent Update — 2026-01 — Kampaniya Promo Kodları (Bloger/Influencer)
Admin paneldə **PromoCodes tab**-a yeni "Kampaniya kodları" alt-bölməsi əlavə edildi.
Bloger/influencer izləyiciləri eyni kodu istifadə edib endirim ala bilir.

### Sahələr
- **Kod**: alphanumeric, 3-20 simvol (məs: BLOGER10)
- **Endirim faizi**: 5/10/15/20 sürətli seçim VƏ custom rəqəm (1-99%)
- **Başlama / bitmə tarixi**: datetime-local picker
- **İstifadə limiti**: max neçə dəfə (boş = limitsiz)
- **Influencer adı**: qeyd üçün
- **Aktiv/Deaktiv toggle**: admin manual idarə edə bilər
- **Avtomatik silinmə**: müddəti bitmiş kodlar tab açılanda silinir

### Statistika
- Hər kodun istifadə sayı + progress bar (əgər limit var)
- "İstifadə tarixçəsi" açılır panel: kim (ad/email), nə vaxt, hansı sifariş ilə

### Dəyişən fayllar
- src/services/promoCodeService.ts (campaign yardımçı funksiyalar, validate/redeem
  alphanumeric kodları və müddət/limit yoxlamalarını dəstəkləyir)
- src/components/admin/PromoCodesTab.tsx (sub-tab keçidi əlavə olundu)
- src/pages/CartPage.tsx (regex `/^\d{6}$/` → `/^[A-Z0-9]{3,20}$/`)


---

## Endirim Kampaniyaları və Popup Sistemi (Yan 2026)

### Məqsəd
Bütün məhsullara bir kliklə qlobal endirim tətbiq etmək, brend əsasında istisna/fərqli faiz təyin etmək, kampaniya zamanı ziyarətçilərə popup göstərmək.

### Endirim Qaydaları
- **Option C**: Yalnız `salePrice`-ı olmayan məhsullara tətbiq olunur (mövcud endirimlər qorunur)
- **Brend override** (hər ikisi dəstəklənir):
  - `exclude`: həmin brend tamamilə istisna
  - `custom`: həmin brend üçün fərqli faiz
- **Tarix məhdudiyyəti**: startDate/endDate ISO; isCampaignLive() həm `isActive` toggle, həm tarix aralığını yoxlayır
- **Aktivləşmə**: productService.getAll/getByCategory/getBestSellers/getById səviyyəsində avtomatik (60s in-memory cache, admin save edəndə invalidate)

### Popup Davranışı
- Hər sessiyada bir dəfə (sessionStorage)
- Admin tərəfindən: şəkil, başlıq, qısa mətn, düymə mətni+linki, gecikmə (saniyə)
- X düyməsi sağ küncdə + arxa fona klik → bağlanır
- Admin/auth səhifələrində göstərilmir

### Firestore
- `campaigns/current` (tək doc) — Campaign tipi
- Storage: `campaigns/{timestamp}_{filename}` — popup şəkilləri

### Dəyişən / yeni fayllar
- `src/services/campaignService.ts` (yeni)
- `src/services/productService.ts` (kampaniya transform avtomatik tətbiq)
- `src/components/CampaignPopup.tsx` (yeni)
- `src/components/admin/CampaignsTab.tsx` (yeni)
- `src/components/admin/AdminPanel.tsx` (yeni tab Marketing & Məzmun qrupunda)
- `src/App.tsx` (CampaignPopup mount)

## Chat Widget Redizaynı (Yan 2026)
- Launcher kiçildi: 56px → 44px
- Border rəngi: #c9a14a → **#D4AF37** (De Valeur logo qızılı)
- "Mütəxəssisdən tövsiyə al" bubble: Sparkles ikonu + qızıl shimmer animation + diqqətçəkən bob effekti, qara qalın font
- Chat panel: qızıl border, AI Mütəxəssis subtitle, rounded mesaj bubbles, send düyməsi hover-də qızıl
- Yeni CSS animasiyaları: dv-ai-greet-attn, dv-ai-shimmer, dv-ai-panel-in, dv-ai-msg-in


## Update: 2026-01-XX — Filter minimisation, Red Gift Card, B2B campaign isolation
- ProductsPage filter sidebar made more minimal & narrower: grid changed from `lg:grid-cols-4` (filter 25%) to `lg:grid-cols-5` (filter 20%); sidebar uses lighter borders, uppercase labels, tighter spacing; FilterSection headings restyled.
- Header Gift Card link (desktop + mobile) restyled to blood red (`#8B0000`) with a sweeping mirror/shine animation on hover (`dv-giftcard-shine` keyframes added in `index.css`). Same look regardless of login state.
- Campaign discounts (`campaignService.applyCampaignToProducts`) now skipped entirely for B2B users in `productService.ts` (`getAll`, `getByCategory`, `getBestSellers`, `getById`). B2B users see only their B2B prices — no campaign discount overlay.
- `CampaignPopup` no longer opens for B2B/admin users.
- `ProductsPage` "Endirimli məhsullar" filter checkbox hidden for B2B users (no discounts to filter by for them).



---

## Hissəli Alış Kalkulyatoru + Taksitlə Al Kartları (Yan 2026)

### Məqsəd
Məhsul səhifəsində (yalnız adi müştərilərə) interaktiv hissəli alış kalkulyatoru
və "Taksitlə al" bank kartı bölməsi göstərilsin. Admin paneldən hər brendə görə
ay/faiz cədvəli və bank kartları (loqo + dəstəklənən aylar) konfiqurasiya edilsin.

### Qaydalar
- **Brend faizi məntiqi** (admin tabında qurulur):
  - Brend üçün ay→faiz cədvəli təyin olunarsa → həmin aylar göstərilir
  - Brend cədvəldə yoxdursa VƏ YA cədvəl boşdursa → **defaultMonths** istifadə
    olunur (hamısı 0% — faizsiz)
- **Aylıq hesablama**: `(price * (1 + percent/100)) / months`
  (faiz 0 olduqda sadəcə `price / months`)
- **B2B istifadəçiləri**: kalkulyator B2B-də göstərilmir
- **Taksitlə al kartları** (faizsiz): hər kart üçün loqo + dəstəklənən aylar.
  Klik → ay dəyişir (cycle).

### Firestore
- `creditCalculator/config` (tək doc):
  ```
  {
    enabled: bool,
    defaultMonths: [6,9,12,15,18,24],
    brandRates: [{ brand, rates: [{ months, percent }] }],
    installmentCards: [{ id, name, logoUrl, months, bgColor, isActive }]
  }
  ```
- Storage: `installmentCards/{timestamp}_{filename}` — kart loqoları

### Dəyişən / yeni fayllar
- `src/services/creditCalculatorService.ts` (yeni)
- `src/components/CreditCalculator.tsx` (yeni — məhsul səhifəsi komponenti)
- `src/components/admin/CreditCalculatorTab.tsx` (yeni — admin tab)
- `src/components/admin/AdminPanel.tsx` (yeni tab: Marketing & Məzmun → Kredit Kalkulyatoru)
- `src/pages/ProductPage.tsx` (CreditCalculator mount — /product/:id)
- `src/pages/ProductDetailsPage.tsx` (CreditCalculator mount — /products/:productId)
