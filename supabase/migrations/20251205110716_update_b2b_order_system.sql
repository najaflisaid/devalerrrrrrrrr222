/*
  # B2B Sifariş Statusu və Müştəri İzləmə Sistemi

  1. Yeni Funksionallıqlar
    - B2B istifadəçilərə fərdi endirim faizləri
    - Genişləndirilmiş sifariş statusları
    - Məhsul növü (B2B, Normal, Hər ikisi)

  2. Dəyişikliklər
    - `b2b_users` cədvəlinə `discount_percentage` əlavə edilir
    - Məhsul növü üçün metadata
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'b2b_users' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE b2b_users ADD COLUMN discount_percentage decimal(5, 2) DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS b2b_customer_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  discount_percentage decimal(5, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_email)
);

ALTER TABLE b2b_customer_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "B2B users can view own discount"
  ON b2b_customer_discounts FOR SELECT
  TO authenticated
  USING (customer_email = auth.jwt() ->> 'email');