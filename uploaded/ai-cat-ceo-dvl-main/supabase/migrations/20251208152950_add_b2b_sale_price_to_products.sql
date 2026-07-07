/*
  # Add B2B Sale Price to Products

  1. Changes
    - Add `b2b_sale_price` column to products table for B2B discounted pricing

  2. Details
    - Column: b2b_sale_price (decimal, nullable)
    - Allows setting a discounted price specifically for B2B customers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'b2b_sale_price'
  ) THEN
    ALTER TABLE products ADD COLUMN b2b_sale_price decimal(10,2);
  END IF;
END $$;