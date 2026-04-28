import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, orderBy, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface Banner {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  subtitle_az?: string;
  subtitle_ru?: string;
  subtitle_en?: string;
  image_url: string;
  link_url: string;
  order_position: number;
  is_active: boolean;
}

export interface AboutStat {
  icon: string; // 'award' | 'users' | 'globe' | 'trending-up' | 'star' | 'shield' | 'crown' | 'gem'
  value_az: string;
  value_ru: string;
  value_en: string;
  label_az: string;
  label_ru: string;
  label_en: string;
}

export interface AboutPage {
  id?: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  slogan_az?: string;
  slogan_ru?: string;
  slogan_en?: string;
  story_heading_az?: string;
  story_heading_ru?: string;
  story_heading_en?: string;
  content_az: string;
  content_ru: string;
  content_en: string;
  mission_heading_az?: string;
  mission_heading_ru?: string;
  mission_heading_en?: string;
  mission_az: string;
  mission_ru: string;
  mission_en: string;
  image_url?: string;
  story_images?: string[];
  stats?: AboutStat[];
}

export interface ProductBanner {
  id: string;
  title_az: string;
  title_ru: string;
  title_en: string;
  image_url?: string;
  video_url?: string;
  content_type: 'image' | 'video';
  link_url: string;
  position: number;
  is_active: boolean;
}

export const getActiveBanners = async () => {
  const bannersRef = collection(db, 'home_banners');
  const q = query(bannersRef, where('is_active', '==', true));
  const querySnapshot = await getDocs(q);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Banner[];

  return banners.sort((a, b) => a.order_position - b.order_position);
};

export const getAllBanners = async () => {
  const bannersRef = collection(db, 'home_banners');
  const querySnapshot = await getDocs(bannersRef);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Banner[];

  return banners.sort((a, b) => a.order_position - b.order_position);
};

export const createBanner = async (banner: Omit<Banner, 'id'>) => {
  const bannersRef = collection(db, 'home_banners');
  const docRef = await addDoc(bannersRef, banner);

  return {
    id: docRef.id,
    ...banner
  } as Banner;
};

