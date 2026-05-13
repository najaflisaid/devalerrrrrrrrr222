import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useReveal } from '../hooks/useReveal';

interface BlogPost {
  id: string;
  title: { az: string; ru: string; en?: string };
  content: { az: string; ru: string; en?: string };
  image: string;
  createdAt: Date;
}

/**
 * HomeBlogSection — Ana səhifədə editorial "Journal" bölməsi.
 * Lüks brendlərin (Omega, Cartier, Hermès) "Stories" / "Le Journal" formatında.
 *  - 3 ən son blog yazısı (Firestore: blog_posts)
 *  - İlk yazı böyük "feature" kart, qalan 2 sağda yığcam stack
 *  - Editorial typography + scroll-reveal animasiya
 */
const HomeBlogSection: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const header = useReveal<HTMLDivElement>();
  const feature = useReveal<HTMLDivElement>();
  const side = useReveal<HTMLDivElement>({ threshold: 0.05 });
  const cta = useReveal<HTMLDivElement>();

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'blog_posts'));
        const blogs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          };
        }) as BlogPost[];
        const sorted = blogs.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        setPosts(sorted.slice(0, 3));
      } catch (err) {
        console.error('HomeBlogSection load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || posts.length === 0) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const getText = (val: { az?: string; ru?: string; en?: string } | undefined): string => {
    if (!val) return '';
    return (val as any)[lang] || val.az || val.en || val.ru || '';
  };

  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const truncate = (text: string, max: number) =>
    text.length <= max ? text : text.substring(0, max).trim() + '…';

  const fmtDate = (d: Date) => {
    const months = {
      az: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'],
      ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    };
    const m = months[lang] || months.az;
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
  };

  const surtitle =
    lang === 'ru' ? 'ЖУРНАЛ' : lang === 'en' ? 'JOURNAL' : 'JURNAL';
  const sectionTitle =
    lang === 'ru'
      ? 'Истории, вдохновляющие стиль'
      : lang === 'en'
      ? 'Stories that inspire style'
      : 'Stili ilhamlandıran hekayələr';
  const sectionSubtitle =
    lang === 'ru'
      ? 'Эксклюзивные материалы о брендах, мастерстве и культуре роскоши'
      : lang === 'en'
      ? 'Exclusive features on brands, craftsmanship and the culture of luxury'
      : 'Brendlər, ustalıq və lüks mədəniyyəti haqqında eksklüziv materiallar';
  const readMore =
    lang === 'ru' ? 'Читать' : lang === 'en' ? 'Read more' : 'Oxu';
  const viewAll =
    lang === 'ru' ? 'Все статьи' : lang === 'en' ? 'All stories' : 'Bütün yazılar';

  const [featured, ...rest] = posts;

  return (
    <section
      className="relative bg-white py-16 md:py-28"
      data-testid="dv-home-blog"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* === Header === */}
        <div
          ref={header.ref}
          className={`dv-scroll-reveal dv-scroll-up flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-16 ${
            header.revealed ? 'dv-scroll-in' : ''
          }`}
        >
          <div>
            <div className="flex items-center gap-3 mb-3 md:mb-5">
              <span className="h-px w-8 md:w-12 bg-[#C9A961]" aria-hidden="true" />
              <p className="text-[10px] md:text-[11px] tracking-[0.32em] uppercase text-[#C9A961] font-medium">
                {surtitle}
              </p>
            </div>
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-[42px] lg:text-[52px] font-light text-black leading-[1.05] tracking-tight max-w-3xl">
              {sectionTitle}
            </h2>
            <p className="mt-3 md:mt-5 text-xs sm:text-sm md:text-base text-black/55 max-w-xl leading-relaxed">
              {sectionSubtitle}
            </p>
          </div>

          {/* Desktop View all link */}
          <Link
            to="/blog"
            className="hidden md:inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group whitespace-nowrap"
            data-testid="home-blog-view-all-desktop"
          >
            <span className="relative pb-1">
              {viewAll}
              <span
                aria-hidden="true"
                className="absolute left-0 bottom-0 h-px w-full bg-black/70"
              />
            </span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </Link>
        </div>

        {/* === Editorial 2-column grid: 1 large feature + 2 stack === */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* FEATURED — large left tile */}
          <div
            ref={feature.ref}
            className={`lg:col-span-7 dv-scroll-reveal dv-scroll-up ${
              feature.revealed ? 'dv-scroll-in' : ''
            }`}
            data-testid="home-blog-featured"
          >
            <Link to={`/blog/${featured.id}`} className="group block">
              <div className="relative aspect-[4/3] md:aspect-[16/11] overflow-hidden bg-[#F5F5F5]">
                <img
                  src={featured.image}
                  alt={getText(featured.title)}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-px w-full bg-white scale-x-0 origin-left transition-transform duration-700 ease-out group-hover:scale-x-100"
                />
              </div>
              <div className="pt-5 md:pt-7">
                <p className="text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-[#C9A961] font-medium">
                  {fmtDate(featured.createdAt)}
                </p>
                <h3 className="mt-3 md:mt-4 font-playfair text-xl sm:text-2xl md:text-[32px] lg:text-[36px] font-light text-black leading-[1.1] tracking-tight">
                  {getText(featured.title)}
                </h3>
                <p className="mt-3 md:mt-4 text-sm md:text-base text-black/60 leading-relaxed line-clamp-2 max-w-2xl">
                  {truncate(stripHtml(getText(featured.content)), 200)}
                </p>
                <span className="mt-4 md:mt-5 inline-flex items-center gap-2 text-[10px] md:text-[11px] uppercase tracking-[0.28em] font-semibold text-black">
                  <span className="relative pb-1">
                    {readMore}
                    <span
                      aria-hidden="true"
                      className="absolute left-0 bottom-0 h-px w-full bg-black/70 origin-left transition-transform duration-500"
                    />
                  </span>
                  <ArrowRight
                    className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1.5"
                    strokeWidth={1.6}
                  />
                </span>
              </div>
            </Link>
          </div>

          {/* SIDE — 2 stacked smaller tiles */}
          <div
            ref={side.ref}
            className={`lg:col-span-5 flex flex-col gap-8 md:gap-10 ${
              side.revealed ? 'dv-scroll-in' : ''
            } dv-scroll-stagger`}
            data-testid="home-blog-side"
          >
            {rest.map((post, idx) => (
              <div
                key={post.id}
                style={{ ['--dv-i' as any]: idx }}
                data-testid={`home-blog-side-${idx}`}
              >
                <Link to={`/blog/${post.id}`} className="group flex flex-col sm:flex-row gap-4 md:gap-6">
                  <div className="relative w-full sm:w-[45%] aspect-[4/3] overflow-hidden bg-[#F5F5F5] shrink-0">
                    <img
                      src={post.image}
                      alt={getText(post.title)}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.07]"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-[9px] md:text-[10px] uppercase tracking-[0.28em] text-[#C9A961] font-medium">
                      {fmtDate(post.createdAt)}
                    </p>
                    <h4 className="mt-2 md:mt-3 font-playfair text-base sm:text-lg md:text-[22px] font-light text-black leading-[1.15] tracking-tight line-clamp-3 group-hover:text-black/85 transition-colors">
                      {getText(post.title)}
                    </h4>
                    <span className="mt-2 md:mt-3 inline-flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-[0.28em] font-semibold text-black/70 group-hover:text-black">
                      {readMore}
                      <ArrowRight
                        className="w-3 h-3 transition-transform duration-500 group-hover:translate-x-1"
                        strokeWidth={1.6}
                      />
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile View all */}
        <div
          ref={cta.ref}
          className={`mt-10 md:hidden flex justify-center dv-scroll-reveal dv-scroll-up ${
            cta.revealed ? 'dv-scroll-in' : ''
          }`}
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-7 py-3 border border-black text-black text-[11px] uppercase tracking-[0.28em] font-medium hover:bg-black hover:text-white transition-colors duration-500"
            data-testid="home-blog-view-all-mobile"
          >
            <span>{viewAll}</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeBlogSection;
