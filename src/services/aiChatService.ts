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
}

const ENV_OPENAI_API_KEY: string =
  (import.meta as any).env?.VITE_OPENAI_API_KEY || '';

// Fallback: bu açar build-də .env oxunmasa belə (məsələn Vercel/Netlify-da
// VITE_OPENAI_API_KEY təyin edilməsə) chat işləməyə davam etsin deyə
// birbaşa bundle-a hardcode edilib. İstifadəçi öz açarını verib və açarın
// brauzerdə görünməsini qəbul edib.
const FALLBACK_OPENAI_API_KEY =
  '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';

const OPENAI_API_KEY: string = ENV_OPENAI_API_KEY || FALLBACK_OPENAI_API_KEY;

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
- Tərəddüddə → "BESTSELLER" etiketli məhsulları və "AZ QALIB" olanları önə çıxar (təcili hiss yarat)
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
Hər məhsulun: ID, brend, ad, [cins], [kateqoriya], qiymət, etiket (BESTSELLER/AZ QALIB/STOKDA YOX), və əksər hallarda qısa təsviri var.
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
      priceStr = `${p.salePrice.toFixed(0)}₼ (köhnə ${p.price.toFixed(0)}₼, -${discPct}%)`;
    } else if (p.price != null) {
      priceStr = `${p.price.toFixed(0)}₼`;
    } else {
      priceStr = 'qiymət yoxdur';
    }
    const badges: string[] = [];
    if (p.stock != null) {
      if (p.stock <= 0) badges.push('STOKDA YOX');
      else if (p.stock <= 2) badges.push('AZ QALIB');
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
    `💰 Qiymət diapazonu: ${priceMin.toFixed(0)}₼ – ${priceMax.toFixed(0)}₼`,
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
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI açarı konfiqurasiya edilməyib (VITE_OPENAI_API_KEY).');
  }

  const systemMessage = buildSystemMessage(req);

  // Send last few messages as proper chat turns + the new user message.
  const recentTurns = (req.history || []).slice(-8).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const messages = [
    { role: 'system', content: systemMessage },
    ...recentTurns,
    { role: 'user', content: req.message.trim() },
  ];

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI xətası (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const reply: string = data?.choices?.[0]?.message?.content || '';
  const trimmed = reply.trim();
  return trimmed || 'Bağışlayın, cavab yarana bilmədi.';
};
