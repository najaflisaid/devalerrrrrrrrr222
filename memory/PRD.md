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
- **Müştəri**: Sayta baxır, məhsul alır (WhatsApp + kredit ərizəsi)
- **B2B partner**: Loginlə daxil olur, b2b qiymətlərlə sifariş verir
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
- **P1**: Web3Forms əvəzinə Resend və ya admin paneldə real-time bildiriş zəngi (email kvota probleminin həqiqi həlli)
- **P2**: Firestore index-ləri (test_reports/iteration_5.json-dan: attendance_requests, performance kolleksiyaları üçün)
- **P2**: Admin session persistence (workers/admin paneldə tab navigasiyası problemi)
- **P3**: PWA dəstəyi mobil cihazlar üçün

## Key Files Modified
- `/app/src/pages/CartPage.tsx`
- `/app/src/services/contentService.ts`
- `/app/src/components/admin/AboutManagementTab.tsx`
- `/app/src/pages/AboutPage.tsx`
