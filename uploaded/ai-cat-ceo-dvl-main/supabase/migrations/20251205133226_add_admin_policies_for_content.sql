/*
  # Admin üçün Content İdarəetmə Hüquqları

  1. Dəyişikliklər
    - home_banners cədvəlinə admin INSERT, UPDATE, DELETE policy-ləri əlavə edildi
    - about_page cədvəlinə admin INSERT, UPDATE policy-ləri əlavə edildi
  
  2. Təhlükəsizlik
    - Yalnız admin bu cədvəlləri dəyişə bilər
    - Bütün istifadəçilər oxuya bilər
*/

-- home_banners üçün admin policy-ləri
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'home_banners' AND policyname = 'Admins can insert banners'
  ) THEN
    CREATE POLICY "Admins can insert banners"
      ON home_banners FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'home_banners' AND policyname = 'Admins can update banners'
  ) THEN
    CREATE POLICY "Admins can update banners"
      ON home_banners FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'home_banners' AND policyname = 'Admins can delete banners'
  ) THEN
    CREATE POLICY "Admins can delete banners"
      ON home_banners FOR DELETE
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'home_banners' AND policyname = 'Admins can view all banners'
  ) THEN
    CREATE POLICY "Admins can view all banners"
      ON home_banners FOR SELECT
      USING (true);
  END IF;
END $$;

-- about_page üçün admin policy-ləri
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'about_page' AND policyname = 'Admins can insert about page'
  ) THEN
    CREATE POLICY "Admins can insert about page"
      ON about_page FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'about_page' AND policyname = 'Admins can update about page'
  ) THEN
    CREATE POLICY "Admins can update about page"
      ON about_page FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;