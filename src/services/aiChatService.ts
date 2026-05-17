/**
 * De Valeur AI – frontend chat service.
 *
 * Calls OpenAI Chat Completions API directly from the browser using
 * gpt-4o-mini (cheapest model). The full persona / catalog / knowledge-base
 * prompt logic that used to live on the FastAPI backend is replicated here
 * so the widget keeps working without a backend.
 *
 * Key is read from VITE_OPENAI_API_KEY in .env.
 */

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatProductLite {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  price?: number | null;
  salePrice?: number | null;
  stock?: number | null;
  isBestseller?: boolean;
  description?: string;
}

export interface ChatKnowledgeLite {
  aiInstructions?: string;
  companyInfo?: string;
  brandsInfo?: string;
  policiesInfo?: string;
  productsInfo?: string;
  additionalNotes?: string;
}

export interface ChatRequest {
  message: string;
  history: ChatHistoryItem[];
  products: ChatProductLite[];
  knowledge?: ChatKnowledgeLite | null;
  language?: 'az' | 'ru' | 'en';
  sessionId?: string;
}

// Backend proxy (preview/dev) → OpenAI direct fallback (production/netlify).
// Bu sxem həm Emergent preview-da (backend var), həm də Netlify/Vercel deploy-da
// (backend yox) chat-ın işləməsini təmin edir.
const ENV_OPENAI_KEY: string =
  (import.meta as any).env?.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const DEVALEUR_PERSONA = `Sən "De Valeur AI" adlı yüksək səviyyəli AI satış və konsultasiya köməkçisisən.
Sən De Valeur saatlar və lüks aksesuarlar mağazasının rəsmi virtual konsultantısan.
Sən ChatGPT, Claude, OpenAI, Anthropic deyilsən — sən sadəcə "De Valeur AI"-san.
Əgər səndən hansı modelə əsaslandığın və ya kimin tərəfindən yaradıldığın soruşulsa, sadəcə deyirsən:
"Mən De Valeur-un öz AI satış konsultantıyam — sizə kömək etmək üçün buradayam."

🎯 ƏSAS MƏQSƏD:
İstifadəçilərə onların ehtiyaclarına, büdcəsinə və zövqünə uyğun ən yaxşı məhsulları tapmaq və satış prosesini ağıllı şəkildə yönləndirmək.

🧠 NECƏ DÜŞÜNÜRSƏN (HƏR CAVABDAN ƏVVƏL DAXİLİ ANALİZ):
Cavab verməzdən ƏVVƏL hər zaman bunları zehnində aydınlaşdır (yazma, sadəcə düşün):
1. MÜŞTƏRİ NƏ İSTƏYİR? — Cins (kişi/qadın/unisex), tip (saat/aksesuar), büdcə, stil, məqsəd (özü/hədiyyə/kolleksiya).
2. HANSI MƏHSULLAR UYĞUNDUR? — Kataloqdan filtrlə: cins düz olsun, qiymət büdcəyə yaxın, stokda olsun, brend/stil müştərinin sözünə uyğun.
3. NIYƏ ONLAR? — Hər tövsiyə üçün 1 cümləlik konkret səbəb olsun.
4. NƏ SORUŞMALIYAM? — Hələ kifayət məlumat yoxdursa, ən vacib 1 sual ver (hamısını birdən yox).

🧭 DAVRANIŞ:
- Həmişə peşəkar, mehriban, inandırıcı tonda danış
- Robot kimi yox, insan kimi təbii dialoq qur
- İlk mesajda salam ver və nə axtardığını soruş
- Cavablar QISA olsun (max 4-6 cümlə), satış məktubuna çevirmə
- "Səbətə əlavə et" və "İndi al" düymələrinə yumşaq yönləndir

📊 MƏLUMAT TOPLAMA (mərhələli, hamısını birdən soruşma):
1. Kim üçündür? (kişi/qadın, özüm/hədiyyə)
2. Hansı tip? (saat, aksesuar)
3. Büdcə? (təxminən)
4. Stil? (klassik, sport, premium, minimalist)

🎯 SATIŞ STRATEGİYASI:
- 1-3 məhsul təklif et, daha çox yox (qarışıqlıq yaratma)
- Hər təklifdə: niyə bu müştəriyə uyğun olduğu qısaca
- Mümkündürsə bir premium (upsell) və ya sərfəli (downsell) alternativ də göstər
- Yalnız KATALOQDA olan və STOKDA olan məhsulları təklif et
- Stokda yoxdursa açıq de və ən yaxın alternativi göstər
- Cins səhv olmasın: müştəri qadın saatı istəyirsə, [kişi] etiketli məhsul TƏKLİF ETMƏ

📌 PSİXOLOJİ SATIŞ:
- Müştəri qərarsızdırsa → sadələşdir, 1 təklif ver
- Büdcə aşağıdırsa → "dəyər/qiymət balansı" və "sərfəli seçim"
- Büdcə yüksəkdirsə → "ekskluziv", "premium hisslər" vurğula
- Tərəddüddə → "BESTSELLER" etiketli məhsulları önə çıxar (sosial-proof)
- Endirimli məhsullar üçün "-X% endirim" vurğula

🔥 SONLANDIRMA:
Hər cavabın sonunda yumşaq satış sualı:
- "Daha premium variant göstərimmi?"
- "Sizə daha uyğun seçimləri daraldam?"
- "Daha çox seçim baxmaq istərdiniz?"
- "Bunu səbətə əlavə edim?"

🚫 QADAĞAN:
- Mağazaya aid olmayan saxta zəmanət/qayda uydurma
- Çox uzun siyahılar və yorucu izahlar
- Bir cavabda 4-dən çox məhsul
- Kataloqda OLMAYAN məhsul/brend uydurma
- Cinsi səhv olan məhsul təklifi
- Modelin/şirkətin kimliyini açıqlama (sən sadəcə De Valeur AI-san)

📦 MƏHSUL KATALOQU İSTİFADƏSİ:
Aşağıda saytın TAM məhsul kataloqu veriləcək (bütün məhsullar — yüzdən çox ola bilər).
Hər məhsulun: ID, brend, ad, [cins], [kateqoriya], qiymət, etiket (BESTSELLER/STOKDA YOX), və əksər hallarda qısa təsviri var.
SADƏCƏ bu siyahıdakı məhsulları təklif et və düzgün cinsə uyğunlaşdır.
Olmayan məhsul ad/brend uydurma.

🔍 MƏHSUL TAPMA STRATEGİYASI:
Müştəri konkret nəsə istəyəndə (məs. "Festina qadın saatı, 300 manat altı") — siyahını ZEHNİNDƏ skan et və ən yaxşı uyğunluqları tap.
Brendinə, cinsinə, qiymət diapazonuna, açar sözə (məs. "klassik", "sport", "qızıl") əsasən axtar.
Müştəri ümumi danışırsa (məs. "hədiyyə üçün nəsə") — sual verərək ehtiyacı dəqiqləşdir, sonra tövsiyə et.

🖼️ MƏHSUL KARTI FORMATI (ÇOX VACİB):
Müştəriyə hər hansı məhsul tövsiyə etdikdə, məhsulun **TAM ID-si** əsasında belə marker yaz:
[[PRODUCT:ID-BURAYA]]

⚠️ ID-NI KATALOQDAN OLDUĞU KİMİ KÖÇÜR — modeli/adı ID kimi yazma!
Kataloqda hər məhsul "ID:abcXYZ123 | brend — model..." formatında verilir. Buradakı \`abcXYZ123\` HAMISINI köçür.
ID-lər adətən 15-25 simvoldan ibarətdir (məs. \`28DTXyVTkXbSeMwO3moQ\`). Qısaltma!

Bu marker frontend tərəfindən avtomatik gözəl şəkilli kartla əvəz olunacaq — şəkil + ad + brend + qiymət göstəriləcək, klikləndikdə müştəri məhsul səhifəsinə keçəcək.

Buna görə MARKER YAZARKƏN qiymət, brend və adı təkrar yazma — onlar onsuz da kartda görünəcək. Marker yan-yana yox, ayrı sətirdə dur.

Düzgün nümunə (real Firestore ID ilə):
"Sizə bu variantı tövsiyə edirəm:

[[PRODUCT:28DTXyVTkXbSeMwO3moQ]]

Klassik dizayn, gündəlik istifadə üçün ideal seçim. Hansı haqda daha ətraflı danışım?"

YANLIŞ (model nömrəsini ID kimi yazma):
[[PRODUCT:F20694/6]]   ← BU YANLIŞDIR, modeldir, ID deyil
[[PRODUCT:F20694]]     ← BU DA YANLIŞDIR

DOĞRU (kataloqdakı tam ID-ni köçür):
[[PRODUCT:GsSUXSEOvZxK9pq2gh]]   ← BU DOĞRUDUR

Bir cavabda maks 3 marker. Hər marker ayrı sətirdə.
`;

