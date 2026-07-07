/*
  # Complete Database Schema for De Valeur

  1. New Tables
    - `users` - User accounts (customers, b2b, admin)
    - `products` - Product catalog
    - `b2b_orders` - B2B customer orders
    - `banners` - Homepage and products page banners
    - `categories` - Product categories
    - `brands` - Product brands

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each user role

  3. Important Notes
    - coming_soon field added to products for upcoming items
    - B2B orders stored in database with full customer info
    - Banners manageable from admin panel
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name jsonb NOT NULL DEFAULT '{"az": "", "ru": ""}'::jsonb,
  slug text UNIQUE NOT NULL,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  logo_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name jsonb NOT NULL DEFAULT '{"az": "", "ru": ""}'::jsonb,
  description jsonb DEFAULT '{"az": "", "ru": ""}'::jsonb,
  price decimal(10,2) NOT NULL,
  sale_price decimal(10,2),
  b2b_price decimal(10,2),
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  category_id uuid REFERENCES categories(id),
  brand_id uuid REFERENCES brands(id),
  coming_soon boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create b2b_orders table
CREATE TABLE IF NOT EXISTS b2b_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  discount_amount decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create banners table
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title jsonb DEFAULT '{"az": "", "ru": ""}'::jsonb,
  link text,
  position text NOT NULL DEFAULT 'home',
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Categories Policies
CREATE POLICY "Everyone can view active categories"
  ON categories FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Brands Policies
CREATE POLICY "Everyone can view active brands"
  ON brands FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can manage brands"
  ON brands FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Products Policies
CREATE POLICY "Everyone can view active products (not coming soon)"
  ON products FOR SELECT
  TO public
  USING (active = true AND coming_soon = false);

CREATE POLICY "B2B users can view all active products including coming soon"
  ON products FOR SELECT
  TO authenticated
  USING (
    active = true AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'b2b' OR users.role = 'admin')
    )
  );

CREATE POLICY "Admins can manage all products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- B2B Orders Policies
CREATE POLICY "Admins can view all B2B orders"
  ON b2b_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "B2B users can create orders"
  ON b2b_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'b2b'
    )
  );

CREATE POLICY "Admins can manage B2B orders"
  ON b2b_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Banners Policies
CREATE POLICY "Everyone can view active banners"
  ON banners FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can manage all banners"
  ON banners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_coming_soon ON products(coming_soon) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON b2b_orders(status);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_created_at ON b2b_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_user ON b2b_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_banners_position_active ON banners(position, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(order_index);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_b2b_orders_updated_at
  BEFORE UPDATE ON b2b_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
