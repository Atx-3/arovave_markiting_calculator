-- ═══════════════════════════════════════════════════════════════════════
-- SUPABASE SQL MIGRATION — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Profiles table (auto-created for each user on signup)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Calculator data table (one row per user, stores entire state as JSON)
CREATE TABLE IF NOT EXISTS calculator_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    categories JSONB DEFAULT '[]',
    input_definitions JSONB DEFAULT '[]',
    input_groups JSONB DEFAULT '[]',
    calculators JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;

-- Profiles: view + update own
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Calculator data: full CRUD on own data
CREATE POLICY "Users can view own data" ON calculator_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON calculator_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON calculator_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON calculator_data
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_calculator_data_user_id ON calculator_data(user_id);
