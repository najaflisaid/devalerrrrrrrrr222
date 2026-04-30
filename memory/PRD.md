# De Valeur — Premium Saatlar və Aksesuarlar Saytı

## Original problem statement (Jan 2026 iteration)
"Filtirde kateqoriya yerində 'hamısı' olmasın. Menyuda Kategoriyaların içində brendlər görsənsin (Saatlar üzərinə qoyduqda saat brendləri açılsın). Kateqoriyaya alt-kateqoriya əlavə etmək olsun (məs: Dəri aksesuarlar → Çantalar → Pul qabıları). İşçi panelində tarix DD.MM.YYYY (31.12.2026) formatında olsun. Satıcının aylıq hədəfini konkret aprel/may ayı üçün qeyd etmə standart olsun, amma admin/işçi hansı ay olduğunu görməsin. İşçinin doğum tarixini dəyişib təsdiqləyəndə dəyişmir, düzəlt. Müştəri sifariş ödənişinə keçərkən gecikmə olur, fırlanan loading bildirişi qoy. AI chatbot bəzən özözünə itir, səbətə məhsul əlavə etmək olmur — düzəlt."

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (root: `/app`, served via supervisor on :3000).
- **Backend**: FastAPI on :8001 (`/api/health`, `/api/chat` — chat hələ də backup endpoint kimi qalır, frontend artıq birbaşa OpenAI-ə zəng vurur).
- **Database**: Firebase Firestore (məhsullar, users, kategoriyalar, sifarişlər, işçi məlumatları və s.) + Supabase qalıqları.
- **Auth**: Firebase Auth (admin, B2B, customer, worker).
- **Payments**: Epoint (Azərbaycan ödəniş gateway).
- **AI Chat**: OpenAI gpt-4o-mini, frontend-dən direkt çağırılır (`src/services/aiChatService.ts`).

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
