/*
  # Add customer signature to B2B orders

  1. Changes
    - Add `signature` column to `b2b_orders` table to store customer signature as base64 image
    - Add `signed_at` column to track when the signature was added
  
  2. Security
    - No changes to RLS policies needed - existing policies cover the new columns
*/

DO $$
BEGIN
  -- Add signature column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'signature'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN signature TEXT;
  END IF;

  -- Add signed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN signed_at TIMESTAMPTZ;
  END IF;
END $$;