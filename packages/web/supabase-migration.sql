-- ═══════════════════════════════════════════════════════════════════════
-- SUPABASE SQL MIGRATION — No Auth, Global Sync
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════

-- Drop old tables if they exist (from previous auth-based setup)
DROP TABLE IF EXISTS calculator_data CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 1. Global calculator data table (single-row, shared across all devices)
CREATE TABLE IF NOT EXISTS calculator_data (
    id TEXT PRIMARY KEY DEFAULT 'global',
    categories JSONB DEFAULT '[]',
    input_definitions JSONB DEFAULT '[]',
    input_groups JSONB DEFAULT '[]',
    calculators JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the initial global row
INSERT INTO calculator_data (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS but allow anonymous access (anon key can read/write)
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;

-- Allow anyone with the anon key to SELECT
CREATE POLICY "Allow public read" ON calculator_data
    FOR SELECT USING (true);

-- Allow anyone with the anon key to INSERT
CREATE POLICY "Allow public insert" ON calculator_data
    FOR INSERT WITH CHECK (true);

-- Allow anyone with the anon key to UPDATE
CREATE POLICY "Allow public update" ON calculator_data
    FOR UPDATE USING (true);

-- Allow anyone with the anon key to DELETE
CREATE POLICY "Allow public delete" ON calculator_data
    FOR DELETE USING (true);

-- 4. Enable Realtime on this table for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE calculator_data;
