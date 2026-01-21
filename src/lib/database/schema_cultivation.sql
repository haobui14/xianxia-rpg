-- =====================================================
-- Cultivation Simulator Database Schema Extensions
-- For: Xianxia RPG - Phase 1 (Time, Activities, Progression)
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ACTIVITY TRACKING
-- Tracks all player activities for analytics and history
-- =====================================================
CREATE TABLE IF NOT EXISTS cultivation_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Activity identification
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'cultivate_qi',      -- Qi cultivation meditation
    'cultivate_body',    -- Body tempering
    'meditate',          -- Pure meditation (insight chance)
    'practice_skill',    -- Combat skill training
    'explore',           -- Area exploration
    'gather',            -- Resource gathering
    'craft_alchemy',     -- Pill crafting
    'craft_talisman',    -- Talisman creation
    'rest',              -- Recovery and healing
    'socialize',         -- NPC interaction
    'sect_duty',         -- Sect missions/training
    'sect_contribution', -- Contributing to sect
    'trade',             -- Market/trading
    'travel',            -- Moving between areas
    'dungeon',           -- Dungeon exploration
    'combat',            -- Combat encounter
    'breakthrough_prep', -- Preparing for breakthrough
    'breakthrough'       -- Attempting breakthrough
  )),
  
  -- Timing
  game_time_start JSONB NOT NULL,  -- {day, month, year, segment}
  game_time_end JSONB,             -- {day, month, year, segment}
  duration_segments INTEGER DEFAULT 1,
  
  -- Results
  exp_gained JSONB DEFAULT '{}',   -- {qi_exp, body_exp, skill_exp: {skill_id: exp}}
  resources_spent JSONB DEFAULT '{}', -- {stamina, qi, silver, spirit_stones, items: [...]}
  rewards JSONB DEFAULT '{}',      -- {items: [...], silver, spirit_stones, insights: [...]}
  
  -- Context
  location_region TEXT,
  location_area TEXT,
  technique_used TEXT,             -- ID of technique used for cultivation
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('success', 'failure', 'interrupted', 'critical_success', 'partial')),
  outcome_details TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries by run and time
CREATE INDEX IF NOT EXISTS idx_activities_run_time 
ON cultivation_activities(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_type 
ON cultivation_activities(activity_type);

-- =====================================================
-- 2. WORLD STATE SIMULATION
-- Tracks the living world state for each run
-- =====================================================
CREATE TABLE IF NOT EXISTS world_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Current game time (snapshot)
  game_time JSONB NOT NULL DEFAULT '{"day": 1, "month": 1, "year": 1}',
  
  -- NPC States - progression and status
  npc_states JSONB DEFAULT '{}',
  -- Structure: { "npc_id": { "realm": "...", "stage": N, "alive": true, "location": "...", "last_interaction": {...} } }
  
  -- Sect States - power dynamics
  sect_states JSONB DEFAULT '{}',
  -- Structure: { "sect_id": { "power": N, "reputation": N, "at_war_with": [...], "controlled_regions": [...] } }
  
  -- Active world events
  world_events JSONB DEFAULT '[]',
  -- Structure: [{ "id": "...", "type": "...", "started": {...}, "ends": {...}, "affected_regions": [...] }]
  
  -- Region control and danger levels
  region_states JSONB DEFAULT '{}',
  -- Structure: { "region_id": { "controlling_sect": "...", "danger_level": N, "resources_depleted": false } }
  
  -- Rumors the player has heard
  active_rumors JSONB DEFAULT '[]',
  -- Structure: [{ "id": "...", "content": "...", "source": "...", "game_time": {...}, "verified": false }]
  
  -- Simulation tracking
  last_simulated TIMESTAMPTZ DEFAULT NOW(),
  simulation_version INTEGER DEFAULT 1,
  
  UNIQUE(run_id)
);

