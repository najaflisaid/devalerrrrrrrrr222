# Cloudflare R2 + Worker — Şəkil/Video yükləmə (Vercel env variable-larsız)

Bu yanaşmada:
- ✅ **Vercel-də heç bir env variable əlavə etmək lazım deyil**
- ✅ Bütün açarlar Cloudflare-in Worker-inin içində gizli qalır
- ✅ Frontend birbaşa Worker-ə fayl göndərir
- ✅ Bucket və Worker eyni Cloudflare hesabında bir yerdədir (R2 binding — API açarlarına ehtiyac yoxdur)

---

## Addım 1 — R2 bucket və Public URL (əgər hələ etməmisən)

Sən artıq bucket yaratmısan (`devaleur`) və Public URL almısan (`https://pub-8757540963484f9695b95960b729f3fa.r2.dev`). Bu addım hazırdır. ✅

Public URL-i qeyd saxla — Worker konfiqurasiyasında istifadə edəcəyik.

---

## Addım 2 — CORS quraşdır bucket üçün

1. Cloudflare Dashboard → **R2** → `devaleur` bucket → **Settings** tab
2. Aşağıya sürüş → **CORS Policy** bölməsi → **Add CORS policy**
3. Aşağıdakı JSON-u yapışdır:

```json
[
  {
    "AllowedOrigins": [
      "https://devaleur.az",
      "https://www.devaleur.az",
      "https://*.vercel.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. **Save** düyməsinə bas.

---

## Addım 3 — Cloudflare Worker yarat və deploy et

### Variant A — Cloudflare Dashboard (ən sadə, brauzerdə)

1. Cloudflare Dashboard → sol menyudan **Workers & Pages** → **Overview**
2. **Create application** düyməsi → **Create Worker** seç
3. Ad ver: `devaleur-uploader` (və ya istədiyin ad — məsələn `silent-pine-862b` onsuz da var)
4. **Deploy** düyməsi (default kod ilə deploy olacaq)

5. Worker deploy olduqdan sonra **Edit code** düyməsinə bas
6. Sağ tərəfdə açılan editor-də mövcud kodun **hamısını sil**
7. `/app/worker/r2-upload-worker.js` faylının məzmununu **kopyala və yapışdır**
8. Yuxarı sağda **Deploy** (mavi) düyməsinə bas
9. Deploy olduqdan sonra sağ üstdə Worker URL-ni görəcəksən:
   ```
   https://devaleur-uploader.najaflisaid35.workers.dev
   ```
   VƏ YA (əgər `silent-pine-862b`-i istifadə etdinsə):
   ```
   https://silent-pine-862b.najaflisaid35.workers.dev
   ```
   **Bu URL-i qeyd et** — sonra frontend kodunda göstərəcəyik.

### Addım 3.1 — Worker-ə R2 bucket bindingi əlavə et (KRİTİK!)

10. Worker səhifəsində **Settings** tab-a keç
11. Sol tərəfdə **Variables and Secrets** və **Bindings** bölmələri var
12. **Bindings** bölməsinə keç → **Add binding**
13. **R2 bucket** seç:
    - **Variable name**: `BUCKET` (mütləq bu ad — böyük hərflərlə)
    - **R2 bucket**: `devaleur` seç dropdown-dan
    - **Save** düyməsi

14. İndi **Variables and Secrets** bölməsinə keç → **Add variable**
    - **Variable name**: `PUBLIC_URL`
    - **Value**: `https://pub-8757540963484f9695b95960b729f3fa.r2.dev`
    - **Type**: `Plain Text` qoy
    - **Save**

15. Sağ üstdə yenidən **Deploy** düyməsinə bas (yeni binding aktiv olsun)

### Addım 3.2 — Yoxla

Brauzerdə aç:
```
https://silent-pine-862b.najaflisaid35.workers.dev/health
```
Cavab belə olmalıdır:
```json
{"ok":true,"publicUrl":"https://pub-8757540963484f9695b95960b729f3fa.r2.dev"}
```

✅ Əgər `publicUrl` null deyilsə, Worker düzgün quraşdırılıb.

---

## Addım 4 — Frontend-də Worker URL-i göstər

**Fayl**: `/app/src/services/imageUploadService.ts`

Faylın yuxarısında bunu tap:

