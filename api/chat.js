/**
 * De Valeur AI Chat — Vercel Serverless Function
 * 
 * Frontend (window.location.origin/api/chat) → bu function → OpenAI API
 * Bu sayədə deploy zamanı heç bir env variable lazım deyil — açar burada gizli qalır.
 */

// NVIDIA Integrate API (OpenAI-compatible) — server-side only, frontend bundle-da görsənmir
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'openai/gpt-oss-20b';

const DEVALEUR_PERSONA = `Sən "De Valeur AI" adlı yüksək səviyyəli AI satış və konsultasiya köməkçisisən.
Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi virtual konsultantısan.
Sən ChatGPT, Claude, OpenAI, Anthropic deyilsən — sən sadəcə "De Valeur AI"-san.
Əgər səndən hansı modelə əsaslandığın və ya kimin tərəfindən yaradıldığın soruşulsa, sadəcə deyirsən:
"Mən De Valeur-un öz AI satış konsultantıyam — sizə kömək etmək üçün buradayam."

🎯 ƏSAS MƏQSƏD:
İstifadəçilərə onların ehtiyaclarına, büdcəsinə və zövqünə uyğun ən yaxşı məhsulları tapmaq və satış prosesini ağıllı şəkildə yönləndirmək.

🧭 DAVRANIŞ:
- Həmişə peşəkar, mehriban, inandırıcı tonda danış
- Robot kimi yox, insan kimi təbii dialoq qur
- İlk mesajda salam ver və nə axtardığını soruş
- Cavablar QISA olsun (max 4-6 cümlə), satış məktubuna çevirmə
- "Səbətə əlavə et" və "İndi al" düymələrinə yumşaq yönləndir

🎯 SATIŞ STRATEGİYASI:
- 1-3 məhsul təklif et, daha çox yox
- Hər təklifdə: niyə bu müştəriyə uyğun olduğu qısaca
- Yalnız KATALOQDA olan və STOKDA olan məhsulları təklif et
- Cins səhv olmasın

🖼️ MƏHSUL KARTI FORMATI (ÇOX VACİB):
Müştəriyə hər hansı məhsul tövsiyə etdikdə, məhsulun TAM ID-si əsasında belə marker yaz:
[[PRODUCT:ID-BURAYA]]

⚠️ ID-NI KATALOQDAN OLDUĞU KİMİ KÖÇÜR — modeli/adı ID kimi yazma!
Kataloqda hər məhsul "ID:abcXYZ123 | brend — model..." formatında verilir.

Bir cavabda maks 3 marker. Hər marker ayrı sətirdə.
`;

const formatProducts = (products, limit = 500) => {
  if (!products || products.length === 0) {
    return '(Hal-hazırda kataloq boşdur.)';
  }
  const rows = [];
  for (const p of products.slice(0, limit)) {
    let priceStr;
    if (p.salePrice && p.price && p.salePrice < p.price) {
      const discPct = Math.round(((p.price - p.salePrice) / p.price) * 100);
      priceStr = `${p.salePrice.toFixed(0)} AZN (köhnə ${p.price.toFixed(0)} AZN, -${discPct}%)`;
    } else if (p.price != null) {
      priceStr = `${p.price.toFixed(0)} AZN`;
    } else {
      priceStr = 'qiymət yoxdur';
    }
    const badges = [];
    if (p.stock != null && p.stock <= 0) badges.push('STOKDA YOX');
    if (p.isBestseller) badges.push('BESTSELLER');
    const badgeStr = badges.length ? ' · ' + badges.join(' · ') : '';
    let genderStr = '';
    if (p.gender === 'men') genderStr = ' [kişi]';
    else if (p.gender === 'women') genderStr = ' [qadın]';
    else if (p.gender === 'unisex') genderStr = ' [unisex]';
    const categoryStr = p.category ? ` [${p.category}]` : '';
    const brandStr = p.brand ? `${p.brand} — ` : '';
    let descPreview = '';
    if (p.description && p.description.trim()) {
      const d = p.description.trim().replace(/\n/g, ' ').slice(0, 120);
      descPreview = ` / ${d}`;
    }
    rows.push(`- ID:${p.id} | ${brandStr}${p.name}${genderStr}${categoryStr} | ${priceStr}${badgeStr}${descPreview}`);
  }
  let extra = '';
  if (products.length > limit) {
    extra = `\n(Yuxarıda ${limit} ən aktual məhsul göstərilib.)`;
  }
  return rows.join('\n') + extra;
};

const catalogSummary = (products) => {
  if (!products || products.length === 0) return '';
  const total = products.length;
  const inStock = products.filter((p) => (p.stock || 0) > 0).length;
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const prices = products.map((p) => p.salePrice || p.price).filter((v) => typeof v === 'number');
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const bestsellers = products.filter((p) => p.isBestseller).length;
  return [
    `📊 KATALOQ STATİSTİKASI: ${total} məhsul (${inStock} stokda), ${bestsellers} bestseller`,
    `💰 Qiymət diapazonu: ${priceMin.toFixed(0)} AZN – ${priceMax.toFixed(0)} AZN`,
    `🏷️ Brendlər (${brands.length}): ${brands.slice(0, 20).join(', ')}`,
    `📂 Kateqoriyalar: ${categories.slice(0, 15).join(', ')}`,
  ].join('\n');
};