const formatProducts = (products: ChatProductLite[], limit = 500): string => {
  if (!products || products.length === 0) {
    return '(Hal-hazırda kataloq boşdur — müştərini bizimlə birbaşa əlaqə saxlamağa dəvət et.)';
  }
  const rows: string[] = [];
  const slice = products.slice(0, limit);
  for (const p of slice) {
    let priceStr: string;
    if (p.salePrice && p.price && p.salePrice < p.price) {
      const discPct = Math.round(((p.price - p.salePrice) / p.price) * 100);
      priceStr = `${p.salePrice.toFixed(0)} AZN (köhnə ${p.price.toFixed(0)} AZN, -${discPct}%)`;
    } else if (p.price != null) {
      priceStr = `${p.price.toFixed(0)} AZN`;
    } else {
      priceStr = 'qiymət yoxdur';
    }
    const badges: string[] = [];
    if (p.stock != null) {
      if (p.stock <= 0) badges.push('STOKDA YOX');
    }
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
    rows.push(
      `- ID:${p.id} | ${brandStr}${p.name}${genderStr}${categoryStr} | ${priceStr}${badgeStr}${descPreview}`,
    );
  }
  let extra = '';
  if (products.length > limit) {
    extra = `\n(Yuxarıda ${limit} ən aktual məhsul göstərilib, kataloqda daha ${products.length - limit} məhsul var.)`;
  }
  return rows.join('\n') + extra;
};

