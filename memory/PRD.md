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

## What was done — Apr 30, 2026 iteration

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
