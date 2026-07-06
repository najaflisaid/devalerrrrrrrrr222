/**
 * /api/og-category-image — Kateqoriya/Brend üçün 2×2 məhsul şəkli grid generatoru (SVG).
 *
 * Yeni dependency əlavə etmədən SVG istifadə edərək 1200×630 ölçülü
 * Open Graph şəkli yaradır. Hər hücrədə bir məhsul şəkli, mərkəzdə
 * kateqoriya/brend adı overlay.
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

function escapeXml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchProductsByFilter(type, name) {
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

function getFirstImage(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find((u) => typeof u === 'string' && u.startsWith('http')) || null;
}

export default async function handler(req, res) {
  try {
    const { category, brand } = req.query || {};

    const type = category ? 'category' : (brand ? 'brand' : 'category');
    const name = category || brand || '';

    // Default şəkillər (placeholder)
    const placeholder = 'https://i.hizliresim.com/tmu65g6.png';
    const images = [placeholder, placeholder, placeholder, placeholder];

    if (name) {
      const products = await fetchProductsByFilter(type, name);

      for (let i = 0; i < Math.min(4, products.length); i++) {
        const img = getFirstImage(products[i]);
        if (img) images[i] = img;
      }
    }

    const label = type === 'brand' ? name : (name || 'Məhsullar');
    const escapedLabel = escapeXml(label);

    // 1200×630 SVG — 2×2 grid
    // Her hücrə: 590×305, 10px boşluqlar
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="cell0"><rect x="10" y="10" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="cell1"><rect x="600" y="10" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="cell2"><rect x="10" y="315" width="590" height="305" rx="8"/></clipPath>
    <clipPath id="cell3"><rect x="600" y="315" width="590" height="305" rx="8"/></clipPath>
  </defs>

  <!-- Arxa fon -->
  <rect width="1200" height="630" fill="#f8f8f8"/>

  <!-- 2×2 Grid -->
  <g clip-path="url(#cell0)">
    <image href="${escapeXml(images[0])}" x="10" y="10" width="590" height="305" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <g clip-path="url(#cell1)">
    <image href="${escapeXml(images[1])}" x="600" y="10" width="590" height="305" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <g clip-path="url(#cell2)">
    <image href="${escapeXml(images[2])}" x="10" y="315" width="590" height="305" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <g clip-path="url(#cell3)">
    <image href="${escapeXml(images[3])}" x="600" y="315" width="590" height="305" preserveAspectRatio="xMidYMid slice"/>
  </g>

  <!-- Mərkəzi overlay -->
  <rect x="350" y="245" width="500" height="140" rx="12" fill="rgba(255,255,255,0.95)"/>
  <text x="600" y="295" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="20" font-weight="500" letter-spacing="3" text-anchor="middle" fill="#0a0a0a">DE VALEUR</text>
  <text x="600" y="340" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="32" font-weight="600" text-anchor="middle" fill="#18181b">${escapedLabel}</text>
  <text x="600" y="370" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="14" font-weight="400" text-anchor="middle" fill="#525252">devaleur.az</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(svg);
  } catch (e) {
    // Fallback — sadə logo SVG
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <image href="https://i.hizliresim.com/tmu65g6.png" x="300" y="115" width="600" height="400" preserveAspectRatio="xMidYMid meet"/>
  <text x="600" y="560" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="24" font-weight="300" letter-spacing="4" text-anchor="middle" fill="#0a0a0a">DE VALEUR — Prestijinizə dəyər qatan detallar</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).send(fallback);
  }
}
