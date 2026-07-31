/**
 * Sinonim və çarpaz-dil axtarış xəritəsi.
 *
 * Müştəri "pulbaqi", "kaselok", "cuzdanlar" yazsa da "pulqabı" tapılsın.
 * Bura həm ümumi tərcümələr (Az/Ru/En/Tr), həm də tez-tez rast gəlinən
 * səhv yazılışlar daxildir. Bütün açarlar diakritiksiz-normal formada
 * saxlanır (`normalizeAz` çıxışı ilə eyni olmalıdır).
 *
 * Yeni sinonim əlavə etmək üçün sadəcə `SYNONYM_GROUPS`-a bir sıra
 * yaz — həmin sıradakı hər söz o biri sözlərin sinonimi kimi qəbul
 * edilir. Kimliyi yoxdur; xəritə hər iki tərəfə də işləyir.
 */

// Diakritikləri və digər variantları düzləşdirən "normal" forma —
// Header.tsx-dəki normalizeAz ilə eyni məntiq. Burada da təkrarlayırıq
// ki, sinonimləri lokal olaraq saxlaya bilək.
const normalize = (s: string): string =>
  (s || '')
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/й/g, 'y').replace(/ы/g, 'y').replace(/ю/g, 'yu').replace(/я/g, 'ya')
    .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'sh').replace(/ц/g, 'ts')
    .replace(/ж/g, 'zh').replace(/х/g, 'h').replace(/ъ/g, '').replace(/ь/g, '')
    .replace(/[аaа]/g, 'a').replace(/[еeэ]/g, 'e').replace(/[оoо]/g, 'o')
    .trim();

// Hər qrup — bir konseptin bütün adları (bütün dillərdə + tipik səhv yazılışlar)
const SYNONYM_GROUPS: string[][] = [
  // ────── Aksesuar ──────
  ['pulqabi', 'pulqabı', 'pulbaqi', 'pulbaqı', 'pulqavi', 'pulqavı', 'pulbagi', 'pulbagı', 'pul qabi',
   'cuzdan', 'cüzdan', 'cuzdanlar', 'cüzdanlar', 'wallet', 'wallets', 'purse', 'purses',
   'кошелёк', 'кошелек', 'кошельки', 'кошельков', 'кошелка', 'бумажник'],
  ['saat', 'saatlar', 'saatı', 'saati', 'qolsaat', 'qol saati', 'qol saatı', 'qol-saati',
   'watch', 'watches', 'wristwatch',
   'часы', 'часики', 'наручные', 'часовые'],
  ['eynek', 'eynək', 'eynəklər', 'eynekler', 'gözlük', 'goylik',
   'glasses', 'sunglasses', 'eyewear',
   'очки', 'солнцезащитные'],
  ['qelem', 'qələm', 'ruchka',
   'pen', 'pens', 'fountain', 'fountainpen',
   'ручка', 'ручки'],
  ['kemer', 'kəmər', 'kemerler', 'kəmərlər',
   'belt', 'belts',
   'ремень', 'ремни', 'пояс'],
  ['qol qolbaq', 'qolbaq', 'qol bağı', 'qolbagi',
   'bracelet', 'bracelets',
   'браслет', 'браслеты'],
  ['boyunbagi', 'boyunbağı', 'boyunbaği', 'boyun bagi',
   'necklace', 'necklaces', 'chain',
   'ожерелье', 'цепочка', 'цепь'],
  ['uzuk', 'üzük', 'yuzuk',
   'ring', 'rings',
   'кольцо', 'кольца'],
  ['sirge', 'sırğa', 'sirga',
   'earring', 'earrings',
   'серьги', 'сережки'],
  ['catki', 'çatqı',
   'cufflink', 'cufflinks',
   'запонки'],
  ['qutu', 'qutusu', 'hediyye qutusu', 'hədiyyə qutusu',
   'giftbox', 'gift box',
   'подарочная', 'подарочный', 'коробка'],
  // ────── Kateqoriya ümumi ──────
  ['aksesuar', 'aksesuarlar', 'aksesuary',
   'accessory', 'accessories',
   'аксессуар', 'аксессуары'],
  ['hediyye', 'hədiyyə', 'hediyyeler', 'hədiyyələr',
   'gift', 'gifts', 'present',
   'подарок', 'подарки'],
  // ────── Cins ──────
  ['kisi', 'kişi', 'kishi',
   'men', 'mens', "men's", 'male', 'gentleman',
   'мужской', 'мужские', 'мужчин'],
  ['qadin', 'qadın', 'xanim', 'xanım',
   'women', 'womens', "women's", 'female', 'ladies', 'lady',
   'женский', 'женские', 'женщин', 'дамский', 'дамские'],
  ['unisex', 'uniseks'],
  ['usaq', 'uşaq', 'ushaq', 'baby',
   'kid', 'kids', 'child', 'children',
   'детский', 'детские', 'дети'],
  // ────── Səhifə axtarışları ──────
  ['haqqinda', 'haqqımızda', 'bizim haqqimizda', 'kim',
   'about', 'aboutus', 'story',
   'о', 'нас'],
  ['elaqe', 'əlaqə', 'kontakt', 'contact',
   'связь', 'контакт', 'контакты'],
  ['catdirilma', 'çatdırılma', 'catdirma',
   'delivery', 'shipping',
   'доставка'],
  ['odenis', 'ödəniş',
   'payment', 'checkout',
   'оплата'],
  ['garanti', 'qaranti',
   'warranty', 'guarantee',
   'гарантия'],
  ['qaytarma', 'qaytar', 'return', 'refund', 'возврат'],
  ['bloq', 'blog', 'yazı', 'yazilar', 'yazıları',
   'blog', 'article', 'articles', 'news',
   'блог', 'статьи', 'новости'],
  ['b2b', 'toptan', 'topdan', 'yuridik', 'yuridiki', 'business',
   'корпоративный', 'опт', 'оптом'],
];

// Xəritəni normal formada quraq — hər sözü öz qrupundakı bütün digər sözlərə bağlayır
const buildIndex = (): Map<string, Set<string>> => {
  const idx = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const set = new Set<string>();
    for (const w of group) set.add(normalize(w));
    for (const key of set) {
      const existing = idx.get(key);
      if (existing) {
        set.forEach((v) => existing.add(v));
      } else {
        idx.set(key, new Set(set));
      }
    }
  }
  return idx;
};

const INDEX = buildIndex();

/**
 * Verilən söz üçün ehtimal olunan bütün sinonimləri qaytarır (normal formada).
 * Öz-özü də daxil olur. Sinonim tapılmadıqda tək elementli array qayıdır.
 */
export const expandTokenSynonyms = (token: string): string[] => {
  const norm = normalize(token);
  if (!norm) return [];
  const set = INDEX.get(norm);
  if (!set) return [norm];
  return Array.from(set);
};

/**
 * Bütün söz-səviyyəli sinonim açarlarını qaytarır (test / debug üçün).
 */
export const allSynonymKeys = (): string[] => Array.from(INDEX.keys());
