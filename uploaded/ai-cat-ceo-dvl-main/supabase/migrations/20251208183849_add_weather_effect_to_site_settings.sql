/*
  # Add Weather Effect Support to Site Settings

  1. Changes
    - Add `weather_effect` column to `site_settings` table
      - Type: text
      - Values: 'none', 'snow', 'rain'
      - Default: 'none'
    - This allows dynamic weather effects across all pages

  2. Notes
    - When `weather_effect` is set to 'snow', snow animation appears
    - When `weather_effect` is set to 'rain', rain animation appears
    - When `weather_effect` is set to 'none', no weather effects appear
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'weather_effect'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN weather_effect text DEFAULT 'none' CHECK (weather_effect IN ('none', 'snow', 'rain'));
  END IF;
END $$;
