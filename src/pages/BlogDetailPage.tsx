import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowLeft, Loader2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-600 mb-4">{t('blog.notFound') || 'Bloq tapılmadı'}</p>
        <Link to="/blog" className="text-gray-900 underline hover:no-underline">
          {t('blog.backToBlogs') || 'Bloqlara qayıt'}
        </Link>
      </div>
    );
  }

  const lang = i18n.language as 'az' | 'ru';

  return (
    <div className="min-h-screen bg-white">
      {/* Header Image */}
      <div className="relative h-[400px] md:h-[500px]">
        <img
          src={post.image}
          alt={post.title[lang]}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl mb-4">
              {post.title[lang]}
            </h1>
            <div className="flex items-center justify-center text-gray-200">
              <Calendar className="h-5 w-5 mr-2" />
              {post.createdAt.toLocaleDateString('az-AZ')}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[800px] mx-auto px-4 py-12">
        <Link 
          to="/blog" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('blog.backToBlogs') || 'Bloqlara qayıt'}
        </Link>

        <article className="prose prose-lg max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-lg">
            {post.content[lang]}
          </p>
        </article>
      </div>
    </div>
  );
};

export default BlogDetailPage;
