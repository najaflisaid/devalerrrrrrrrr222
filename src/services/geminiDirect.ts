/**
 * geminiDirect — brauzerdən BIRBAŞA Google Gemini API-yə müraciət (backend/serverless
 * olmadan da AI işləsin deyə). /api/chat və /api/workers-chat uğursuz olduqda
 * (404 / şəbəkə / static hosting) frontend bu modula keçir.
 *
 * Gemini generativelanguage API brauzer CORS-u dəstəkləyir (Origin-i əks etdirir),
 * ona görə birbaşa çağırış mümkündür. Açar api/chat.js ilə eynidir.
 */

const GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  'AQ.Ab8RN6J6B4CZpyrSLtz6l0-M_c292ljC8pRPYb2hV1ffFjxGjA';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
];

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

async function generate(systemMessage: string, contents: Content[], gen: any): Promise<string> {
  const payload = {
    systemInstruction: { parts: [{ text: systemMessage }] },
    contents,
    generationConfig: gen,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
  let lastErr = 'no models';
  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      lastErr = `network: ${e?.message || e}`;
      continue;
    }
    if (resp.status === 429 || resp.status === 503) {
      lastErr = `HTTP ${resp.status} on ${model}`;
      continue;
    }
    if (!resp.ok) {
      lastErr = `HTTP ${resp.status}`;
      const txt = await resp.text().catch(() => '');
      lastErr += `: ${txt.slice(0, 160)}`;
      continue;
    }
    const data = await resp.json().catch(() => null);
    const cand = data?.candidates?.[0];
    const reply = (cand?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
    if (reply) return reply;
    lastErr = `boş cavab (${cand?.finishReason || 'UNKNOWN'})`;
  }
  throw new Error(lastErr);
}

const toHistory = (history: any[]): Content[] =>
  (history || [])
    .slice(-10)
    .filter((h) => (h?.content || '').trim())
    .map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }));

// ─────────────────────────── SATIŞ (public) chat ───────────────────────────
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

