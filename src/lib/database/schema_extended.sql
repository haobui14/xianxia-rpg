-- Extended Database Schema for Xianxia RPG
-- This adds normalized tables for better data management
-- Run this AFTER the base schema.sql

-- ============================================
-- ITEMS & INVENTORY MANAGEMENT
-- ============================================

-- Master item templates (for AI reference and consistent generation)
CREATE TABLE IF NOT EXISTS item_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id TEXT UNIQUE NOT NULL, -- e.g., "spirit_herb_ginseng"
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('Consumable', 'Equipment', 'Material', 'Quest')),
  rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
  equipment_slot TEXT CHECK (equipment_slot IN ('Weapon', 'Head', 'Chest', 'Legs', 'Feet', 'Hands', 'Accessory', 'Artifact', 'None')),
  base_stats JSONB DEFAULT '{}',
  effects JSONB DEFAULT '{}',
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character inventory (normalized from JSONB)
CREATE TABLE IF NOT EXISTS character_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, -- References item_templates.item_id
  item_data JSONB NOT NULL, -- Full item data for flexibility
  quantity INTEGER NOT NULL DEFAULT 1,
  is_equipped BOOLEAN DEFAULT false,
  equipped_slot TEXT,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, item_id, is_equipped) -- Allow duplicates only if not equipped
);

-- Character equipment slots (for quick queries)
CREATE TABLE IF NOT EXISTS character_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('Weapon', 'Head', 'Chest', 'Legs', 'Feet', 'Hands', 'Accessory', 'Artifact')),
  inventory_item_id UUID REFERENCES character_inventory(id) ON DELETE SET NULL,
  item_data JSONB NOT NULL, -- Denormalized for performance
  equipped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, slot)
);

-- ============================================
-- MARKET & ECONOMY MANAGEMENT
-- ============================================

-- Market listings (regenerated every 3 months)
CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_seed TEXT NOT NULL, -- Shared across all players in same world seed
  generation_quarter INTEGER NOT NULL, -- year * 4 + quarter (0-3)
  item_id TEXT NOT NULL,
  item_data JSONB NOT NULL,
  price_silver INTEGER DEFAULT 0,
  price_spirit_stones INTEGER DEFAULT 0,
  quantity_available INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(world_seed, generation_quarter, item_id)
);

-- Market transaction history
CREATE TABLE IF NOT EXISTS market_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_silver INTEGER DEFAULT 0,
  price_spirit_stones INTEGER DEFAULT 0,
  transaction_date JSONB NOT NULL, -- {year, month, day}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auction events (every 2 years)
CREATE TABLE IF NOT EXISTS auction_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_seed TEXT NOT NULL,
  auction_year INTEGER NOT NULL,
  start_date JSONB NOT NULL, -- {year, month, day}
  end_date JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(world_seed, auction_year)
);

-- Auction bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID REFERENCES auction_events(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  bid_amount_silver INTEGER DEFAULT 0,
  bid_amount_spirit_stones INTEGER DEFAULT 0,
  bidder_name TEXT NOT NULL, -- Character or AI NPC name
  is_ai_bidder BOOLEAN DEFAULT false,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winning BOOLEAN DEFAULT false
);

-- ============================================
-- SKILLS & TECHNIQUES MANAGEMENT
-- ============================================

-- Skill templates
CREATE TABLE IF NOT EXISTS skill_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('Combat', 'Movement', 'Utility', 'Cultivation')),
  max_level INTEGER DEFAULT 10,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character skills (learned skills with progress)
CREATE TABLE IF NOT EXISTS character_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_data JSONB NOT NULL,
  current_level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, skill_id)
);

-- Cultivation technique templates
CREATE TABLE IF NOT EXISTS technique_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technique_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  grade TEXT NOT NULL,
  requirements JSONB DEFAULT '{}',
  bonuses JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character techniques
CREATE TABLE IF NOT EXISTS character_techniques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  technique_id TEXT NOT NULL,
  technique_data JSONB NOT NULL,
  mastery_level INTEGER DEFAULT 1,
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, technique_id)
);

