import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowLeft, Loader2, Share2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BlogPost {
  id: string;
  title: { az: string; ru: string };
  content: { az: string; ru: string };
  image: string;
  createdAt: Date;
}

const BlogDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    if (!id) return;
    try {
      const docRef = doc(db, 'blog_posts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPost({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as BlogPost);
      }
    } catch (error) {
      console.error('Error loading blog post:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateReadTime = (text: string) => {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes;
  };

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title[lang],
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(t('blog.linkCopied') || 'Link kopyalandı!');
    }
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

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-12 h-12 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            {t('blog.notFound') || 'Bloq tapılmadı'}
          </h2>
          <p className="text-slate-600 mb-6">
            {t('blog.notFoundDesc') || 'Axtardığınız yazı mövcud deyil'}
          </p>
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('blog.backToBlogs') || 'Bloqlara qayıt'}
          </Link>
        </div>
      </div>
    );
  }

  const lang = i18n.language as 'az' | 'ru';
  const readTime = calculateReadTime(post.content[lang]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Image Section */}
      <div className="relative h-[50vh] md:h-[60vh] lg:h-[70vh]">
        <img
          src={post.image}
          alt={post.title[lang]}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
        
        {/* Back Button */}
        <Link 
          to="/blog"
          className="absolute top-6 left-6 z-10 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all"
          data-testid="back-to-blogs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('blog.backToBlogs') || 'Bloqlara qayıt'}</span>
        </Link>

        {/* Share Button */}
        <button 
          onClick={handleShare}
          className="absolute top-6 right-6 z-10 p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all"
          data-testid="share-button"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {/* Title Overlay */}
        <div className="absolute inset-x-0 bottom-0 pb-12 md:pb-16 lg:pb-20">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
              {post.title[lang]}
            </h1>
            
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <time dateTime={post.createdAt.toISOString()} className="text-sm md:text-base">
                  {post.createdAt.toLocaleDateString('az-AZ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm md:text-base">{readTime} {t('blog.minRead') || 'dəq oxuma'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative -mt-8 md:-mt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <article className="bg-white rounded-3xl shadow-2xl overflow-hidden" data-testid="blog-content">
            <div className="p-8 md:p-12 lg:p-16">
              {/* Content with proper typography */}
              <div className="prose prose-lg md:prose-xl prose-slate max-w-none">
                {post.content[lang].split('\n\n').map((paragraph, index) => (
                  <p 
                    key={index} 
                    className="text-slate-700 leading-relaxed text-center mb-6 last:mb-0"
                    style={{ fontSize: '1.125rem', lineHeight: '1.9' }}
                  >
                    {paragraph.split('\n').map((line, lineIndex) => (
                      <React.Fragment key={lineIndex}>
                        {line}
                        {lineIndex < paragraph.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </p>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-slate-100 p-6 md:p-8 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link 
                  to="/blog"
                  className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('blog.backToBlogs') || 'Bloqlara qayıt'}
                </Link>
                
                <button 
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors font-medium"
                >
                  <Share2 className="w-4 h-4" />
                  {t('blog.share') || 'Paylaş'}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-16 md:h-24"></div>
    </div>
  );
};

export default BlogDetailPage;
