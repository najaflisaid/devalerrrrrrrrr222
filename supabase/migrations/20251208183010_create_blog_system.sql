/*
  # Blog System with Multilingual Support

  1. New Tables
    - `blog_posts`
      - `id` (uuid, primary key) - Unique identifier
      - `slug` (text, unique) - URL-friendly identifier
      - `title_az` (text) - Title in Azerbaijani
      - `title_en` (text) - Title in English
      - `title_ru` (text) - Title in Russian
      - `content_az` (text) - Content in Azerbaijani
      - `content_en` (text) - Content in English
      - `content_ru` (text) - Content in Russian
      - `excerpt_az` (text) - Short excerpt in Azerbaijani
      - `excerpt_en` (text) - Short excerpt in English
      - `excerpt_ru` (text) - Short excerpt in Russian
      - `image_url` (text) - Featured image URL
      - `author` (text) - Author name
      - `category` (text) - Blog category
      - `tags` (text[]) - Array of tags
      - `published` (boolean) - Publication status
      - `featured` (boolean) - Featured post flag
      - `views` (integer) - View count
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `published_at` (timestamptz) - Publication timestamp

  2. Security
    - Enable RLS on `blog_posts` table
    - Add policy for public to read published posts
    - Add policy for authenticated users to manage posts
    - Add policy for admins to manage all posts

  3. Indexes
    - Index on slug for fast lookups
    - Index on published and published_at for listing
    - Index on category for filtering
*/

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title_az text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  title_ru text NOT NULL DEFAULT '',
  content_az text NOT NULL DEFAULT '',
  content_en text NOT NULL DEFAULT '',
  content_ru text NOT NULL DEFAULT '',
  excerpt_az text NOT NULL DEFAULT '',
  excerpt_en text NOT NULL DEFAULT '',
  excerpt_ru text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  author text DEFAULT 'Admin',
  category text DEFAULT 'general',
  tags text[] DEFAULT ARRAY[]::text[],
  published boolean DEFAULT false,
  featured boolean DEFAULT false,
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz
);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can view published posts
CREATE POLICY "Anyone can view published blog posts"
  ON blog_posts
  FOR SELECT
  TO public
  USING (published = true);

-- Authenticated users can view all posts
CREATE POLICY "Authenticated users can view all blog posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create blog posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update posts
CREATE POLICY "Authenticated users can update blog posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete posts
CREATE POLICY "Authenticated users can delete blog posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured) WHERE featured = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trigger_update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();