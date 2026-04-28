import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Briefcase, MapPin, Clock, Mail, Send } from 'lucide-react';
import { getVacancies, type Vacancy } from '../services/contentService';

const CareersPage: React.FC = () => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const items = await getVacancies();
        setVacancies(items.filter((v) => v.isOpen));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Format body with bullets and paragraphs
  const renderBody = (text: string) => {
    const lines = (text || '').split(/\r?\n/);
    const blocks: Array<{ type: 'p' | 'ul'; content: string | string[] }> = [];
    let list: string[] | null = null;
    let para: string[] = [];
    const flushP = () => { if (para.length) { blocks.push({ type: 'p', content: para.join(' ') }); para = []; } };
    const flushL = () => { if (list && list.length) { blocks.push({ type: 'ul', content: list }); list = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('- ')) { flushP(); if (!list) list = []; list.push(line.slice(2).trim()); }
      else if (!line) { flushP(); flushL(); }
      else { flushL(); para.push(line); }
    }
    flushP(); flushL();
    return blocks.map((b, i) =>
      b.type === 'p'
        ? <p key={i} className="text-gray-600 leading-relaxed font-light text-[15px] mb-2">{b.content as string}</p>
        : (
          <ul key={i} className="space-y-1.5 mb-3">
            {(b.content as string[]).map((item, j) => (
              <li key={j} className="relative pl-5 text-gray-600 font-light text-[15px]">
                <span className="absolute left-0 top-[0.6em] block w-2 h-[1px]" style={{ background: '#D4AF37' }} />
                {item}
              </li>
            ))}
          </ul>
        )
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="careers-page">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FBF7EF] via-white to-white">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, #D4AF37 0%, transparent 40%), radial-gradient(circle at 80% 100%, #000 0%, transparent 40%)' }}
        />
        <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
            <Link to="/" className="hover:text-black transition-colors">Ana Səhifə</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">Karyera</span>
          </nav>

          <div className="flex items-center gap-3 mb-3">
            <span className="block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="text-[10px] tracking-[0.3em] uppercase text-gray-500 font-medium">
              Maison · De Valeur
            </span>
          </div>

          <h1
            className="font-playfair text-3xl md:text-5xl lg:text-6xl font-light text-black leading-[1.05] tracking-tight"
            data-testid="careers-title"
          >
            Bizimlə{' '}
            <span style={{ color: '#D4AF37' }}>çalışın</span>
          </h1>

          <p className="mt-5 max-w-2xl text-gray-600 leading-relaxed text-base md:text-lg font-light">
            DE VALEUR komandasının bir parçası olun — lüks bazarın incəliklərini öyrənin, zövqlü mühitdə peşəkar
            inkişafa imkan tapın və müştərilərimizə ən yaxşı təcrübəni təqdim etməkdə bizə qoşulun.
          </p>
        </div>
      </section>

      {/* VACANCIES */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {vacancies.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-4" />
            <h3 className="font-playfair text-2xl font-light text-gray-700 mb-2">
              Hazırda açıq vakansiya yoxdur
            </h3>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              Bizim komandaya qoşulmaq istəyirsiniz?  CV-nizi
              <a href="mailto:hr@devaleur.az" className="text-black font-medium underline decoration-[#D4AF37] underline-offset-4 mx-1">hr@devaleur.az</a>
              ünvanına göndərin — yaxın bir vakansiya açılanda sizinlə əlaqə saxlayacağıq.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="font-playfair text-2xl md:text-3xl font-light text-black">
                Açıq vakansiyalar
              </h2>
              <span className="text-sm text-gray-500">{vacancies.length} açıq mövqe</span>
            </div>

            <div className="space-y-4">
              {vacancies.map((v) => {
                const isOpen = openId === v.id;
                return (
                  <article
                    key={v.id}
                    className={`border rounded-2xl bg-white overflow-hidden transition-all ${
                      isOpen ? 'border-[#D4AF37]/40 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`vacancy-${v.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : v.id)}
                      className="w-full text-left p-5 md:p-6"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {v.department && (
                            <span className="inline-block text-[10px] tracking-[0.2em] uppercase text-[#D4AF37] font-medium mb-2">
                              {v.department}
                            </span>
                          )}
                          <h3 className="font-playfair text-xl md:text-2xl font-light text-black leading-tight mb-2">
                            {v.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {v.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />{v.location}
                              </span>
                            )}
                            {v.type && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />{v.type}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {isOpen ? 'Bağla' : 'Ətraflı'}
                          </span>
                          <ChevronRight
                            className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${
                              isOpen ? 'rotate-90 text-[#D4AF37]' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 md:px-6 pb-6 pt-2 border-t border-gray-100">
                          <div className="pt-4">
                            {renderBody(v.description)}
                          </div>

                          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4 text-[#D4AF37]" />
                              CV göndərin: <strong className="text-black">{v.contactEmail || 'hr@devaleur.az'}</strong>
                            </div>
                            <a
                              href={`mailto:${v.contactEmail || 'hr@devaleur.az'}?subject=${encodeURIComponent('Müraciət: ' + v.title)}`}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-colors"
                              data-testid={`vacancy-apply-${v.id}`}
                            >
                              <Send className="h-4 w-4" />
                              Müraciət et
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* General CTA */}
        <div className="mt-16 pt-10 border-t border-gray-100 text-center">
          <p className="font-playfair italic text-gray-500 text-base">— DE VALEUR MMC —</p>
        </div>
      </section>
    </div>
  );
};

export default CareersPage;
