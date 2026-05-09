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
