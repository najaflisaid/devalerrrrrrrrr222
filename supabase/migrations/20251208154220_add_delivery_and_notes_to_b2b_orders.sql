/*
  # B2B Sifarişlərə Təslim və Qeyd Funksionallığı

  1. Yeni Sütunlar
    - `delivered_at` - Müştəri sifarişi təslim aldığı zaman
    - `admin_note` - Adminin sifarişə aid qeydi

  2. Təsvir
    - Müştəri "Təslim aldı" düyməsini basanda delivered_at tarixi qeyd edilir
    - Admin sifarişlər panelindən hər sifarişə qeyd yaza bilər
    - Müştəri öz sifarişlər səhifəsində admin qeydini görə bilər
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN admin_note text;
  END IF;
END $$;