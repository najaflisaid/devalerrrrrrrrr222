# De Valeur — Premium Saatlar və Aksesuarlar Saytı

## Original problem statement (May 2026 iteration — Group A+B+C)
"Rəy/ulduz vermək istəyəndə avtomatik qeydiyyat. Filterdən 'Hamısı' silinsin. USPA URL. Google-da DE VALEUR caps. Stok 0 olanda müştəri əlavə edə bilməsin. Login/logout zamanı səbət təmizlənsin. Safari/B2B düymə donma problemi. AI köməkçi salamlama. Real-time search analitika. Daily visitors qrafiki. Anonim user tracking. Excel məhsul miqrasiyası. Worker bölməsi default tab Satış planı."

## What was done — May 4, 2026 iteration #5 — Group B + C

### Group B (cart/auth flow)

#### #2 Safari donma + B2B login düyməsi düzəldi
- **Root cause**: `B2BLogin.tsx` Hooks Rules pozulmuşdu — `useState` çağırışları `if (isLoggedIn) return null` early return-dan sonra idi. Bu Safari və bəzi React versiyalarında "Rendered more hooks than..." xətası verirdi.
- **Fix**: Bütün hooks komponent başında, redirect `useEffect`-də edilir. Login submit düyməsinə `disabled` + spinner əlavə edildi (ikiqat klikləməyin qarşısı).

#### #3 Login/logout zamanı səbət təmizlənməsi
- `Header.tsx`: `previousRole !== newRole` yoxlanışı (əvvəl `previousRole && ...` idi) — guest → login keçidində də səbəti təmizləyir.
- `B2BLogin.tsx`: B2B login zamanı `previousRole !== 'b2b'` olduqda səbət təmizlənir.

#### #10 AI köməkçi salamlama
- `AiChatWidget.tsx`: yeni "salamlama bubble" — sayta giriş edəndən 4.5 saniyə sonra avtomatik açılır, "Salam! 👋 Sizə uyğun saat və ya aksesuar seçməkdə kömək edə bilərəm" mesajı göstərir.
- Sessiya başına 1 dəfə (sessionStorage flag), 12 saniyədən sonra avtomatik gizlənir, X düyməsi ilə bağlanır, klik açır chat panelini.

### Group C (analytics / admin features)

#### #4 Real-time search analytics
- `Header.tsx`: axtarış input-da 1.2 saniyə yazma debounce-undan sonra `trackSearch()` çağırılır. İstifadəçi Enter basmadan da hər yazılan söz analitikaya düşür (5 saniyə throttle ilə eyni sözün təkrarlanması bloklanır).

#### #5 Günlük ziyarətçi qrafiki
- `analyticsService.ts`: yeni `daily_visits` Firestore koleksiyası — sessiya başına 1 dəfə artırılır.
- `App.tsx`: ilk render-də `trackDailyVisit()` çağırışı.
- `AnalyticsTab.tsx`: yeni "Günlük ziyarətçilər" tab-ı — son 30 günün SVG bar chart-ı + son 7 gün vs əvvəlki 7 gün artma/azalma %-i + son 10 günün card view-i.

#### #6 Qeydiyyatsız user cart/wishlist tracking
- `analyticsService.ts`: yeni `anon_product_interest` Firestore koleksiyası — `productId_kind` formasında ID, count + lastEvent.
- `CartContext.addToCart`: qeydiyyatsız user üçün `trackAnonProductInterest(productId, 'cart', meta)` (5 dəq throttle).
- `WishlistContext.toggleFavorite`: qeydiyyatsız user üçün eyni — wishlist-ə əlavə zamanı.
- `AnalyticsTab.tsx`: yeni "Qeydiyyatsız maraq" tab-ı — hansı məhsullara maraq var, brand/şəkil/ad ilə.

#### #7 Excel/xlsx ilə məhsul miqrasiyası + hazır şablon + auto stock update
- Yeni komponent: `src/components/admin/ProductExcelImport.tsx` (lazy-loaded, 437KB ayrı chunk).
- **Hazır şablon**: "Şablonu yüklə (.xlsx)" düyməsi — 2 vərəqli Excel faylı verir:
  - **Məhsullar** vərəqi: sample 3 sətir + boş sətir. Sütunlar: `Kateqoriya, Brend, Məhsul kodu (SKU), Məhsul adı, Qiymət (AZN), B2B qiymət (AZN), Miqdar, Cins`.
  - **Təlimat** vərəqi: istifadə qaydaları azərbaycan dilində.