📞 ƏLAQƏ MƏLUMATLARINI TOPLAMA:
- Müştəri ilə 2-3 sual/cavab mübadiləsindən sonra NƏZAKƏTLƏ ad və əlaqə nömrəsini soruş.
- ƏSLA basınc yaratma, bir dəfə soruş. Müştəri "sonra" desə bir də təkrarlama.`;

const fmtProducts = (products: any[], limit = 500): string => {
  if (!products || products.length === 0) return '(Hal-hazırda kataloq boşdur.)';
  const rows: string[] = [];
  for (const p of products.slice(0, limit)) {
    let priceStr: string;
    if (p.salePrice && p.price && p.salePrice < p.price) {
      const disc = Math.round(((p.price - p.salePrice) / p.price) * 100);
      priceStr = `${p.salePrice.toFixed(0)} AZN (köhnə ${p.price.toFixed(0)} AZN, -${disc}%)`;
    } else if (p.price != null) priceStr = `${p.price.toFixed(0)} AZN`;
    else priceStr = 'qiymət yoxdur';
    const badges: string[] = [];
    if (p.stock != null && p.stock <= 0) badges.push('STOKDA YOX');
    if (p.isBestseller) badges.push('BESTSELLER');
    const badgeStr = badges.length ? ' · ' + badges.join(' · ') : '';
    let g = '';
    if (p.gender === 'men') g = ' [kişi]';
    else if (p.gender === 'women') g = ' [qadın]';
    else if (p.gender === 'unisex') g = ' [unisex]';
    const cat = p.category ? ` [${p.category}]` : '';
    const brand = p.brand ? `${p.brand} — ` : '';
    let desc = '';
    if (p.description && p.description.trim()) desc = ` / ${p.description.trim().replace(/\n/g, ' ').slice(0, 120)}`;
    rows.push(`- ID:${p.id} | ${brand}${p.name}${g}${cat} | ${priceStr}${badgeStr}${desc}`);
  }
  return rows.join('\n');
};

const catalogSummary = (products: any[]): string => {
  if (!products || products.length === 0) return '';
  const inStock = products.filter((p) => (p.stock || 0) > 0).length;
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const prices = products.map((p) => p.salePrice || p.price).filter((v) => typeof v === 'number');
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const best = products.filter((p) => p.isBestseller).length;
  return [
    `📊 KATALOQ STATİSTİKASI: ${products.length} məhsul (${inStock} stokda), ${best} bestseller`,
    `💰 Qiymət diapazonu: ${min.toFixed(0)} AZN – ${max.toFixed(0)} AZN`,
    `🏷️ Brendlər (${brands.length}): ${brands.slice(0, 20).join(', ')}`,
    `📂 Kateqoriyalar: ${cats.slice(0, 15).join(', ')}`,
  ].join('\n');
};

const fmtKnowledge = (k: any): string => {
  if (!k) return '';
  const s: string[] = [];
  if (k.aiInstructions?.trim()) s.push('⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI (hər şeydən üstündür, MÜTLƏQ ƏMƏL ET):\n' + k.aiInstructions.trim());
  if (k.companyInfo?.trim()) s.push('🏢 ŞİRKƏT HAQQINDA:\n' + k.companyInfo.trim());
  if (k.brandsInfo?.trim()) s.push('🏷️ BRENDLƏR HAQQINDA:\n' + k.brandsInfo.trim());
  if (k.policiesInfo?.trim()) s.push('🛡️ ZƏMANƏT/ÇATDIRILMA/QAYTARMA:\n' + k.policiesInfo.trim());
  if (k.productsInfo?.trim()) s.push('📦 MƏHSULLAR HAQQINDA:\n' + k.productsInfo.trim());
  if (k.additionalNotes?.trim()) s.push('📝 ƏLAVƏ KONTEKST:\n' + k.additionalNotes.trim());
  if (Array.isArray(k.conversationExamples) && k.conversationExamples.length) {
    const ex = k.conversationExamples
      .filter((e: any) => (e.userMessage || '').trim() && (e.assistantMessage || '').trim())
      .map((e: any, i: number) => `Nümunə ${i + 1}:\nMüştəri: ${e.userMessage.trim()}\nDe Valeur AI: ${e.assistantMessage.trim()}${e.note ? '\n(Kontekst: ' + e.note + ')' : ''}`)
      .join('\n\n');
    if (ex) s.push('💡 DİALOQ NÜMUNƏLƏRİ (bu tərzdə cavab ver):\n' + ex);
  }
  if (!s.length) return '';
  return '\n\n📚 ŞİRKƏT BİLİK BAZASI:\n' + s.join('\n\n');
};

export async function salesChatDirect(req: any): Promise<string> {
  const language = req.language || 'az';
  const products = req.products || [];
  const history = req.history || [];
  const userTurns = Math.max(1, history.filter((h: any) => h?.role === 'user').length + 1);
  const langDirective =
    language === 'ru' ? 'Cavab DİLİ: Rus dilində.' : language === 'en' ? 'Cavab DİLİ: İngilis dilində.' : 'Cavab DİLİ: Azərbaycan dilində.';
  const contactHint = req.contactCaptured
    ? '\n\n📌 Müştəri artıq ad/telefon paylaşıb. YENİDƏN SORUŞMA.'
    : userTurns === 3 || userTurns === 4
    ? '\n\n📌 Bu ' + userTurns + '-cü mesajdır. İndi nəzakətlə ad və WhatsApp nömrəsini soruşmaq üçün ən uyğun andır (bir dəfə).'
    : userTurns > 4
    ? '\n\n📌 Nömrə soruşmusansa və müştəri verməyibsə, təkrar soruşma.'
    : '\n\n📌 Hələ nömrə soruşma — əvvəlcə ehtiyacı anla və 1-2 məhsul göstər.';
  const systemMessage =
    DEVALEUR_PERSONA + '\n\n' + langDirective + contactHint + fmtKnowledge(req.knowledge) +
    '\n\n' + catalogSummary(products) +
    '\n\n📦 SAYTDAKI TAM MƏHSUL KATALOQU:\n' + fmtProducts(products) +
    '\n\n⚠️ ADMIN QAYDALARI və BİLİK BAZASI ƏSAS PRİORİTETDİR. İndi müştərinin son mesajına qısa, təbii, satış yönümlü cavab ver.';
  const contents = toHistory(history);
  contents.push({ role: 'user', parts: [{ text: (req.message || '').trim() }] });
  return generate(systemMessage, contents, { temperature: 0.7, topP: 0.95, maxOutputTokens: 2048 });
}

// ─────────────────────────── İŞÇİLƏR (HR) chat ───────────────────────────
const HR_PERSONA = `Sən De Valeur şirkətinin admini üçün işləyən HR/heyət analitikasısan.

🎯 ƏSAS MƏQSƏD:
Admin sizdən komanda haqqında suallar verəcək (kim yaxşı satır, kimin performansı zəifdir, cərimələr, mükafatlar, tələblər, filial müqayisələri və s.). Cavabları QISA, konkret və data-ya əsaslanmış şəkildə ver.

🧭 DAVRANIŞ:
- Adminlə peşəkar, məlumatlı, bir HR analitiki tonunda danış
- Cavab dilində konkret rəqəm və adlar ver (məs. "Rəşad Əliyev — 4,200 AZN satış, 88% reytinq")
- Ümumiləşdirməkdən çəkin — hansı işçini nəzərdə tutduğunu aydın göstər
- Rəqəmləri AZN valyutasında və 0/2 onluqda ver
- Zəruri hallarda TOP-3 və ya siyahı formatı istifadə et (- ilə)
- Cavab uzunluğu: 3-8 cümlə
- Heç vaxt uydurma — göstərilən data-dan kənara çıxmasan
- Əgər sual data ilə əlaqəli deyilsə, mehriban şəkildə admini komanda mövzusuna qaytar

