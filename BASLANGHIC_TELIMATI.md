# İŞÇİ İDARƏETMƏ SİSTEMİ - BAŞLANĞIC TƏLİMATI

## 🎯 İLK ADDIMLAR

### 1. Firebase Hesabları Yaradın

Sistemdə işləmək üçün əvvəlcə Firebase Console-da test hesabları yaratmalısınız.

**Firebase Console Linki:** https://console.firebase.google.com/project/devaleur-11742/authentication/users

#### Admin Hesabı Yaradın:
1. Firebase Console → Authentication → Users
2. "Add user" düyməsinə basın
3. Məlumatları daxil edin:
   - **Email:** admin@devaleur.az
   - **Password:** Admin123!
4. "Add user" düyməsinə basın

#### İşçi Hesablarını Yaradın:

**İşçi 1:**
- **Email:** aysel.mammadova@devaleur.az
- **Password:** Test123!

**İşçi 2:**
- **Email:** elvin.hasanov@devaleur.az
- **Password:** Test123!

**İşçi 3:**
- **Email:** leyla.aliyeva@devaleur.az
- **Password:** Test123!

### 2. Admin Olaraq Daxil Olun

1. Browser-də açın: `http://localhost:3000/workers/admin-login`
2. Login edin:
   - Email: admin@devaleur.az
   - Password: Admin123!

### 3. İşçiləri Sistemə Əlavə Edin

Admin Panel-də:
1. "İşçilər" tabına keçin
2. "Yeni İşçi" düyməsinə basın
3. Hər işçi üçün məlumatları doldurun:

**İşçi 1 - Ayşəl Məmmədova:**
```
Ad: Ayşəl
Soyad: Məmmədova
Email: aysel.mammadova@devaleur.az
Telefon: +994501234567
Vəzifə: Satış meneceri
Mağaza: Ana mağaza
Məzuniyyət Qalığı: 20
```

**İşçi 2 - Elvin Həsənov:**
```
Ad: Elvin
Soyad: Həsənov
Email: elvin.hasanov@devaleur.az
Telefon: +994502345678
Vəzifə: Kassir
Mağaza: Ana mağaza
Məzuniyyət Qalığı: 18
```

**İşçi 3 - Leyla Əliyeva:**
```
Ad: Leyla
Soyad: Əliyeva
Email: leyla.aliyeva@devaleur.az
Telefon: +994503456789
Vəzifə: Satış məsləhətçisi
Mağaza: Ana mağaza
Məzuniyyət Qalığı: 22
```

### 4. İşçi Kimi Test Edin

1. Yeni tab-da açın: `http://localhost:3000/workers`
2. İşçi hesabı ilə daxil olun (məsələn: aysel.mammadova@devaleur.az / Test123!)
3. "Giriş Et" düyməsinə basın
4. Dashboard-u araşdırın

### 5. Admin Funksiyalarını Test Edin

Admin Panel-də:

#### Real-Vaxt İzləmə:
- "Real Vaxt İzləmə" tabına keçin
- İşdə olanları görün
- Filter edin (İşdə, Gecikənlər və s.)

#### Davranış Qeydi Əlavə Edin:
- "Davranış" tabına keçin
- "Yeni Qeyd" düyməsinə basın
- İşçi seçin
- Növ seçin (Xəbərdarlıq, Töhmət və ya Təşəkkür)
- Səbəb yazın
- Əlavə edin

#### Performans Hesablayın:
- "Performans" tabına keçin
- Ay seçin
- "Hamısını Hesabla" düyməsinə basın
- Gözləyin (hər işçi üçün hesablanacaq)
- Nəticələrə baxın

#### Bonusları Yoxlayın:
- "Bonuslar" tabına keçin
- Avtomatik yaranmış bonusları görün

## 📊 SİSTEM İSTİFADƏ SSENARISINI

### Səhər (İşə Gələndə):
1. İşçi `/workers` linkindən daxil olur
2. Email və şifrə ilə login edir
3. "Giriş Et" düyməsinə basır
4. Sistem gecikmə varsa avtomatik hesablayır

### Gün Ərzində:
1. Admin real-vaxt izləməni yoxlayır
2. Lazım olduqda davranış qeydi əlavə edir
3. İşçi öz dashboard-ında statistikalarını görür

### Axşam (İşdən Çıxanda):
1. İşçi dashboard-a keçir
2. "Çıxış Et" düyməsinə basır
3. İş saatı avtomatik hesablanır

### Ay Sonu:
1. Admin "Performans" tabına keçir
2. "Hamısını Hesabla" edir
3. Sistem:
   - Performans balını hesablayır
   - Bonus verir
   - Badge verir (şərtlərə uyğun olarsa)
   - Reytinq hesablayır

## 🎨 İNTERFEYS BƏLMƏLƏRİ

### İşçi Dashboard:
- ✅ Check-In/Check-Out kartı
- ✅ Bu ay iş saatı
- ✅ Performans balı
- ✅ Bonus məbləği
- ✅ Gecikmə sayı
- ✅ Satış hədəfi progress bar
- ✅ Badgelər
- ✅ Son davamiyyət cədvəli

### Admin Panel:
- ✅ Dashboard (statistikalar)
- ✅ Real-vaxt izləmə
- ✅ İşçilər (CRUD)
- ✅ Davamiyyət
- ✅ Davranış qeydləri
- ✅ Performans hesablaması
- ✅ Bonuslar

## 🔍 PROBLEM HƏLLI

### Firebase Xətası:
```
Error: Missing Supabase environment variables
```
**Həll:** Sistem Firebase istifadə edir, Supabase deyil. Xəta firestore-dan gəlirsə, Firebase konfigurasiyası düzgündür.

### Giriş Xətası:
```
Email və ya şifrə yanlışdır
```
**Həll:** 
1. Firebase Console-da hesab yaradıldığını yoxlayın
2. Email və şifrəni düzgün yazdığınızdan əmin olun
3. Admin hesabı üçün düzgün linki istifadə edin (/workers/admin-login)

### İşçi Tapılmadı:
```
İşçi məlumatı yoxdur
```
**Həll:**
1. Admin panel-dən işçini əlavə edin
2. Firebase Console → Firestore → employees collection-da data olduğunu yoxlayın

## 📱 QISA KEÇIDLƏR

### Linklar:
- Ana səhifə: `http://localhost:3000`
- İşçi girişi: `http://localhost:3000/workers`
- Admin girişi: `http://localhost:3000/workers/admin-login`
- İşçi dashboard: `http://localhost:3000/workers/dashboard`
- Admin panel: `http://localhost:3000/workers/admin`

### Test Hesabları:
```
ADMIN:
admin@devaleur.az / Admin123!

İŞÇİLƏR:
aysel.mammadova@devaleur.az / Test123!
elvin.hasanov@devaleur.az / Test123!
leyla.aliyeva@devaleur.az / Test123!
```

## ✅ SİSTEM HAZIRDIR!

Bütün funksiyalar işləkdir:
- ✅ Firebase Authentication qurulub
- ✅ Firestore database hazırdır
- ✅ İşçi və Admin panelləri hazırdır
- ✅ Check-in/Check-out işləyir
- ✅ Performans hesablama işləyir
- ✅ Bonus və badge sistemləri işləyir
- ✅ Real-vaxt izləmə işləyir

## 🎉 BAŞLAYAQ!

1. Firebase Console-da hesabları yaradın
2. Admin olaraq daxil olun
3. İşçiləri əlavə edin
4. İşçi olaraq test edin
5. Admin funksiyalarını sınayın

**Uğurlar! Sistem tam hazırdır və Azərbaycan dilindədir! 🚀**
