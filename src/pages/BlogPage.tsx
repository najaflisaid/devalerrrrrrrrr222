import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, ArrowRight } from 'lucide-react';
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
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'blog_posts'));
      const blogs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date()
        };
      }) as BlogPost[];
      setBlogPosts(blogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const lang = i18n.language as 'az' | 'ru';

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-slate-800 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">{t('loading') || 'Yüklənir...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Minimalist Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="flex items-center mb-5">
            <span className="inline-block w-8 h-[1px]" style={{ background: '#D4AF37' }} />
            <span className="ml-3 text-[10px] uppercase tracking-[0.35em] text-gray-500 font-semibold">
              {t('blog.eyebrow', { defaultValue: 'Journal · Stories' })}
            </span>
          </div>
          <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl font-light text-black tracking-tight leading-[1.05]">
            {t('blog.title') || 'Bloq'}
          </h1>
          <p className="mt-4 text-gray-500 text-base md:text-lg max-w-xl font-light tracking-wide">
            {t('blog.subtitle') || 'Ən son xəbərlər və məqalələr'}
          </p>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        {blogPosts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {t('blog.noPosts') || 'Hələ heç bir yazı yoxdur'}
            </h3>
            <p className="text-slate-500">
              {t('blog.checkBackLater') || 'Tezliklə yeni yazılar əlavə ediləcək'}
            </p>
          </div>
        ) : (
          <>
            {/* Featured Post - First Post */}
            {blogPosts.length > 0 && (
              <div className="mb-16">
                <Link 
                  to={`/blog/${blogPosts[0].id}`} 
                  className="group block"
                  data-testid="featured-blog-post"
                >
                  <article className="relative bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500">
                    <div className="grid lg:grid-cols-2 gap-0">
                      <div className="relative h-72 lg:h-[450px] overflow-hidden">
                        <img
                          src={blogPosts[0].image}
                          alt={blogPosts[0].title[lang]}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent lg:hidden"></div>
                      </div>
                      
                      <div className="flex flex-col justify-center p-8 lg:p-12">
                        <div className="inline-flex items-center gap-2 text-sm text-slate-500 mb-4">
                          <Calendar className="w-4 h-4" />
                          <time dateTime={blogPosts[0].createdAt.toISOString()}>
                            {blogPosts[0].createdAt.toLocaleDateString('az-AZ', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </time>
                        </div>
                        
                        <h2 className="font-serif text-3xl lg:text-4xl font-bold text-slate-900 mb-4 group-hover:text-slate-700 transition-colors leading-tight">
                          {blogPosts[0].title[lang]}
                        </h2>
                        
                        <p className="text-slate-600 text-lg leading-relaxed mb-6 line-clamp-3">
                          {truncateText(blogPosts[0].content[lang], 200)}
                        </p>
                        
                        <div className="inline-flex items-center gap-2 text-slate-900 font-semibold group-hover:gap-4 transition-all">
                          <span>{t('blog.readMore') || 'Daha ətraflı'}</span>
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              </div>
            )}

            {/* Rest of Posts Grid */}
            {blogPosts.length > 1 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {blogPosts.slice(1).map((post, index) => (
                  <Link 
                    key={post.id} 
                    to={`/blog/${post.id}`}
                    className="group"
                    data-testid={`blog-post-${index + 1}`}
                  >
                    <article className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                      <div className="relative h-56 overflow-hidden">
                        <img
                          src={post.image}
                          alt={post.title[lang]}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>

                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                          <Calendar className="w-4 h-4" />
                          <time dateTime={post.createdAt.toISOString()}>
                            {post.createdAt.toLocaleDateString('az-AZ', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </time>
                        </div>

                        <h3 className="font-serif text-xl font-bold text-slate-900 mb-3 group-hover:text-slate-700 transition-colors line-clamp-2 leading-snug">
                          {post.title[lang]}
                        </h3>
                        
                        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 flex-1 mb-4">
                          {truncateText(post.content[lang], 120)}
                        </p>

                        <div className="inline-flex items-center gap-2 text-slate-900 font-medium text-sm group-hover:gap-3 transition-all mt-auto">
                          <span>{t('blog.readMore') || 'Daha ətraflı'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
