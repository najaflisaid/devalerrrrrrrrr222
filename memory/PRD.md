# De Valeur E-Commerce PRD

## Original Problem Statement
- "Tezliklə" bölməsi adminde işləmir - məhsul edit edəndə save olunmur
- Endirimli məhsullar işləmir
- Bloq səhifəsi pis dizayndır
- Bloq detay səhifəsində yazılar ortada olmalıdır

## Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Firestore)
- **Styling**: Tailwind CSS
- **i18n**: i18next (az, ru dillər)

## User Personas
1. **Admin** - Məhsul, bloq, banner idarəetməsi
2. **B2B User** - Topdan alış, xüsusi qiymətlər
3. **Customer** - Normal müştəri

## Core Requirements (Static)
- Məhsul kataloqu
- Səbət funksionallığı
- Admin panel
- B2B giriş sistemi
- Çoxdilli dəstək (az/ru)

## What's Been Implemented

### 2026-01-28
1. **"Tezliklə" Bug Fix** ✅
   - `AdminPanel.tsx` - `handleUpdateProduct` funksiyasına `comingSoon` sahəsi əlavə edildi
   - Məhsul edit edəndə "Tezliklə" checkbox düzgün save olunur

2. **Endirimli Məhsullar Filter** ✅
   - "Endirimli məhsullar" seçiləndə bütün filtrlər "Hamısı" olur
   - Kateqoriya/Brend/Cins seçiləndə endirimli filtr avtomatik ləğv edilir
   - URL parametrləri düzgün idarə olunur
   - `useEffect`-ə `searchParams` dependency əlavə edildi

3. **Bloq Səhifəsi Dizayn** ✅
   - Modern hero section
   - Featured post (ilk yazı böyük)
   - Kartlarda hover effektlər
   - Responsive grid layout

4. **Bloq Detay Səhifəsi** ✅
   - Mətnlər ortada (centered)
   - Hero şəkil + overlay
   - Oxuma vaxtı göstəricisi
   - Paylaş funksiyası
   - i18n tərcümələri (az/ru)

## Prioritized Backlog

### P0 (Critical)
- [x] Tezliklə checkbox save problemi
- [x] Endirimli məhsullar filter məntiq

### P1 (High)
- [x] Bloq səhifəsi yenidən dizayn
- [x] Bloq detay səhifəsi

### P2 (Medium)
- [ ] Ana səhifədə "Endirimli Məhsullar" bölməsi
- [ ] Daha çox endirimli məhsul əlavə etmək

### P3 (Low)
- [ ] TypeScript type xətalarını düzəltmək
- [ ] Performance optimizasiyası

## Files Modified
- `/app/src/components/admin/AdminPanel.tsx`
- `/app/src/pages/ProductsPage.tsx`
- `/app/src/pages/BlogPage.tsx`
- `/app/src/pages/BlogDetailPage.tsx`
- `/app/src/i18n/locales/az.json`
- `/app/src/i18n/locales/ru.json`
- `/app/vite.config.ts`