-- =====================================================
-- 3. REPUTATION TRACKING
-- Multi-faction reputation system
-- =====================================================
CREATE TABLE IF NOT EXISTS reputation_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Faction identification
  faction_type TEXT NOT NULL CHECK (faction_type IN ('sect', 'region', 'npc', 'faction', 'race')),
  faction_id TEXT NOT NULL,
  faction_name TEXT,          -- Display name
  faction_name_en TEXT,       -- English display name
  
  -- Reputation values
  reputation_value INTEGER DEFAULT 0 CHECK (reputation_value >= -1000 AND reputation_value <= 1000),
  reputation_rank TEXT DEFAULT 'neutral' CHECK (reputation_rank IN (
    'hated',      -- < -750
    'hostile',    -- -750 to -500
    'unfriendly', -- -500 to -100
    'neutral',    -- -100 to 100
    'friendly',   -- 100 to 500
    'honored',    -- 500 to 750
    'revered',    -- 750 to 900
    'exalted'     -- > 900
  )),
  
  -- Tracking
  last_change_reason TEXT,
  last_change_amount INTEGER,
  
  -- History (last 20 changes)
  history JSONB DEFAULT '[]',
  -- Structure: [{ "change": N, "reason": "...", "game_time": {...}, "timestamp": "..." }]
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id, faction_type, faction_id)
);

-- Index for reputation queries
CREATE INDEX IF NOT EXISTS idx_reputation_run 
ON reputation_tracking(run_id);

CREATE INDEX IF NOT EXISTS idx_reputation_faction 
ON reputation_tracking(faction_type, faction_id);

-- =====================================================
-- 4. BREAKTHROUGH ATTEMPTS
-- Track all breakthrough history for progression feel
-- =====================================================
CREATE TABLE IF NOT EXISTS breakthrough_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Attempt details
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('realm', 'stage', 'body_realm', 'body_stage')),
  
  -- From state
  from_realm TEXT NOT NULL,
  from_stage INTEGER,
  
  -- Target state
  to_realm TEXT NOT NULL,
  to_stage INTEGER,
  
  -- Preparation
  preparation JSONB NOT NULL DEFAULT '{}',
  -- Structure: { 
  --   "pills_used": [{"id": "...", "name": "...", "bonus": N}], 
  --   "location": {"region": "...", "area": "...", "bonus": N},
  --   "mental_state": "calm|agitated|injured|enlightened",
  --   "technique": {"id": "...", "name": "...", "bonus": N},
  --   "total_bonus": N
  -- }
  
  -- Probabilities
  base_success_chance FLOAT,
  modified_success_chance FLOAT,
  
  -- Outcome
  outcome TEXT NOT NULL CHECK (outcome IN (
    'success',          -- Successful breakthrough
    'failure',          -- Failed but no damage
    'qi_deviation',     -- Qi went berserk
    'minor_injury',     -- Light injuries
    'major_injury',     -- Severe injuries
    'crippled',         -- Cultivation crippled (major setback)
    'near_death'        -- Almost died
  )),
  
  -- Consequences
  consequences JSONB DEFAULT '{}',
  -- Structure: { "injuries": [...], "debuffs": [...], "exp_loss": N, "recovery_days": N }
  
  -- Timing
  game_time JSONB NOT NULL,
  duration_segments INTEGER DEFAULT 4, -- Breakthroughs take time
  
  -- Narrative
  narrative TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for breakthrough history
CREATE INDEX IF NOT EXISTS idx_breakthrough_run 
ON breakthrough_attempts(run_id, created_at DESC);

