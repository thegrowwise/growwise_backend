-- Supabase PostgreSQL Schema for Course Enrollments
-- Run this SQL in your Supabase SQL Editor to create the enrollments table

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  city TEXT NOT NULL,
  postal TEXT NOT NULL,
  bootcamp TEXT,
  course TEXT,
  level TEXT NOT NULL,
  agree BOOLEAN NOT NULL DEFAULT false,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  status TEXT DEFAULT 'pending', -- pending, contacted, enrolled, declined
  notes TEXT, -- Internal notes
  business_email_sent BOOLEAN DEFAULT false,
  user_email_sent BOOLEAN DEFAULT false,
  business_email_id TEXT,
  user_email_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_level ON enrollments(level);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON enrollments(created_at DESC);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrollments_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_enrollments_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role to do everything
DROP POLICY IF EXISTS "Service role can manage enrollments" ON enrollments;
CREATE POLICY "Service role can manage enrollments" ON enrollments
    FOR ALL
    USING (true)
    WITH CHECK (true);

