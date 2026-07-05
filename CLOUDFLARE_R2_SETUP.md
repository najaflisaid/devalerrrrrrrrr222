# Cloudflare R2 — Şəkil yükləmə quraşdırma bələdçisi

De Valeur admin paneli indi məhsul şəkillərini iki üsulla dəstəkləyir:
1. **URL yapışdırmaq** (əvvəlki kimi) — kənar linki daxil et
2. **Faylı yüklə** — kompüterdən şəkil seç → Cloudflare R2-yə yüklənir → URL avtomatik doldurulur

Fayl yükləmə funksiyasının işləməsi üçün Cloudflare R2 quraşdırmaq lazımdır.

---

## 1. Cloudflare R2 hesabı və bucket yaratmaq

### Addım 1.1 — R2-ni aktivləşdir
1. https://dash.cloudflare.com hesabına daxil ol
2. Sol menyudan **R2 Object Storage** seç
3. **"Purchase R2"** düyməsinə bas (10 GB / ay + 1M yazma pulsuzdur)

### Addım 1.2 — Bucket yarat
1. **"Create bucket"** düyməsi
2. Ad ver: məsələn `devaleur-images`
3. **Location**: `Automatic` və ya `Eastern Europe`
4. **Create bucket** düyməsini bas

### Addım 1.3 — Public access aktiv et (şəkillərin brauzerdə görünməsi üçün)
Bucket-in Settings tab-ına gir → **Public access** bölməsi:

**Variant A: R2.dev subdomain (test üçün rahat)**
- **"Allow Access"** düyməsinə bas
- Public URL veriləcək: `https://pub-xxxxxxxxxxx.r2.dev`
- Bunu qeyd et — `R2_PUBLIC_URL` env-i olacaq

**Variant B: Custom domain (production üçün tövsiyə edilir)**
- **Custom Domains** → **Connect Domain** → məsələn `cdn.devaleur.az`
- DNS CNAME avtomatik əlavə ediləcək
- `R2_PUBLIC_URL=https://cdn.devaleur.az`

### Addım 1.4 — CORS quraşdır
Bucket → **Settings** → **CORS Policy** → **Add CORS policy**:

```json
[
  {
    "AllowedOrigins": ["https://devaleur.az", "https://*.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 2. API açarları yaratmaq

1. R2 səhifəsində **Manage R2 API Tokens** düyməsinə bas
2. **Create API token**:
   - Ad: `devaleur-uploader`
   - Permissions: **Object Read & Write**
   - Specify bucket: yalnız `devaleur-images` seç (təhlükəsizlik üçün)
   - TTL: `Forever` (və ya istədiyin müddət)
3. **Create API Token** düyməsinə bas
4. Ekranda çıxan **3 dəyəri kopyala**:
   - `Access Key ID`
   - `Secret Access Key`
   - `Endpoint` (bunun içindəki account ID lazımdır — məsələn `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

> ⚠️ Secret Access Key yalnız bir dəfə göstərilir. Dərhal kopyala!

Həmçinin Cloudflare dashboardun sağ tərəfində **Account ID** yazılıb — o da lazımdır.

---

## 3. Vercel-də Environment Variables əlavə et

Vercel dashboard → Proyektinin **Settings** → **Environment Variables**:

| Variable | Nümunə dəyər |
|---|---|
| `R2_ACCOUNT_ID` | `1a2b3c4d5e6f7g8h9i0j` |
| `R2_ACCESS_KEY_ID` | `abcdef...` |
| `R2_SECRET_ACCESS_KEY` | `xyz123...` |
| `R2_BUCKET` | `devaleur-images` |
| `R2_PUBLIC_URL` | `https://pub-xxxxxxx.r2.dev` (və ya custom domain) |

Save edəndən sonra **Deployments** tab → son deploy → **Redeploy** düyməsi ilə yenidən deploy et.

---

## 4. Yoxlama

1. Deploy tamamlandıqdan sonra `/admin` səhifəsinə gir
2. **Məhsullar** tabına keç → **Yeni məhsul əlavə et**
3. **Şəkillər URL və ya Yüklə** sahəsində **"Yüklə"** (yaşıl-qara) düyməsinə bas
4. Kompüterdən şəkil seç (maks. 10 MB)
5. Bir neçə saniyədə URL avtomatik doldurulur — məhsulu saxla

Yüklənmiş şəkillərin R2 URL-i belə görünəcək:
```
https://pub-xxxxxxx.r2.dev/products/<random-uuid>.jpg
```

---

## Problemlər (troubleshooting)

**"R2 credentials not configured" xətası:**
- Vercel env variables saxlanmayıb və ya deploy yenilənməyib. Redeploy et.

**"Access Denied" / "Forbidden":**
- API tokeni yenidən yarat və bu dəfə **Object Read & Write** icazəsi ver
- Token-in scope-u seçilmiş bucket-a uyğundurmu?

**URL açılır amma şəkil göstərilmir:**
- Bucket üçün **Public access** aktiv deyil. Addım 1.3-ə qayıt.

**CORS xətası (brauzer console):**
- Bucket CORS Policy-si düzgün deyil. Addım 1.4-ə qayıt.

---

## Texniki qeydlər

- Fayllar `products/` prefix ilə saxlanır (folder parametri ilə dəyişdirmək olar)
- Fayl adı təsadüfi UUID + orijinal fayl uzantısıdır (kolliziya yoxdur)
- Maksimum fayl ölçüsü: 10 MB (Vercel serverless body limit-i)
- Daha böyük fayllar üçün presigned URL yanaşması lazımdır (gələcək iterasiya)
- Cache-Control: `public, max-age=31536000, immutable` (1 il CDN cache)

## API endpoint

`POST /api/r2-upload`

Body (JSON):
```json
{
  "fileBase64": "iVBORw0KGgo...",  // data URI prefixi olmadan və ya prefiks ilə
  "filename": "photo.jpg",
  "contentType": "image/jpeg",
  "folder": "products"
}
```

Response:
```json
{
  "url": "https://pub-xxxxxxx.r2.dev/products/abc-123.jpg",
  "key": "products/abc-123.jpg"
}
```
