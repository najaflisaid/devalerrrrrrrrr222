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

    // Preferred language for meta text — derived from ?lang=..., Accept-Language,
    // or `az` default. Bots (Googlebot) send Accept-Language rarely, so default to AZ.
    const langRaw = (
      (req.query?.lang && String(req.query.lang)) ||
      (req.headers['accept-language'] || '').split(',')[0] ||
      'az'
    ).toLowerCase();
    const lang = langRaw.startsWith('ru') ? 'ru' : langRaw.startsWith('en') ? 'en' : 'az';
    const otherLangs = ['az', 'ru', 'en'].filter((l) => l !== lang);

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

    // 3) Məhsula uyğun SEO meta-ları hazırla — ƏSAS: admin-in AI SEO tabında
    // yaratdığı `seo.title / seo.description / seo.keywords / seo.imageAlt`
    // istifadə olunur. Yalnız o yoxdursa məhsul adı/təsviri fall-back kimi işlədilir.
    let title = 'DE VALEUR | Prestijinizə dəyər qatan detallar';
    let description = 'Azərbaycanda orijinal qol saatları, dəri məhsullar və aksesuarlar.';
    let keywords = '';
    let imageAlt = '';
    let image = `${baseUrl}/api/og-default`;
    const canonical = `${baseUrl}/product/${id}`;
    let jsonLd = null;

    if (product) {
      const nameObj = product.name || {};
      const descObj = product.description || {};
      const seo = product.seo || {};
      const productName =
        (typeof nameObj === 'string' ? nameObj : nameObj[lang] || nameObj.en || nameObj.az || nameObj.ru) ||
        'Məhsul';
      const productDesc =
        (typeof descObj === 'string' ? descObj : descObj[lang] || descObj.en || descObj.az || descObj.ru) ||
        '';
      const brand = product.brand || '';
      const priceNum = product.price != null ? Number(product.price) : null;
      const salePriceNum = product.salePrice != null ? Number(product.salePrice) : null;
      const priceForSchema = salePriceNum && priceNum && salePriceNum < priceNum ? salePriceNum : priceNum;
      const priceLabel = priceForSchema != null ? `${priceForSchema} ₼` : '';
      const inStock = (product.stock ?? 1) > 0;
      const stockLabel = inStock ? 'Mövcuddur' : 'Sifariş ilə';
      const images = Array.isArray(product.images) ? product.images : [];
      const firstImage = images.find((u) => typeof u === 'string' && u.startsWith('http'));

      // AI SEO title/description/keywords/imageAlt istifadə et (əgər varsa)
      const seoTitle = (seo.title && (seo.title[lang] || seo.title.en || seo.title.az)) || '';
      const seoDesc = (seo.description && (seo.description[lang] || seo.description.en || seo.description.az)) || '';
      const seoKeywords = (seo.keywords && (seo.keywords[lang] || seo.keywords.en || seo.keywords.az)) || '';
      const seoAlt = (seo.imageAlt && (seo.imageAlt[lang] || seo.imageAlt.en || seo.imageAlt.az)) || '';

      title = seoTitle || `${productName}${brand ? ' — ' + brand : ''} | DE VALEUR`;
      description =
        seoDesc ||
        `${productName}${brand ? ' · ' + brand : ''}${priceLabel ? ' · ' + priceLabel : ''} · ${stockLabel} · De Valeur Azərbaycan.${productDesc ? ' ' + productDesc.slice(0, 100) : ''}`;
      keywords =
        seoKeywords ||
        [brand, product.category, productName, 'de valeur', 'orijinal', 'saat', 'aksesuar']
          .filter(Boolean)
          .join(', ');
      imageAlt = seoAlt || productName;
      if (firstImage) image = firstImage;

      // JSON-LD Product schema for Google rich results
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productName,
        description: description,
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

    // 4) HTML-də meta-ları əvəz et
    const replaceMeta = (h, prop, val) => {
      const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
      const reAlt = new RegExp(`(<meta\\s+name="${prop}"\\s+content=")([^"]*)("\\s*/?>)`, 'i');
      if (re.test(h)) return h.replace(re, `$1${escapeHtml(val)}$3`);
      if (reAlt.test(h)) return h.replace(reAlt, `$1${escapeHtml(val)}$3`);
      return h;
    };
    const replaceLink = (h, rel, href) => {
      const re = new RegExp(`(<link\\s+rel="${rel}"[^>]*href=")([^"]*)("[^>]*>)`, 'i');
      if (re.test(h)) return h.replace(re, `$1${escapeHtml(href)}$3`);
      return h;
    };

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

    // Inject JSON-LD Product schema + <h1>/description body content so
    // bots that don't run JS (or Google's fast-index bot) still see the
    // essential product info as HTML text.
    if (jsonLd) {
      const ldTag = `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
      html = html.replace(/<\/head>/i, ldTag);
    }

    // Alternate hreflang for the OTHER two languages (Google multi-lang SEO)
    const hreflangTags = otherLangs
      .map((l) => `    <link rel="alternate" hreflang="${l}" href="${canonical}?lang=${l}" />`)
      .concat([`    <link rel="alternate" hreflang="${lang}" href="${canonical}" />`])
      .concat([`    <link rel="alternate" hreflang="x-default" href="${canonical}" />`])
      .join('\n');
    html = html.replace(/<\/head>/i, `\n${hreflangTags}\n  </head>`);

    // A minimal SEO body so crawlers see H1 + product summary without executing JS.
    // Real users get the SPA (React replaces #root); this is only visible until React mounts.
    if (product) {
      const nameObj = product.name || {};
      const productName =
        (typeof nameObj === 'string' ? nameObj : nameObj[lang] || nameObj.en || nameObj.az || nameObj.ru) ||
        'Məhsul';
      const brand = product.brand || '';
      const descObj = product.description || {};
      const productDesc =
        (typeof descObj === 'string' ? descObj : descObj[lang] || descObj.en || descObj.az || descObj.ru) || '';
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
