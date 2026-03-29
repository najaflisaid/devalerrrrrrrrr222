# İşçi İdarəetmə Sistemi

Tam funksiyalı işçi idarəetmə və motivasiya sistemi - nəzarət və performans izləmə.

## 🎯 Xüsusiyyətlər

### İşçi Tərəfi
- ✅ **Giriş/Çıxış Sistemi** - Check-in və Check-out funksiyası
- ✅ **Şəxsi Dashboard** - Performans, bonus və statistikalar
- ✅ **Davamiyyət Tarixçəsi** - Son davamiyyət qeydləri
- ✅ **Performans Balı** - Real-time bal göstəricisi (0-100)
- ✅ **Bonus Məlumatı** - Bu ay qazanılmış bonus
- ✅ **Badge Sistemi** - Nailiyyət badgeləri
- ✅ **Satış Hədəfi** - Hədəf progress bar
- ✅ **Reytinq** - Mağaza daxilində reytinq

### Admin Tərəfi
- ✅ **Real-Vaxt İzləmə** - Kim işdə, kim gecikib
- ✅ **İşçi İdarəetməsi** - İşçi əlavə/redaktə/sil (CRUD)
- ✅ **Davamiyyət İdarəsi** - Aylıq davamiyyət cədvəlləri
- ✅ **Davranış Qeydləri** - Xəbərdarlıq, töhmət, təşəkkür
- ✅ **Performans Hesablaması** - Avtomatik bal hesablama
- ✅ **Bonus İdarəetməsi** - Bonus hesablama və izləmə
- ✅ **Hesabatlar** - Dashboard statistikaları

## 📊 Performans Bal Sistemi

```
Davamiyyət:  30% (0-30 bal)
Satış:       40% (0-40 bal)
İntizam:     20% (0-20 bal)
Aktivlik:    10% (0-10 bal)
----------------------------
Ümumi:      100% (0-100 bal)
```

### Bonus Dərəcələri
- **80-89 bal:** Standart bonus (500₼)
- **90-94 bal:** Premium bonus (750₼)
- **95+ bal:** Super premium + Ayın işçisi (1000₼)

## 🏅 Badge Sistemi

- 🎯 **30 Gün Gecikmə Yox** - Bir ay gecikmədən işə gəlmək
- ⭐ **100% Davamiyyət** - Tam iş günlərində iştirak
- 🏆 **Satış Lideri** - Ən çox satış edən
- 👑 **Ayın İşçisi** - 95+ performans balı
- 💎 **İntizam Nümunəsi** - 90+ bal və gecikmə yox

## 🚀 İstifadə

### Linklar
- **İşçi girişi:** `/workers`
- **Admin girişi:** `/workers/admin-login`
- **İşçi dashboard:** `/workers/dashboard`
- **Admin panel:** `/workers/admin`

### Test Hesabları

**Admin:**
```
Email: admin@devaleur.az
Password: Admin123!
```

**İşçilər:**
```
1. aysel.mammadova@devaleur.az / Test123!
2. elvin.hasanov@devaleur.az / Test123!
3. leyla.aliyeva@devaleur.az / Test123!
```

## 📱 İşçi Dashboard Funksiyaları

1. **Check-In/Check-Out**
   - Səhər işə gələndə "Giriş Et"
   - Axşam gedəndə "Çıxış Et"
   - Gecikmə avtomatik hesablanır

2. **Statistika Kartları**
   - Bu ay iş saatı
   - Performans balı (real-time)
   - Bu ay bonus məbləği
   - Gecikmə sayı

3. **Satış Hədəfi**
   - Cari satış / Hədəf satış
   - Progress bar
   - Qalan məbləğ

4. **Badgelər**
   - Qazanılmış nailiyyətlər
   - İkon və ad ilə göstərilir

5. **Son Davamiyyət**
   - 7 günlük tarixçə
   - Giriş/çıxış saatları
   - İş saatı və gecikmə

## 🔧 Admin Panel Funksiyaları

### 1. Dashboard
- Bugün işdə olanlar
- Bugün gecikənlər
- Ümumi işçi sayı
- Ortalama performans

### 2. Real-Vaxt İzləmə
- Kim işdə, kim yoxdur
- Gecikmə məlumatı
- Giriş/çıxış saatları
- Status filtrləmə

