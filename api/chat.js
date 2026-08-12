/**
 * De Valeur AI Chat — Vercel Serverless Function
 *
 * Frontend (window.location.origin/api/chat) → bu function → Google Gemini API
 * GEMINI_API_KEY env variable Vercel dashboardundan gətirilir.
 */

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  'AQ.Ab8RN6J6B4CZpyrSLtz6l0-M_c292ljC8pRPYb2hV1ffFjxGjA';
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const GEMINI_MODEL_FALLBACKS = (
  process.env.GEMINI_MODEL_FALLBACKS ||
  'gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-3.5-flash'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const DEVALEUR_PERSONA = `Sən "De Valeur AI" adlı yüksək səviyyəli AI satış və konsultasiya köməkçisisən.
Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi virtual konsultantısan.
Sən ChatGPT, Claude, OpenAI, Anthropic, Gemini deyilsən — sən sadəcə "De Valeur AI"-san.
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

📞 ƏLAQƏ MƏLUMATLARINI TOPLAMA (SATIŞ QIZILU QAYDASI):
- Müştəri ilə 2-3 sual/cavab mübadiləsindən sonra (yəni 3-cü və ya 4-cü AI cavabında) NƏZAKƏTLƏ ad və əlaqə nömrəsini soruş.
- Bunu satış işi ilə bağla — "Sizə ən uyğun modelləri seçib, stok və endirim təsdiqi üçün WhatsApp/zəng ilə əlaqə saxlayaq" tipli təbii bir cümlə ilə.
- ƏSLA basınc yaratma, təkidlə deyil. Bir dəfə soruş. Müştəri "sonra" desə bir də təkrarlama.
- Formatlaşdırma nümunəsi: "Sizinlə uyğun modelləri müzakirə edib rezerv etmək üçün adınızı və WhatsApp nömrənizi paylaşa bilərsinizmi? Nömrəniz yalnız sifariş və məsləhət üçün istifadə olunacaq."
- Əgər müştəri artıq öz-özündən nömrə/ad vermişsə, təşəkkür et və bir daha soruşma.
- Nömrə soruşduğun cavabda MƏHSUL markeri (yəni [[PRODUCT:...]]) də əlavə edə bilərsən — soyuq deyil, məsləhətə bağlı olmalıdır.
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

const formatKnowledge = (k) => {
  if (!k) return '';
  const sections = [];
  if (k.aiInstructions && k.aiInstructions.trim()) {
    sections.push('⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI (hər şeydən üstündür, MÜTLƏQ ƏMƏL ET):\n' + k.aiInstructions.trim());
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

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const callGemini = async (payload) => {
  const models = [GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
  let lastError = 'no models configured';
  for (const model of models) {
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = `network: ${err.message}`;
      continue;
    }
    if (resp.status === 429 || resp.status === 503) {
      lastError = `HTTP ${resp.status} on ${model}`;
      continue;
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { data: null, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` };
    }
    try {
      const data = await resp.json();
      return { data, error: null };
    } catch (e) {
      return { data: null, error: 'non-JSON response' };
    }
  }
  return { data: null, error: lastError };
};

// ---------------------------------------------------------------------------
// HR / heyət analitikası (İşçilər səhifəsi) — /api/workers-chat bu funksiyaya
// yönləndirilir (vercel.json rewrite). Eyni Gemini açarı istifadə olunur.
// ---------------------------------------------------------------------------
const HR_PERSONA = `Sən De Valeur şirkətinin admini üçün işləyən HR/heyət analitikasısan.

🎯 ƏSAS MƏQSƏD:
Admin sizdən komanda haqqında suallar verəcək (kim yaxşı satır, kimin performansı zəifdir, cərimələr, mükafatlar, tələblər, filial müqayisələri və s.). Cavabları QISA, konkret və data-ya əsaslanmış şəkildə ver.

🧭 DAVRANIŞ:
- Adminlə peşəkar, məlumatlı, bir HR analitiki tonunda danış
- Cavab dilində konkret rəqəm və adlar ver (məs. "Rəşad Əliyev — 4,200 AZN satış, 88% reytinq")
- Ümumiləşdirməkdən çəkin — hansı işçini nəzərdə tutduğunu aydın göstər
- Rəqəmləri AZN valyutasında və 0/2 onluqda ver
- Zəruri hallarda TOP-3 və ya siyahı formatı istifadə et (- ilə)
- Cavab uzunluğu: 3-8 cümlə (əgər sual siyahı istəyirsə, siyahını qısa saxla)
- Heç vaxt uydurma — göstərilən data-dan kənara çıxmasan
- Əgər sual data ilə əlaqəli deyilsə, mehriban şəkildə admini komanda mövzusuna qaytar

📊 STATİSTİKA QAYDALARI:
- "Bu ay" dedikdə cari ay salesHistory-də tapdığın son ay
- Reytinq (%): işçinin ümumi performans göstəricisi
- monthlyTotalSales / monthlyTarget → hədəf tamamlanma faizi
- monthlyTotalReturns → qaytarılmalar (əskiltmə)
- Cərimələr və mükafatlar tarixçəsini nəzərə al

Əgər səndən hansı model olduğun soruşulsa: "Mən De Valeur-un daxili HR AI-yıyam."`;

const nfmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const summariseWorkers = (workers) => {
  if (!workers || workers.length === 0) return 'Komandada işçi yoxdur.';
  const active = workers.filter((w) => w.isActive);
  const totalSales = active.reduce((s, w) => s + (w.monthlyTotalSales || 0), 0);
  const totalTarget = active.reduce((s, w) => s + (w.monthlyTarget || 0), 0);
  const avgRating = active.length
    ? active.reduce((s, w) => s + (w.rating || 0), 0) / active.length
    : 0;
  const branches = {};
  const positions = {};
  for (const w of active) {
    if (w.branch) branches[w.branch] = (branches[w.branch] || 0) + 1;
    if (w.position) positions[w.position] = (positions[w.position] || 0) + 1;
  }
  const bstr = Object.entries(branches).map(([k, v]) => `${k} (${v})`).join(', ') || '—';
  const pstr = Object.entries(positions).map(([k, v]) => `${k} (${v})`).join(', ') || '—';
  return (
    `📊 KOMANDA ÜMUMİ:\n` +
    `- Ümumi işçi: ${workers.length}, aktiv: ${active.length}\n` +
    `- Cari ay ümumi satış: ${nfmt(totalSales)} AZN (hədəf: ${nfmt(totalTarget)} AZN)\n` +
    `- Orta performans reytinqi: ${avgRating.toFixed(1)}%\n` +
    `- Filiallar: ${bstr}\n` +
    `- Vəzifələr: ${pstr}`
  );
};

const formatWorkers = (workers, limit = 60) => {
  if (!workers || workers.length === 0) return '';
  const rows = workers.slice(0, limit).map((w) => {
    const sales = w.monthlyTotalSales || 0;
    const target = w.monthlyTarget || 0;
    const returns = w.monthlyTotalReturns || 0;
    const net = Math.max(0, sales - returns);
    const pct = target > 0 ? (net / target) * 100 : 0;
    const rating = w.rating != null ? `${Math.round(w.rating)}%` : '—';
    const branch = w.branch ? ` · ${w.branch}` : '';
    return (
      `- ${w.name} ${w.surname} [${w.position}${branch}] ` +
      `| reytinq: ${rating} | satış: ${nfmt(sales)} AZN ` +
      `| qaytarma: ${nfmt(returns)} | net: ${nfmt(net)} ` +
      `| hədəf: ${nfmt(target)} (${Math.round(pct)}%) ` +
      `| ${w.isActive ? 'aktiv' : 'passiv'} | id:${w.id}`
    );
  });
  return '👥 İŞÇİLƏR (detallı siyahı):\n' + rows.join('\n');
};

const nameMap = (workers) => {
  const m = {};
  for (const w of workers) m[w.id] = `${w.name} ${w.surname}`;
  return m;
};

const formatFines = (fines, workers) => {
  if (!fines || fines.length === 0) return '';
  const nm = nameMap(workers);
  const rows = fines.slice(0, 40).map(
    (f) => `- ${nm[f.workerId] || f.workerId}: -${nfmt(f.amount)} AZN (${f.reason || '—'}) · ${f.date}`
  );
  return '⚠️ SON CƏRİMƏLƏR:\n' + rows.join('\n');
};

const formatRewards = (rewards, workers) => {
  if (!rewards || rewards.length === 0) return '';
  const nm = nameMap(workers);
  const rows = rewards.slice(0, 40).map((r) => {
    const amt = r.amount ? ` +${nfmt(r.amount)}` : '';
    return `- ${nm[r.workerId] || r.workerId}: ${r.type}${amt} (${r.reason || '—'}) · ${r.date}`;
  });
  return '🏆 SON MÜKAFATLAR:\n' + rows.join('\n');
};

const formatRequests = (requests, workers) => {
  if (!requests || requests.length === 0) return '';
  const nm = nameMap(workers);
  const rows = requests.slice(0, 30).map(
    (r) => `- ${nm[r.workerId] || r.workerId}: ${r.type} [${r.status}] — ${r.subject || '—'} (${r.createdAt ? r.createdAt.slice(0, 10) : '—'})`
  );
  return '📨 İŞÇİ TƏLƏBLƏRİ:\n' + rows.join('\n');
};

