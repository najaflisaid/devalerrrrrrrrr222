/*
  # Add Company Name and Last Name to B2B Orders

  1. Changes
    - Add `company_name` column to `b2b_orders` table
    - Add `last_name` column to `b2b_orders` table
    - Add `customer_notes` column for customer order notes
    - Add `admin_notes` column for admin notes on orders
    
  2. Notes
    - company_name stores the B2B customer's company
    - last_name stores customer's surname/last name
    - customer_notes allows customers to add notes when confirming order receipt
    - admin_notes allows admin to add notes visible to customers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN company_name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN last_name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'customer_notes'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN customer_notes TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'b2b_orders' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE b2b_orders ADD COLUMN admin_notes TEXT;
  END IF;
END $$;