-- ============================================
-- QUESTS & ACHIEVEMENTS
-- ============================================

-- Quest templates
CREATE TABLE IF NOT EXISTS quest_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quest_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  quest_type TEXT NOT NULL CHECK (quest_type IN ('main', 'side', 'daily', 'sect', 'cultivation')),
  requirements JSONB DEFAULT '{}',
  rewards JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character quests
CREATE TABLE IF NOT EXISTS character_quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  quest_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  icon TEXT,
  points INTEGER DEFAULT 0,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Character achievements
CREATE TABLE IF NOT EXISTS character_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id, achievement_id)
);

-- ============================================
-- RELATIONSHIPS & SECT MANAGEMENT
-- ============================================

-- Sects (cultivation schools)
CREATE TABLE IF NOT EXISTS sects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sect_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  realm_requirement TEXT,
  element_affinity TEXT[],
  benefits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NPC relationships
CREATE TABLE IF NOT EXISTS npc_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  npc_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  npc_name_en TEXT NOT NULL,
  relationship_level INTEGER DEFAULT 0, -- -100 to 100
  relationship_type TEXT DEFAULT 'neutral' CHECK (relationship_type IN ('enemy', 'neutral', 'friendly', 'companion', 'master', 'disciple')),
  first_met_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  interaction_history JSONB DEFAULT '[]',
  UNIQUE(run_id, npc_id)
);

-- ============================================
-- COMBAT & ENCOUNTERS
-- ============================================

-- Enemy templates
CREATE TABLE IF NOT EXISTS enemy_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enemy_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  description_en TEXT,
  realm_level INTEGER NOT NULL,
  base_stats JSONB NOT NULL,
  behavior TEXT DEFAULT 'Balanced' CHECK (behavior IN ('Aggressive', 'Defensive', 'Balanced', 'Flee')),
  loot_table JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Combat history
CREATE TABLE IF NOT EXISTS combat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  enemy_id TEXT NOT NULL,
  enemy_name TEXT NOT NULL,
  victory BOOLEAN NOT NULL,
  player_damage_dealt INTEGER DEFAULT 0,
  player_damage_taken INTEGER DEFAULT 0,
  rewards JSONB DEFAULT '{}',
  combat_date JSONB NOT NULL,
  turn_no INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEADERBOARDS & STATISTICS
-- ============================================

-- Player statistics (for leaderboards)
CREATE TABLE IF NOT EXISTS player_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  current_realm TEXT NOT NULL,
  realm_stage INTEGER NOT NULL,
  total_wealth INTEGER DEFAULT 0, -- Silver equivalent
  total_combat_wins INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  highest_cultivation_exp INTEGER DEFAULT 0,
  play_time_minutes INTEGER DEFAULT 0,
  achievements_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(run_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_character_inventory_run_id ON character_inventory(run_id);
CREATE INDEX idx_character_inventory_item_id ON character_inventory(item_id);
CREATE INDEX idx_character_inventory_equipped ON character_inventory(run_id, is_equipped);

CREATE INDEX idx_character_equipment_run_id ON character_equipment(run_id);
CREATE INDEX idx_character_equipment_slot ON character_equipment(run_id, slot);

CREATE INDEX idx_market_listings_world_seed ON market_listings(world_seed, generation_quarter);
CREATE INDEX idx_market_transactions_run_id ON market_transactions(run_id);

CREATE INDEX idx_auction_events_world_seed ON auction_events(world_seed, status);
CREATE INDEX idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX idx_auction_bids_winning ON auction_bids(auction_id, is_winning);

CREATE INDEX idx_character_skills_run_id ON character_skills(run_id);
CREATE INDEX idx_character_techniques_run_id ON character_techniques(run_id);

CREATE INDEX idx_character_quests_run_id ON character_quests(run_id);
CREATE INDEX idx_character_quests_status ON character_quests(run_id, status);

CREATE INDEX idx_character_achievements_run_id ON character_achievements(run_id);

CREATE INDEX idx_npc_relationships_run_id ON npc_relationships(run_id);
CREATE INDEX idx_combat_history_run_id ON combat_history(run_id);

CREATE INDEX idx_player_statistics_realm ON player_statistics(current_realm, realm_stage);
CREATE INDEX idx_player_statistics_wealth ON player_statistics(total_wealth DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Character inventory policies
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON character_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_inventory.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own inventory"
  ON character_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_inventory.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Character equipment policies
ALTER TABLE character_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own equipment"
  ON character_equipment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_equipment.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own equipment"
  ON character_equipment FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_equipment.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Market listings are public (read-only for users)
ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market listings"
  ON market_listings FOR SELECT
  TO authenticated
  USING (true);

-- Market transactions policies
ALTER TABLE market_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON market_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = market_transactions.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own transactions"
  ON market_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = market_transactions.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Similar RLS policies for other tables...
-- (Quest, Skills, Combat History, etc.)

ALTER TABLE character_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own skills"
  ON character_skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_skills.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE character_techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own techniques"
  ON character_techniques FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_techniques.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE character_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own quests"
  ON character_quests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_quests.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE character_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements"
  ON character_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = character_achievements.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE npc_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their NPC relationships"
  ON npc_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = npc_relationships.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE combat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their combat history"
  ON combat_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON characters.id = runs.character_id
      WHERE runs.id = combat_history.run_id
      AND characters.user_id = auth.uid()
    )
  );

