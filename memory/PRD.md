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
