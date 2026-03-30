# PRD - İşçi İdarəetmə Sistemi (De Valeur)

## Problem Statement
1. İşçilər səhifəsində QR kod oxutma sistemi düzəldilsin
2. Cərimə etdikdə məbləğ + bal ayrı yazılsın
3. İşçinin səhifəsində cərimələr görsənsin

## Architecture
- **Frontend**: Vite + React + TypeScript
- **Backend**: Firebase (Firestore, Auth)
- **Database**: Firebase Firestore
- **QR System**: html5-qrcode library + qrcode.react

## User Personas
1. **Admin**: İşçiləri idarə edir, QR kod yaradır, cərimə/mükafat yazır
2. **İşçi**: Admin QR kodunu telefon ilə skan edərək giriş/çıxış edir

## What's Been Implemented (2024-03-30)

### QR Sistem:
- [x] QR kod URL formatında yaradılır: `{domain}/workers/qr-scan?session={token}`
- [x] İşçilər YALNIZ admin QR kodu ilə giriş-çıxış edə bilər
- [x] 1-ci skan = Giriş, 2-ci skan = Çıxış + imza

### Cərimə Sistemi (YENİ):
- [x] **Cərimə növü** əlavə edildi (Təşəkkür, Xəbərdarlıq, Töhmət, Cərimə)
- [x] **Məbləğ (₼)** ayrı field - admin istədiyi məbləği yazır
- [x] **Bal təsiri** ayrı field - admin istədiyi balı yazır
- [x] Admin panelində cərimə siyahısında məbləğ göstərilir

### İşçi Dashboard:
- [x] **Cərimə/Xəbərdarlıq bölümü** əlavə edildi
- [x] Hər qeyd üçün növ, səbəb, bal və məbləğ göstərilir
- [x] Cəmi cərimə məbləği hesablanır və göstərilir

## Test Results
- **Kod strukturu**: 100% uğurlu
- **Frontend**: 70% (Firebase Auth session problemi)

## URLs
- QR Skan: /workers/qr-scan?session={token}
- Admin Davranış: /workers/admin → Davranış tabı

## Test Credentials
- Admin: rasimgasimzade@gmail.com / Rasim2323