export const updateBanner = async (id: string, banner: Partial<Banner>) => {
  const bannerRef = doc(db, 'home_banners', id);
  await updateDoc(bannerRef, { ...banner, updated_at: new Date().toISOString() });

  const updatedDoc = await getDoc(bannerRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as Banner;
};

export const deleteBanner = async (id: string) => {
  const bannerRef = doc(db, 'home_banners', id);
  await deleteDoc(bannerRef);
};

export const getAboutPage = async () => {
  const aboutRef = doc(db, 'about', 'main');
  const aboutDoc = await getDoc(aboutRef);

  if (aboutDoc.exists()) {
    return {
      id: aboutDoc.id,
      ...aboutDoc.data()
    } as AboutPage;
  }

  return null;
};

export const updateAboutPage = async (aboutData: Partial<AboutPage>) => {
  const aboutRef = doc(db, 'about', 'main');
  await setDoc(aboutRef, {
    ...aboutData,
    updated_at: new Date().toISOString()
  }, { merge: true });

  const updatedDoc = await getDoc(aboutRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as AboutPage;
};

export const getActiveProductBanners = async () => {
  const bannersRef = collection(db, 'product_banners');
  const q = query(bannersRef, where('is_active', '==', true));
  const querySnapshot = await getDocs(q);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductBanner[];

  return banners.sort((a, b) => a.position - b.position);
};

export const getAllProductBanners = async () => {
  const bannersRef = collection(db, 'product_banners');
  const querySnapshot = await getDocs(bannersRef);

  const banners = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ProductBanner[];

  return banners.sort((a, b) => a.position - b.position);
};

export const createProductBanner = async (banner: Omit<ProductBanner, 'id'>) => {
  const bannersRef = collection(db, 'product_banners');
  const docRef = await addDoc(bannersRef, banner);

  return {
    id: docRef.id,
    ...banner
  } as ProductBanner;
};

export const updateProductBanner = async (id: string, banner: Partial<ProductBanner>) => {
  const bannerRef = doc(db, 'product_banners', id);
  await updateDoc(bannerRef, { ...banner, updated_at: new Date().toISOString() });

  const updatedDoc = await getDoc(bannerRef);
  return {
    id: updatedDoc.id,
    ...updatedDoc.data()
  } as ProductBanner;
};

export const deleteProductBanner = async (id: string) => {
  const bannerRef = doc(db, 'product_banners', id);
  await deleteDoc(bannerRef);
};


// ============================================================
// Home page sections (MaisonQuote + SignaturePiece3D texts)
// ============================================================
export interface HomepageSections {
  quote: {
    eyebrow: { az: string; ru: string; en: string };
    line1: { az: string; ru: string; en: string };
    line2: { az: string; ru: string; en: string };
    signature: { az: string; ru: string; en: string };
    backgroundText: string;
    enabled: boolean;
  };
  signature: {
    eyebrow: { az: string; ru: string; en: string };
    title: { az: string; ru: string; en: string };
    subtitle: { az: string; ru: string; en: string };
    pickLabel: { az: string; ru: string; en: string };
    ctaLabel: { az: string; ru: string; en: string };
    featuredProductId: string;
    enabled: boolean;
  };
}

const DEFAULT_HOMEPAGE_SECTIONS: HomepageSections = {
  quote: {
    eyebrow: {
      az: 'Philosophie · Depuis 2010',
      ru: 'Philosophie · Depuis 2010',
      en: 'Philosophie · Depuis 2010',
    },
    line1: {
      az: 'Zaman ölçülmür.',
      ru: 'Время не меряют.',
      en: 'Time is not measured.',
    },
    line2: {
      az: 'Zaman daşınır.',
      ru: 'Его носят.',
      en: 'It is worn.',
    },
    signature: {
      az: 'Maison De Valeur',
      ru: 'Maison De Valeur',
      en: 'Maison De Valeur',
    },
    backgroundText: 'De Valeur',
    enabled: true,
  },
  signature: {
    eyebrow: {
      az: 'Le Choix de la Maison',
      ru: 'Le Choix de la Maison',
      en: 'Le Choix de la Maison',
    },
    title: {
      az: 'Seçilmiş Əsər',
      ru: 'Главное произведение',
      en: 'Signature Piece',
    },
    subtitle: {
      az: 'Zamansız dizayn. Kompromissiz sənətkarlıq.',
      ru: 'Вневременной дизайн. Бескомпромиссное мастерство.',
      en: 'Timeless design. Uncompromising craftsmanship.',
    },
    pickLabel: {
      az: 'Həftənin seçimi',
      ru: 'Выбор недели',
      en: 'Pick of the week',
    },
    ctaLabel: {
      az: 'Məhsula bax',
      ru: 'Смотреть',
      en: 'View product',
    },
    featuredProductId: '',
    enabled: true,
  },
};

export const getHomepageSections = async (): Promise<HomepageSections> => {
  try {
    const ref = doc(db, 'site_content', 'homepage_sections');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<HomepageSections>;
      return {
        quote: { ...DEFAULT_HOMEPAGE_SECTIONS.quote, ...(data.quote || {}) },
        signature: { ...DEFAULT_HOMEPAGE_SECTIONS.signature, ...(data.signature || {}) },
      };
    }
  } catch (err) {
    console.error('getHomepageSections:', err);
  }
  return DEFAULT_HOMEPAGE_SECTIONS;
};

export const updateHomepageSections = async (sections: HomepageSections) => {
  const ref = doc(db, 'site_content', 'homepage_sections');
  await setDoc(
    ref,
    { ...sections, updated_at: new Date().toISOString() },
    { merge: true }
  );
};


// ============================================================
// Site theme (light / dark) — controlled from admin panel
// ============================================================
export type SiteTheme = 'light' | 'dark';

export const getSiteTheme = async (): Promise<SiteTheme> => {
  try {
    const ref = doc(db, 'site_content', 'site_theme');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const t = (snap.data() as any).theme;
      if (t === 'dark' || t === 'light') return t;
    }
  } catch (err) {
    console.error('getSiteTheme:', err);
  }
  return 'light';
};

export const setSiteTheme = async (theme: SiteTheme) => {
  const ref = doc(db, 'site_content', 'site_theme');
  await setDoc(ref, { theme, updated_at: new Date().toISOString() }, { merge: true });
};

export { DEFAULT_HOMEPAGE_SECTIONS };


// ============================================================
// Privacy Policy — admin-editable from admin panel
// ============================================================
export interface PrivacySection {
  id: string;       // stable id (slug)
  no: string;       // display number "01", "02", ...
  title: string;
  body: string;     // plain text or simple HTML; can use lines starting with "- " for bullets
}

