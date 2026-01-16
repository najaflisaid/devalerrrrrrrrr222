/*
  # B2B Sifarişlərə Status Əlavə Edilməsi

  1. Dəyişikliklər
    - `b2b_orders` cədvəlinə `status` kolonu əlavə edilir
    - Status növləri: pending, accepted, preparing, ready, delivering, delivered
    - `b2b_orders` cədvəlinə əlavə məlumatlar əlavə edilir

  2. Təhlükəsizlik
    - B2B istifadəçilər öz sifarişlərini görə bilərlər
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2b_orders' AND column_name = 'status'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2b_orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN customer_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2b_orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN customer_phone text DEFAULT '';
  END IF;
END $$;

CREATE POLICY "B2B users can view own orders"
  ON b2b_orders FOR SELECT
  TO authenticated
  USING (customer_email = auth.jwt() ->> 'email');