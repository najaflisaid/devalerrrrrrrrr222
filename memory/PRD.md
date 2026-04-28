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

### 2026-01-28 (current session) — Epoint ödəniş sistemi + Müştəri sifarişləri
1. **Backend Epoint inteqrasiyası** (`/app/backend/server.py`):
   - `POST /api/epoint/create` — signed payment request, Epoint redirect URL qaytarır
   - `POST /api/epoint/verify` — redirect-back data+signature doğrulaması
   - `POST /api/epoint/result` — server-to-server webhook (Firestore-u Firestore REST API ilə yeniləyir)
   - SHA1 sandwich signature: `base64(sha1(private_key + base64_data + private_key))`
2. **Müştəri sifariş sistemi**:
   - Yeni `customer_orders` Firestore kolleksiyası (sequential orderNumber counter)
   - `/app/src/services/customerOrderService.ts` — CRUD + status idarəetməsi
   - `/app/src/services/epointPaymentService.ts` — backend ilə körpü
3. **Yeni səhifələr**:
   - `/my-orders` — Müştəri sifariş tarixçəsi + statuslara görə vizual timeline (Ödəniş → Hazırlanır → Yoldadır → Təhvil verildi)
   - `/payment/success` — signature verify edir, sifariş statusunu `preparing` edir, səbəti təmizləyir
   - `/payment/error` — sifarişi `payment_failed` edir
4. **Cart ödəniş axını dəyişdirildi** (yalnız müştəri üçün):
   - WhatsApp əvəzinə "Epoint ilə ödə" düyməsi
   - Modal: telefon, ünvan, qeyd → Epoint redirect
   - B2B email flow saxlanılır
5. **WhatsApp düymələri silindi**: `ProductPage`, `ProductDetailsPage`, `ProductCard` — indi səbətə yönləndirir
6. **"Sifarişlərim" linki Header-də**: müştərilər üçün desktop və mobil menyularda
7. **Admin Panel — yeni `Müştəri Sifarişləri` tabı** (`CustomerOrdersTab.tsx`):
   - Bütün customer sifarişlərini list edir (filtr, axtarış)
   - Status dəyişdirmək: pending_payment → preparing → shipping → delivered → cancelled
   - Müştərinin "Təhvil aldım" düyməsi `delivered` statusu işarələyir

## Key Files Modified / Created
### Yaradıldı
- `/app/backend/server.py` (Epoint integration)
- `/app/backend/.env` (Epoint config)
- `/app/backend/requirements.txt`
- `/app/frontend/.env`
- `/app/src/services/customerOrderService.ts`
- `/app/src/services/epointPaymentService.ts`
- `/app/src/pages/MyOrdersPage.tsx`
- `/app/src/pages/PaymentSuccessPage.tsx`
- `/app/src/pages/PaymentErrorPage.tsx`
- `/app/src/components/admin/CustomerOrdersTab.tsx`

### Redaktə edildi
- `/app/src/App.tsx` (yeni route-lar)
- `/app/src/pages/CartPage.tsx` (Epoint flow)
- `/app/src/pages/ProductPage.tsx` (WhatsApp silindi)
- `/app/src/pages/ProductDetailsPage.tsx` (WhatsApp silindi)
- `/app/src/components/ProductCard.tsx` (WhatsApp silindi)
- `/app/src/components/Header.tsx` (Sifarişlərim linki)
- `/app/src/components/admin/AdminPanel.tsx` (yeni tab)
