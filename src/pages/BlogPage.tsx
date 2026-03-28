import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BlogPost {
  id: string;
  title: { az: string; ru: string };
  content: { az: string; ru: string };
  image: string;
  createdAt: Date;
}

const BlogCard: React.FC<{ post: BlogPost }> = ({ post }) => {
  const { i18n, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const content = post.content[i18n.language as 'az' | 'ru'] || '';
  const shortContent = content.slice(0, 150);
  const hasMore = content.length > 150;

  return (
    <article className="bg-white rounded-lg overflow-hidden shadow-sm">
      <img
        src={post.image}
        alt={post.title[i18n.language as 'az' | 'ru']}
        className="w-full h-64 object-cover"
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="h-4 w-4 mr-2" />
          {post.createdAt.toLocaleDateString('az-AZ')}
        </div>

        <h2 className="font-playfair text-xl font-semibold">
          {post.title[i18n.language as 'az' | 'ru']}
        </h2>

        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
          {expanded ? content : shortContent}{!expanded && hasMore && '...'}
        </p>

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {t('blog.showLess') || 'Daha az'}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t('blog.readMore') || 'Daha çox'}
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
};

const BlogPage: React.FC = () => {
  const { t } = useTranslation();
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
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
