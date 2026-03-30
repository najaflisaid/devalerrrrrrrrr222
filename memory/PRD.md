# PRD - İşçi İdarəetmə Sistemi (De Valeur)

## Problem Statement
İşçilər səhifəsində QR kod oxutma sistemi və işə giriş-çıxış sistemini düzəltmək. İşçi QR kod skan etdikdə:
- 1-ci skan = İşə giriş yazılsın
- 2-ci skan = İşdən çıxış yazılsın
- Admin panelində real-vaxt görünsün

## Architecture
- **Frontend**: Vite + React + TypeScript
- **Backend**: Firebase (Firestore, Auth)
- **Database**: Firebase Firestore
- **QR System**: html5-qrcode library

## User Personas
1. **Admin**: İşçiləri idarə edir, QR kod yaradır, giriş-çıxışları izləyir
2. **İşçi**: QR skan edərək giriş/çıxış edir, öz statistikasını görür

## Core Requirements
- [x] İşçi giriş sistemi (Firebase Auth)
- [x] Admin giriş sistemi
- [x] QR kod yaratma (Admin panelində)
- [x] QR skan ilə giriş (1-ci skan)
- [x] QR skan ilə çıxış (2-ci skan)
- [x] Real-vaxt monitorinq (Admin panelində)
- [x] Session persistence (browserLocalPersistence)

## What's Been Implemented (2024-03-30)
1. **WorkerDashboard QR Skan düzəldildi**:
   - Real-time attendance check əlavə edildi
   - Giriş/Çıxış əməliyyatları ayrıldı
   - Vaxt göstərilməsi əlavə edildi
   - UI yaxşılaşdırıldı

2. **RealTimeMonitoring yaxşılaşdırıldı**:
   - Yeniləmə düyməsi əlavə edildi
   - Son yeniləmə vaxtı göstərilir
   - Giriş/Çıxış vaxtları ayrıca göstərilir
   - Auto-refresh 10 saniyəyə endirildi

3. **Session Persistence**:
   - browserLocalPersistence əlavə edildi
   - Session artıq tez bitmır

## Prioritized Backlog
### P0 (Kritik - Tamamlandı)
- [x] QR skan sistemi

### P1 (Yüksək)
- [ ] QR kod yazdırma funksiyası
- [ ] İşçi gecikmə hesabatı

### P2 (Orta)
- [ ] Aylıq hesabat export
- [ ] İcazə sistemi

## Test Credentials
- Admin: rasimgasimzade@gmail.com / Rasim2323
- İşçilər admin panelindən yaradılır

## URLs
- İşçi Girişi: /workers
- Admin Girişi: /workers/admin-login
- Admin Panel: /workers/admin-dashboard
- İşçi Dashboard: /workers/dashboard
