import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronDown, ShieldCheck, FileText, ArrowUp, Search } from 'lucide-react';
import {
  getPrivacyPolicy,
  DEFAULT_PRIVACY_POLICY,
  type PrivacyPolicy,
  type PrivacySection,
} from '../services/contentService';

// Render plain-text body with simple formatting:
//  - lines that start with "- " become bullet items
//  - blank line separates paragraphs
const SectionBody: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => {
    const out: Array<{ type: 'p' | 'ul'; content: string | string[] }> = [];
    const lines = (text || '').split(/\r?\n/);
    let currentList: string[] | null = null;
    let currentPara: string[] = [];

    const flushPara = () => {
      if (currentPara.length) {
        out.push({ type: 'p', content: currentPara.join(' ') });
        currentPara = [];
      }
    };
    const flushList = () => {
      if (currentList && currentList.length) {
        out.push({ type: 'ul', content: currentList });
        currentList = null;
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('- ')) {
        flushPara();
        if (!currentList) currentList = [];
        currentList.push(line.slice(2).trim());
      } else if (!line) {
        flushPara();
        flushList();
      } else {
        flushList();
        currentPara.push(line);
      }
    }
    flushPara();
    flushList();
    return out;
  }, [text]);

  return (
    <div className="text-gray-600 leading-relaxed font-light text-[15px] space-y-2.5">
      {blocks.map((b, i) =>
        b.type === 'p' ? (
          <p key={i}>{b.content as string}</p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {(b.content as string[]).map((item, j) => (
              <li key={j} className="relative pl-5">
                <span
                  className="absolute left-0 top-[0.6em] block w-2 h-[1px]"
                  style={{ background: '#D4AF37' }}
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};

const PrivacyPolicyPage: React.FC = () => {
  const [data, setData] = useState<PrivacyPolicy>(DEFAULT_PRIVACY_POLICY);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showTop, setShowTop] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getPrivacyPolicy();
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenIds(new Set(data.sections.map((s) => s.id)));
  const collapseAll = () => setOpenIds(new Set());

  const filtered: PrivacySection[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.sections;
    return data.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.no.toLowerCase().includes(q)
    );
  }, [search, data.sections]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="privacy-policy-page">
      {/* HERO — compact */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FBF7EF] via-white to-white">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 0%, #D4AF37 0%, transparent 40%), radial-gradient(circle at 80% 100%, #000 0%, transparent 40%)',
          }}
        />
        <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
            <Link to="/" className="hover:text-black transition-colors">Ana Səhifə</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">Məxfilik Siyasəti</span>
          </nav>

          <div className="flex items-center gap-3 mb-3">
            <span className="block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="text-[10px] tracking-[0.3em] uppercase text-gray-500 font-medium">
              {data.hero.eyebrow}
            </span>
          </div>

          <h1
            className="font-playfair text-3xl md:text-5xl font-light text-black leading-[1.05] tracking-tight"
            data-testid="privacy-title"
          >
            {data.hero.title}{' '}
            <span style={{ color: '#D4AF37' }}>{data.hero.titleAccent}</span>
          </h1>

          <p className="mt-4 max-w-2xl text-gray-600 leading-relaxed text-sm md:text-[15px] font-light">
            {data.hero.intro}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white/70 backdrop-blur text-gray-700">
              <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
              {data.hero.badgeLeft}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white/70 backdrop-blur text-gray-700">
              <FileText className="h-3.5 w-3.5 text-[#D4AF37]" />
              {data.hero.badgeRight}
            </span>
          </div>
        </div>
      </section>

      {/* CONTENT — compact accordion */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bölmələrdə axtar..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 bg-white"
              data-testid="privacy-search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              data-testid="privacy-expand-all"
            >
              Hamısını aç
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              data-testid="privacy-collapse-all"
            >
              Bağla
            </button>
          </div>
        </div>

        {/* Accordion */}
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">
              Axtarışa uyğun bölmə tapılmadı
            </div>
          )}
          {filtered.map((s) => {
            const isOpen = openIds.has(s.id);
            return (
              <div key={s.id} data-testid={`privacy-section-${s.id}`}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${
                    isOpen ? 'bg-gray-50/60' : ''
                  }`}
                  aria-expanded={isOpen}
                >
                  <span
                    className="font-playfair text-lg w-8 flex-shrink-0 tabular-nums"
                    style={{ color: '#D4AF37' }}
                  >
                    {s.no}
                  </span>
                  <span className="flex-1 font-medium text-gray-900 text-[15px]">
                    {s.title}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-[#D4AF37]' : ''
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pl-[3.25rem]">
                      <SectionBody text={s.body} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom signature */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="font-playfair italic text-gray-500 text-base">
            {data.signature}
          </p>
        </div>
      </div>

      {/* Scroll-to-top button */}
      {showTop && (
        <button
          onClick={scrollToTop}
          aria-label="Yuxarı"
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full bg-black text-white shadow-xl hover:bg-gray-800 hover:scale-105 transition-all flex items-center justify-center"
          data-testid="privacy-scroll-top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default PrivacyPolicyPage;