Əgər səndən hansı model olduğun soruşulsa: "Mən De Valeur-un daxili HR AI-yıyam."`;

const nfmt = (n: any) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const summariseWorkers = (workers: any[]): string => {
  if (!workers || workers.length === 0) return 'Komandada işçi yoxdur.';
  const active = workers.filter((w) => w.isActive);
  const totalSales = active.reduce((s, w) => s + (w.monthlyTotalSales || 0), 0);
  const totalTarget = active.reduce((s, w) => s + (w.monthlyTarget || 0), 0);
  const avg = active.length ? active.reduce((s, w) => s + (w.rating || 0), 0) / active.length : 0;
  const br: Record<string, number> = {};
  const po: Record<string, number> = {};
  for (const w of active) {
    if (w.branch) br[w.branch] = (br[w.branch] || 0) + 1;
    if (w.position) po[w.position] = (po[w.position] || 0) + 1;
  }
  const bstr = Object.entries(br).map(([k, v]) => `${k} (${v})`).join(', ') || '—';
  const pstr = Object.entries(po).map(([k, v]) => `${k} (${v})`).join(', ') || '—';
  return `📊 KOMANDA ÜMUMİ:\n- Ümumi işçi: ${workers.length}, aktiv: ${active.length}\n- Cari ay ümumi satış: ${nfmt(totalSales)} AZN (hədəf: ${nfmt(totalTarget)} AZN)\n- Orta performans reytinqi: ${avg.toFixed(1)}%\n- Filiallar: ${bstr}\n- Vəzifələr: ${pstr}`;
};

const fmtWorkers = (workers: any[], limit = 60): string => {
  if (!workers || workers.length === 0) return '';
  const rows = workers.slice(0, limit).map((w) => {
    const sales = w.monthlyTotalSales || 0;
    const target = w.monthlyTarget || 0;
    const ret = w.monthlyTotalReturns || 0;
    const net = Math.max(0, sales - ret);
    const pct = target > 0 ? (net / target) * 100 : 0;
    const rating = w.rating != null ? `${Math.round(w.rating)}%` : '—';
    const branch = w.branch ? ` · ${w.branch}` : '';
    return `- ${w.name} ${w.surname} [${w.position}${branch}] | reytinq: ${rating} | satış: ${nfmt(sales)} AZN | qaytarma: ${nfmt(ret)} | net: ${nfmt(net)} | hədəf: ${nfmt(target)} (${Math.round(pct)}%) | ${w.isActive ? 'aktiv' : 'passiv'} | id:${w.id}`;
  });
  return '👥 İŞÇİLƏR (detallı siyahı):\n' + rows.join('\n');
};

const nameMap = (workers: any[]) => {
  const m: Record<string, string> = {};
  for (const w of workers) m[w.id] = `${w.name} ${w.surname}`;
  return m;
};

const fmtFines = (fines: any[], workers: any[]): string => {
  if (!fines || fines.length === 0) return '';
  const nm = nameMap(workers);
  return '⚠️ SON CƏRİMƏLƏR:\n' + fines.slice(0, 40).map((f) => `- ${nm[f.workerId] || f.workerId}: -${nfmt(f.amount)} AZN (${f.reason || '—'}) · ${f.date}`).join('\n');
};

const fmtRewards = (rewards: any[], workers: any[]): string => {
  if (!rewards || rewards.length === 0) return '';
  const nm = nameMap(workers);
  return '🏆 SON MÜKAFATLAR:\n' + rewards.slice(0, 40).map((r) => `- ${nm[r.workerId] || r.workerId}: ${r.type}${r.amount ? ' +' + nfmt(r.amount) : ''} (${r.reason || '—'}) · ${r.date}`).join('\n');
};

const fmtRequests = (requests: any[], workers: any[]): string => {
  if (!requests || requests.length === 0) return '';
  const nm = nameMap(workers);
  return '📨 İŞÇİ TƏLƏBLƏRİ:\n' + requests.slice(0, 30).map((r) => `- ${nm[r.workerId] || r.workerId}: ${r.type} [${r.status}] — ${r.subject || '—'} (${r.createdAt ? r.createdAt.slice(0, 10) : '—'})`).join('\n');
};

export async function workersChatDirect(body: any): Promise<string> {
  const language = body.language || 'az';
  const langDirective =
    language === 'ru' ? 'Cavab DİLİ: Rus dilində.' : language === 'en' ? 'Cavab DİLİ: İngilis dilində.' : 'Cavab DİLİ: Azərbaycan dilində.';
  const workers = body.workers || [];
  const parts = [
    HR_PERSONA,
    langDirective,
    summariseWorkers(workers),
    fmtWorkers(workers),
    fmtFines(body.fines || [], workers),
    fmtRewards(body.rewards || [], workers),
    fmtRequests(body.requests || [], workers),
  ];
  if ((body.context || '').trim()) parts.push('📝 ADMIN ƏLAVƏSİ:\n' + body.context.trim());
  const systemMessage = parts.filter(Boolean).join('\n\n');
  const contents = toHistory(body.history || []);
  contents.push({ role: 'user', parts: [{ text: (body.message || '').trim() }] });
  return generate(systemMessage, contents, { temperature: 0.4, topP: 0.9, maxOutputTokens: 1200 });
}
