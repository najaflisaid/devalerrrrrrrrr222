# PRD - İşçi İdarəetmə Sistemi (De Valeur)

## Problem Statement
1. QR kod sistemi silinsin
2. İşçi "İşə Başla" bassın → Admin-ə sorğu gəlsin
3. Admin təsdiq/ləğv edə bilsin
4. Çıxış üçün də eyni sistem
5. Cərimə sistemi - məbləğ + bal ayrı

## Architecture
- **Frontend**: Vite + React + TypeScript
- **Backend**: Firebase (Firestore, Auth)
- **Database**: Firebase Firestore
- **Real-time**: Firebase onSnapshot listeners

## What's Been Implemented (2024-03-30)

### YENİ: Sorğu Sistemi
- [x] **İşçi Dashboard-da**:
  - "İşə Başla" düyməsi (giriş sorğusu göndərir)
  - "Çıxış Et" düyməsi (çıxış sorğusu göndərir)
  - Gözləmədə olan sorğu statusu göstərilir
  - Ləğv edilmiş sorğu mesajı göstərilir

- [x] **Admin Panelində "Sorğular" tabı**:
  - Real-time sorğu siyahısı
  - Təsdiq/Ləğv düymələri
  - Gözləyən sorğu sayı badge ilə göstərilir
  - Ləğv səbəbi yazıla bilər

- [x] **Request Service** (`/app/src/services/requestService.ts`):
  - createAttendanceRequest - sorğu yaratma
  - approveRequest - təsdiq (avtomatik checkIn/checkOut)
  - rejectRequest - ləğv
  - subscribeToPendingRequests - real-time admin dinləmə
  - subscribeToMyRequests - işçinin öz sorğularını dinləmə

### SİLİNDİ:
- [x] QR kod sistemi (QRCodePanel RealTimeMonitoring-dən silindi)
- [x] QRScanPage artıq istifadə olunmur

### Cərimə Sistemi:
- [x] Məbləğ (₼) + Bal ayrı yazılır
- [x] İşçi Dashboard-da cərimələr göstərilir

## Firebase Index Tələbi ⚠️
Admin paneli üçün bu indexlər Firebase Console-da yaradılmalıdır:
- `attendance_requests` collection: `status` + `sorguVaxti`
- `performances` collection: mövcud index tələbi

## URLs
- İşçi Dashboard: /workers/dashboard
- Admin Panel: /workers/admin
- Sorğular: Admin Panel → "Sorğular" tabı

## Test Credentials
- Admin: rasimgasimzade@gmail.com / Rasim2323