- **Dəqiq uyğunlaşdırma**: Yalnız şablonun sütun adlarına uyğun faylları qəbul edir. Tələb olunan sütunlar (`Məhsul adı`, `Miqdar`) yoxdursa xəta göstərir.
- **Match prioriteti**: 1) SKU, 2) Ad+Kateqoriya. Uyğun tapıldıqda **yalnız stok yenilənir** (Product type-ə `sku?: string` əlavə olundu).
- **Yeni məhsul yaradarkən**: `Kateqoriya + Ad` məcburidir. Tam SKU, qiymət, b2bPrice, cins, marka saxlanılır. Şəkil boş buraxılır — sonra admin əlavə edir. Kateqoriya/brend yoxdursa avtomatik yaradılır.
- Preview: yenilənəcək (emerald), yaradılacaq (blue), atlandı (amber) — hamısı ayrı siyahıda.
- .xlsx, .xls, .csv formatları dəstəklənir.

#### #13 Worker bölməsi yenidən sıralandı
- `WorkersTab.tsx` `WorkerDetail`: default tab `info` → `total` (Satış planı) dəyişdirildi.
- Tab sırası: **Satış planı** → Cərimələr → Mükafatlar → Məzuniyyət → Bildiriş → Məlumat (axırda).
- Header-də "Redaktə" düyməsi əlavə edildi (Edit ikonu) — yalnız klikləndikdə "Məlumat" tab-ına keçir; əvvəl avtomatik açılırdı.

## Architecture
- React 18 + TypeScript + Vite
- Firebase Firestore + Auth
- Supabase (qalıqlar)
- Epoint payments
- OpenAI gpt-4o-mini chat

## Backlog
- P2: Excel migrasiya üçün xls/xlsx native dəstəyi (hazırda yalnız CSV; Excel-də "Save As → CSV UTF-8" kifayətdir)
- P2: Daily visits-də unikal IP/user-id ayrımı (hazırda sessiya bazlı)
- P3: Anonim user-lərin telefon/email collection (cart abandonment recovery üçün)
- P3: Worker info edit-i avtomatik açıq yox, password protected modal şəklində



## What was done — May 4, 2026 iteration #4 — Group A (təhlükəsiz UI/SEO/data fixes)

### 1. Rəy/Ulduz → avtomatik qeydiyyat modal (#1)
- `src/components/ProductReviews.tsx`: `alert()` əvəzinə `CustomerLogin` modalı qeydiyyat modunda (`initialMode="register"`) açılır.
- Qeydiyyatsız istifadəçi üçün "Bu məhsulu qiymətləndirin" başlıqlı interaktiv ulduz blok əlavə olundu — istənilən ulduza/Qeydiyyat linkinə klik qeydiyyat modalını açır.
- `src/components/auth/CustomerLogin.tsx`: yeni opsional prop `initialMode?: 'login' | 'register'`.

### 2. Filtrdən "Hamısı" seçimi silindi (#9)
- `src/pages/ProductsPage.tsx`:
  - Stock filter: radio `Hamısı / Mövcud məhsullar` → tək checkbox "Yalnız mövcud məhsullar".
  - Brand list: 'all' option silindi (yalnız real brendlər radio kimi).
  - Gender: "Hamısı" radio silindi (men / women / unisex).
- Hər filtrin yanına kiçik "Sıfırla" düyməsi əlavə olundu — yalnız filter aktiv olduqda görünür, sıfırlamağa imkan verir.

### 3. Stok 0 → bütün istifadəçilər üçün "Mövcud deyil" + əlavə bloklanır (#8)
- `src/components/ProductCard.tsx`: `isOutOfStock = product.stock === 0` (əvvəl yalnız B2B üçün idi).
- Bütün istifadəçilər üçün "Bitdi" yerinə "Mövcud deyil" yazısı, səbətə əlavə düyməsi gizlədilir, müştəri klikləsə notification göstərilir.
- `src/pages/ProductDetailsPage.tsx`: addToCart, buyNow düymələri stok 0 olarsa hamı üçün bloklanır.

