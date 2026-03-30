# PRD - İşçi İdarəetmə Sistemi (De Valeur)

## Problem Statement
İşçilər səhifəsində QR kod oxutma sistemi və işə giriş-çıxış sistemini düzəltmək. İşçi QR kod skan etdikdə:
- 1-ci skan = İşə giriş yazılsın
- 2-ci skan = İşdən çıxış yazılsın
- Admin panelində real-vaxt görünsün

**YENİ**: İşçilər YALNIZ admin-in yaratdığı QR kod linki ilə giriş-çıxış edə bilər.

## Architecture
- **Frontend**: Vite + React + TypeScript
- **Backend**: Firebase (Firestore, Auth)
- **Database**: Firebase Firestore
- **QR System**: html5-qrcode library + qrcode.react

## User Personas
1. **Admin**: İşçiləri idarə edir, QR kod yaradır, giriş-çıxışları izləyir
2. **İşçi**: Admin QR kodunu telefon ilə skan edərək giriş/çıxış edir

## Core Requirements
- [x] İşçi giriş sistemi (Firebase Auth)
- [x] Admin giriş sistemi
- [x] QR kod yaratma (URL formatında)
- [x] QR skan ilə giriş (1-ci skan)
- [x] QR skan ilə çıxış (2-ci skan + imza)
- [x] Real-vaxt monitorinq (Admin panelində)
- [x] Session persistence

## What's Been Implemented (2024-03-30)

### İlkin dəyişikliklər:
1. WorkerDashboard QR Skan düzəldildi
2. RealTimeMonitoring yaxşılaşdırıldı
3. Session Persistence əlavə edildi

### Son dəyişikliklər (v2):
1. **QR Sistem dəyişdirildi**:
   - QR kod indi URL formatında yaradılır: `{domain}/workers/qr-scan?session={token}`
   - İşçilər telefon ilə QR kodu skan edib linki açırlar
   - Dashboard-dakı QR skan düyməsi silindi
   
2. **QRScanPage yaxşılaşdırıldı**:
   - Session token validation əlavə edildi
   - Giriş/Çıxış avtomatik təyin olunur
   - Çıxışda imza tələb olunur
   
3. **QRCodePanel yeniləndi**:
   - URL formatında QR kod yaradılır
   - Təlimatlar əlavə edildi (1-ci skan = Giriş, 2-ci skan = Çıxış)

## Test Results
- **Frontend**: 100% uğurlu
- Admin QR yaradır
- İşçi telefon ilə skan edir
- Giriş/Çıxış düzgün qeyd olunur
- Admin panelində real-vaxt görünür

## Prioritized Backlog
### P0 (Kritik - Tamamlandı)
- [x] QR skan sistemi
- [x] Yalnız admin QR ilə giriş

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
- QR Skan Səhifəsi: /workers/qr-scan?session={token}
