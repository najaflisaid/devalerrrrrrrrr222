/*
  # Banner Storage Bucket

  1. Storage
    - Create public 'banners' bucket for banner images
    - Configure public access for image display
  
  2. Security
    - Enable authenticated users to upload
    - Public read access for all users
*/

-- Create banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload banners'
  ) THEN
    CREATE POLICY "Authenticated users can upload banners"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'banners');
  END IF;
END $$;

-- Allow authenticated users to update their uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update banners'
  ) THEN
    CREATE POLICY "Authenticated users can update banners"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'banners');
  END IF;
END $$;

-- Allow authenticated users to delete banners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete banners'
  ) THEN
    CREATE POLICY "Authenticated users can delete banners"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'banners');
  END IF;
END $$;

-- Allow public to view banners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view banners'
  ) THEN
    CREATE POLICY "Public can view banners"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'banners');
  END IF;
END $$;
