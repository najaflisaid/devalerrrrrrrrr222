/**
 * AI Product Lookup — Vercel Serverless Function
 *
 * Admin panelində barkod/SKU daxil edildikdə AI ilə internet axtarışı edir
 * (Gemini + google_search tool) və məhsul haqqında struktura salınmış JSON
 * qaytarır. Şəkillər groundingMetadata-dan çıxarılır və ehtiyat üçün
 * Google Images (unofficial html scrape) ilə tamamlanır.
 *
 * Frontend `POST /api/ai/product-lookup { barcode }` ilə çağırır.
 */

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  'AQ.Ab8RN6J6B4CZpyrSLtz6l0-M_c292ljC8pRPYb2hV1ffFjxGjA';
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  'https://generativelanguage.googleapis.com/v1beta';
// google_search tool Gemini 2.0+ modellərində dəstəklənir.
// gemini-2.5-flash artıq yeni istifadəçilər üçün silinib — gemini-flash-latest
// və gemini-2.0-flash istifadə olunur (bunlar tool istifadəsini dəstəkləyir).
const GEMINI_MODEL = process.env.GEMINI_MODEL_LOOKUP || 'gemini-flash-latest';
const GEMINI_MODEL_FALLBACKS = ['gemini-2.0-flash', 'gemini-3-flash-preview'];

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const buildPrompt = (query, extraSites) => {
  const sitesHint = extraSites && extraSites.length
    ? `\n\nÜstünlük ver bu saytlara (əgər tapılsa): ${extraSites.join(', ')}.`
    : '';
  return `Sən internet üzərindən məhsul kataloqu tərtib edən köməkçisən.
Aşağıdakı barkod və ya SKU ilə axtar və məhsul haqqında dolğun məlumat tap.

BARKOD/SKU: "${query}"${sitesHint}

Rəsmi mağaza, brend, Amazon, eBay, WorldOfWatches və s. saytlardan istifadə edərək
məhsulun rəsmi məlumatlarını topla. Bir neçə mənbədə eyni məhsul göstərilibsə,
məlumatları birləşdir. Uydurma məlumat yazma — bilinmirsə null qoy.

⚠️ CAVAB YALNIZ AŞAĞIDAKI JSON FORMATINDA OLSUN (heç bir izahat, markdown fence yox):
{
  "found": boolean,
  "name": {"az": string|null, "en": string|null, "ru": string|null},
  "description": {"az": string|null, "en": string|null, "ru": string|null},
  "brand": string|null,
  "model": string|null,
  "barcode": string|null,
  "sku": string|null,
  "category_hint": string|null,
  "gender": "men"|"women"|"unisex"|null,
  "country_of_origin": string|null,
  "color": string|null,
  "size": string|null,
  "features": string[],
  "specs": {[key:string]: string},
  "seo": {"title_az": string|null, "description_az": string|null, "tags": string[]},
  "image_urls": string[],
  "source_urls": string[]
}

Qaydalar:
- name.az, name.en, name.ru — məhsulun rəsmi adı hər üç dildə (tərcümə et).
- description — 2-4 cümlə peşəkar məhsul təsviri hər üç dildə.
- brand — yalnız brend adı, məsələn "Casio", "Seiko", "Ducati".
- model — istehsalçının rəsmi model kodu.
- category_hint — "watch", "eyewear", "leather-goods" kimi qısa ingilis dilində kateqoriya işarəsi.
- gender — məhsul kişi/qadın/uniseks kimi hansı üçündür.
- image_urls — məhsulun ən azı 5-8 yüksək keyfiyyətli şəkil URL-i (birbaşa .jpg/.png/.webp linkləri; təkrarları at, kiçik thumbnail-ləri qoyma).
- source_urls — hansı saytlardan məlumat toplanıb.
- features — 4-8 önə çıxan xüsusiyyət (məs. "Sapfir kristal şüşə", "50m suya davamlı").
- specs — texniki xüsusiyyətlər açar-dəyər ("Şüşə": "Mineral", "Diametr": "42mm", ...).
- Bilinmir → null qoy, uydurma. Boş massiv üçün [].
- Şəkil URL-ləri yalnız məhsulun rəsmi/aydın fotolarını göstərsin (logo, reklam banneri yox).`;
};

