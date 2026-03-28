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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              {t('blog.title') || 'Bloq'}
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              {t('blog.subtitle') || 'Ən son xəbərlər və məqalələr'}
            </p>
          </div>
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
