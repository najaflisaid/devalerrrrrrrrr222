/*
  # Banner və Haqqımızda Səhifəsi İdarəetmə Sistemi

  1. Yeni Cədvəllər
    - `home_banners` - Ana səhifə bannerləri
      - `id` (uuid, primary key)
      - `title_az` (text)
      - `title_ru` (text)
      - `title_en` (text)
      - `subtitle_az` (text)
      - `subtitle_ru` (text)
      - `subtitle_en` (text)
      - `image_url` (text)
      - `link_url` (text)
      - `order_position` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `about_page` - Haqqımızda səhifəsi məzmunu
      - `id` (uuid, primary key)
      - `title_az` (text)
      - `title_ru` (text)
      - `title_en` (text)
      - `content_az` (text)
      - `content_ru` (text)
      - `content_en` (text)
      - `image_url` (text)
      - `updated_at` (timestamptz)

  2. Təhlükəsizlik
    - RLS aktivləşdirilmiş
    - Hamı oxuya bilər
    - Yalnız admin dəyişə bilər
*/

CREATE TABLE IF NOT EXISTS home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_az text NOT NULL DEFAULT '',
  title_ru text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  subtitle_az text DEFAULT '',
  subtitle_ru text DEFAULT '',
  subtitle_en text DEFAULT '',
  image_url text NOT NULL,
  link_url text DEFAULT '/products',
  order_position integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS about_page (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_az text NOT NULL DEFAULT 'Haqqımızda',
  title_ru text NOT NULL DEFAULT 'О нас',
  title_en text NOT NULL DEFAULT 'About Us',
  content_az text NOT NULL DEFAULT '',
  content_ru text NOT NULL DEFAULT '',
  content_en text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_page ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners"
  ON home_banners FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view about page"
  ON about_page FOR SELECT
  USING (true);

INSERT INTO about_page (title_az, title_ru, title_en, content_az, content_ru, content_en)
VALUES (
  'Haqqımızda',
  'О нас',
  'About Us',
  'De Valeur - premium saat və zərgərlik mağazası',
  'De Valeur - магазин премиум часов и ювелирных изделий',
  'De Valeur - premium watch and jewelry store'
) ON CONFLICT (id) DO NOTHING;