### 3. İşçilər
- Yeni işçi əlavə et
- İşçi redaktə et
- İşçi sil
- Firebase Auth-da hesab yaradır

### 4. Davamiyyət
- İşçi seç
- Ay seç
- Davamiyyət cədvəli
- Statistika (iş saatı, gecikmə, faiz)

### 5. Davranış
- Xəbərdarlıq ver (-5 bal)
- Töhmət ver (-10 bal)
- Təşəkkür et (+10 bal)
- Tarixçə

### 6. Performans
- Aylıq performans hesabla
- Bütün işçilər üçün avtomatik
- Reytinq hesablama
- Bonus və badge avtomatik

### 7. Bonuslar
- Bonus siyahısı
- Toplam bonus
- Ortalama bonus
- Status (gözləmədə/təsdiq/ödənilib)

## 🛠 Texnologiyalar

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **Backend:** Firebase (Firestore + Authentication)
- **Build Tool:** Vite
- **Icons:** Lucide React

## 📦 Firebase Strukturu

### Collections

1. **employees** - İşçi məlumatları
2. **attendance** - Davamiyyət qeydləri
3. **behaviors** - Davranış qeydləri
4. **performance** - Performans məlumatları
5. **bonuses** - Bonus məlumatları
6. **badges** - Badge qeydləri
7. **sales** - Satış qeydləri

## 🎨 Dizayn Xüsusiyyətləri

- Modern və professional UI
- Responsive dizayn (mobil uyğun)
- İntuitive navigation
- Real-time updates
- Smooth animations
- Color-coded status indicators

## 📋 İlk Quraşdırma

1. **Firebase Console-da hesablar yaradın:**
   - Authentication bölməsinə keçin
   - "Add User" düyməsinə basın
   - Test hesablarını yaradın

2. **İşçi məlumatlarını əlavə edin:**
   - Admin olaraq daxil olun
   - "İşçilər" tabına keçin
   - "Yeni İşçi" düyməsinə basın
   - Məlumatları doldurun

3. **İşçi olaraq test edin:**
   - İşçi hesabı ilə daxil olun
   - "Giriş Et" edin
   - Dashboard-u araşdırın

4. **Admin funksiyalarını test edin:**
   - Real-vaxt izləməni yoxlayın
   - Davranış qeydi əlavə edin
   - Performans hesablayın

## 🔄 İş Prosesi

1. İşçi səhər işə gələndə sistemə daxil olur və "Giriş Et" edir
2. Sistem gecikmə varsa avtomatik hesablayır
3. Axşam işdən çıxanda "Çıxış Et" edir
4. Admin davranış qeydləri əlavə edə bilər
5. Ay sonunda admin "Performans Hesabla" edir
6. Sistem avtomatik bonus və badge verir
7. İşçi öz dashboard-ında nəticələri görür

## 🎯 Performans Hesablama Məntiqi

### Davamiyyət Balı (30%)
- İş günlərində iştirak = bal artır
- Gecikmə = hər gecikmə -0.5 bal

### Satış Balı (40%)
- Satış / Hədəf = faiz
- Faiz x 0.4 = bal

### İntizam Balı (20%)
- Başlanğıc: 20 bal
- Xəbərdarlıq: -5
- Töhmət: -10
- Təşəkkür: +10

### Aktivlik Balı (10%)
- Default: 8 bal
- Əlavə aktivlik üçün artırıla bilər

## 📱 Mobil Uyğunluq

Sistem tam responsive-dir:
- Mobil telefonlar (< 640px)
- Tablet (640px - 1024px)
- Desktop (> 1024px)

## 🔐 Təhlükəsizlik

- Firebase Authentication
- Email/Password yoxlaması
- Admin/İşçi səlahiyyət ayrılması
- Secure Firebase rules

## 🚀 Deployment

Sistem hazırda Vite dev server-də işləyir:
```bash
yarn dev  # Development
yarn build # Production build
```

## 📞 Dəstək

Hər hansı sual və ya problem olduqda Firebase Console-dan yoxlayın:
- Authentication: Hesablar düzgün yaradılıbmı?
- Firestore: Datalar düzgün yazılırmı?
- Console logs: Browser console-da xəta varmı?

## 🎉 Uğurlar!

Sistem tam işlək vəziyyətdədir. Azərbaycan dilində, intuitive və professional bir işçi idarəetmə həllidir.
