/*
  # Add Discount Price to Products

  1. Changes
    - Add `discount_price` column to `products` table (nullable decimal)
    - This allows admin to set a discounted price for products
    - If discount_price is set, it will be displayed instead of regular price
    
  2. Notes
    - discount_price is optional (can be NULL)
    - When discount_price is NULL, regular price is used
    - When discount_price is set, both prices are shown (original crossed out, discount highlighted)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'discount_price'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_price DECIMAL(10,2);
  END IF;
END $$;
