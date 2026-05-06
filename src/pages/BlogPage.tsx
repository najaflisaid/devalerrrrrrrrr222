import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BlogPost {
  id: string;
  title: { az: string; ru: string };
  content: { az: string; ru: string };
  image: string;
  createdAt: Date;
}

const BlogPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

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
        setBlogPosts(blogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      } catch (err) {
        console.error('Error loading blogs:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lang = i18n.language as 'az' | 'ru';

  const truncate = (text: string, max: number) => {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max).trim() + '…';
  };

  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-black/45 text-sm tracking-wide">{t('common.loading') || 'Yüklənir...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="blog-page">
      {/* Hero — minimalist, centred, gold hairlines */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-10 md:pb-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center mb-3">
            <span className="inline-block w-6 h-px bg-black/30" />
            <span className="mx-3 text-[10px] uppercase tracking-[0.32em] text-black/55 font-medium whitespace-nowrap">
              {t('blog.subtitle') || 'Jurnal & Hekayələr'}
            </span>
            <span className="inline-block w-6 h-px bg-black/30" />
          </div>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-light text-black tracking-tight leading-[1.05]">
            {t('blog.title') || 'Bloq'}
          </h1>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-24">
        {blogPosts.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="h-8 w-8 text-black/25 mx-auto mb-3" strokeWidth={1.25} />
            <p className="text-black font-light text-sm">
              {t('blog.noPosts') || 'Hələ heç bir yazı yoxdur'}
            </p>
            <p className="text-black/45 text-xs mt-1">
              {t('blog.checkBackLater') || 'Tezliklə yeni yazılar əlavə ediləcək'}
            </p>
          </div>
        ) : (
          <>
            {/* Featured — editorial two-column */}
            {blogPosts[0] && (
              <Link
                to={`/blog/${blogPosts[0].id}`}
                className="group block mb-14 md:mb-20"
                data-testid="featured-blog-post"
              >
                <article className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                  <div className="relative aspect-[4/3] overflow-hidden bg-black/[0.04]">
                    <img
                      src={blogPosts[0].image}
                      alt={blogPosts[0].title[lang]}
                      className="w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      loading="eager"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <span className="inline-block w-8 h-px bg-black/30" />
                      <time className="text-[10px] uppercase tracking-[0.3em] text-black/55 font-medium">
                        {fmtDate(blogPosts[0].createdAt)}
                      </time>
                    </div>
                    <h2 className="font-playfair text-2xl md:text-4xl font-light text-black tracking-tight leading-[1.1] mb-5">
                      {blogPosts[0].title[lang]}
                    </h2>
                    <p className="text-black/60 text-sm md:text-[15px] font-light leading-relaxed mb-8 line-clamp-4">
                      {truncate(blogPosts[0].content[lang], 240)}
                    </p>
                    <span className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] font-medium text-black border-b border-black/30 pb-1 group-hover:border-black transition-colors">
                      {t('blog.readMore') || 'Oxu'}
                      <span className="transition-transform duration-500 group-hover:translate-x-1.5 text-base leading-none">→</span>
                    </span>
                  </div>
                </article>
              </Link>
            )}

            {/* Rest — minimalist hairline grid */}
            {blogPosts.length > 1 && (
              <div className="border-t border-black/10">
                <div className="grid md:grid-cols-2 lg:grid-cols-3">
                  {blogPosts.slice(1).map((post, index) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.id}`}
                      className="group block border-b md:border-r border-black/10 last:border-b-0 lg:[&:nth-child(3n)]:border-r-0 md:[&:nth-last-child(-n+2)]:border-b md:[&:last-child]:border-r-0 lg:md:[&:nth-last-child(-n+3)]:border-b-0 p-6 md:p-8 hover:bg-black/[0.015] transition-colors"
                      data-testid={`blog-post-${index + 1}`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-black/[0.04] mb-5">
                        <img
                          src={post.image}
                          alt={post.title[lang]}
                          className="w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                      <time className="block text-[10px] uppercase tracking-[0.3em] text-black/45 font-medium mb-2">
                        {fmtDate(post.createdAt)}
                      </time>
                      <h3 className="font-playfair text-lg md:text-xl font-light text-black tracking-tight leading-snug mb-3 line-clamp-2 group-hover:text-black/70 transition-colors">
                        {post.title[lang]}
                      </h3>
                      <p className="text-black/55 text-[13px] font-light leading-relaxed line-clamp-3 mb-4">
                        {truncate(post.content[lang], 140)}
                      </p>
                      <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-medium text-black/70 group-hover:text-black transition-colors">
                        {t('blog.readMore') || 'Oxu'}
                        <span className="transition-transform duration-500 group-hover:translate-x-1 text-sm leading-none">→</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
