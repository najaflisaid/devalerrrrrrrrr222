/*
  # Banner Sistemində Video Dəstəyi

  1. Dəyişikliklər
    - `home_product_banners` cədvəlinə video dəstəyi əlavə edilir
      - `media_type` - Media tipi (image və ya video)
      - `video_url` - Video linki (YouTube, Vimeo və s.)
    - `image_url` artıq nullable olur (video olduqda şəkil lazım olmaya bilər)
  
  2. Qeydlər
    - Əgər media_type "video" olarsa, video_url istifadə olunacaq
    - Əgər media_type "image" olarsa, image_url istifadə olunacaq
*/

DO $$
BEGIN
  -- Add media_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'home_product_banners' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE home_product_banners 
    ADD COLUMN media_type text DEFAULT 'image' CHECK (media_type IN ('image', 'video'));
  END IF;

  -- Add video_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'home_product_banners' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE home_product_banners 
    ADD COLUMN video_url text;
  END IF;

  -- Make image_url nullable since video banners don't need images
  ALTER TABLE home_product_banners 
  ALTER COLUMN image_url DROP NOT NULL;
END $$;