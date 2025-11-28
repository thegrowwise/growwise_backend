-- Supabase PostgreSQL Schema for Orders
-- Run this SQL in your Supabase SQL Editor to create/update the orders table

-- First, add new columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  -- Customer contact information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_phone') THEN
    ALTER TABLE orders ADD COLUMN customer_phone TEXT;
  END IF;
  
  -- Address fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_name') THEN
    ALTER TABLE orders ADD COLUMN shipping_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_line1') THEN
    ALTER TABLE orders ADD COLUMN shipping_line1 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_line2') THEN
    ALTER TABLE orders ADD COLUMN shipping_line2 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_city') THEN
    ALTER TABLE orders ADD COLUMN shipping_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_state') THEN
    ALTER TABLE orders ADD COLUMN shipping_state TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_postal_code') THEN
    ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_country') THEN
    ALTER TABLE orders ADD COLUMN shipping_country TEXT;
  END IF;
  
  -- Tax information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_amount') THEN
    ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(10, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_rate') THEN
    ALTER TABLE orders ADD COLUMN tax_rate DECIMAL(5, 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_id') THEN
    ALTER TABLE orders ADD COLUMN tax_id TEXT;
  END IF;
  
  -- Processing fee
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='processing_fee') THEN
    ALTER TABLE orders ADD COLUMN processing_fee DECIMAL(10, 2) DEFAULT 0;
  END IF;
  
  -- Remove old JSONB columns if they exist (optional - comment out if you want to keep them)
  -- ALTER TABLE orders DROP COLUMN IF EXISTS customer_details;
  -- ALTER TABLE orders DROP COLUMN IF EXISTS shipping_details;
END $$;

-- Create the table if it doesn't exist (for new installations)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  items JSONB NOT NULL,
  
  -- Customer information
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  
  -- Shipping address (individual fields)
  shipping_name TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,
  
  -- Tax information
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 4),
  tax_id TEXT,
  
  -- Processing fee (3.5% of subtotal, calculated server-side)
  processing_fee DECIMAL(10, 2) DEFAULT 0,
  
  -- Optional: Metadata for extra/unstructured data
  metadata JSONB,
  
  -- Payment information
  locale TEXT DEFAULT 'en',
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  amount_paid DECIMAL(10, 2),
  
  -- Stripe information
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_country ON orders(shipping_country);

-- Add unique constraint on stripe_session_id to prevent duplicate payment processing
-- This ensures each Stripe session can only be associated with one order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_stripe_session_id_unique' 
    AND conrelid = 'orders'::regclass
  ) THEN
    -- Only add unique constraint if stripe_session_id is not null
    -- We'll use a partial unique index instead
    CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_unique 
    ON orders(stripe_session_id) 
    WHERE stripe_session_id IS NOT NULL;
  END IF;
END $$;

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role to do everything
-- In production, you may want more restrictive policies
DROP POLICY IF EXISTS "Service role can manage orders" ON orders;
CREATE POLICY "Service role can manage orders" ON orders
    FOR ALL
    USING (true)
    WITH CHECK (true);