const callGemini = async (prompt) => {
  const models = [GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
  let lastError = 'no models';
  for (const model of models) {
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    };
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = `network: ${err.message} (${model})`;
      continue;
    }
    if (resp.status === 429 || resp.status === 503) {
      lastError = `HTTP ${resp.status} on ${model}`;
      continue;
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      lastError = `HTTP ${resp.status} on ${model}: ${txt.slice(0, 200)}`;
      // Bəzi köhnə modellər google_search tool-u dəstəkləmir — sonrakı ilə cəhd et.
      continue;
    }
    try {
      const data = await resp.json();
      return { data, error: null, modelUsed: model };
    } catch (e) {
      lastError = `non-JSON on ${model}`;
    }
  }
  return { data: null, error: lastError, modelUsed: null };
};

const parseJsonLoose = (text) => {
  if (!text) return null;
  // Markdown code fence-ni sil
  let t = String(text).trim();
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) t = fenceMatch[1].trim();
  // İlk açan mötərizədən başla, sonuncu bağlayana qədər al
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = t.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // Trailing comma və s. kimi kiçik problemləri düzəlt
    try {
      const cleaned = candidate
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u0000-\u001F]/g, ' ');
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
};

const extractGroundingImages = (data) => {
  try {
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
      .map((c) => c?.web?.uri)
      .filter((u) => typeof u === 'string');
  } catch {
    return [];
  }
};

const extractGroundingSources = (data) => {
  try {
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
      .map((c) => c?.web?.uri)
      .filter((u) => typeof u === 'string')
      .slice(0, 10);
  } catch {
    return [];
  }
};

const isImageUrl = (u) => {
  if (typeof u !== 'string' || !u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  // Bir çox e-commerce şəkilləri query string ilə gəlir; extension-i pathde axtar
  const path = u.split('?')[0].split('#')[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(path) ||
    /\/(images?|media|photos?|cdn|assets)\//i.test(path);
};

const dedupeImages = (arr) => {
  const seen = new Set();
  const out = [];
  for (const u of arr) {
    if (!u || typeof u !== 'string') continue;
    // sadə normalizasiya — query stripped
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
};

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const query = String(body.barcode || body.sku || body.query || '').trim();
    const extraSites = Array.isArray(body.sites) ? body.sites.filter(Boolean).slice(0, 10) : [];
    if (!query) {
      res.status(400).json({ error: 'barcode/sku required' });
      return;
    }

    const prompt = buildPrompt(query, extraSites);
    const { data, error, modelUsed } = await callGemini(prompt);
    if (error || !data) {
      // İstifadəçiyə anlaşılan mesaj — 429 → kvota bitib
      const isQuota = /429|quota|exceeded/i.test(String(error || ''));
      const friendly = isQuota
        ? 'Gemini API kvotası bitib. Google AI Studio-da billing yoxlayın və ya bir neçə dəqiqə sonra yenidən cəhd edin.'
        : `AI provayder xətası: ${error}`;
      res.status(502).json({ error: friendly, detail: error });
      return;
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    const parsed = parseJsonLoose(text) || {};

    // Groundinq şəkilləri əlavə et (bəzən LLM özü də image_urls verir, birləşdir)
    const llmImages = Array.isArray(parsed.image_urls) ? parsed.image_urls : [];
    const grounding = extractGroundingImages(data);
    const allImages = dedupeImages([...llmImages, ...grounding.filter(isImageUrl)]);

    const sourceUrls = Array.isArray(parsed.source_urls) && parsed.source_urls.length
      ? parsed.source_urls
      : extractGroundingSources(data);

    const result = {
      found: parsed.found !== false && !!(parsed.name?.az || parsed.name?.en),
      query,
      name: parsed.name || { az: null, en: null, ru: null },
      description: parsed.description || { az: null, en: null, ru: null },
      brand: parsed.brand || null,
      model: parsed.model || null,
      barcode: parsed.barcode || query,
      sku: parsed.sku || null,
      category_hint: parsed.category_hint || null,
      gender: parsed.gender || null,
      country_of_origin: parsed.country_of_origin || null,
      color: parsed.color || null,
      size: parsed.size || null,
      features: Array.isArray(parsed.features) ? parsed.features : [],
      specs: parsed.specs && typeof parsed.specs === 'object' ? parsed.specs : {},
      seo: parsed.seo || { title_az: null, description_az: null, tags: [] },
      image_urls: allImages,
      source_urls: sourceUrls,
      model_used: modelUsed,
    };

    res.status(200).json(result);
  } catch (err) {
    console.error('[AI product-lookup] Error:', err);
    res.status(500).json({ error: 'AI cavab verə bilmədi', detail: String(err?.message || err) });
  }
}
