-- ============================================
-- COMPREHENSIVE SECURITY FIXES FOR XIANXIA RPG
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. FIX FUNCTION SEARCH PATHS
-- ============================================

-- Fix update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix calculate_total_wealth function
DROP FUNCTION IF EXISTS public.calculate_total_wealth(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.calculate_total_wealth(p_silver INTEGER, p_spirit_stones INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN p_silver + (p_spirit_stones * 100);
END;
$$;

-- Fix update_player_statistics function
DROP FUNCTION IF EXISTS public.update_player_statistics();

CREATE OR REPLACE FUNCTION public.update_player_statistics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. PLAYER STATISTICS RPC FUNCTIONS
-- ============================================

-- Drop existing policies that cause RLS issues
DROP POLICY IF EXISTS "Users can insert their own statistics" ON player_statistics;
DROP POLICY IF EXISTS "Users can update their own statistics" ON player_statistics;

-- Function for authenticated users (checks ownership)
CREATE OR REPLACE FUNCTION public.upsert_player_statistics(
  p_run_id UUID,
  p_character_name TEXT,
  p_current_realm TEXT,
  p_realm_stage INTEGER,
  p_total_wealth INTEGER DEFAULT 0,
  p_total_combat_wins INTEGER DEFAULT 0,
  p_total_deaths INTEGER DEFAULT 0,
  p_highest_cultivation_exp INTEGER DEFAULT 0,
  p_play_time_minutes INTEGER DEFAULT 0,
  p_achievements_count INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_stat_id UUID;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  -- Check authorization
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  -- Upsert the statistics
  INSERT INTO public.player_statistics (
    run_id, character_name, current_realm, realm_stage,
    total_wealth, total_combat_wins, total_deaths,
    highest_cultivation_exp, play_time_minutes, achievements_count, updated_at
  )
  VALUES (
    p_run_id, p_character_name, p_current_realm, p_realm_stage,
    p_total_wealth, p_total_combat_wins, p_total_deaths,
    p_highest_cultivation_exp, p_play_time_minutes, p_achievements_count, NOW()
  )
  ON CONFLICT (run_id) DO UPDATE SET
    character_name = EXCLUDED.character_name,
    current_realm = EXCLUDED.current_realm,
    realm_stage = EXCLUDED.realm_stage,
    total_wealth = EXCLUDED.total_wealth,
    total_combat_wins = EXCLUDED.total_combat_wins,
    total_deaths = EXCLUDED.total_deaths,
    highest_cultivation_exp = EXCLUDED.highest_cultivation_exp,
    play_time_minutes = EXCLUDED.play_time_minutes,
    achievements_count = EXCLUDED.achievements_count,
    updated_at = NOW()
  RETURNING id INTO v_stat_id;

  RETURN v_stat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_player_statistics(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

-- Admin function for service role (no auth check)
CREATE OR REPLACE FUNCTION public.upsert_player_statistics_admin(
  p_run_id UUID,
  p_character_name TEXT,
  p_current_realm TEXT,
  p_realm_stage INTEGER,
  p_total_wealth INTEGER DEFAULT 0,
  p_total_combat_wins INTEGER DEFAULT 0,
  p_total_deaths INTEGER DEFAULT 0,
  p_highest_cultivation_exp INTEGER DEFAULT 0,
  p_play_time_minutes INTEGER DEFAULT 0,
  p_achievements_count INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stat_id UUID;
BEGIN
  INSERT INTO public.player_statistics (
    run_id, character_name, current_realm, realm_stage,
    total_wealth, total_combat_wins, total_deaths,
    highest_cultivation_exp, play_time_minutes, achievements_count, updated_at
  )
  VALUES (
    p_run_id, p_character_name, p_current_realm, p_realm_stage,
    p_total_wealth, p_total_combat_wins, p_total_deaths,
    p_highest_cultivation_exp, p_play_time_minutes, p_achievements_count, NOW()
  )
  ON CONFLICT (run_id) DO UPDATE SET
    character_name = EXCLUDED.character_name,
    current_realm = EXCLUDED.current_realm,
    realm_stage = EXCLUDED.realm_stage,
    total_wealth = EXCLUDED.total_wealth,
    total_combat_wins = EXCLUDED.total_combat_wins,
    total_deaths = EXCLUDED.total_deaths,
    highest_cultivation_exp = EXCLUDED.highest_cultivation_exp,
    play_time_minutes = EXCLUDED.play_time_minutes,
    achievements_count = EXCLUDED.achievements_count,
    updated_at = NOW()
  RETURNING id INTO v_stat_id;

  RETURN v_stat_id;
END;
$$;

-- Only service_role can use admin function
REVOKE EXECUTE ON FUNCTION public.upsert_player_statistics_admin(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_player_statistics_admin(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;

-- ============================================
-- 3. INVENTORY SYNC RPC FUNCTIONS
-- ============================================

-- Define composite types for inventory sync
DO $$
BEGIN
  -- Drop existing types if they exist
  DROP TYPE IF EXISTS inventory_item_input CASCADE;
  DROP TYPE IF EXISTS equipped_item_input CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TYPE inventory_item_input AS (
  item_id TEXT,
  item_data JSONB,
  quantity INTEGER
);

CREATE TYPE equipped_item_input AS (
  slot TEXT,
  item_data JSONB
);

-- Function for authenticated users (checks ownership)
CREATE OR REPLACE FUNCTION public.sync_character_inventory(
  p_run_id UUID,
  p_inventory_items JSONB DEFAULT '[]'::jsonb,
  p_equipped_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_item JSONB;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  -- Clear existing inventory
  DELETE FROM public.character_inventory WHERE run_id = p_run_id;
  DELETE FROM public.character_equipment WHERE run_id = p_run_id;

  -- Insert inventory items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    INSERT INTO public.character_inventory (run_id, item_id, item_data, quantity, is_equipped, equipped_slot)
    VALUES (
      p_run_id,
      v_item->>'item_id',
      v_item->'item_data',
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      false,
      NULL
    );
  END LOOP;

  -- Insert equipped items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_equipped_items)
  LOOP
    INSERT INTO public.character_equipment (run_id, slot, item_data, inventory_item_id)
    VALUES (
      p_run_id,
      v_item->>'slot',
      v_item->'item_data',
      NULL
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_character_inventory(UUID, JSONB, JSONB) TO authenticated;

-- Admin function for service role (no auth check)
CREATE OR REPLACE FUNCTION public.sync_character_inventory_admin(
  p_run_id UUID,
  p_inventory_items JSONB DEFAULT '[]'::jsonb,
  p_equipped_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- Clear existing inventory
  DELETE FROM public.character_inventory WHERE run_id = p_run_id;
  DELETE FROM public.character_equipment WHERE run_id = p_run_id;

  -- Insert inventory items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    INSERT INTO public.character_inventory (run_id, item_id, item_data, quantity, is_equipped, equipped_slot)
    VALUES (
      p_run_id,
      v_item->>'item_id',
      v_item->'item_data',
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      false,
      NULL
    );
  END LOOP;

  -- Insert equipped items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_equipped_items)
  LOOP
    INSERT INTO public.character_equipment (run_id, slot, item_data, inventory_item_id)
    VALUES (
      p_run_id,
      v_item->>'slot',
      v_item->'item_data',
      NULL
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_character_inventory_admin(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_character_inventory_admin(UUID, JSONB, JSONB) TO service_role;

-- ============================================
-- 4. FIX AUCTION RLS POLICIES
-- ============================================

-- Fix auction_bids UPDATE policy
DROP POLICY IF EXISTS "System can update winning bids" ON auction_bids;
DROP POLICY IF EXISTS "Users can update their own bids" ON auction_bids;

CREATE POLICY "Users can update their own bids"
  ON auction_bids FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.runs
      JOIN public.characters ON runs.character_id = characters.id
      WHERE runs.id = auction_bids.run_id
      AND characters.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.runs
      JOIN public.characters ON runs.character_id = characters.id
      WHERE runs.id = auction_bids.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Admin function for marking winning bids
CREATE OR REPLACE FUNCTION public.mark_winning_bid(p_bid_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.auction_bids
  SET is_winning = true
  WHERE id = p_bid_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_winning_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_winning_bid(UUID) TO service_role;

-- Fix auction_events INSERT policy
DROP POLICY IF EXISTS "Users can create auction events" ON auction_events;

-- Admin function for creating auction events
CREATE OR REPLACE FUNCTION public.create_auction_event(
  p_world_seed TEXT,
  p_auction_year INTEGER,
  p_start_date JSONB,
  p_end_date JSONB,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auction_id UUID;
BEGIN
  INSERT INTO public.auction_events (world_seed, auction_year, start_date, end_date, items)
  VALUES (p_world_seed, p_auction_year, p_start_date, p_end_date, p_items)
  ON CONFLICT (world_seed, auction_year) DO UPDATE
    SET items = EXCLUDED.items,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date
  RETURNING id INTO v_auction_id;

  RETURN v_auction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_auction_event(TEXT, INTEGER, JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auction_event(TEXT, INTEGER, JSONB, JSONB, JSONB) TO service_role;

-- ============================================
-- 5. COMBAT HISTORY RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.record_combat_history(
  p_run_id UUID,
  p_enemy_id TEXT,
  p_enemy_name TEXT,
  p_victory BOOLEAN,
  p_player_damage_dealt INTEGER DEFAULT 0,
  p_player_damage_taken INTEGER DEFAULT 0,
  p_rewards JSONB DEFAULT '{}'::jsonb,
  p_combat_date JSONB DEFAULT '{}'::jsonb,
  p_turn_no INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_combat_id UUID;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  INSERT INTO public.combat_history (
    run_id, enemy_id, enemy_name, victory,
    player_damage_dealt, player_damage_taken,
    rewards, combat_date, turn_no
  )
  VALUES (
    p_run_id, p_enemy_id, p_enemy_name, p_victory,
    p_player_damage_dealt, p_player_damage_taken,
    p_rewards, p_combat_date, p_turn_no
  )
  RETURNING id INTO v_combat_id;

  RETURN v_combat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_history(UUID, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER, JSONB, JSONB, INTEGER) TO authenticated;

-- ============================================
-- 6. MARKET TRANSACTION RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.record_market_transaction(
  p_run_id UUID,
  p_transaction_type TEXT,
  p_item_id TEXT,
  p_item_name TEXT,
  p_quantity INTEGER,
  p_price_silver INTEGER DEFAULT 0,
  p_price_spirit_stones INTEGER DEFAULT 0,
  p_transaction_date JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  INSERT INTO public.market_transactions (
    run_id, transaction_type, item_id, item_name,
    quantity, price_silver, price_spirit_stones, transaction_date
  )
  VALUES (
    p_run_id, p_transaction_type, p_item_id, p_item_name,
    p_quantity, p_price_silver, p_price_spirit_stones, p_transaction_date
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_market_transaction(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, JSONB) TO authenticated;

-- ============================================
-- 7. SKILLS & TECHNIQUES SYNC RPC FUNCTIONS
-- ============================================

-- Function to sync character skills
CREATE OR REPLACE FUNCTION public.sync_character_skills(
  p_run_id UUID,
  p_skills JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_skill JSONB;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  -- Clear existing skills
  DELETE FROM public.character_skills WHERE run_id = p_run_id;

  -- Insert skills
  FOR v_skill IN SELECT * FROM jsonb_array_elements(p_skills)
  LOOP
    INSERT INTO public.character_skills (run_id, skill_id, skill_data, current_level, experience)
    VALUES (
      p_run_id,
      v_skill->>'skill_id',
      v_skill->'skill_data',
      COALESCE((v_skill->>'current_level')::INTEGER, 1),
      0
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_character_skills(UUID, JSONB) TO authenticated;

-- Admin function for service role (no auth check)
CREATE OR REPLACE FUNCTION public.sync_character_skills_admin(
  p_run_id UUID,
  p_skills JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_skill JSONB;
BEGIN
  -- Clear existing skills
  DELETE FROM public.character_skills WHERE run_id = p_run_id;

  -- Insert skills
  FOR v_skill IN SELECT * FROM jsonb_array_elements(p_skills)
  LOOP
    INSERT INTO public.character_skills (run_id, skill_id, skill_data, current_level, experience)
    VALUES (
      p_run_id,
      v_skill->>'skill_id',
      v_skill->'skill_data',
      COALESCE((v_skill->>'current_level')::INTEGER, 1),
      0
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_character_skills_admin(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_character_skills_admin(UUID, JSONB) TO service_role;

-- Function to sync character techniques
CREATE OR REPLACE FUNCTION public.sync_character_techniques(
  p_run_id UUID,
  p_techniques JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_technique JSONB;
BEGIN
  -- Verify the user owns this run
  SELECT c.user_id INTO v_user_id
  FROM public.runs r
  JOIN public.characters c ON r.character_id = c.id
  WHERE r.id = p_run_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: You do not own this run';
  END IF;

  -- Clear existing techniques
  DELETE FROM public.character_techniques WHERE run_id = p_run_id;

  -- Insert techniques
  FOR v_technique IN SELECT * FROM jsonb_array_elements(p_techniques)
  LOOP
    INSERT INTO public.character_techniques (run_id, technique_id, technique_data, mastery_level)
    VALUES (
      p_run_id,
      v_technique->>'technique_id',
      v_technique->'technique_data',
      COALESCE((v_technique->>'mastery_level')::INTEGER, 1)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_character_techniques(UUID, JSONB) TO authenticated;

-- Admin function for service role (no auth check)
CREATE OR REPLACE FUNCTION public.sync_character_techniques_admin(
  p_run_id UUID,
  p_techniques JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_technique JSONB;
BEGIN
  -- Clear existing techniques
  DELETE FROM public.character_techniques WHERE run_id = p_run_id;

  -- Insert techniques
  FOR v_technique IN SELECT * FROM jsonb_array_elements(p_techniques)
  LOOP
    INSERT INTO public.character_techniques (run_id, technique_id, technique_data, mastery_level)
    VALUES (
      p_run_id,
      v_technique->>'technique_id',
      v_technique->'technique_data',
      COALESCE((v_technique->>'mastery_level')::INTEGER, 1)
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_character_techniques_admin(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_character_techniques_admin(UUID, JSONB) TO service_role;

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- List all functions with their settings
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.proconfig as config,
  p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'update_updated_at_column',
  'calculate_total_wealth',
  'update_player_statistics',
  'upsert_player_statistics',
  'upsert_player_statistics_admin',
  'sync_character_inventory',
  'sync_character_inventory_admin',
  'sync_character_skills',
  'sync_character_skills_admin',
  'sync_character_techniques',
  'sync_character_techniques_admin',
  'mark_winning_bid',
  'create_auction_event',
  'record_combat_history',
  'record_market_transaction'
);

-- List RLS policies on critical tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('player_statistics', 'auction_bids', 'auction_events', 'character_inventory', 'character_equipment');
