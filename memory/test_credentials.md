# Test Credentials - İşçi İdarəetmə Sistemi

## Admin Credentials (Firebase Auth-da yaradılmalı)
- **Email:** rasimgasimzade@gmail.com
- **Password:** Rasim2323
- **URL:** /workers/admin-login

## Admin Hesabı Yaratma Təlimatı
1. Firebase Console-a daxil olun: https://console.firebase.google.com
2. "devaleur-11742" layihəsini seçin
3. Sol menyudan "Authentication" → "Users" bölməsinə keçin
4. "Add user" düyməsinə basın
5. Email: rasimgasimzade@gmail.com, Password: Rasim2323 daxil edin
6. "Add user" ilə təsdiqləyin

## QR Kod Sistemi
- Admin paneldə "Real Vaxt İzləmə" tabında QR kod yaradılır
- QR kod hər 1 saat keçərlidir
- İşçilər QR skan edərək giriş/çıxış edirlər
- Eyni QR ilə eyni işçi 2 dəfə giriş edə bilmir

## İşçi Test Credentials
İşçilər admin panel vasitəsilə yaradılır. Yaradıldıqda Firebase Auth-da da avtomatik hesab yaranır.

## Linkler
- İşçi Girişi: /workers
- Admin Girişi: /workers/admin-login
- Admin Panel: /workers/admin
- İşçi Dashboard: /workers/dashboard
