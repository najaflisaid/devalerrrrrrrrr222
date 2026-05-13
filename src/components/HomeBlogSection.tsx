import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BlogPost {
  id: string;
  title: { az: string; ru: string; en?: string };
  content: { az: string; ru: string; en?: string };
  image: string;
  category?: { az?: string; ru?: string; en?: string } | string;
  createdAt: Date;
}

/**
 * HomeBlogSection — Omega "News & Stories" tipli 4-lü minimal grid.
 *  - Hər kart: kvadrat şəkil + kateqoriya etiketi + başlıq + qısa təsvir
 *  - Şəkil hover-də yumşaq zoom
 *  - Mobil 1 sütun, planşet 2, desktop 4
 */
const HomeBlogSection: React.FC = () => {
  const { i18n } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'blog_posts'));
        const blogs = snap.docs.map((d) => {
          const data = d.data();
          let createdAt: Date;
          if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
          else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number')
            createdAt = new Date(data.createdAt);
          else createdAt = new Date();
          return { ...data, id: d.id, createdAt } as BlogPost;
        });
        const sorted = blogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setPosts(sorted.slice(0, 4));
      } catch (err) {
        console.error('[HomeBlogSection] load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!loading && posts.length === 0) return null;

  const lang = (i18n.language as 'az' | 'ru' | 'en') || 'az';
  const getText = (val: { az?: string; ru?: string; en?: string } | string | undefined): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return (val as any)[lang] || val.az || val.en || val.ru || '';
  };

  const stripHtml = (html: string) =>
    (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const truncate = (text: string, max: number) =>
    text.length <= max ? text : text.substring(0, max).trim() + '…';

  const title =
    lang === 'ru' ? 'Новости и истории' : lang === 'en' ? 'News & Stories' : 'Xəbərlər və hekayələr';
  const viewAll = lang === 'ru' ? 'Все статьи' : lang === 'en' ? 'See all articles' : 'Hamısına bax';
  const defaultCategory = lang === 'ru' ? 'Истории' : lang === 'en' ? 'Stories' : 'Hekayələr';

  return (
    <section className="relative bg-white py-16 md:py-24" data-testid="dv-home-blog">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <motion.div
          className="flex items-end justify-between gap-6 mb-10 md:mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-[42px] lg:text-[52px] font-light text-black leading-[1.05] tracking-tight">
            {title}
          </h2>

          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-[10px] md:text-[11px] uppercase tracking-[0.28em] font-medium text-black/80 hover:text-black group whitespace-nowrap pb-2"
            data-testid="home-blog-view-all"
          >
            <span className="relative pb-1 hidden sm:inline">
              {viewAll}
              <span aria-hidden="true" className="absolute left-0 bottom-0 h-px w-full bg-black/70" />
            </span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5"
              strokeWidth={1.6}
            />
          </Link>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8" data-testid="home-blog-loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-[5/4] w-full bg-black/[0.04] animate-pulse" />
                <div className="mt-4 h-3 w-20 bg-black/[0.06] animate-pulse" />
                <div className="mt-3 h-5 w-full bg-black/[0.06] animate-pulse" />
                <div className="mt-2 h-4 w-2/3 bg-black/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* 4-up grid */}
        {!loading && posts.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-10%' }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
            }}
            data-testid="home-blog-grid"
          >
            {posts.map((post, idx) => (
              <motion.article
                key={post.id}
                data-testid={`home-blog-card-${idx}`}
                variants={{
                  hidden: { opacity: 0, y: 28 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              >
                <Link to={`/blog/${post.id}`} className="group block">
                  <div className="relative aspect-[5/4] overflow-hidden bg-[#F5F5F5]">
                    {post.image && (
                      <img
                        src={post.image}
                        alt={getText(post.title)}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                      />
                    )}
                  </div>
                  <div className="pt-4 md:pt-5">
                    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.24em] text-[#C9A961] font-medium">
                      {getText(post.category) || defaultCategory}
                    </p>
                    <h3 className="mt-2 md:mt-3 font-playfair text-base md:text-[20px] font-light text-black leading-[1.2] tracking-tight line-clamp-2 group-hover:text-black/85 transition-colors">
                      {getText(post.title)}
                    </h3>
                    <p className="mt-2 md:mt-3 text-xs md:text-[13px] text-black/55 leading-relaxed line-clamp-2">
                      {truncate(stripHtml(getText(post.content)), 110)}
                    </p>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default HomeBlogSection;
