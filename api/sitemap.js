/**
 * /api/sitemap.xml — Dinamik sitemap generatoru.
 *
 * Firestore-dan bütün aktiv məhsulları çəkir, hər biri üçün URL yaradır və
 * `lastmod` sahəsinə məhsulun sonuncu yenilənmə tarixini yazır. Google həm
 * yeni məhsulları, həm də dəyişənləri sürətlə tapsın deyə.
 *
 * Vercel `sitemap.xml` sorğusunu bu funksiyaya yönləndirir (vercel.json).
 *
 * Cache-Control: `s-maxage=3600` — hər saat bir dəfə regenerasiya, arada
 * `stale-while-revalidate` ilə istifadəçi heç vaxt gecikmə hiss etmir.
 */
const FIRESTORE_PROJECT = 'devaleur-11742';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;
const SITE = 'https://devaleur.az';

function decodeFsValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decodeFsValue);
  if (v.mapValue !== undefined) {
    const obj = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach((k) => { obj[k] = decodeFsValue(fields[k]); });
    return obj;
  }
  return null;
}

function decodeDoc(doc) {
  if (!doc || !doc.fields) return null;
  const out = { _name: doc.name };
  Object.keys(doc.fields).forEach((k) => { out[k] = decodeFsValue(doc.fields[k]); });
  return out;
}

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Firestore REST list endpoint returns max 100 docs per page — use pagination.
async function listAllProducts() {
  const all = [];
  let pageToken = '';
  for (let i = 0; i < 100; i++) {
    const url = `${FIRESTORE_BASE}/products?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    // eslint-disable-next-line no-await-in-loop
    const r = await fetch(url);
    if (!r.ok) break;
    // eslint-disable-next-line no-await-in-loop
    const json = await r.json();
    (json.documents || []).forEach((d) => {
      const decoded = decodeDoc(d);
      if (!decoded) return;
      // Firestore document name → last segment = doc id
      const id = (decoded._name || '').split('/').pop();
      all.push({ id, ...decoded });
    });
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return all;
}

const STATIC_URLS = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${SITE}/products`, priority: '0.95', changefreq: 'daily' },
  { loc: `${SITE}/about`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/partners`, priority: '0.85', changefreq: 'weekly' },
  { loc: `${SITE}/blog`, priority: '0.75', changefreq: 'weekly' },
  { loc: `${SITE}/contact`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/delivery`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${SITE}/careers`, priority: '0.65', changefreq: 'monthly' },
  { loc: `${SITE}/return-policy`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${SITE}/privacy-policy`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${SITE}/gift-cards`, priority: '0.7', changefreq: 'weekly' },
];

export default async function handler(req, res) {
  try {
    const products = await listAllProducts();
    // Yalnız aktiv və qonağa görünən məhsulları sitemap-a qoy
    const visibleProducts = products.filter((p) => {
      if (p.isEnabled === false) return false;
      const visibleTo = p.visibleTo || 'all';
      // Public sitemap → yalnız `all` və `customer` göstər (b2b-only məhsullar
      // Google-a görünməsin)
      if (visibleTo === 'b2b') return false;
      if (p.comingSoon === true) return false;
      return true;
    });

    // Kateqoriya və brend URL-ləri — məhsullardan uniq siyahı
    const categories = Array.from(
      new Set(visibleProducts.map((p) => p.category).filter(Boolean))
    );
    const brands = Array.from(
      new Set(visibleProducts.map((p) => p.brand).filter(Boolean))
    );

    const urls = [];

    // 1) Statik səhifələr
    STATIC_URLS.forEach((u) => {
      urls.push(
        `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n    <xhtml:link rel="alternate" hreflang="az" href="${xmlEscape(u.loc)}" />\n    <xhtml:link rel="alternate" hreflang="ru" href="${xmlEscape(u.loc)}?lang=ru" />\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(u.loc)}?lang=en" />\n  </url>`
      );
    });

    // 2) Kateqoriya səhifələri
    categories.forEach((c) => {
      const loc = `${SITE}/category/${encodeURIComponent(c)}`;
      urls.push(
        `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.75</priority>\n  </url>`
      );
    });

    // 3) Brend səhifələri
    brands.forEach((b) => {
      const loc = `${SITE}/brand/${encodeURIComponent(b)}`;
      urls.push(
        `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );
    });

    // 4) Məhsul səhifələri — ən vacib hissə (Google bu URL-ləri kəşf edir)
    visibleProducts.forEach((p) => {
      const loc = `${SITE}/product/${p.id}`;
      const lastmod = (p.updatedAt || p.createdAt || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10);
      const firstImage = Array.isArray(p.images)
        ? p.images.find((u) => typeof u === 'string' && u.startsWith('http'))
        : null;
      const nameObj = p.name || {};
      const titleAz = (typeof nameObj === 'string' ? nameObj : nameObj.az || nameObj.en || '') + (p.brand ? ' – ' + p.brand : '');
      const imgBlock = firstImage
        ? `\n    <image:image>\n      <image:loc>${xmlEscape(firstImage)}</image:loc>\n      <image:title>${xmlEscape(titleAz)}</image:title>\n    </image:image>`
        : '';
      urls.push(
        `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${xmlEscape(lastmod)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n    <xhtml:link rel="alternate" hreflang="az" href="${xmlEscape(loc)}" />\n    <xhtml:link rel="alternate" hreflang="ru" href="${xmlEscape(loc)}?lang=ru" />\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(loc)}?lang=en" />${imgBlock}\n  </url>`
      );
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Product-Count', String(visibleProducts.length));
    res.status(200).send(xml);
  } catch (e) {
    // Fall back to a minimal static sitemap so Google still gets root URLs
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
  <url><loc>${SITE}/products</loc></url>
</urlset>`);
  }
}
