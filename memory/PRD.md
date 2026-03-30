# İşçi İdarəetmə Sistemi PRD

## Original Problem Statement
İşçi İdarəetmə Sistemi – Nəzarət + Motivasiya layihəsi:
- /workers linkində işçilərin girişi
- Davamiyyət nəzarəti (giriş/çıxış saatı, gecikmə, erkən çıxış)
- Real vaxt izləmə
- Davranış qeydləri (xəbərdarlıq, töhmət, təşəkkür)
- Performans balı sistemi (davamiyyət 30%, satış 40%, intizam 20%, aktivlik 10%)
- Bonus paneli
- Reytinq sistemi (1-7)
- Badge sistemi

## Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Firestore + Authentication)
- **Styling**: Tailwind CSS
- **State Management**: React Context

## User Personas
1. **Admin** - İşçi yaratma, davamiyyət izləmə, performans idarəetmə
2. **İşçi** - Giriş/çıxış, öz performansını görür, badge qazanır

## Core Requirements
### Nəzarət funksiyaları ✅
- Davamiyyət nəzarəti (giriş/çıxış saatı)
- Gecikmə avtomatik hesablanması
- Erkən çıxış qeydiyyatı
- Real vaxt izləmə
- Davranış qeydləri

### Motivasiya funksiyaları ✅
- Performans balı sistemi
- Bonus paneli
- Reytinq sistemi
- Badge sistemi

## What's Been Implemented

### 2026-03-30
1. **Admin Login sistemi yeniləndi** ✅
   - Admin email: rasim@gmail.com
   - WorkerContext.tsx yeniləndi
   - AdminLogin.tsx yeniləndi

2. **UI Komponentləri** ✅
   - /workers - İşçi giriş səhifəsi
   - /workers/admin-login - Admin giriş səhifəsi
   - /workers/dashboard - İşçi dashboard
   - /workers/admin - Admin panel

3. **Services** ✅
   - employeeService.ts - İşçi CRUD
   - attendanceService.ts - Davamiyyət
   - performanceService.ts - Performans
   - bonusService.ts - Bonus
   - badgeService.ts - Badge
   - behaviorService.ts - Davranış
   - salesService.ts - Satış

4. **Admin Panel Tabs** ✅
   - Dashboard statistika
   - Real vaxt izləmə
   - İşçilər idarəetmə
   - Davamiyyət
   - Davranış
   - Performans
   - Bonuslar

## Files Modified
- /app/src/context/WorkerContext.tsx
- /app/src/pages/workers/AdminLogin.tsx

## Prioritized Backlog

### P0 (Critical) - Tamamlandı
- [x] İşçi giriş səhifəsi
- [x] Admin giriş səhifəsi
- [x] Admin panel
- [x] Davamiyyət sistemi

### P1 (High) - Firebase Auth Setup Gözlənir
- [ ] Admin hesabı Firebase-də yaradılmalı (rasim@gmail.com / Rasim2323)

### P2 (Medium)
- [ ] Aylıq HR report
- [ ] Mağaza üzrə müqayisə

### P3 (Low)
- [ ] Email bildirişləri
- [ ] PDF export

## Next Steps
1. Firebase Console-da admin hesabı yaratmaq
2. Test işçilər əlavə etmək
3. Satış data əlavə etmək
