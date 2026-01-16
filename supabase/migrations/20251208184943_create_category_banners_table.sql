/*
  # Create Category Banners System

  1. New Tables
    - `category_banners`
      - `id` (uuid, primary key)
      - `category` (text) - Category slug (electronics, clothing, home-garden, etc.)
      - `image_url` (text) - Banner image URL
      - `title_az` (text) - Banner title in Azerbaijani
      - `title_ru` (text) - Banner title in Russian
      - `title_en` (text) - Banner title in English
      - `subtitle_az` (text) - Banner subtitle in Azerbaijani
      - `subtitle_ru` (text) - Banner subtitle in Russian
      - `subtitle_en` (text) - Banner subtitle in English
      - `is_active` (boolean) - Whether banner is active
      - `display_order` (integer) - Order of display
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `category_banners` table
    - Add policy for public read access
    - Add policy for authenticated admin write access

  3. Storage
    - Create bucket for category banner images
*/

-- Create category_banners table
CREATE TABLE IF NOT EXISTS category_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  image_url text NOT NULL,
  title_az text DEFAULT '',
  title_ru text DEFAULT '',
  title_en text DEFAULT '',
  subtitle_az text DEFAULT '',
  subtitle_ru text DEFAULT '',
  subtitle_en text DEFAULT '',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE category_banners ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Anyone can view active category banners"
  ON category_banners
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy for authenticated users to view all banners
CREATE POLICY "Authenticated users can view all category banners"
  ON category_banners
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert banners
CREATE POLICY "Authenticated users can insert category banners"
  ON category_banners
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update banners
CREATE POLICY "Authenticated users can update category banners"
  ON category_banners
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to delete banners
CREATE POLICY "Authenticated users can delete category banners"
  ON category_banners
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for category banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-banners', 'category-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for category banners
CREATE POLICY "Anyone can view category banner images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'category-banners');

CREATE POLICY "Authenticated users can upload category banner images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'category-banners');

CREATE POLICY "Authenticated users can update category banner images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'category-banners')
  WITH CHECK (bucket_id = 'category-banners');

CREATE POLICY "Authenticated users can delete category banner images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'category-banners');
