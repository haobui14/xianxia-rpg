-- Migration: Re-enable authentication with proper foreign keys
-- This reverses the previous anonymous user setup and enables proper Google OAuth

-- Step 1: Clear any existing test data (optional - comment out if you want to keep data)
TRUNCATE turn_logs, runs, characters CASCADE;

-- Step 2: Re-enable RLS on all tables
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: Add foreign key constraint back to auth.users
ALTER TABLE characters 
  ADD CONSTRAINT characters_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 4: Create RLS policies for characters
CREATE POLICY "Users can view their own characters"
  ON characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own characters"
  ON characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Create RLS policies for runs
CREATE POLICY "Users can view their own runs"
  ON runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = runs.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create runs for their characters"
  ON runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = runs.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own runs"
  ON runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = runs.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own runs"
  ON runs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = runs.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- Step 6: Create RLS policies for turn_logs
CREATE POLICY "Users can view their own turn logs"
  ON turn_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = turn_logs.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create turn logs for their runs"
  ON turn_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = turn_logs.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Done! Now your database is ready for authenticated users with Google OAuth
