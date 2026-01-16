-- Database schema for Xianxia RPG
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Characters table (for MVP, user_id is just a UUID without FK to support anonymous users)
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Runs (game sessions/save slots)
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  world_seed TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  current_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turn logs (game history)
CREATE TABLE turn_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  turn_no INTEGER NOT NULL,
  choice_id TEXT,
  narrative TEXT NOT NULL,
  ai_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_runs_character_id ON runs(character_id);
CREATE INDEX idx_turn_logs_run_id ON turn_logs(run_id);
CREATE INDEX idx_turn_logs_turn_no ON turn_logs(run_id, turn_no);

-- Row Level Security (RLS) policies
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_logs ENABLE ROW LEVEL SECURITY;

-- Characters policies
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

-- Runs policies
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

-- Turn logs policies
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