### 4. US Polo Assn → URL `/brand/USPA` (#11)
- Yeni utility: `src/utils/brandSlug.ts` — `toBrandSlug()` və `fromBrandSlug()`.
- Xüsusi alias map: "U.S. Polo Assn." → `USPA`. Digər brendlər avtomatik (nöqtə/boşluq sil → CAPS).
- `src/components/Header.tsx`: mega menyuda kategoriya seçilməyibsə brend kliki `/brand/USPA` formatında URL-ə gedir (kategoriya seçilibsə əvvəlki kimi `?brand=...&category=...`).
- `src/components/Footer.tsx`: brendlər `/brand/${slug}` formatına yönləndirilir.
- `src/pages/BrandPage.tsx`: brendi həm tam ad ilə, həm də slug ilə resolve edir; başlıqda tam ad göstərilir ("U.S. Polo Assn.").

### 5. Google-da `DE VALEUR` böyük hərf (#12)
- `index.html`: title, description, og:title, og:site_name, twitter:title, schema.org Organization/Store/WebSite name field-ləri "De Valeur" → "DE VALEUR" olaraq dəyişdirildi.
- `Organization.alternateName` siyahısına "De Valeur" backup üçün qaldırıldı (köhnə backlinks/bookmark-lar üçün).

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (root: `/app`, served via supervisor on :3000).
- **Backend**: FastAPI on :8001 (`/api/health`, `/api/chat`).
- **Database**: Firebase Firestore (məhsullar, users, kategoriyalar, sifarişlər, işçi məlumatları və s.) + Supabase qalıqları.
- **Auth**: Firebase Auth (admin, B2B, customer, worker).
- **Payments**: Epoint.
- **AI Chat**: OpenAI gpt-4o-mini, frontend-dən direkt çağırılır.

## Backlog — Group B (orta risk: cart/auth flow)
- **#3** Login/logout zamanı səbət təmizlənsin (B2B vs normal session)
- **#2** Safari donma + B2B login button issue
- **#10** AI köməkçi salamlama (satış mütəxəssisi kimi)

## Backlog — Group C (analytics / admin features)
- **#4** Real-time search analytics (yazılanlar hamısı, Enter basmadan)
- **#5** Daily visitors qrafiki (artma/azalma)
- **#6** Anonim user cart/wishlist tracking
- **#7** Excel məhsul miqrasiyası + stok auto-update
- **#13** Worker bölməsi yenidən qurma (email tetikleyicisi gec, satış planı sıralama)



## What was done — Apr 30, 2026 iteration #3 — Mobil menyu + alt-kateqoriya

### 1. Mobil menyu tamamən yenidən quruldu (akardeon hierarxiyası)
- `src/components/Header.tsx`: əvvəlki "Məhsullar" linki + ayrıca "Kategoriyalar" + ayrıca "Brendlər" sxemi **tamamilə dəyişdirildi**.
- İndi yalnız bir "Məhsullar" akardeonu var:
  - Açıldıqda yalnız **kategoriyalar** görünür (ox aşağı)
  - Hər kategoriyaya basıldıqda akardeon açılır → **brendlər** + (varsa) **alt-kateqoriyalar** görünür
  - Hər alt-kategori də öz akardeonuna malikdir → açıldıqda həmin alt-kategorinin brendləri görünür
  - Ayrıca "Brendlər" menyusu silindi (artıq kategoriya altında qruplaşır)
- "Bütün [kateqoriya adı]" düyməsi əlavə edildi — kategorinin bütün məhsullarını birbaşa açır.

### 2. Alt-kateqoriya (subcategory) tam dəstəyi
- Yeni service: `src/services/categoryService.ts` — `getCategoryTree(lang)` Firestore-dan parent → children hierarxiyasını qurur.
- `categories` Firestore koleksiyasına yeni field: **`parentId: string | null`**.
- AdminPanel "Yeni Kategori" və "Redaktə" formlarına **"Ana kateqoriya seç"** dropdown əlavə edildi.
- AdminPanel kateqoriya siyahısında alt-kategoriyalarda "↳ [Parent ad] altında" badge görünür.
- ProductsPage filterində: **parent kategori seçildikdə alt-larındakı məhsullar da göstərilir** (məs: "Dəri Aksesuarlar" → "Çantalar" + "Pul qabıları" məhsulları daxil olur).
- Desktop mega menyu: kategoriyaya hover edəndə alt-kateqoriyalar (varsa) yuxarıda + brendlər aşağıda göstərilir. Parent kategori brendləri = onun alt-larının brendlərinin birləşməsi.

