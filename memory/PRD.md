# De Valeur E-Commerce PRD

## Original Problem Statement
- "Tezliklə" bölməsi adminde işləmir - məhsul edit edəndə save olunmur
- Endirimli məhsullar işləmir
- Bloq səhifəsi pis dizayndır
- Bloq detay səhifəsində yazılar ortada olmalıdır
- B2B sifarişlərdə endirimsiz qiymət, endirim və ödəniləcək məbləğ düzgün göstərilməli

## Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Firestore + Authentication)
- **Styling**: Tailwind CSS
- **i18n**: i18next (az, ru dillər)

## User Personas
1. **Admin** - Məhsul, bloq, banner, B2B sifariş idarəetməsi
2. **B2B User** - Topdan alış, xüsusi qiymətlər, endirim
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

2. **Endirimli Məhsullar Filter** ✅
   - "Endirimli məhsullar" seçiləndə bütün filtrlər "Hamısı" olur
   - Kateqoriya/Brend/Cins seçiləndə endirimli filtr avtomatik ləğv edilir

3. **Bloq Səhifəsi Dizayn** ✅
   - Modern hero section, Featured post, Hover effektlər

4. **Bloq Detay Səhifəsi** ✅
   - Mətnlər ortada (centered), Hero şəkil + overlay

5. **B2B Sifariş Sistemi** ✅
   - `subtotal` (endirimsiz qiymət) sahəsi əlavə edildi
   - Admin paneldə: Endirimsiz qiymət, Endirim, Ödəniləcək məbləğ göstərilir
   - Müştəri səhifəsində: Eyni məlumatlar göstərilir
   - Miqdar azaldıqda/artırıldıqda endirim proporsional olaraq yenidən hesablanır
   - `updateOrderItemQuantity` və `removeOrderItem` funksiyaları yeniləndi

## Files Modified
- `/app/src/components/admin/AdminPanel.tsx`
- `/app/src/components/admin/B2BOrdersTab.tsx`
- `/app/src/pages/ProductsPage.tsx`
- `/app/src/pages/BlogPage.tsx`
- `/app/src/pages/BlogDetailPage.tsx`
- `/app/src/pages/B2BOrdersPage.tsx`
- `/app/src/services/b2bOrderService.ts`
- `/app/src/i18n/locales/az.json`
- `/app/src/i18n/locales/ru.json`
- `/app/vite.config.ts`

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Tezliklə checkbox save problemi
- [x] Endirimli məhsullar filter məntiqi
- [x] B2B sifariş qiymət hesablanması

### P1 (High) - DONE
- [x] Bloq səhifəsi yenidən dizayn
- [x] Bloq detay səhifəsi

### P2 (Medium)
- [ ] Ana səhifədə "Endirimli Məhsullar" bölməsi

### P3 (Low)
- [ ] TypeScript type xətalarını düzəltmək
