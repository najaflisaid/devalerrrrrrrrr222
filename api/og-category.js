/**
 * /api/og-category — Kateqoriya/Brend səhifəsi üçün OG önbaxış generatoru.
 *
 * Vercel rewrite vasitəsilə bot user-agent-ləri bu funksiyaya yönləndirilir.
 * Funksiya:
 *   1. Firestore REST structuredQuery ilə kateqoriya/brend üzrə məhsulları alır
 *   2. index.html-i fetch edib OG meta-ları dəyişir
 *   3. OG image üçün /api/og-category-image istifadə edir
 */
const FIRESTORE_PROJECT = 'devaleur-11742';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

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

/**
 * Kateqoriya və ya brend adı ilə məhsulları axtar (structuredQuery).
 * Firestore REST API-də runQuery istifadə olunur.
 */
async function fetchProductsByFilter(type, name) {
  // type: 'category' | 'brand'
  const field = type === 'brand' ? 'brand' : 'category';

  const query = {
    structuredQuery: {
      from: [{ collectionId: 'products' }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: name }
        }
      },
      limit: 4
    }
  };

  const url = `${FIRESTORE_BASE}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });

  if (!res.ok) return [];

  const data = await res.json();
  const products = [];

  for (const item of data) {
    if (item.document) {
      products.push(decodeFsDoc(item.document));
    }
  }

  return products;
}

export default async function handler(req, res) {
  try {
    const { category, brand } = req.query || {};

    // URL-dən parametr çıxarmaq (fallback)
    const pathMatch = req.url?.match(/\/(category|brand)\/([^\/?#]+)/);
    const type = category ? 'category' : (brand ? 'brand' : (pathMatch?.[1] || 'category'));
    const name = category || brand || pathMatch?.[2] || '';

    if (!name) {
      res.status(400).send('Missing category or brand name');
      return;
    }

    // Məhsulları fetch et
    const products = await fetchProductsByFilter(type, name);

    // index.html-i fetch et
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'devaleur.az';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${host}`;
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    let html = await htmlRes.text();

    // OG meta-ları hazırla
    const label = type === 'brand' ? name : `${name} — DE VALEUR`;
    const count = products.length;

    const title = type === 'brand'
      ? `${name} məhsulları | DE VALEUR`
      : `${name} kateqoriyası | DE VALEUR`;

    const description = count > 0
      ? `${name} üzrə ${count}+ məhsul. Orijinal qol saatları, dəri məhsullar və aksesuarlar. De Valeur Azərbaycan.`
      : `${name} — Orijinal qol saatları, dəri məhsullar və aksesuarlar. De Valeur Azərbaycan.`;

    const image = `${baseUrl}/api/og-category-image?${type}=${encodeURIComponent(name)}`;
    const url = `${baseUrl}/${type}/${encodeURIComponent(name)}`;

    // HTML-də OG meta-ları əvəz et
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
    html = replaceMeta(html, 'og:type', 'website');
    html = replaceMeta(html, 'twitter:title', title);
    html = replaceMeta(html, 'twitter:description', description);
    html = replaceMeta(html, 'twitter:image', image);
    html = replaceMeta(html, 'og:image:width', '1200');
    html = replaceMeta(html, 'og:image:height', '630');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (e) {
    // Səhv olarsa standart index.html-i qaytar
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'devaleur.az';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const r = await fetch(`${proto}://${host}/index.html`);
      const fallback = await r.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fallback);
    } catch {
      res.status(500).send('OG category generator failed');
    }
  }
}