### Necə istifadə olunmalıdır
1. AdminPanel → Kategoriyalar → "Dəri Aksesuarlar" yarat (Ana kateqoriya boş qoy).
2. "Yeni kateqoriya əlavə et" → ad: "Çantalar", **Ana kateqoriya: Dəri Aksesuarlar**.
3. Eyni şəkildə "Pul qabıları" → Ana kateqoriya: "Dəri Aksesuarlar".
4. Məhsul yaradılarkən, çantalı məhsullara `category = "Çantalar"`, pul qabısına `category = "Pul qabıları"` ver.
5. Mobil/desktop menyuda və filtrdə "Dəri Aksesuarlar"-a bassanız → Çantalar + Pul qabıları + brendlər görünəcək.

## What was done — Apr 30, 2026 iteration #2

### 1. "Ən çox satılanlar" 3 sıra
- `src/components/BestSellersSection.tsx`: 24 məhsul → 36 məhsul yüklənir, 3 sıra (sol↔sağ↔sol marquee).

### 2. SEO — Google sitelinks üçün strukturlaşdırılmış məlumat
- `index.html`: zəngin meta tags (azərbaycanca title/description/keywords), hreflang (az/ru/en), Open Graph + Twitter cards.
- 5 ayrı JSON-LD schema: Organization, Store, WebSite (SearchAction), ItemList (SiteNavigationElement — sitelinks üçün), BreadcrumbList.
- `public/sitemap.xml`: bütün vacib səhifələr + brendlər siyahısı.
- `public/robots.txt`: index/follow + admin/private route disallow + sitemap referansı.

### 3. Admin paneldə "Sürətli qiymət yeniləmə" paneli
- `src/components/admin/DeliveryMethodsTab.tsx`: yuxarıda yeni inline panel.
- Hər çatdırılma üsulu üçün cari qiymət göstərilir + yeni qiymət inputu + ✓ saxla düyməsi.
- Enter ilə dərhal saxlayır, Escape ilə imtina, dəyişdirildikdə amber highlight.
- Cart-da `deliveryFee` dəyişdikdə total avtomatik yenilənir (artıq belə işləyirdi).

## What was done — Apr 30, 2026 iteration #1

### 1. Məhsul filtrindən "Hamısı" kateqoriya seçimi silindi
- `src/pages/ProductsPage.tsx`: `categories.filter(c => c !== 'all')` ilə yalnız real kateqoriyalar göstərilir.
- Brand filterində "Hamısı" qalır (user istəyi). Default məhsul siyahısı dəyişməz qalır.

### 2. Mega menyu — kateqoriya hover edildikdə həmin kateqoriyanın brendləri görünür
- `src/components/Header.tsx`: 2 sütunlu yeni layout — sol: kateqoriyalar, sağ: brendlər.
- `productsByCategory` map qurulur (məhsulların kategoriyasına görə brendlər qruplaşır).
- Hover edildikdə həmin kateqoriyanın brendləri sağda göstərilir; yoxsa bütün brendlər. Brend kliklədikdə kategori filtri də avtomatik tətbiq olunur.

### 3. Aylıq hədəf üçün gizli ay seçici
- `src/components/admin/WorkersTab.tsx` — `MonthlyTotalPanel`: 12 ay (cari + 2 növbəti + 11 keçmiş) seçimi əlavə edildi.
- Yeni Firestore field: `targetsHistory: Record<string, number>` (məs: `{"2026-04": 5000}`).
- UI-də sadəcə "Aylıq hədəf" yazılır — ay etiketi heç bir display-də göstərilmir (admin və işçi panellərində).

### 4. İşçi məlumatlarının saxlanmaması bug fix
- Səbəb: `WorkersTab` refresh-dən sonra `editing` state-i köhnə Worker objekti saxlayırdı, WorkerDetail komponenti yenilənmiş data ilə re-render olmurdu.
- Düzəliş: `refresh()` funksiyasında `setEditing(prev => prev ? (w.find(x => x.id === prev.id) || prev) : prev)` ilə yenilənmiş worker obyektinə bağlanır.

### 5. Cart ödəniş tam ekran loading overlay
- `src/pages/CartPage.tsx`: ödəniş zamanı (loading=true) tam ekran backdrop blur + spinner + "Ödəniş hazırlanır..." mesajı.
- İstifadəçi prosesin getdiyini aydın görür, "donmuş" hissi aradan qalxır.

