/*
  # B2B Endirim Sistemini Genişləndir

  1. Dəyişikliklər
    - `users` cədvəlinə aşağıdakı kolonlar əlavə edilir:
      - `discount_expires_at` - Endirimin bitmə tarixi
      - `discount_usage_type` - Endirim növü (unlimited, once, time_limited)
      - `discount_used` - Endirim istifadə edilib-edilməməsi

  2. Qeydlər
    - unlimited: Limitsiz endirim
    - once: Bir dəfəlik endirim
    - time_limited: Müddətli endirim
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'discount_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN discount_expires_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'discount_usage_type'
  ) THEN
    ALTER TABLE users ADD COLUMN discount_usage_type text DEFAULT 'unlimited';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'discount_used'
  ) THEN
    ALTER TABLE users ADD COLUMN discount_used boolean DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN users.discount_expires_at IS 'Endirimin bitmə tarixi';
COMMENT ON COLUMN users.discount_usage_type IS 'Endirim növü: unlimited, once, time_limited';
COMMENT ON COLUMN users.discount_used IS 'Bir dəfəlik endirim istifadə edilib-edilməməsi';