-- =====================================================
-- 5. GATHERING NODES
-- Resource spawns per run for exploration
-- =====================================================
CREATE TABLE IF NOT EXISTS gathering_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Location
  region_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  
  -- Resource info
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'herb',           -- Medicinal herbs for alchemy
    'ore',            -- Metals for equipment
    'beast_material', -- Dropped by beasts
    'spirit_stone',   -- Currency/cultivation resource
    'treasure',       -- Special items
    'wood',           -- Crafting material
    'essence'         -- Elemental essences
  )),
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  resource_rarity TEXT DEFAULT 'Common',
  
  -- Quantity and respawn
  quantity INTEGER DEFAULT 1,
  max_quantity INTEGER DEFAULT 1,
  respawn_time_days INTEGER, -- Game days until respawn, NULL = no respawn
  last_gathered JSONB,       -- {day, month, year} when last gathered
  
  -- Discovery
  discovered BOOLEAN DEFAULT FALSE,
  discovery_hint TEXT,        -- Clue for players to find it
  requires_perception INTEGER DEFAULT 0, -- Min perception to discover
  
  -- Special flags
  guarded_by TEXT,           -- Enemy ID if guarded
  requires_tool TEXT,        -- Tool needed to gather
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for node queries
CREATE INDEX IF NOT EXISTS idx_nodes_location 
ON gathering_nodes(run_id, region_id, area_id);

CREATE INDEX IF NOT EXISTS idx_nodes_discovered 
ON gathering_nodes(run_id, discovered);

-- =====================================================
-- 6. CHARACTER CONDITION
-- Persistent injuries and status effects
-- =====================================================
CREATE TABLE IF NOT EXISTS character_condition (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Current condition
  injuries JSONB DEFAULT '[]',
  -- Structure: [{ "id": "...", "type": "...", "severity": N, "affected_stats": {...}, "recovery_days": N, "acquired_time": {...} }]
  
  qi_deviation_level INTEGER DEFAULT 0 CHECK (qi_deviation_level >= 0 AND qi_deviation_level <= 100),
  -- 0 = none, 1-30 = minor, 31-60 = moderate, 61-90 = severe, 91-100 = critical
  
  fatigue INTEGER DEFAULT 0 CHECK (fatigue >= 0 AND fatigue <= 100),
  -- Accumulates from activities, reduces with rest
  
  mental_state TEXT DEFAULT 'calm' CHECK (mental_state IN (
    'enlightened', -- Bonus to breakthroughs and insights
    'calm',        -- Normal state
    'focused',     -- Bonus to cultivation
    'agitated',    -- Penalty to delicate tasks
    'fearful',     -- Penalty to combat
    'injured',     -- Healing priority
    'corrupted'    -- Demonic influence
  )),
  
  -- Buffs and debuffs
  active_effects JSONB DEFAULT '[]',
  -- Structure: [{ "id": "...", "name": "...", "type": "buff|debuff", "stats": {...}, "expires": {...} }]
  
  -- Enlightenment/Insight points (for special revelations)
  enlightenment_points INTEGER DEFAULT 0,
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id)
);

-- =====================================================
-- 7. LIFESPAN TRACKING
-- Age and mortality system
-- =====================================================
CREATE TABLE IF NOT EXISTS lifespan_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Base lifespan by mortal standards
  base_lifespan_years INTEGER DEFAULT 80,
  
  -- Bonus years from cultivation
  realm_bonus_years INTEGER DEFAULT 0,
  -- PhàmNhân: +0, LuyệnKhí: +50, TrúcCơ: +150, KếtĐan: +400, NguyênAnh: +1000
  
  -- Bonus from special items/events
  special_bonus_years INTEGER DEFAULT 0,
  
  -- Penalties (from qi deviation, injuries, etc.)
  penalty_years INTEGER DEFAULT 0,
  
  -- Calculated max lifespan
  max_lifespan INTEGER GENERATED ALWAYS AS (
    base_lifespan_years + realm_bonus_years + special_bonus_years - penalty_years
  ) STORED,
  
  -- Near death warnings triggered
  warnings_shown JSONB DEFAULT '[]',
  -- Structure: [{ "threshold": 0.9, "shown_at": {...} }]
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id)
);

-- =====================================================
-- 8. PLAYTIME ANALYTICS
-- Track real-time play sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS playtime_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  
  -- Session timing
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  
  -- Duration tracking
  real_time_seconds INTEGER DEFAULT 0,
  
  -- Game progress during session
  turns_played INTEGER DEFAULT 0,
  game_days_passed INTEGER DEFAULT 0,
  
  -- Activity summary
  activities_summary JSONB DEFAULT '{}',
  -- Structure: { "cultivate_qi": N, "combat": N, "explore": N, ... }
  
  -- Progress made
  exp_gained_total INTEGER DEFAULT 0,
  silver_gained INTEGER DEFAULT 0,
  items_acquired INTEGER DEFAULT 0
);

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_sessions_run 
ON playtime_sessions(run_id, session_start DESC);