### 6. AI chatbot — Səbətə əlavə et düyməsi
- `src/components/AiChatWidget.tsx`: hər `ProductMiniCard` indi 2 düymə təklif edir — "Səbətə əlavə et" və "Bax →".
- `useCart` hook-u inteqrasiya edilib. Stokda olmayan məhsullar üçün düymə deaktiv olur. Əlavə olunduqda "✓ Əlavə olundu" görünür 2 saniyə.
- `updateFine` import edildi (TS səhvi düzəldildi).

## Important notes / Known limitations
- **AI chat preview ortamında "Failed to fetch" verə bilər** — bu OpenAI API-yə birbaşa çağırışla bağlıdır və preview konteynerindən bəzən olmur. Production-da işləməlidir.
- **`<input type="date">` brauzerin lokalına görə göstərir** — bütün display çıxışları `'az-AZ'` ilə DD.MM.YYYY formatında verir, amma native date picker-i tarayıcı seçir.
- **Sub-category dəstəyi (Dəri aksesuarlar → Çantalar → Pul qabıları)** — backlog-a qoyuldu (aşağıda).

## Backlog / next ideas
- **P1: Alt-kateqoriya (subCategory) tam dəstəyi**
  - `categories` Firestore koleksiyasına `parentId` field əlavə et
  - AdminPanel "Yeni kateqoriya" formuna "Ana kateqoriya seç" dropdown
  - `Product` type-a `subCategory: string` (optional)
  - Mega menyuda hierarxik göstərmə (kateqoriya → alt-kateqoriya → brendlər)
  - ProductsPage filterdə alt-kateqoriya radio seçimi
- **P2**: Custom DD.MM.YYYY date input komponenti (native picker tarayıcı dilinə bağlı qalmasın deyə).
- **P2**: AI chat üçün lightweight backend proxy (key brauzerdə görünməsin, rate-limit, retry).
- **P3**: AI chat streaming responses (token-by-token sürət üçün).
- **P3**: Hər ay üçün ayrıca işçi performans tarixçəsi qrafiki.

## Test credentials
Bax: `/app/memory/test_credentials.md`

## What was done — Jan 6, 2026 iteration

### Filter "gah var, gah yox" problemi — root-cause fix
- **Problem**: İstifadəçi qeyd etdi ki, hər rolla (qonaq, müştəri, B2B) məhsullara baxanda filter itir, sonra qayıdır. Screenshot brend səhifəsində (`/brand/zippo`) filter olmadığını göstərdi.
- **Root cause**: `BrandPage.tsx` və `CategoryPage.tsx` filter sidebar olmadan göstərilirdi — yalnız `/products` səhifəsində filter var idi. Naviqasiya zamanı filter "yoxa çıxırdı".
- **Fix**: `BrandPage.tsx` və `CategoryPage.tsx` müstəqil layout əvəzinə `/products?brand=<canonicalName>` və `/products?category=<name>` ünvanlarına `<Navigate replace />` ilə yönləndirilir. Brend slug-ı (`ZIPPO`, `USPA`) məhsul siyahısından `fromBrandSlug` ilə həqiqi brend adına çevrilib göndərilir.
- **Nəticə**: Bütün məhsul siyahı səhifələri (məhsullar, kateqoriya, brend) eyni `ProductsPage` filter UI-ı paylaşır — filter HƏMİŞƏ görünür və davranış identikdir.
- Files: `src/pages/BrandPage.tsx`, `src/pages/CategoryPage.tsx`

## What was done — Jan 6, 2026 iteration #2