const formatHistory = (history, limit = 8) => {
  if (!history || history.length === 0) return '(yeni söhbətdir)';
  const recent = history.slice(-limit);
  return recent
    .map((h) => `${h.role === 'user' ? 'Müştəri' : 'De Valeur AI'}: ${(h.content || '').trim()}`)
    .join('\n');
};

const formatKnowledge = (k) => {
  if (!k) return '';
  const sections = [];
  if (k.aiInstructions && k.aiInstructions.trim()) {
    sections.push('⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI:\n' + k.aiInstructions.trim());
  }
  if (k.companyInfo && k.companyInfo.trim()) sections.push('🏢 ŞİRKƏT HAQQINDA:\n' + k.companyInfo.trim());
  if (k.brandsInfo && k.brandsInfo.trim()) sections.push('🏷️ BRENDLƏR HAQQINDA:\n' + k.brandsInfo.trim());
  if (k.policiesInfo && k.policiesInfo.trim()) sections.push('🛡️ ZƏMANƏT/ÇATDIRILMA/QAYTARMA:\n' + k.policiesInfo.trim());
  if (k.productsInfo && k.productsInfo.trim()) sections.push('📦 MƏHSULLAR HAQQINDA:\n' + k.productsInfo.trim());
  if (k.additionalNotes && k.additionalNotes.trim()) sections.push('📝 ƏLAVƏ KONTEKST:\n' + k.additionalNotes.trim());
  if (Array.isArray(k.conversationExamples) && k.conversationExamples.length > 0) {
    const exBlock = k.conversationExamples
      .filter((e) => (e.userMessage || '').trim() && (e.assistantMessage || '').trim())
      .map((e, i) => `Nümunə ${i + 1}:\nMüştəri: ${e.userMessage.trim()}\nDe Valeur AI: ${e.assistantMessage.trim()}${e.note ? '\n(Kontekst: ' + e.note + ')' : ''}`)
      .join('\n\n');
    if (exBlock) sections.push('💡 DİALOQ NÜMUNƏLƏRİ (bu tərzdə cavab ver):\n' + exBlock);
  }
  if (sections.length === 0) return '';
  return '\n\n📚 ŞİRKƏT BİLİK BAZASI:\n' + sections.join('\n\n');
};

// Extract image URLs from a message ("[şəkil: URL] text") for vision support
const extractImageUrls = (text) => {
  const urls = [];
  const re = /\[şəkil:\s*(https?:\/\/[^\]\s]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) urls.push(m[1]);
  return urls;
};

const stripImageMarkers = (text) => text.replace(/\[şəkil:\s*https?:\/\/[^\]\s]+\]/gi, '').trim();

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const message = (body.message || '').toString().trim();
    if (!message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const products = Array.isArray(body.products) ? body.products : [];
    const knowledge = body.knowledge || null;
    const language = body.language || 'az';

    const langDirective =
      language === 'ru'
        ? 'Cavab DİLİ: Rus dilində.'
        : language === 'en'
        ? 'Cavab DİLİ: İngilis dilində.'
        : 'Cavab DİLİ: Azərbaycan dilində.';

    const systemMessage =
      DEVALEUR_PERSONA +
      '\n\n' +
      langDirective +
      formatKnowledge(knowledge) +
      '\n\n' +
      catalogSummary(products) +
      '\n\n📦 SAYTDAKI TAM MƏHSUL KATALOQU:\n' +
      formatProducts(products) +
      '\n\n📝 ƏVVƏLKİ SÖHBƏT:\n' +
      formatHistory(history) +
      '\n\nİndi yuxarıdakı kontekstə əsasən müştərinin son mesajına qısa, təbii, satış yönümlü cavab ver.';

    // Build user content
    // Note: openai/gpt-oss-20b is text-only. If images are attached, mention their URLs in text.
    const imageUrls = extractImageUrls(message);
    const cleanedMessage = stripImageMarkers(message) || (imageUrls.length ? 'Müştəri şəkil paylaşdı.' : message);
    const userContent = imageUrls.length > 0
      ? `${cleanedMessage}\n\n[Müştəri şəkil(lər) əlavə etdi: ${imageUrls.slice(0, 4).join(', ')}]`
      : message;

    const messages = [
      { role: 'system', content: systemMessage },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    const aiRes = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      res.status(502).json({ error: `AI provayder xətası: ${aiRes.status}`, detail: errText.slice(0, 300) });
      return;
    }

    const data = await aiRes.json();
    const msgObj = data?.choices?.[0]?.message || {};
    let reply = (msgObj.content || '').trim();
    if (!reply) reply = (msgObj.reasoning_content || msgObj.reasoning || '').trim();
    reply = reply || 'Bağışlayın, cavab yarana bilmədi.';
    res.status(200).json({ reply });
  } catch (err) {
    console.error('[Chat API] Error:', err);
    res.status(500).json({ error: 'AI cavab verə bilmədi', detail: String(err?.message || err) });
  }
}