const handleWorkersChat = async (res, body, message) => {
  const language = body.language || 'az';
  const langDirective =
    language === 'ru'
      ? 'Cavab DİLİ: Rus dilində.'
      : language === 'en'
      ? 'Cavab DİLİ: İngilis dilində.'
      : 'Cavab DİLİ: Azərbaycan dilində.';
  const workers = Array.isArray(body.workers) ? body.workers : [];
  const fines = Array.isArray(body.fines) ? body.fines : [];
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];
  const requests = Array.isArray(body.requests) ? body.requests : [];

  const parts = [
    HR_PERSONA,
    langDirective,
    summariseWorkers(workers),
    formatWorkers(workers),
    formatFines(fines, workers),
    formatRewards(rewards, workers),
    formatRequests(requests, workers),
  ];
  if ((body.context || '').trim()) parts.push('📝 ADMIN ƏLAVƏSİ:\n' + body.context.trim());
  const systemMessage = parts.filter(Boolean).join('\n\n');

  const history = Array.isArray(body.history) ? body.history : [];
  const contents = [];
  for (const h of history.slice(-10)) {
    if (!(h.content || '').trim()) continue;
    contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const payload = {
    systemInstruction: { parts: [{ text: systemMessage }] },
    contents,
    generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 1200 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const { data, error } = await callGemini(payload);
  if (error || !data) {
    res.status(502).json({ error: `AI provayder xətası: ${error || 'boş cavab'}` });
    return;
  }
  const candidates = data.candidates || [];
  let reply = '';
  if (candidates.length > 0) {
    const p = ((candidates[0].content || {}).parts) || [];
    reply = p.map((x) => x.text || '').join('').trim();
  }
  if (!reply) reply = 'Bağışlayın, cavab yarana bilmədi. Yenidən cəhd edin.';
  res.status(200).json({ reply });
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
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const message = (body.message || '').toString().trim();
    if (!message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    // İşçilər səhifəsi (HR analitikası) — /api/workers-chat bura yönlənir.
    if (body.mode === 'workers' || Array.isArray(body.workers)) {
      return await handleWorkersChat(res, body, message);
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const products = Array.isArray(body.products) ? body.products : [];
    const knowledge = body.knowledge || null;
    const language = body.language || 'az';
    const contactAlreadyCaptured = !!body.contactCaptured;
    // Count how many user turns have happened (including the current one).
    const userTurnCount = Math.max(
      1,
      history.filter((h) => h && h.role === 'user').length + 1
    );

    const langDirective =
      language === 'ru'
        ? 'Cavab DİLİ: Rus dilində.'
        : language === 'en'
        ? 'Cavab DİLİ: İngilis dilində.'
        : 'Cavab DİLİ: Azərbaycan dilində.';

    const contactHint = contactAlreadyCaptured
      ? '\n\n📌 SESSIYA DURUMU: Müştəri artıq ad/telefonunu paylaşıb. YENİDƏN SORUŞMA — sadəcə peşəkar cavab ver.'
      : userTurnCount === 3 || userTurnCount === 4
      ? '\n\n📌 SESSIYA DURUMU: Bu ' + userTurnCount + '-cü müştəri mesajıdır. Bu cavabında nəzakətlə ad və WhatsApp nömrəsini soruşmağın ən uyğun anıdır (bir dəfə, satış məsləhəti ilə bağlayaraq).'
      : userTurnCount > 4
      ? '\n\n📌 SESSIYA DURUMU: Bu ' + userTurnCount + '-cü müştəri mesajıdır. Əgər ad/telefon soruşmusansa və müştəri verməyibsə, TƏKRAR SORUŞMA. Yalnız məsləhət yönündə davam et.'
      : '\n\n📌 SESSIYA DURUMU: Bu ' + userTurnCount + '-cü müştəri mesajıdır. Hələ nömrə soruşma — əvvəlcə ehtiyacı anla və 1-2 məhsul göstər.';

    const systemMessage =
      DEVALEUR_PERSONA +
      '\n\n' +
      langDirective +
      contactHint +
      formatKnowledge(knowledge) +
      '\n\n' +
      catalogSummary(products) +
      '\n\n📦 SAYTDAKI TAM MƏHSUL KATALOQU:\n' +
      formatProducts(products) +
      '\n\n⚠️ SON XATIRLATMA: Yuxarıdakı ADMIN QAYDALARI (⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI bölməsi) və ŞİRKƏT BİLİK BAZASI hər zaman ƏSAS PRİORİTETDİR. Əgər personada göstərilən qayda ilə admin qaydası ziddiyyət təşkil edərsə, ADMIN QAYDASINA əməl et.\n\nİndi yuxarıdakı kontekstə əsasən müştərinin son mesajına qısa, təbii, satış yönümlü cavab ver.';

    // Build Gemini contents from history (map assistant->model)
    const contents = [];
    for (const h of history.slice(-10)) {
      if (!(h.content || '').trim()) continue;
      const role = h.role === 'user' ? 'user' : 'model';
      contents.push({ role, parts: [{ text: h.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const payload = {
      systemInstruction: { parts: [{ text: systemMessage }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    const { data, error } = await callGemini(payload);
    if (error || !data) {
      res.status(502).json({ error: `AI provayder xətası: ${error || 'boş cavab'}` });
      return;
    }
    const candidates = data.candidates || [];
    let reply = '';
    if (candidates.length > 0) {
      const parts = ((candidates[0].content || {}).parts) || [];
      reply = parts.map((p) => p.text || '').join('').trim();
    }
    if (!reply) reply = 'Bağışlayın, cavab yarana bilmədi. Yenidən cəhd edin.';
    res.status(200).json({ reply });
  } catch (err) {
    console.error('[Chat API] Error:', err);
    res.status(500).json({ error: 'AI cavab verə bilmədi', detail: String(err?.message || err) });
  }
}