### Admin bildiriş sistemi — qlobal səs + TTS "Yeni sifariş daxil oldu"
- **Problem (1)**: Admin başqa səhifədə (`/products` və s.) olarkən yeni sifariş gələndə səs gəlmirdi — listener yalnız `AdminPanel` mount olduqda işləyirdi.
- **Problem (2)**: Müştəri sifarişləri üçün bildiriş bəzən tətiklənmirdi (B2B işləyirdi).
- **Problem (3)**: Bildiriş səsi default beep idi — istifadəçi "YENİ Sifariş daxil oldu" səsi istəyirdi.
- **Fix**:
  - Yeni komponent: `src/components/AdminGlobalNotifications.tsx` — App.tsx-də həmişə render olunur, `userRole === 'admin'` olduqda Firestore real-time listener-ləri başladır (customer_orders + b2bOrders). Bu listener admin hansı route-da olursa olsun işləyir.
  - Yeni utility: `src/utils/notificationSound.ts` — üstünlük sırası: (1) `/sounds/new-order.mp3` (gələcəkdə custom yükləmə üçün), (2) `window.speechSynthesis` ilə `"Yeni sifariş daxil oldu"` (az/tr/ru voice fallback), (3) WebAudio iki-tonlu beep.
  - `AdminPanel.tsx`: artıq özü səs çalmır, yalnız badge sayğacını izləyir (qlobal listener çalır → ikiqat səsi qarşısı). `acknowledgeXxx` çağırışlarında `adminOrdersAcknowledged` event göndərilir ki, qlobal listener prev count-u sıfırlaya bilsin.
  - `CustomerOrdersTab.tsx`: test/preview düyməsi də artıq eyni TTS səsini çalır.

### Axtarış analytics — onBlur + close tracking
- **İstək**: Müştəri Enter/OK basmasa belə yazdığı söz analitikaya düşsün (dropdown-dakı məhsula klik etmədən modal-dan çıxsa belə).
- **Fix** (`Header.tsx`):
  - Search input-a `onBlur` tracking — input fokusu itirəndə yazılmış sözü trackSearch-ə göndərir (≥2 simvol)
  - `closeSearchModal` daxilində də track çağırışı (X düyməsi və ya backdrop ilə bağlananda)
  - Mövcud 1.2s debounce və product-click tracking saxlanılıb.

### e-Pos checkout sağlamlığı
- **İstək**: e-Point bəzən açılmır və ya gec açılır; uğursuz olsa müştəriyə dəqiq bildiriş gəlsin.
- **Fix** (`CartPage.tsx → handleEpointCheckout`):
  - `buildSignedPayment` xəta atarsa, yeni yaranmış orphan sifariş `payment_failed` kimi qeyd olunur (admin panelində `pending_payment` siyahısında qalmasın).
  - **Watchdog timer (8 san)**: Əgər `redirectToEpoint` form submit-i səssizcə uğursuz olarsa (brauzer bloku, şəbəkə problemi), 8 saniyədən sonra istifadəçiyə "Ödəniş səhifəsi açıla bilmədi" xətası göstərilir, sifariş `payment_failed` qeyd olunur. `beforeunload`/`pagehide` event-lərində timer ləğv olunur (uğurlu yönləndirmədə təkrar bildiriş çıxmasın).
  - Mövcud "Ödəniş hazırlanır..." overlay saxlanılıb (donmuş hissini aradan qaldırır).

### Files
- `src/utils/notificationSound.ts` (yeni)
- `src/components/AdminGlobalNotifications.tsx` (yeni)
- `src/App.tsx` (qlobal komponent əlavə olundu)
- `src/components/admin/AdminPanel.tsx` (səs qlobala köçürüldü; ack event dispatch)
- `src/components/admin/CustomerOrdersTab.tsx` (preview səsi TTS-ə keçdi)
- `src/components/Header.tsx` (search analytics genişləndi)
- `src/pages/CartPage.tsx` (epoint watchdog + orphan order cleanup)

## Jan 6, 2026 — iteration #3 — Admin məhsul filterinə "Görünürlük" filteri
- Admin panel → Məhsullar bölməsinə yeni "Görünür kim?" filteri əlavə olundu (kateqoriya/brend/stok yanında 4-cü filter olaraq).
- Seçimlər: **Hamısı** (default), **Hamı görür** (`visibleTo === 'all'`), **Yalnız müştəri** (`visibleTo === 'customer'` — qonaq + normal müştəri), **Yalnız B2B** (`visibleTo === 'b2b'`).
- Filter həm məhsul siyahısı grid-ində, həm başlıqdakı məhsul sayğacında tətbiq olunur. Müştəri qruplarına xüsusi məhsulların idarəsi üçün admin tez-tez B2B-yə xüsusi və ya yalnız adi müştəriyə görünən məhsulları izləməyə kömək edir.
- Layout `md:grid-cols-3` → `md:grid-cols-2 lg:grid-cols-4`-ə dəyişdi ki, mobil/tablet ekrana sığsın.
- File: `src/components/admin/AdminPanel.tsx`

