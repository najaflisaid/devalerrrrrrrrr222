/**
 * /api/og-product — Məhsul linki paylaşıldıqda OG önbaxış generatoru.
 *
 * Vercel rewrite vasitəsilə bot user-agent-ləri (WhatsApp, Telegram,
 * Twitter, Facebook, Google, vs.) bu funksiyaya yönləndirilir. Funksiya:
 *   1. Firestore REST API ilə məhsul məlumatını alır
 *   2. index.html-i fetch edib OG meta-ları məhsula uyğun dəyişir
 *   3. Bot-a kompleks önbaxış üçün hazır HTML qaytarır
 *
 * Adi istifadəçilər (brauzer) bu funksiyaya gəlmir — onlar üçün SPA standartdır.
 */
const FIRESTORE_PROJECT = 'devaleur-11742';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

// Firestore REST cavabını sadə JS obyektinə çevir
function decodeFsValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(decodeFsValue);
  }
  if (v.mapValue !== undefined) {
    const obj = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach((k) => { obj[k] = decodeFsValue(fields[k]); });
    return obj;
  }
  return null;
}

function decodeFsDoc(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  Object.keys(doc.fields).forEach((k) => { out[k] = decodeFsValue(doc.fields[k]); });
  return out;
}

function escapeHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  try {
    const id = req.query?.id || (req.url && req.url.match(/\/product[s]?\/([^\/?#]+)/)?.[1]);
    if (!id) {
      res.status(400).send('Missing product id');
      return;
    }

    // 1) Firestore-dan məhsul al
    const fsUrl = `${FIRESTORE_BASE}/products/${encodeURIComponent(id)}`;
    const fsRes = await fetch(fsUrl);
    let product = null;
    if (fsRes.ok) {
      const json = await fsRes.json();
      product = decodeFsDoc(json);
    }

    // 2) index.html-i fetch et (eyni deploy)
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'devaleur.az';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${host}`;
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    let html = await htmlRes.text();

    // 3) Məhsula uyğun OG meta-ları hazırla
    let title = 'DE VALEUR | Prestijinizə dəyər qatan detallar';
    let description = 'Azərbaycanda orijinal qol saatları, dəri məhsullar və aksesuarlar.';
    let image = `${baseUrl}/api/og-default`;
    let url = `${baseUrl}/product/${id}`;

    if (product) {
      const name = product.name || {};
      const productName = (typeof name === 'string') ? name : (name.az || name.en || name.ru || 'Məhsul');
      const brand = product.brand || '';
      const price = product.price != null ? `${product.price} ₼` : '';
      const stock = (product.stock ?? 0) > 0 ? 'Mövcuddur' : 'Sifariş ilə';
      const images = Array.isArray(product.images) ? product.images : [];
      const firstImage = images.find((u) => typeof u === 'string' && u.startsWith('http'));

      title = `${productName}${brand ? ' — ' + brand : ''} | DE VALEUR`;
      description = `${productName}${brand ? ' · ' + brand : ''}${price ? ' · ' + price : ''} · ${stock} · De Valeur Azərbaycan.`;
      if (firstImage) image = firstImage;
    }

    // 4) HTML-də OG meta-ları əvəz et
    const replaceMeta = (h, prop, val) => {
      const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
      const reAlt = new RegExp(`(<meta\\s+name="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
      if (re.test(h)) return h.replace(re, `$1${escapeHtml(val)}$3`);
      if (reAlt.test(h)) return h.replace(reAlt, `$1${escapeHtml(val)}$3`);
      return h;
    };

    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = replaceMeta(html, 'description', description);
    html = replaceMeta(html, 'og:title', title);
    html = replaceMeta(html, 'og:description', description);
    html = replaceMeta(html, 'og:image', image);
    html = replaceMeta(html, 'og:image:secure_url', image);
    html = replaceMeta(html, 'og:url', url);
    html = replaceMeta(html, 'og:type', 'product');
    html = replaceMeta(html, 'twitter:title', title);
    html = replaceMeta(html, 'twitter:description', description);
    html = replaceMeta(html, 'twitter:image', image);

    // og:image:width/height — məhsul şəkillərinin ölçüsünü dəqiq bilmirik, böyük göstər
    html = replaceMeta(html, 'og:image:width', '1200');
    html = replaceMeta(html, 'og:image:height', '1200');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (e) {
    // Səhv olarsa standart index.html-i qaytar — istifadəçi heç vaxt boş ekran görmür
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'devaleur.az';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const r = await fetch(`${proto}://${host}/index.html`);
      const fallback = await r.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fallback);
    } catch {
      res.status(500).send('OG generator failed');
    }
  }
}