ALTER TABLE player_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view leaderboards"
  ON player_statistics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own statistics"
  ON player_statistics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON runs.character_id = characters.id
      WHERE runs.id = player_statistics.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own statistics"
  ON player_statistics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON runs.character_id = characters.id
      WHERE runs.id = player_statistics.run_id
      AND characters.user_id = auth.uid()
    )
  );

-- Templates are public (read-only)
ALTER TABLE item_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enemy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view templates" ON item_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view skill templates" ON skill_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view technique templates" ON technique_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view quest templates" ON quest_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view sects" ON sects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view enemy templates" ON enemy_templates FOR SELECT TO authenticated USING (true);

-- Auction tables RLS
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view auction events"
  ON auction_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create auction events"
  ON auction_events FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow system-generated auctions (world_seed is required)
    world_seed IS NOT NULL AND world_seed != ''
  );

CREATE POLICY "Anyone can view auction bids"
  ON auction_bids FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can place bids"
  ON auction_bids FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN characters ON runs.character_id = characters.id
      WHERE runs.id = auction_bids.run_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update winning bids"
  ON auction_bids FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate total wealth (for leaderboards)
CREATE OR REPLACE FUNCTION calculate_total_wealth(p_silver INTEGER, p_spirit_stones INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN p_silver + (p_spirit_stones * 100); -- 1 spirit stone = 100 silver
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- Function to update player statistics
CREATE OR REPLACE FUNCTION update_player_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called when runs.current_state is updated
  -- Implementation depends on your JSONB structure
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for active market listings with item details
CREATE OR REPLACE VIEW active_market_view
WITH (security_invoker = true) AS
SELECT 
  ml.*,
  it.name,
  it.name_en,
  it.description,
  it.description_en,
  it.type,
  it.rarity
FROM market_listings ml
LEFT JOIN item_templates it ON ml.item_id = it.item_id;

-- View for character inventory with equipment status
CREATE OR REPLACE VIEW character_inventory_view
WITH (security_invoker = true) AS
SELECT 
  ci.*,
  ce.slot as equipped_in_slot,
  CASE WHEN ce.id IS NOT NULL THEN true ELSE false END as is_currently_equipped
FROM character_inventory ci
LEFT JOIN character_equipment ce ON ci.id = ce.inventory_item_id;

-- View for leaderboard (top players by realm and wealth)
CREATE OR REPLACE VIEW leaderboard_view
WITH (security_invoker = true) AS
SELECT 
  character_name,
  current_realm,
  realm_stage,
  total_wealth,
  total_combat_wins,
  achievements_count,
  RANK() OVER (ORDER BY realm_stage DESC, total_wealth DESC) as rank
FROM player_statistics
ORDER BY rank
LIMIT 100;
