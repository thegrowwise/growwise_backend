-- Migration: Add processing_fee column to orders table
-- Run this in your Supabase SQL Editor

-- Add processing_fee column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='processing_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN processing_fee DECIMAL(10, 2) DEFAULT 0;
    RAISE NOTICE 'Added processing_fee column';
  ELSE
    RAISE NOTICE 'processing_fee column already exists';
  END IF;
END $$;

