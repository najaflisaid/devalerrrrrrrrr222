/**
 * AI Product Lookup — Frontend Service
 *
 * Gemini API-yə birbaşa brauzer-dən müraciət edir (Vercel serverless
 * olmadan). google_search tool ilə internet axtarışı aparır.
 *
 * QEYD: API açarı bundle-a daxildir — bu Firebase config kimi ictimai
 * client-side identifikatordur. Google AI-də HTTP referrer restriction
 * qoymaqla məhdudlaşdırıla bilər.
 */

const GEMINI_API_KEY = 'AQ.Ab8RN6J6B4CZpyrSLtz6l0-M_c292ljC8pRPYb2hV1ffFjxGjA';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// google_search tool Gemini 2.0+ modellərində dəstəklənir.
const MODELS = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-3-flash-preview'];

type LangObj = { az: string | null; en: string | null; ru: string | null };

export interface AiLookupResult {
  found: boolean;
  query: string;
  name: LangObj;
  description: LangObj;
  brand: string | null;
  model: string | null;
  barcode: string | null;
  sku: string | null;
  category_hint: string | null;
  gender: 'men' | 'women' | 'unisex' | null;
  country_of_origin: string | null;
  color: string | null;
  size: string | null;
  features: string[];
  specs: Record<string, string>;
  seo: { title_az: string | null; description_az: string | null; tags: string[] };
  image_urls: string[];
  source_urls: string[];
  model_used?: string;
}

const buildPrompt = (query: string, sites: string[]): string => {
  const sitesHint = sites.length
    ? `\n\nÜstünlük ver bu saytlara (əgər tapılsa): ${sites.join(', ')}.`
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

const callGemini = async (prompt: string): Promise<{ data: any; error: string | null; modelUsed: string | null }> => {
  let lastError = 'no models';
  for (const model of MODELS) {
    const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    };
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
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
      continue;
    }
    try {
      const data = await resp.json();
      return { data, error: null, modelUsed: model };
    } catch {
      lastError = `non-JSON on ${model}`;
    }
  }
  return { data: null, error: lastError, modelUsed: null };
};

const parseJsonLoose = (text: string | null | undefined): any => {
  if (!text) return null;
  let t = String(text).trim();
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) t = fenceMatch[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = t.slice(start, end + 1);
  try { return JSON.parse(candidate); } catch {
    try {
      const cleaned = candidate
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u0000-\u001F]/g, ' ');
      return JSON.parse(cleaned);
    } catch { return null; }
  }
};

const isImageUrl = (u: string): boolean => {
  if (typeof u !== 'string' || !u) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  const path = u.split('?')[0].split('#')[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(path) ||
    /\/(images?|media|photos?|cdn|assets)\//i.test(path);
};

const dedupeImages = (arr: (string | undefined | null)[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of arr) {
    if (!u || typeof u !== 'string') continue;
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
};

const extractGroundingImages = (data: any): string[] => {
  try {
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks.map((c: any) => c?.web?.uri).filter((u: any) => typeof u === 'string');
  } catch { return []; }
};

const extractGroundingSources = (data: any): string[] => {
  try {
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks.map((c: any) => c?.web?.uri).filter((u: any) => typeof u === 'string').slice(0, 10);
  } catch { return []; }
};

export const lookupProductByBarcode = async (
  query: string,
  sites: string[] = [],
): Promise<AiLookupResult> => {
  const q = String(query || '').trim();
  if (!q) throw new Error('Barkod və ya SKU daxil edin');

  const prompt = buildPrompt(q, sites.slice(0, 10));
  const { data, error, modelUsed } = await callGemini(prompt);
  if (error || !data) {
    const isQuota = /429|quota|exceeded/i.test(String(error || ''));
    throw new Error(
      isQuota
        ? 'Gemini API kvotası bitib. Google AI Studio-da billing yoxlayın və ya bir neçə dəqiqə sonra yenidən cəhd edin.'
        : `AI axtarışı uğursuz oldu: ${error}`,
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text || '').join('').trim();
  const parsed = parseJsonLoose(text) || {};

  const llmImages: string[] = Array.isArray(parsed.image_urls) ? parsed.image_urls : [];
  const grounding = extractGroundingImages(data);
  const allImages = dedupeImages([...llmImages, ...grounding.filter(isImageUrl)]);

  const sourceUrls: string[] = Array.isArray(parsed.source_urls) && parsed.source_urls.length
    ? parsed.source_urls
    : extractGroundingSources(data);

  return {
    found: parsed.found !== false && !!(parsed.name?.az || parsed.name?.en),
    query: q,
    name: parsed.name || { az: null, en: null, ru: null },
    description: parsed.description || { az: null, en: null, ru: null },
    brand: parsed.brand || null,
    model: parsed.model || null,
    barcode: parsed.barcode || q,
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
    model_used: modelUsed || undefined,
  };
};
