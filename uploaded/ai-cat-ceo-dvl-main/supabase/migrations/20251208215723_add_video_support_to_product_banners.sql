/*
  # Video Dəstəyi Əlavə Et - Məhsul Bannerləri

  1. Dəyişikliklər
    - `home_product_banners` cədvəlinə video_url sahəsi əlavə edilir
    - content_type sahəsi əlavə edilir ('image' və ya 'video')
    - image_url sahəsi nullable edilir çünki video olduqda şəkil olmaya bilər
  
  2. Qeydlər
    - Köhnə bannerlər avtomatik 'image' tipində qalacaq
    - Video bannerlər üçün video_url sahəsinə link qoyulmalıdır
    - Video tam görünsün deyə object-cover istifadə olunacaq
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'home_product_banners' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE home_product_banners ADD COLUMN video_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'home_product_banners' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE home_product_banners ADD COLUMN content_type text DEFAULT 'image' CHECK (content_type IN ('image', 'video'));
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE home_product_banners ALTER COLUMN image_url DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;