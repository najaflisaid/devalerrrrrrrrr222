/*
  # Remove B2B Pricing System
  
  This migration removes the B2B-specific pricing fields and table from the database.
  From now on, B2B customers will see the regular prices with their discount applied.
  
  1. Changes
    - Drop `b2b_price` column from `products` table
    - Drop `b2b_pricing` table entirely
  
  2. Notes
    - B2B customers will now use regular prices with their discount percentage
    - This simplifies the pricing structure
*/

-- Drop b2b_price column from products
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'b2b_price'
  ) THEN
    ALTER TABLE products DROP COLUMN b2b_price;
  END IF;
END $$;

-- Drop b2b_pricing table
DROP TABLE IF EXISTS b2b_pricing;