```typescript
const WORKER_URL =
  (import.meta as any).env?.VITE_R2_WORKER_URL ||
  'https://silent-pine-862b.najaflisaid35.workers.dev';
```

Əgər sənin Worker URL-in **fərqlidir**, sadəcə hardcoded fallback URL-i öz Worker URL-inlə əvəz et. Vercel-də env variable əlavə etməyə **ehtiyac yoxdur** — hardcoded URL kifayətdir.

---

## Addım 5 — Deploy et

Adi qaydada Vercel-də deploy et:

```bash
git add .
git commit -m "R2 upload via Cloudflare Worker"
git push
```

Vercel avtomatik yeni deploy edəcək.

---

## Addım 6 — Test et

1. `https://devaleur.az/admin` aç
2. **Məhsullar** tabı → **Yeni məhsul əlavə et**
3. Aşağı sürüş → **Şəkillər URL və ya Yüklə** sahəsi
4. Qara **"Yüklə"** düyməsinə bas
5. Kompüterdən şəkil seç → 2-3 saniyəyə URL avtomatik doldurulur

**Digər yerlərdə də test et:**
- Admin → **Banner idarəetməsi** — şəkil VƏ video yükləmə (URL və ya fayl)
- Admin → **Bestseller Banner** — şəkil (URL və ya fayl)
- Admin → **Məhsul bannerləri** — şəkil / video (URL və ya fayl)

---

## Nə saxlanılır və harada

| Kontent | Bucket-də folder | Nümunə URL |
|---|---|---|
| Məhsul şəkilləri | `products/` | `pub-xxx.r2.dev/products/uuid.jpg` |
| Ana banner (image/video) | `banners/` | `pub-xxx.r2.dev/banners/uuid.mp4` |
| Bestseller banner | `bestsellers-banner/` | `pub-xxx.r2.dev/bestsellers-banner/uuid.jpg` |
| Məhsul banneri (image/video) | `product-banners/` | `pub-xxx.r2.dev/product-banners/uuid.jpg` |

---

## Problemlər (Troubleshooting)

**"R2 BUCKET binding not configured"** xətası
- Addım 3.1 edilməyib. Worker Settings → Bindings → R2 binding əlavə et (name: `BUCKET`).

**"PUBLIC_URL env var not set"** xətası
- Addım 3.1 kimi Environment Variable əlavə et (`PUBLIC_URL`).

**"CORS error" brauzer console-da**
- Addım 2 (CORS policy) atlanıb. R2 bucket → Settings → CORS Policy əlavə et.

**Şəkil URL açılır amma boşdur / 404**
- Bucket-in Public Access aktiv deyil. Cloudflare → R2 → bucket → Settings → Public Access → **Allow Access**.

**"Şəbəkə xətası — Worker URL və CORS quraşdırmasını yoxlayın"**
- Worker URL frontend-də səhv göstərilib. `imageUploadService.ts`-də URL-i yoxla.
- Health endpoint-i test et: `<worker-url>/health` — 200 gəlməlidir.

---

## Təhlükəsizlik qeydləri

- **Worker-in URL-i açıqdır** — hər kəs POST edib fayl yükləyə bilər. Bu sənin ictimai sayt üçün OK-dir (məhsul şəkilləri saxlanır), amma:
  - Böyük ölçülü limit qoyulub (100 MB)
  - Yalnız image/video/pdf uzantıları qəbul edilir
  - Sonradan lazım olarsa authentication əlavə edə bilərik (istifadəçi tokeni yoxlanışı Worker-də)
- R2 bucket-i **öz bucketindir**, Worker binding vasitəsilə yazır — S3 API açarları paylaşılmır
- Chat-də paylaşdığın Access Key ID və Secret Access Key artıq lazım deyil — istəsən Cloudflare-də sil (Manage R2 API Tokens → köhnə token-i "Revoke" et)

---

## Növbəti addımlar (istəyə görə)

- **Custom domain**: `cdn.devaleur.az` kimi öz domenini bucket-ə bağla (Cloudflare Dashboard → R2 → bucket → Settings → Custom Domains)
- **Auth qoruması**: Worker-də admin token yoxlaması əlavə et
- **Image optimization**: Cloudflare Images ilə avtomatik WebP + resize
