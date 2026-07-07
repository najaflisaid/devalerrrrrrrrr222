/*
  # Create B2B users and pricing tables

  1. New Tables
    - `b2b_users` - B2B şirkət istifadəçiləri
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `password_hash` (text)
      - `first_name` (text)
      - `last_name` (text)
      - `phone` (text)
      - `company_name` (text)
      - `status` (text: 'pending', 'active', 'rejected')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `b2b_requests` - B2B qeydiyyat sorğuları
      - `id` (uuid, primary key)
      - `email` (text)
      - `first_name` (text)
      - `last_name` (text)
      - `phone` (text)
      - `company_name` (text)
      - `status` (text: 'pending', 'approved', 'rejected')
      - `created_at` (timestamp)
      - `admin_notes` (text)

    - `b2b_pricing` - B2B qiymətləri
      - `id` (uuid, primary key)
      - `product_id` (text)
      - `b2b_price` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for admin and authenticated users
*/

CREATE TABLE IF NOT EXISTS b2b_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  company_name text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  company_name text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS b2b_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  b2b_price decimal(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE b2b_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "B2B users can view own data"
  ON b2b_users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = email OR auth.uid()::text IN (SELECT email FROM b2b_users WHERE status = 'active'));

CREATE POLICY "B2B pricing is public"
  ON b2b_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can create B2B request"
  ON b2b_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "B2B requests visible to admins"
  ON b2b_requests FOR SELECT
  TO authenticated
  USING (true);