export interface PrivacyPolicy {
  hero: {
    eyebrow: string;
    title: string;       // first part rendered in black
    titleAccent: string; // last part rendered in gold
    intro: string;
    badgeLeft: string;
    badgeRight: string;
    lastUpdated: string;
  };
  signature: string;     // bottom italic line
  sections: PrivacySection[];
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  hero: {
    eyebrow: 'Maison · De Valeur',
    title: 'Məxfilik',
    titleAccent: 'Siyasəti',
    intro:
      'Sizin etimadınız bizim üçün dəyərlidir. Bu sənəd DE VALEUR MMC-nin fərdi məlumatlarınızı necə topladığını, istifadə etdiyini və qoruduğunu şəffaf şəkildə izah edir.',
    badgeLeft: 'Azərbaycan qanunvericiliyinə uyğun',
    badgeRight: 'Son yenilənmə: 28.04.2026',
    lastUpdated: '28.04.2026',
  },
  signature: '— DE VALEUR MMC —',
  sections: [
    { id: 'general', no: '01', title: 'Ümumi müddəalar', body: 'Bu Məxfilik Siyasəti DE VALEUR MMC tərəfindən idarə olunan rəqəmsal kanallar vasitəsilə fərdi məlumatların toplanması, emalı və qorunması qaydalarını müəyyən edir.\n\n- www.devaleur.az rəsmi vebsaytı\n- DE VALEUR Loyalty mobil tətbiqi\n- Digər rəqəmsal xidmətlər' },
    { id: 'terms', no: '02', title: 'Terminlər', body: '- Şirkət — DE VALEUR MMC\n- Platforma — devaleur.az vebsaytı və mobil tətbiq\n- İstifadəçi — platformadan istifadə edən fiziki şəxs\n- Fərdi məlumat — şəxsi identifikasiyanı təmin edən məlumat\n- Emal — toplanma, saxlama, ötürmə və silmə' },
    { id: 'collected', no: '03', title: 'Toplanan məlumatlar', body: '- Ad, soyad, ata adı\n- Telefon nömrəsi və email ünvanı\n- Doğum tarixi və cinsiyyət\n- Ünvan məlumatları\n- Müştəri ID və Loyalty ID\n- Sifariş tarixçəsi\n- Ödəniş məlumatları (məhdud, maskalanmış formada)' },
    { id: 'technical', no: '04', title: 'Texniki məlumatlar', body: 'Platformadan istifadə zamanı avtomatik toplanır:\n\n- IP ünvanı\n- Cihaz modeli və əməliyyat sistemi\n- Brauzer növü və versiyası\n- Klik və davranış məlumatları\n- Lokasiya məlumatı (təxmini)' },
    { id: 'loyalty', no: '05', title: 'Loyalty proqram məlumatları', body: '- Bonus xalları (Cash-back)\n- Endirim tarixçəsi\n- Kampaniya iştirakları\n- Müştəri seqmentasiyası\n- Alış tezliyi və davranış göstəriciləri' },
    { id: 'methods', no: '06', title: 'Toplanma üsulları', body: '- Qeydiyyat forması\n- Sifariş prosesi\n- Loyalty qeydiyyatı\n- Cookies və oxşar texnologiyalar\n- Mobil tətbiq və marketinq kampaniyaları' },
    { id: 'legal-basis', no: '07', title: 'Hüquqi əsaslar', body: '- İstifadəçinin könüllü razılığı\n- Müqavilə öhdəliyinin icrası\n- Qanunla nəzərdə tutulmuş öhdəliklər\n- Şirkətin qanuni maraqları' },
    { id: 'purposes', no: '08', title: 'İstifadə məqsədləri', body: '- Sifarişlərin icrası və çatdırılması\n- Loyalty proqramının idarə edilməsi\n- Marketinq və fərdiləşdirilmiş kommunikasiya\n- Müştəri dəstəyi\n- Saxta əməliyyatların qarşısının alınması\n- Xidmət keyfiyyətinin yaxşılaşdırılması' },
    { id: 'third-parties', no: '09', title: 'Üçüncü tərəflərə ötürülmə', body: 'Xidmət təminatçıları: IT, CRM, SMS, email, ödəniş sistemləri.\nAnalitika: Google Analytics, Meta (Facebook, Instagram), reklam platformaları.\nHüquqi əsaslarla: səlahiyyətli dövlət qurumları, məhkəmə qərarı, hüquq mühafizə orqanları.' },
    { id: 'transfer', no: '10', title: 'Beynəlxalq ötürülmə', body: 'İstifadəçi məlumatları beynəlxalq serverlərdə saxlanıla və xarici IT sistemlərində emal oluna bilər. Bu zaman məlumatların qorunması beynəlxalq standartlara uyğun təmin olunur.' },
    { id: 'cookies', no: '11', title: 'Cookies siyasəti', body: 'Platformada cookies, pixel-tag və analitika alətləri istifadə olunur:\n\n- İstifadəçi təcrübəsini yaxşılaşdırmaq\n- Remarketing fəaliyyəti aparmaq\n- Saytın performansını analiz etmək' },
    { id: 'retention', no: '12', title: 'Saxlanma müddəti', body: '- Müqavilə müddəti ərzində\n- Qanunvericiliyin tələb etdiyi müddətdə\n- Müştəri hesabı aktiv olduğu müddətdə' },
    { id: 'deletion', no: '13', title: 'Məlumatların silinməsi', body: '- İstifadəçinin yazılı müraciəti əsasında\n- Hesabın ləğvi zamanı\n- Qanunvericiliklə müəyyən edilmiş müddətin sonunda' },
    { id: 'security', no: '14', title: 'Təhlükəsizlik', body: '- SSL şifrələmə\n- Çoxsəviyyəli giriş məhdudiyyəti\n- Audit və monitorinq sistemi\n- Daxili təhlükəsizlik prosedurları və əməkdaş təlimləri' },
    { id: 'rights', no: '15', title: 'İstifadəçi hüquqları', body: '- Öz məlumatlarına çıxış əldə etmək\n- Yanlış məlumatları düzəltmək\n- Məlumatların silinməsini tələb etmək\n- Verilmiş razılığı geri götürmək\n- Marketinq kommunikasiyalarından imtina etmək' },
    { id: 'age', no: '16', title: 'Yetkinlik yaşı', body: 'Platforma 18 yaşdan yuxarı istifadəçilər üçün nəzərdə tutulmuşdur. 18 yaşdan aşağı istifadəçilərin məlumatları valideyn və ya qanuni nümayəndənin razılığı olmadan emal edilmir.' },
    { id: 'liability', no: '17', title: 'Məsuliyyətin məhdudlaşdırılması', body: 'Şirkət aşağıdakı hallara görə məsuliyyət daşımır:\n\n- Üçüncü tərəf saytlarındakı kontent və əməliyyatlar\n- İstifadəçinin könüllü olaraq paylaşdığı məlumatlar\n- Şirkətdən asılı olmayan texniki problemlər' },
    { id: 'disputes', no: '18', title: 'Mübahisələrin həlli', body: 'Yaranan mübahisələr ilk növbədə danışıqlar yolu ilə, həll mümkün olmadıqda Azərbaycan Respublikası qanunvericiliyi əsasında həll olunur.' },
    { id: 'changes', no: '19', title: 'Siyasətə dəyişikliklər', body: 'Şirkət bu siyasəti tək tərəfli olaraq dəyişmək hüququna malikdir. Dəyişikliklər saytda yerləşdirildiyi andan etibarən qüvvəyə minir. Mütəmadi olaraq sənədin yenilənmiş versiyası ilə tanış olmağınızı tövsiyə edirik.' },
    { id: 'contact', no: '20', title: 'Əlaqə', body: 'Suallarınızı bizə aşağıdakı kanallarla ünvanlaya bilərsiniz:\n\n- Email: info@devaleur.az\n- Telefon: +994 77 757 72 77\n- Vebsayt: www.devaleur.az' },
  ],
};

export const getPrivacyPolicy = async (): Promise<PrivacyPolicy> => {
  try {
    const ref = doc(db, 'site_content', 'privacy_policy');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<PrivacyPolicy>;
      return {
        hero: { ...DEFAULT_PRIVACY_POLICY.hero, ...(data.hero || {}) },
        signature: data.signature || DEFAULT_PRIVACY_POLICY.signature,
        sections: (data.sections && data.sections.length > 0)
          ? data.sections
          : DEFAULT_PRIVACY_POLICY.sections,
      };
    }
  } catch (err) {
    console.error('getPrivacyPolicy:', err);
  }
  return DEFAULT_PRIVACY_POLICY;
};

export const updatePrivacyPolicy = async (data: PrivacyPolicy) => {
  const ref = doc(db, 'site_content', 'privacy_policy');
  await setDoc(ref, { ...data, updated_at: new Date().toISOString() }, { merge: true });
};