## Jan 6, 2026 — iteration #4 — Visibility badge, English voice, customer notification root-fix, user-assigned promo codes

### #1 Visibility badge per məhsul kartı (admin)
Admin → Məhsullar siyahısında hər məhsul kartında stok badge-inin yanında kiçik vizual badge:
- 👁 yaşıl emerald = `visibleTo === 'all'` (hamı görür)
- mavi **B2B** = `visibleTo === 'b2b'`
- narıncı **C** = `visibleTo === 'customer'`
Hover-ə açıqlama tooltip-i. Filterdən asılı olmayaraq bir baxışdan səhv konfiqurasiyalanmış məhsulları aşkar etmək asanlaşdı.

### #2 Bildiriş səsi ingilis dilinə keçdi
`notificationSound.ts`: `SPEECH_TEXT = 'New order received'`, `lang = 'en-US'`, voice picker → en-US > en-GB > any English. TTS keyfiyyəti yüksək (bütün modern brauzerlər en-US səs ilə gəlir). Gələcəkdə `/sounds/new-order.mp3` faylı qoyulsa avtomatik üstün tutulur (custom yazı).

### #3 Müştəri sifariş bildirişi tətiklənmirdi — ROOT FIX
- **Problem**: Müştəri sifarişi `pending_payment` statusu ilə yaranır (`createdAt` o anda qoyulur). Admin bu vaxt tab-ı açıb `lastSeen=now` etmiş ola bilər. Sonra ödəniş uğurlu olduqda status `preparing` olur, AMMA `createdAt` köhnə qalır → `createdAt < lastSeen` → sayğac artmır → səs gəlmir, badge yoxdur.
- **Fix**: `AdminPanel.tsx` və `AdminGlobalNotifications.tsx` müştəri sifariş listener-lərində `ms = max(paidAt, createdAt)` istifadə olunur. `paidAt` `PaymentSuccessPage`-də ödəniş uğurla bitəndə qoyulur, deməli yeni dəyər həmişə `lastSeen`-dan böyük olacaq (ödənişdən sonra admin tab-ı açana qədər) → düzgün sayılır. B2B sifarişlər toxunulmadı (orada `pending_payment` mərhələsi yoxdur).

### #4 Müştəriyə təyin olunmuş promo kodlar
Admin müəyyən bir müştəriyə xüsusi promo kod yarada bilər; müştəri "Sifarişlərim" sidebar-ında həmin kodu görür və köçürə bilər.
- `promoCodeService.ts`:
  - `PromoCode` interface-inə `assignedTo: { userId, userEmail, userName }` (optional) əlavə olundu
  - `createPromoCode(discount, createdBy, assignedTo?)` — yeni opsional parametr
  - `validatePromoCode(code, userId?)` — assigned kod yalnız həmin userId üçün etibarlıdır
  - Yeni `getUserAssignedCodes(userId)` — istifadə edilməmiş təyin olunmuş kodları qaytarır
- `PromoCodesTab.tsx`: yuxarıda müştəri seçim paneli (axtarışlı, max 30 nəticə). Seçilibsə badge görünür, "Sil" düyməsi ilə təmizlənir. Cədvəlin "İstifadəçi" sütunu "Təyinat / İstifadə"-yə dəyişdi — kim üçün təyin olunduğunu və kim istifadə etdiyini ayırd edir.
- `MyOrdersPage.tsx`: profil sidebar-ına yeni "Sizə hədiyyə kodlar" kartı — kodu, faiz, "Köçür" düyməsi və qısa təlimat. Admin kod yaradan kimi avtomatik görünür.
- `CartPage.tsx`: `validatePromoCode(code, userId)` çağırılır — başqa müştəriyə təyin olunmuş kodu istifadəyə çalışan müştəri "Bu promo kod sizə təyin olunmayıb" xətası alır.

### Files
- `src/utils/notificationSound.ts` (en-US speech)
- `src/components/AdminGlobalNotifications.tsx` (paidAt fix)
- `src/components/admin/AdminPanel.tsx` (paidAt fix + visibility badge + Eye icon)
- `src/services/promoCodeService.ts` (assignedTo + getUserAssignedCodes)
- `src/components/admin/PromoCodesTab.tsx` (user picker UI)
- `src/pages/MyOrdersPage.tsx` (assigned codes card)
- `src/pages/CartPage.tsx` (userId-aware validation)