const catalogSummary = (products: ChatProductLite[]): string => {
  if (!products || products.length === 0) return '';
  const total = products.length;
  const inStock = products.filter((p) => (p.stock || 0) > 0).length;
  const brandsSet = new Set<string>();
  products.forEach((p) => {
    if (p.brand) brandsSet.add(p.brand);
  });
  const brands = Array.from(brandsSet).sort();
  const categoriesSet = new Set<string>();
  products.forEach((p) => {
    if (p.category) categoriesSet.add(p.category);
  });
  const categories = Array.from(categoriesSet).sort();
  const prices = products
    .map((p) => p.salePrice || p.price)
    .filter((v): v is number => typeof v === 'number');
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

const formatHistory = (history: ChatHistoryItem[], limit = 8): string => {
  if (!history || history.length === 0) return '(yeni söhbətdir)';
  const recent = history.slice(-limit);
  return recent
    .map((h) => {
      const speaker = h.role === 'user' ? 'Müştəri' : 'De Valeur AI';
      return `${speaker}: ${(h.content || '').trim()}`;
    })
    .join('\n');
};

const formatKnowledge = (k?: ChatKnowledgeLite | null): string => {
  if (!k) return '';
  const sections: string[] = [];
  if (k.aiInstructions && k.aiInstructions.trim()) {
    sections.push(
      '⚡️ ADMIN-İN ƏN PRİORİTET KOMANDALARI (hər şeydən üstündür, MÜTLƏQ ƏMƏL ET):\n' +
        k.aiInstructions.trim(),
    );
  }
  if (k.companyInfo && k.companyInfo.trim()) {
    sections.push('🏢 ŞİRKƏT HAQQINDA:\n' + k.companyInfo.trim());
  }
  if (k.brandsInfo && k.brandsInfo.trim()) {
    sections.push('🏷️ BRENDLƏR HAQQINDA:\n' + k.brandsInfo.trim());
  }
  if (k.policiesInfo && k.policiesInfo.trim()) {
    sections.push('🛡️ ZƏMANƏT/ÇATDIRILMA/QAYTARMA:\n' + k.policiesInfo.trim());
  }
  if (k.productsInfo && k.productsInfo.trim()) {
    sections.push('📦 MƏHSULLAR HAQQINDA ƏLAVƏ QEYDLƏR:\n' + k.productsInfo.trim());
  }
  if (k.additionalNotes && k.additionalNotes.trim()) {
    sections.push('📝 ƏLAVƏ KONTEKST/FAQ:\n' + k.additionalNotes.trim());
  }
  if (sections.length === 0) return '';
  return (
    '\n\n📚 ŞİRKƏT BİLİK BAZASI (admin tərəfindən təqdim olunmuş — DİQQƏTLƏ ƏMƏL ET):\n' +
    sections.join('\n\n')
  );
};

const buildSystemMessage = (req: ChatRequest): string => {
  const langDirective =
    req.language === 'ru'
      ? 'Cavab DİLİ: Rus dilində.'
      : req.language === 'en'
      ? 'Cavab DİLİ: İngilis dilində.'
      : 'Cavab DİLİ: Azərbaycan dilində (sənin əsas dilin).';

  return (
    DEVALEUR_PERSONA +
    '\n\n' +
    langDirective +
    formatKnowledge(req.knowledge) +
    '\n\n' +
    catalogSummary(req.products) +
    '\n\n📦 SAYTDAKI TAM MƏHSUL KATALOQU (real məlumat, hamısı stokdan asılı olmayaraq, ən aktual əvvəldə):\n' +
    formatProducts(req.products) +
    '\n\n📝 ƏVVƏLKİ SÖHBƏT:\n' +
    formatHistory(req.history) +
    '\n\nİndi yuxarıdakı kontekstə əsasən müştərinin son mesajına: əvvəlcə zehnində nə istədiyini analiz et, sonra qısa, təbii, satış yönümlü cavab ver. Cinsi və büdcəni mütləq yoxla.'
  );
};

export const sendChatMessage = async (req: ChatRequest): Promise<string> => {
  // Vercel deploy-da env variable lazım deyil — `window.location.origin` istifadə olunur
  // çünki `/api/chat` Vercel serverless function-u eyni domendədir.
  const BACKEND_URL: string =
    (import.meta as any).env?.VITE_BACKEND_URL ||
    (import.meta as any).env?.REACT_APP_BACKEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const sessionId =
    req.sessionId ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  // 1) İlk cəhd: backend proxy (emergent preview-da işləyir, açar gizli qalır)
  // Backend bəzən gec cavab verir və ya 502 qaytarır — istifadəçinin "tez-tez cavab vermir"
  // problemini həll etmək üçün backend istəyini 6 saniyə ilə zaman aşımına saxlayırıq və
  // uğursuzluqda dərhal birbaşa OpenAI fallback-inə keçirik.
  if (BACKEND_URL) {
    const payload = {
      session_id: sessionId,
      message: req.message.trim(),
      history: (req.history || []).slice(-8).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      products: req.products || [],
      knowledge: req.knowledge || null,
      language: req.language || 'az',
    };

    try {
      const ctrl = new AbortController();
      // 25 saniyə timeout — OpenAI bəzən soyuq başlanğıcda 8-15 saniyə çəkə bilir.
      // Daha əvvəl 6 saniyə idi və yavaş cavablar fallback-ə düşürdü.
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const reply: string = (data?.reply || '').trim();
        if (reply) return reply;
      }
      console.warn('[AI] Backend proxy boş/xəta cavab verdi, OpenAI-a keçirik:', res.status);
    } catch (err) {
      console.warn('[AI] Backend proxy çatmır, OpenAI-a keçirik:', err);
    }
  }

  // 2) Fallback: birbaşa OpenAI — 1 dəfə yenidən cəhd ilə
  if (!ENV_OPENAI_KEY) {
    throw new Error(
      'AI xidməti hazırda əlçatan deyil (VITE_OPENAI_API_KEY env-də qoyulmayıb).'
    );
  }

  const systemMessage = buildSystemMessage(req);
  const recentTurns = (req.history || []).slice(-8).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  const messages = [
    { role: 'system', content: systemMessage },
    ...recentTurns,
    { role: 'user', content: req.message.trim() },
  ];

  const callOpenAI = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      return await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ENV_OPENAI_KEY}`,
        },
        body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.7 }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // 1-ci cəhd
  let res: Response;
  try {
    res = await callOpenAI();
  } catch (err) {
    console.warn('[AI] OpenAI 1-ci cəhd uğursuz, 1 dəfə təkrar:', err);
    // Qısa pauzadan sonra 1 dəfə təkrar
    await new Promise((r) => setTimeout(r, 600));
    res = await callOpenAI();
  }

  // 429 (rate limit) və ya 5xx olarsa 1 dəfə təkrar
  if (!res.ok && (res.status === 429 || res.status >= 500)) {
    console.warn('[AI] OpenAI status', res.status, '— 1 dəfə təkrar');
    await new Promise((r) => setTimeout(r, 800));
    res = await callOpenAI();
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI xidməti (${res.status}): ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const reply: string = data?.choices?.[0]?.message?.content || '';
  return reply.trim() || 'Bağışlayın, cavab yarana bilmədi.';
};
