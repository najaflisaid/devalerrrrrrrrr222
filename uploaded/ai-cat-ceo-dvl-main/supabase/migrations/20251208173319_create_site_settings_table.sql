/*
  # Site Settings Table for Theme Management

  1. New Tables
    - `site_settings`
      - `id` (uuid, primary key)
      - `new_year_theme_enabled` (boolean) - Controls whether New Year theme is active
      - `updated_at` (timestamptz) - Last update time
      - `created_at` (timestamptz) - Creation time

  2. Security
    - Enable RLS on `site_settings` table
    - Add policy for public read access
    - Add policy for authenticated admin users to update settings

  3. Initial Data
    - Insert default settings row with new year theme disabled
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  new_year_theme_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON site_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only authenticated users can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO site_settings (new_year_theme_enabled)
VALUES (false)
ON CONFLICT DO NOTHING;