-- =====================================================
-- 9. LOCATION CULTIVATION BONUSES
-- Static data for cultivation spots
-- =====================================================
CREATE TABLE IF NOT EXISTS location_cultivation_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Location identification
  region_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  
  -- Element affinity
  element_affinity TEXT[], -- Array of elements that benefit here
  
  -- Cultivation bonuses (percentage)
  qi_cultivation_bonus INTEGER DEFAULT 0,
  body_cultivation_bonus INTEGER DEFAULT 0,
  meditation_insight_bonus INTEGER DEFAULT 0,
  
  -- Requirements to access bonus
  discovery_requirements JSONB DEFAULT '{}',
  -- Structure: { "min_realm": "...", "min_perception": N, "quest_completed": "..." }
  
  -- Special features
  special_features TEXT[],
  -- e.g., ['spirit_spring', 'ancient_formation', 'ley_line']
  
  -- Danger and competition
  danger_level INTEGER DEFAULT 1 CHECK (danger_level >= 1 AND danger_level <= 10),
  competing_npcs TEXT[], -- NPCs that may occupy this spot
  
  UNIQUE(region_id, area_id)
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Activities: Users can only see their own
ALTER TABLE cultivation_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY cultivation_activities_policy ON cultivation_activities
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- World state: Users can only see their own
ALTER TABLE world_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY world_state_policy ON world_state
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Reputation: Users can only see their own
ALTER TABLE reputation_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY reputation_tracking_policy ON reputation_tracking
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Breakthroughs: Users can only see their own
ALTER TABLE breakthrough_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY breakthrough_attempts_policy ON breakthrough_attempts
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Gathering nodes: Users can only see their own run's nodes
ALTER TABLE gathering_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY gathering_nodes_policy ON gathering_nodes
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Character condition: Users can only see their own
ALTER TABLE character_condition ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_condition_policy ON character_condition
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Lifespan: Users can only see their own
ALTER TABLE lifespan_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY lifespan_tracking_policy ON lifespan_tracking
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Playtime: Users can only see their own
ALTER TABLE playtime_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY playtime_sessions_policy ON playtime_sessions
  FOR ALL USING (
    run_id IN (
      SELECT r.id FROM runs r
      JOIN characters c ON r.character_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Location bonuses: Public read (static data)
ALTER TABLE location_cultivation_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_bonuses_read_policy ON location_cultivation_bonuses
  FOR SELECT USING (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate reputation rank from value
CREATE OR REPLACE FUNCTION calculate_reputation_rank(rep_value INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN rep_value < -750 THEN 'hated'
    WHEN rep_value < -500 THEN 'hostile'
    WHEN rep_value < -100 THEN 'unfriendly'
    WHEN rep_value < 100 THEN 'neutral'
    WHEN rep_value < 500 THEN 'friendly'
    WHEN rep_value < 750 THEN 'honored'
    WHEN rep_value < 900 THEN 'revered'
    ELSE 'exalted'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update reputation rank
CREATE OR REPLACE FUNCTION update_reputation_rank()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reputation_rank := calculate_reputation_rank(NEW.reputation_value);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reputation_rank
  BEFORE INSERT OR UPDATE OF reputation_value ON reputation_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_reputation_rank();

-- Function to get lifespan bonus by realm
CREATE OR REPLACE FUNCTION get_realm_lifespan_bonus(realm TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE realm
    WHEN 'PhàmNhân' THEN 0
    WHEN 'LuyệnKhí' THEN 50
    WHEN 'TrúcCơ' THEN 150
    WHEN 'KếtĐan' THEN 400
    WHEN 'NguyênAnh' THEN 1000
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
