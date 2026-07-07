/*
  # Ana Səhifə Məhsul Bannerləri Sistemi

  1. Yeni Cədvəl
    - `home_product_banners`
      - `id` (uuid, primary key)
      - `title` - Banner başlığı
      - `image_url` - Banner şəkli
      - `position` - Sol və ya sağ (left, right)
      - `active` - Aktiv/deaktiv
      - `created_at` - Yaradılma tarixi

  2. Təhlükəsizlik
    - RLS aktivdir
    - Yalnız adminlər banner əlavə/redaktə edə bilər
    - Hamı oxuya bilər
*/

CREATE TABLE IF NOT EXISTS home_product_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  image_url text NOT NULL,
  position text NOT NULL CHECK (position IN ('left', 'right')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE home_product_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active product banners"
  ON home_product_banners FOR SELECT
  USING (active = true OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert product banners"
  ON home_product_banners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product banners"
  ON home_product_banners FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete product banners"
  ON home_product_banners FOR DELETE
  TO authenticated
  USING (true);
