-- Migration: Remove foreign key constraint and update RLS policies
-- This allows anonymous users without auth.users entries

-- First, drop all existing RLS policies that depend on user_id
DROP POLICY IF EXISTS "Users can view their own characters" ON characters;
DROP POLICY IF EXISTS "Users can create their own characters" ON characters;
DROP POLICY IF EXISTS "Users can update their own characters" ON characters;
DROP POLICY IF EXISTS "Users can delete their own characters" ON characters;

DROP POLICY IF EXISTS "Users can view their own runs" ON runs;
DROP POLICY IF EXISTS "Users can create runs for their characters" ON runs;
DROP POLICY IF EXISTS "Users can update their own runs" ON runs;
DROP POLICY IF EXISTS "Users can delete their own runs" ON runs;

DROP POLICY IF EXISTS "Users can view their own turn logs" ON turn_logs;
DROP POLICY IF EXISTS "Users can create turn logs for their runs" ON turn_logs;

-- Now drop the foreign key constraint
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_user_id_fkey;

-- For MVP: Disable RLS or use permissive policies since we're using service role
-- Option 1: Disable RLS entirely (simpler for MVP)
ALTER TABLE characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE turn_logs DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled but allow service role access
-- Uncomment these instead of the DISABLE commands above:
-- ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE turn_logs ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow service role full access" ON characters FOR ALL USING (true);
-- CREATE POLICY "Allow service role full access" ON runs FOR ALL USING (true);
-- CREATE POLICY "Allow service role full access" ON turn_logs FOR ALL USING (true);
