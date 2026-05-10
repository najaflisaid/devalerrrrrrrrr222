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

