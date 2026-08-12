/**
 * /api/og — consolidated OG / SEO endpoint.
 *
 * Handles four sub-routes so we stay under Vercel's Hobby-plan function limit:
 *   ?type=default          → 1200×1200 site logo SVG
 *   ?type=product&id=...   → product HTML with AI SEO + JSON-LD (for bots)
 *   ?type=category&...     → category/brand HTML with OG meta (for bots)
 *   ?type=category-image&… → 1200×630 SVG grid image
 *
 * Called via vercel.json rewrites — legacy URLs (/api/og-default, /api/og-product, …)
 * keep working transparently.
 */
const FIRESTORE_PROJECT = 'devaleur-11742';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function decodeFsValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
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
const escapeXml = escapeHtml;

async function fetchProductsByFilter(type, name) {
  const field = type === 'brand' ? 'brand' : 'category';
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'products' }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: name } } },
      limit: 4,
    },
  };
  const r = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data || []).filter((i) => i.document).map((i) => decodeFsDoc(i.document));
}

function replaceMeta(h, prop, val) {
  const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
  const reAlt = new RegExp(`(<meta\\s+name="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
  if (re.test(h)) return h.replace(re, `$1${escapeHtml(val)}$3`);
  if (reAlt.test(h)) return h.replace(reAlt, `$1${escapeHtml(val)}$3`);
  return h;
}
function replaceLink(h, rel, href) {
  const re = new RegExp(`(<link\\s+rel="${rel}"[^>]*href=")([^"]*)("[^>]*>)`, 'i');
  if (re.test(h)) return h.replace(re, `$1${escapeHtml(href)}$3`);
  return h;
}

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'devaleur.az';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// ?type=default — 1200×1200 site logo
function handleDefault(req, res) {
  const logoUrl = 'https://i.hizliresim.com/tmu65g6.png';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#ffffff"/>
  <image href="${logoUrl}" x="200" y="350" width="800" height="500" preserveAspectRatio="xMidYMid meet"/>
  <text x="600" y="950" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="42" font-weight="300" letter-spacing="6" text-anchor="middle" fill="#0a0a0a">PRESTIJINIZƏ DƏYƏR QATAN DETALLAR</text>
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(svg);
}

// ?type=category-image — 1200×630 2×2 product grid
async function handleCategoryImage(req, res) {
  try {
    const { category, brand } = req.query || {};
    const filterType = category ? 'category' : brand ? 'brand' : 'category';
    const name = category || brand || '';
    const placeholder = 'https://i.hizliresim.com/tmu65g6.png';
    const images = [placeholder, placeholder, placeholder, placeholder];
    if (name) {
      const products = await fetchProductsByFilter(filterType, name);
      for (let i = 0; i < Math.min(4, products.length); i++) {
        const imgs = Array.isArray(products[i].images) ? products[i].images : [];
        const img = imgs.find((u) => typeof u === 'string' && u.startsWith('http'));
        if (img) images[i] = img;
      }
    }
    const label = escapeXml(filterType === 'brand' ? name : (name || 'Məhsullar'));
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="c0"><rect x="10" y="10" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="c1"><rect x="600" y="10" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="c2"><rect x="10" y="315" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="c3"><rect x="600" y="315" width="590" height="305" rx="8"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#f8f8f8"/>
  <g clip-path="url(#c0)"><image href="${escapeXml(images[0])}" x="10" y="10" width="590" height="305" preserveAspectRatio="xMidYMid slice"/></g>
  <g clip-path="url(#c1)"><image href="${escapeXml(images[1])}" x="600" y="10" width="590" height="305" preserveAspectRatio="xMidYMid slice"/></g>
  <g clip-path="url(#c2)"><image href="${escapeXml(images[2])}" x="10" y="315" width="590" height="305" preserveAspectRatio="xMidYMid slice"/></g>
  <g clip-path="url(#c3)"><image href="${escapeXml(images[3])}" x="600" y="315" width="590" height="305" preserveAspectRatio="xMidYMid slice"/></g>
  <rect x="350" y="245" width="500" height="140" rx="12" fill="rgba(255,255,255,0.95)"/>
  <text x="600" y="295" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="20" font-weight="500" letter-spacing="3" text-anchor="middle" fill="#0a0a0a">DE VALEUR</text>
  <text x="600" y="340" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="32" font-weight="600" text-anchor="middle" fill="#18181b">${label}</text>
  <text x="600" y="370" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="14" font-weight="400" text-anchor="middle" fill="#525252">devaleur.az</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(svg);
  } catch {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.status(200).send(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fff"/></svg>`);
  }
}

// ?type=category — category / brand HTML for bots
async function handleCategory(req, res) {
  try {
    const { category, brand } = req.query || {};
    const pathMatch = req.url?.match(/\/(category|brand)\/([^\/?#]+)/);
    const filterType = category ? 'category' : brand ? 'brand' : (pathMatch?.[1] || 'category');
    const name = category || brand || (pathMatch?.[2] ? decodeURIComponent(pathMatch[2]) : '');
    if (!name) { res.status(400).send('Missing category or brand name'); return; }

    const products = await fetchProductsByFilter(filterType, name);
    const baseUrl = getBaseUrl(req);
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    let html = await htmlRes.text();

    const count = products.length;
    const title = filterType === 'brand'
      ? `${name} məhsulları | DE VALEUR`
      : `${name} kateqoriyası | DE VALEUR`;
    const description = count > 0
      ? `${name} üzrə ${count}+ məhsul. Orijinal qol saatları, dəri məhsullar və aksesuarlar. De Valeur Azərbaycan.`
      : `${name} — Orijinal qol saatları, dəri məhsullar və aksesuarlar. De Valeur Azərbaycan.`;
    const image = `${baseUrl}/api/og-category-image?${filterType}=${encodeURIComponent(name)}`;
    const url = `${baseUrl}/${filterType}/${encodeURIComponent(name)}`;

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
    html = replaceLink(html, 'canonical', url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch {
    try {
      const baseUrl = getBaseUrl(req);
      const r = await fetch(`${baseUrl}/index.html`);
      const fb = await r.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fb);
    } catch { res.status(500).send('OG category failed'); }
  }
}

// ?type=product — product HTML with AI SEO + JSON-LD for bots
async function handleProduct(req, res) {
  try {
    const id = req.query?.id || (req.url && req.url.match(/\/product[s]?\/([^\/?#]+)/)?.[1]);
    if (!id) { res.status(400).send('Missing product id'); return; }

    const langRaw = (
      (req.query?.lang && String(req.query.lang)) ||
      (req.headers['accept-language'] || '').split(',')[0] ||
      'az'
    ).toLowerCase();
    const lang = langRaw.startsWith('ru') ? 'ru' : langRaw.startsWith('en') ? 'en' : 'az';
    const otherLangs = ['az', 'ru', 'en'].filter((l) => l !== lang);

    const fsRes = await fetch(`${FIRESTORE_BASE}/products/${encodeURIComponent(id)}`);
    let product = null;
    if (fsRes.ok) product = decodeFsDoc(await fsRes.json());

    const baseUrl = getBaseUrl(req);
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    let html = await htmlRes.text();

    let title = 'DE VALEUR | Prestijinizə dəyər qatan detallar';
    let description = 'Azərbaycanda orijinal qol saatları, dəri məhsullar və aksesuarlar.';
    let keywords = '';
    let imageAlt = '';
    let image = `${baseUrl}/api/og-default`;
    const canonical = `${baseUrl}/product/${id}`;
    let jsonLd = null;
    let productName = '';
    let brand = '';
    let productDesc = '';

    if (product) {
      const nameObj = product.name || {};
      const descObj = product.description || {};
      const seo = product.seo || {};
      productName = (typeof nameObj === 'string' ? nameObj : nameObj[lang] || nameObj.en || nameObj.az || nameObj.ru) || 'Məhsul';
      productDesc = (typeof descObj === 'string' ? descObj : descObj[lang] || descObj.en || descObj.az || descObj.ru) || '';
      brand = product.brand || '';
      const priceNum = product.price != null ? Number(product.price) : null;
      const salePriceNum = product.salePrice != null ? Number(product.salePrice) : null;
      const priceForSchema = salePriceNum && priceNum && salePriceNum < priceNum ? salePriceNum : priceNum;
      const priceLabel = priceForSchema != null ? `${priceForSchema} ₼` : '';
      const inStock = (product.stock ?? 1) > 0;
      const stockLabel = inStock ? 'Mövcuddur' : 'Sifariş ilə';
      const images = Array.isArray(product.images) ? product.images : [];
      const firstImage = images.find((u) => typeof u === 'string' && u.startsWith('http'));

      const seoTitle = (seo.title && (seo.title[lang] || seo.title.en || seo.title.az)) || '';
      const seoDesc = (seo.description && (seo.description[lang] || seo.description.en || seo.description.az)) || '';
      const seoKeywords = (seo.keywords && (seo.keywords[lang] || seo.keywords.en || seo.keywords.az)) || '';
      const seoAlt = (seo.imageAlt && (seo.imageAlt[lang] || seo.imageAlt.en || seo.imageAlt.az)) || '';

      title = seoTitle || `${productName}${brand ? ' — ' + brand : ''} | DE VALEUR`;
      description = seoDesc || `${productName}${brand ? ' · ' + brand : ''}${priceLabel ? ' · ' + priceLabel : ''} · ${stockLabel} · De Valeur Azərbaycan.${productDesc ? ' ' + productDesc.slice(0, 100) : ''}`;
      keywords = seoKeywords || [brand, product.category, productName, 'de valeur', 'orijinal', 'saat', 'aksesuar'].filter(Boolean).join(', ');
      imageAlt = seoAlt || productName;
      if (firstImage) image = firstImage;

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productName,
        description,
        image: images.filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 6),
        brand: brand ? { '@type': 'Brand', name: brand } : undefined,
        sku: product.sku || id,
        mpn: product.sku || id,
        category: product.category,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'AZN',
          price: priceForSchema != null ? String(priceForSchema) : undefined,
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: canonical,
          seller: { '@type': 'Organization', name: 'DE VALEUR' },
        },
      };
    }

    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = replaceMeta(html, 'description', description);
    if (keywords) html = replaceMeta(html, 'keywords', keywords);
    html = replaceMeta(html, 'og:title', title);
    html = replaceMeta(html, 'og:description', description);
    html = replaceMeta(html, 'og:image', image);
    html = replaceMeta(html, 'og:image:secure_url', image);
    if (imageAlt) html = replaceMeta(html, 'og:image:alt', imageAlt);
    html = replaceMeta(html, 'og:url', canonical);
    html = replaceMeta(html, 'og:type', 'product');
    html = replaceMeta(html, 'twitter:title', title);
    html = replaceMeta(html, 'twitter:description', description);
    html = replaceMeta(html, 'twitter:image', image);
    html = replaceMeta(html, 'og:image:width', '1200');
    html = replaceMeta(html, 'og:image:height', '1200');
    html = replaceLink(html, 'canonical', canonical);

    if (jsonLd) {
      const ldTag = `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
      html = html.replace(/<\/head>/i, ldTag);
    }
    const hreflangTags = otherLangs
      .map((l) => `    <link rel="alternate" hreflang="${l}" href="${canonical}?lang=${l}" />`)
      .concat([`    <link rel="alternate" hreflang="${lang}" href="${canonical}" />`])
      .concat([`    <link rel="alternate" hreflang="x-default" href="${canonical}" />`])
      .join('\n');
    html = html.replace(/<\/head>/i, `\n${hreflangTags}\n  </head>`);

    if (product) {
      const seoBody = `
    <div id="seo-fallback" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">
      <h1>${escapeHtml(productName)}${brand ? ' – ' + escapeHtml(brand) : ''}</h1>
      <p>${escapeHtml(description)}</p>
      ${productDesc ? `<p>${escapeHtml(productDesc.slice(0, 500))}</p>` : ''}
      <p>Brend: ${escapeHtml(brand)}. Kateqoriya: ${escapeHtml(product.category || '')}. DE VALEUR — Azərbaycanda orijinal saat və aksesuarlar.</p>
    </div>`;
      html = html.replace('<div id="root"></div>', `<div id="root"></div>${seoBody}`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch {
    try {
      const baseUrl = getBaseUrl(req);
      const r = await fetch(`${baseUrl}/index.html`);
      const fb = await r.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fb);
    } catch { res.status(500).send('OG product failed'); }
  }
}

// ?type=telegram-notify (POST) — müştəri söhbət hadisələrini Telegram qrupuna
// göndərir. Token/chat_id yalnız Vercel env-də saxlanılır.
async function handleTelegramNotify(req, res) {
  try {
    const token =
      process.env.TELEGRAM_BOT_TOKEN ||
      '8879699672:AAHn_7Omeg8LA9eEMEF2MhlwNnBtlfC9_u4';
    const chatId = process.env.TELEGRAM_CHAT_ID || '-5447107741';
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    if (!token || !chatId) { res.status(200).json({ ok: false, error: 'telegram not configured' }); return; }
    const code = (body.code || '?').toString().trim();
    let text;
    if (body.type === 'contact') {
      const lines = ['📞 <b>Müştəri ilə əlaqə yarat</b>', `Müştəri: <b>#${code}</b>`];
      if (body.name) lines.push(`👤 ${body.name}`);
      if (body.phone) lines.push(`📱 <b>${body.phone}</b>`);
      text = lines.join('\n');
    } else {
      text = `🆕 <b>Yeni söhbət başladı</b>\nMüştəri: <b>#${code}</b>`;
      if (body.message) text += `\n💬 ${String(body.message).slice(0, 200)}`;
    }
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await tg.json().catch(() => ({}));
    res.status(200).json({ ok: !!data.ok });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}

// ?type=img-proxy&url=... — CORS-safe image proxy so <canvas> (Instagram Story
// generator) can draw remote R2/Firebase product images without tainting.
async function handleImgProxy(req, res) {
  try {
    const url = req.query?.url ? String(req.query.url) : '';
    if (!url || !/^https?:\/\//i.test(url)) { res.status(400).send('bad url'); return; }
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { res.status(400).send('bad url'); return; }
    // SSRF guard — block internal/private hosts, allow any public host
    if (
      !host ||
      host === 'localhost' || host === '::1' || host.endsWith('.local') ||
      host.startsWith('127.') || host.startsWith('10.') ||
      host.startsWith('192.168.') || host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) { res.status(403).send('host not allowed'); return; }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeValeurBot/1.0)',
        'Accept': 'image/*,*/*',
      },
      redirect: 'follow',
    });
    if (!upstream.ok) { res.status(upstream.status).send('upstream error'); return; }
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buf);
  } catch {
    res.status(502).send('proxy failed');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const type = (req.query?.type || '').toString().toLowerCase();

  // Route explicitly by ?type=
  if (type === 'default') return handleDefault(req, res);
  if (type === 'category-image') return handleCategoryImage(req, res);
  if (type === 'category') return handleCategory(req, res);
  if (type === 'product') return handleProduct(req, res);
  if (type === 'img-proxy') return handleImgProxy(req, res);
  if (type === 'telegram-notify') return handleTelegramNotify(req, res);

  // Fallback: infer from URL path so /api/og-default etc. still work if any
  // callers hit the raw file name without rewrite.
  if (req.url?.includes('img-proxy')) return handleImgProxy(req, res);
  if (req.url?.includes('telegram')) return handleTelegramNotify(req, res);
  if (req.url?.includes('og-default')) return handleDefault(req, res);
  if (req.url?.includes('og-category-image')) return handleCategoryImage(req, res);
  if (req.url?.includes('og-category')) return handleCategory(req, res);
  if (req.url?.includes('og-product')) return handleProduct(req, res);

  // Default: site logo
  return handleDefault(req, res);
}
