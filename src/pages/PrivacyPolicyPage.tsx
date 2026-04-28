import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, FileText, ArrowUp } from 'lucide-react';

interface Section {
  id: string;
  no: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'general',
    no: '01',
    title: 'Ümumi müddəalar',
    body: (
      <>
        <p>
          Bu Məxfilik Siyasəti <strong>"DE VALEUR MMC"</strong> (bundan sonra <em>"Şirkət"</em>) tərəfindən idarə olunan rəqəmsal kanallar vasitəsilə istifadəçilərin fərdi məlumatlarının
          toplanması, emalı, saxlanması və qorunması qaydalarını müəyyən edir:
        </p>
        <ul>
          <li><a href="https://www.devaleur.az" className="underline decoration-[#D4AF37] underline-offset-4 hover:text-black">www.devaleur.az</a> rəsmi vebsaytı</li>
          <li>DE VALEUR Loyalty mobil tətbiqi</li>
          <li>Digər rəqəmsal xidmətlər və kommunikasiya kanalları</li>
        </ul>
        <p className="mt-4">
          Sənəd Azərbaycan Respublikasının aşağıdakı normativ-hüquqi aktlarına uyğun hazırlanmışdır:
        </p>
        <ul>
          <li>“Fərdi məlumatlar haqqında” Azərbaycan Respublikası Qanunu</li>
          <li>“Elektron ticarət haqqında” Qanun</li>
          <li>“İstehlakçıların hüquqlarının müdafiəsi haqqında” Qanun</li>
          <li>Digər tətbiq olunan normativ-hüquqi aktlar</li>
        </ul>
        <p className="mt-4">
          Platformadan istifadə etməklə istifadəçi:
        </p>
        <ul>
          <li>Məxfilik Siyasəti ilə tanış olduğunu</li>
          <li>Şərtlərlə razılaşdığını</li>
          <li>Fərdi məlumatlarının emalına razılıq verdiyini</li>
        </ul>
        <p>təsdiq etmiş olur.</p>
      </>
    ),
  },
  {
    id: 'terms',
    no: '02',
    title: 'Terminlər',
    body: (
      <>
        <p>Bu siyasətdə istifadə olunan əsas anlayışlar:</p>
        <dl className="grid sm:grid-cols-[160px_1fr] gap-x-6 gap-y-2 mt-3">
          <dt className="font-semibold">Şirkət</dt><dd>DE VALEUR MMC</dd>
          <dt className="font-semibold">Platforma</dt><dd>devaleur.az vebsaytı və mobil tətbiq</dd>
          <dt className="font-semibold">İstifadəçi</dt><dd>Platformadan istifadə edən fiziki şəxs</dd>
          <dt className="font-semibold">Fərdi məlumat</dt><dd>Şəxsi identifikasiyanı təmin edən hər hansı məlumat</dd>
          <dt className="font-semibold">Emal</dt><dd>Məlumatların toplanması, saxlanması, ötürülməsi və silinməsi</dd>
        </dl>
      </>
    ),
  },
  {
    id: 'collected',
    no: '03',
    title: 'Toplanan məlumatlar',
    body: (
      <>
        <h4 className="font-semibold text-black mt-2">3.1 Şəxsi məlumatlar</h4>
        <p>Şirkət aşağıdakı məlumatları toplaya bilər:</p>
        <ul>
          <li>Ad, soyad, ata adı</li>
          <li>Telefon nömrəsi</li>
          <li>Email ünvanı</li>
          <li>Doğum tarixi</li>
          <li>Ünvan məlumatları</li>
          <li>Cinsiyyət</li>
          <li>Müştəri ID</li>
          <li>Loyalty ID</li>
          <li>Sifariş tarixçəsi</li>
          <li>Ödəniş məlumatları (məhdud, maskalanmış formada)</li>
        </ul>
      </>
    ),
  },
  {
    id: 'technical',
    no: '04',
    title: 'Texniki məlumatlar',
    body: (
      <>
        <p>Platformadan istifadə zamanı avtomatik toplanır:</p>
        <ul>
          <li>IP ünvanı</li>
          <li>Cihaz modeli və əməliyyat sistemi</li>
          <li>Brauzer növü və versiyası</li>
          <li>Giriş tarixçəsi</li>
          <li>Klik və davranış məlumatları</li>
          <li>Lokasiya məlumatı (təxmini)</li>
        </ul>
      </>
    ),
  },
  {
    id: 'loyalty',
    no: '05',
    title: 'Loyalty proqram məlumatları',
    body: (
      <>
        <p>DE VALEUR Loyalty sistemi çərçivəsində aşağıdakı məlumatlar emal olunur:</p>
        <ul>
          <li>Bonus xalları (Cash-back)</li>
          <li>Endirim tarixçəsi</li>
          <li>Kampaniya iştirakları</li>
          <li>Müştəri seqmentasiyası</li>
          <li>Alış tezliyi və davranış göstəriciləri</li>
        </ul>
      </>
    ),
  },
  {
    id: 'methods',
    no: '06',
    title: 'Məlumatların toplanma üsulları',
    body: (
      <>
        <p>Məlumatlar aşağıdakı vasitələrlə toplanır:</p>
        <ul>
          <li>Qeydiyyat forması</li>
          <li>Sifariş prosesi</li>
          <li>Loyalty qeydiyyatı</li>
          <li>Cookies və oxşar texnologiyalar</li>
          <li>Mobil tətbiq</li>
          <li>Marketinq kampaniyaları və sorğular</li>
        </ul>
      </>
    ),
  },
  {
    id: 'legal-basis',
    no: '07',
    title: 'Emalın hüquqi əsasları',
    body: (
      <>
        <p>Şirkət fərdi məlumatları yalnız aşağıdakı hüquqi əsaslarla emal edir:</p>
        <ul>
          <li>İstifadəçinin könüllü razılığı</li>
          <li>Müqavilə öhdəliyinin icrası</li>
          <li>Qanunla nəzərdə tutulmuş öhdəliklər</li>
          <li>Şirkətin qanuni maraqları</li>
        </ul>
      </>
    ),
  },
  {
    id: 'purposes',
    no: '08',
    title: 'İstifadə məqsədləri',
    body: (
      <>
        <p>Toplanan məlumatlar yalnız aşağıdakı məqsədlər üçün istifadə olunur:</p>
        <ul>
          <li>Sifarişlərin icrası və çatdırılması</li>
          <li>Loyalty proqramının idarə edilməsi</li>
          <li>Marketinq və fərdiləşdirilmiş kommunikasiya</li>
          <li>Müştəri dəstəyi və geri-dönüş</li>
          <li>Risklərin idarə olunması</li>
          <li>Saxta və riskli əməliyyatların qarşısının alınması</li>
          <li>Xidmət keyfiyyətinin daim yaxşılaşdırılması</li>
        </ul>
      </>
    ),
  },
  {
    id: 'third-parties',
    no: '09',
    title: 'Üçüncü tərəflərə ötürülmə',
    body: (
      <>
        <h4 className="font-semibold text-black mt-2">9.1 Xidmət təminatçıları</h4>
        <ul>
          <li>IT və hosting xidmətləri</li>
          <li>CRM sistemləri</li>
          <li>SMS platformaları</li>
          <li>Email xidmətləri</li>
          <li>Ödəniş emal sistemləri</li>
        </ul>
        <h4 className="font-semibold text-black mt-4">9.2 Analitika və reklam tərəfdaşları</h4>
        <ul>
          <li>Google Analytics</li>
          <li>Meta (Facebook, Instagram)</li>
          <li>Reklam və remarketinq platformaları</li>
        </ul>
        <h4 className="font-semibold text-black mt-4">9.3 Hüquqi əsaslarla</h4>
        <ul>
          <li>Səlahiyyətli dövlət qurumları</li>
          <li>Məhkəmə qərarı əsasında</li>
          <li>Hüquq mühafizə orqanları</li>
        </ul>
      </>
    ),
  },
  {
    id: 'transfer',
    no: '10',
    title: 'Beynəlxalq ötürülmə',
    body: (
      <>
        <p>İstifadəçi məlumatları:</p>
        <ul>
          <li>Beynəlxalq serverlərdə saxlanıla bilər</li>
          <li>Xarici IT sistemlərində emal oluna bilər</li>
        </ul>
        <p className="mt-3">
          Bu zaman məlumatların qorunması beynəlxalq standartlara və qüvvədə olan qanunvericiliyə uyğun təmin olunur.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    no: '11',
    title: 'Cookies siyasəti',
    body: (
      <>
        <p>Platformada aşağıdakı texnologiyalardan istifadə olunur:</p>
        <ul>
          <li>Cookies (sessiya və daimi)</li>
          <li>Pixel-tag-lar</li>
          <li>Analitika alətləri</li>
        </ul>
        <p className="mt-3">Bu texnologiyalar:</p>
        <ul>
          <li>İstifadəçi təcrübəsini yaxşılaşdırmaq</li>
          <li>Remarketing fəaliyyəti aparmaq</li>
          <li>Saytın performansını analiz etmək</li>
        </ul>
        <p>üçün tətbiq olunur.</p>
      </>
    ),
  },
  {
    id: 'retention',
    no: '12',
    title: 'Saxlanma müddəti',
    body: (
      <>
        <p>Məlumatlar aşağıdakı müddətlərdə saxlanılır:</p>
        <ul>
          <li>Müqavilə müddəti ərzində</li>
          <li>Qanunvericiliyin tələb etdiyi müddətdə</li>
          <li>Müştəri hesabı aktiv olduğu müddətdə</li>
        </ul>
      </>
    ),
  },
  {
    id: 'deletion',
    no: '13',
    title: 'Məlumatların silinməsi',
    body: (
      <>
        <p>Fərdi məlumatlar aşağıdakı hallarda silinir:</p>
        <ul>
          <li>İstifadəçi yazılı müraciəti əsasında</li>
          <li>Hesabın ləğv olunması zamanı</li>
          <li>Qanunvericiliklə müəyyən edilmiş müddətin sonunda</li>
        </ul>
      </>
    ),
  },
  {
    id: 'security',
    no: '14',
    title: 'Təhlükəsizlik tədbirləri',
    body: (
      <>
        <p>Şirkət məlumatların qorunması üçün aşağıdakı tədbirləri tətbiq edir:</p>
        <ul>
          <li>SSL şifrələmə</li>
          <li>Çoxsəviyyəli giriş məhdudiyyəti</li>
          <li>Audit və monitorinq sistemi</li>
          <li>Daxili təhlükəsizlik prosedurları və əməkdaş təlimləri</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rights',
    no: '15',
    title: 'İstifadəçi hüquqları',
    body: (
      <>
        <p>İstifadəçi istənilən vaxt aşağıdakı hüquqlardan istifadə edə bilər:</p>
        <ul>
          <li>Öz məlumatlarına çıxış əldə etmək</li>
          <li>Yanlış məlumatları düzəltmək</li>
          <li>Məlumatlarının silinməsini tələb etmək</li>
          <li>Verilmiş razılığı geri götürmək</li>
          <li>Marketinq kommunikasiyalarından imtina etmək</li>
        </ul>
      </>
    ),
  },
  {
    id: 'age',
    no: '16',
    title: 'Yetkinlik yaşı',
    body: (
      <>
        <p>
          Platforma 18 yaşdan yuxarı istifadəçilər üçün nəzərdə tutulmuşdur. 18 yaşdan aşağı istifadəçilərin
          məlumatları valideyn və ya qanuni nümayəndənin razılığı olmadan emal edilmir.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    no: '17',
    title: 'Məsuliyyətin məhdudlaşdırılması',
    body: (
      <>
        <p>Şirkət aşağıdakı hallara görə məsuliyyət daşımır:</p>
        <ul>
          <li>Üçüncü tərəf saytlarındakı kontent və əməliyyatlar</li>
          <li>İstifadəçinin könüllü olaraq paylaşdığı məlumatlar</li>
          <li>Şirkətdən asılı olmayan texniki problemlər</li>
        </ul>
      </>
    ),
  },
  {
    id: 'disputes',
    no: '18',
    title: 'Mübahisələrin həlli',
    body: (
      <>
        <p>Yaranan hər hansı mübahisə:</p>
        <ul>
          <li>İlk növbədə danışıqlar yolu ilə</li>
          <li>Həll mümkün olmadıqda Azərbaycan Respublikası qanunvericiliyi əsasında</li>
        </ul>
        <p>həll olunur.</p>
      </>
    ),
  },
  {
    id: 'changes',
    no: '19',
    title: 'Siyasətə dəyişikliklər',
    body: (
      <>
        <p>
          Şirkət bu siyasəti tək tərəfli olaraq dəyişmək hüququna malikdir.
          Dəyişikliklər saytda yerləşdirildiyi andan etibarən qüvvəyə minir.
          Mütəmadi olaraq sənədin yenilənmiş versiyası ilə tanış olmağınızı tövsiyə edirik.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    no: '20',
    title: 'Əlaqə məlumatları',
    body: (
      <>
        <p>
          Məxfilik Siyasəti və fərdi məlumatların emalı ilə bağlı suallarınızı bizə aşağıdakı kanallarla
          ünvanlaya bilərsiniz:
        </p>
        <ul>
          <li>Email: <a href="mailto:info@devaleur.az" className="underline decoration-[#D4AF37] underline-offset-4 hover:text-black">info@devaleur.az</a></li>
          <li>Telefon: <a href="tel:+994777577277" className="underline decoration-[#D4AF37] underline-offset-4 hover:text-black">+994 77 757 72 77</a></li>
          <li>Vebsayt: <a href="https://www.devaleur.az" className="underline decoration-[#D4AF37] underline-offset-4 hover:text-black">www.devaleur.az</a></li>
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          © DE VALEUR MMC. Bütün hüquqlar qorunur.
        </p>
      </>
    ),
  },
];

const PrivacyPolicyPage: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const [showTop, setShowTop] = useState(false);

  // Scroll-spy: highlight current section in sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId((e.target as HTMLElement).id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const lastUpdated = '28.04.2026';

  return (
    <div className="min-h-screen bg-white" data-testid="privacy-policy-page">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FBF7EF] via-white to-white">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 0%, #D4AF37 0%, transparent 40%), radial-gradient(circle at 80% 100%, #000 0%, transparent 40%)',
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
            <Link to="/" className="hover:text-black transition-colors">Ana Səhifə</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">Məxfilik Siyasəti</span>
          </nav>

          <div className="flex items-center gap-3 mb-6">
            <span className="block w-10 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="text-xs tracking-[0.3em] uppercase text-gray-500 font-medium">
              Maison · De Valeur
            </span>
          </div>

          <h1
            className="font-playfair text-4xl md:text-6xl lg:text-7xl font-light text-black leading-[1.05] tracking-tight"
            data-testid="privacy-title"
          >
            Məxfilik
            <span style={{ color: '#D4AF37' }}> Siyasəti</span>
          </h1>

          <p className="mt-6 max-w-2xl text-gray-600 leading-relaxed text-base md:text-lg font-light">
            Sizin etimadınız bizim üçün dəyərlidir. Bu sənəd <strong className="text-black font-medium">DE VALEUR MMC</strong>-nin
            fərdi məlumatlarınızı necə topladığını, istifadə etdiyini və qoruduğunu şəffaf şəkildə izah edir.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white/70 backdrop-blur text-gray-700">
              <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
              Azərbaycan qanunvericiliyinə uyğun
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white/70 backdrop-blur text-gray-700">
              <FileText className="h-4 w-4 text-[#D4AF37]" />
              Son yenilənmə: {lastUpdated}
            </span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </section>

      {/* CONTENT */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          {/* SIDEBAR — Table of Contents */}
          <aside className="lg:sticky lg:top-24 lg:self-start hidden lg:block">
            <div className="border-l border-gray-200 pl-5">
              <p className="text-xs tracking-[0.25em] uppercase text-gray-400 font-medium mb-5">
                Mündəricat
              </p>
              <ol className="space-y-2.5">
                {SECTIONS.map((s) => {
                  const isActive = activeId === s.id;
                  return (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`group flex items-baseline gap-3 text-sm transition-colors ${
                          isActive ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-mono w-6 transition-colors ${
                            isActive ? 'text-[#D4AF37]' : 'text-gray-400'
                          }`}
                        >
                          {s.no}
                        </span>
                        <span className="leading-snug">{s.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="min-w-0">
            {SECTIONS.map((s, idx) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 mb-14 last:mb-0"
                data-testid={`privacy-section-${s.id}`}
              >
                <div className="flex items-baseline gap-4 mb-5">
                  <span
                    className="font-playfair text-3xl md:text-4xl font-light"
                    style={{ color: '#D4AF37' }}
                  >
                    {s.no}
                  </span>
                  <h2 className="font-playfair text-2xl md:text-3xl font-light text-black tracking-tight leading-tight">
                    {s.title}
                  </h2>
                </div>

                <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed font-light text-[15.5px] md:text-base">
                  <style>{`
                    [data-testid="privacy-section-${s.id}"] ul { list-style: none; padding-left: 0; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                    [data-testid="privacy-section-${s.id}"] ul li { position: relative; padding-left: 1.25rem; margin-top: 0.35rem; }
                    [data-testid="privacy-section-${s.id}"] ul li::before {
                      content: ''; position: absolute; left: 0; top: 0.55rem;
                      width: 6px; height: 1px; background: #D4AF37;
                    }
                    [data-testid="privacy-section-${s.id}"] p { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                    [data-testid="privacy-section-${s.id}"] a { color: inherit; }
                  `}</style>
                  {s.body}
                </div>

                {idx < SECTIONS.length - 1 && (
                  <div className="mt-12 h-[1px] bg-gradient-to-r from-gray-200 via-gray-100 to-transparent" />
                )}
              </section>
            ))}

            {/* Bottom signature */}
            <div className="mt-20 pt-10 border-t border-gray-200 text-center">
              <p className="font-playfair italic text-gray-600 text-lg">
                — DE VALEUR MMC —
              </p>
              <p className="mt-2 text-xs tracking-[0.25em] uppercase text-gray-400">
                Anno · MMX
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Scroll-to-top button */}
      {showTop && (
        <button
          onClick={scrollToTop}
          aria-label="Yuxarı"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-black text-white shadow-xl hover:bg-gray-800 hover:scale-105 transition-all flex items-center justify-center"
          data-testid="privacy-scroll-top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default PrivacyPolicyPage;
