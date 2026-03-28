import React, { useState, useEffect } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
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
      setBlogPosts(blogs);
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const lang = i18n.language as 'az' | 'ru';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="relative h-[300px] bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="font-playfair text-5xl md:text-6xl mb-4">
            {t('blog.title')}
          </h1>
          <p className="text-gray-300">{t('blog.subtitle')}</p>
        </div>
      </div>

      {/* Blogs */}
      <div className="max-w-[1200px] mx-auto px-4 py-16">
        {blogPosts.length === 0 ? (
          <p className="text-center text-gray-500">
            {t('blog.noPosts')}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {blogPosts.map(post => (
              <article
                key={post.id}
                className="bg-white rounded-lg overflow-hidden shadow-sm group"
              >
                <Link to={`/blog/${post.id}`} className="block">
                  <div className="relative overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title[lang]}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>

                <div className="p-6">
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Calendar className="h-4 w-4 mr-2" />
                    {post.createdAt.toLocaleDateString('az-AZ')}
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-playfair text-xl font-semibold flex-1 line-clamp-2">
                      {post.title[lang]}
                    </h2>
                    <Link
                      to={`/blog/${post.id}`}
                      className="flex-shrink-0 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors whitespace-nowrap underline"
                    >
                      {t('blog.readMore') || 'Daha ətraflı'}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
