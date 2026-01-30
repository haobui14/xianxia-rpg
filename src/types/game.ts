// Core game types based on the plan

import { TravelState, EventState, DungeonState } from "./world";

export type Locale = "vi" | "en";

// =====================================================
// TIME & ACTIVITY SYSTEM TYPES
// =====================================================

// Game time structure
export interface GameTime {
  day: number; // 1-30
  month: number; // 1-12
  year: number; // Starts at 1
  segment: TimeSegment;
}

// Season derived from month
export type Season = "Spring" | "Summer" | "Autumn" | "Winter";

// Activity types available to player
export type ActivityType =
  | "cultivate_qi" // Qi cultivation meditation
  | "cultivate_body" // Body tempering exercises
  | "meditate" // Pure meditation (insight chance)
  | "practice_skill" // Combat skill training
  | "explore" // Area exploration
  | "gather" // Resource gathering
  | "craft_alchemy" // Pill crafting
  | "rest" // Recovery and healing
  | "socialize" // NPC interaction
  | "sect_duty" // Sect missions/training
  | "trade" // Market/trading
  | "travel" // Moving between areas
  | "dungeon" // Dungeon exploration
  | "breakthrough_prep" // Preparing for breakthrough
  | "breakthrough"; // Attempting breakthrough

// Activity duration options
export type ActivityDuration =
  | "1_segment" // ~3 hours
  | "half_day" // 2 segments
  | "full_day" // 4 segments
  | "3_days" // 12 segments
  | "week" // 28 segments
  | "month" // 120 segments (30 days * 4)
  | "custom";

// Activity definition
export interface ActivityDefinition {
  type: ActivityType;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  icon: string;
  category: "cultivation" | "combat" | "gathering" | "social" | "recovery" | "special";

  // Base costs per segment
  base_stamina_cost: number;
  base_qi_cost: number;

  // Requirements
  requirements?: {
    min_realm?: Realm;
    min_body_realm?: BodyRealm;
    min_stamina?: number;
    min_qi?: number;
    required_location_type?: string[];
    required_items?: string[];
    in_sect?: boolean;
    not_injured?: boolean;
  };

  // Allowed durations
  allowed_durations: ActivityDuration[];

  // Base rewards per segment
  base_rewards: {
    qi_exp?: number;
    body_exp?: number;
    skill_exp?: number;
    insight_chance?: number; // 0-1 probability
    stamina_recovery?: number;
    hp_recovery?: number;
  };

  // Affected by
  affected_by: ("technique" | "location" | "season" | "equipment" | "condition")[];
}

// Current activity state
export interface CurrentActivity {
  type: ActivityType;
  started_time: GameTime;
  target_end_time: GameTime;
  duration_segments: number;
  progress: number; // 0-100%
  technique_id?: string;
  accumulated_rewards: {
    qi_exp: number;
    body_exp: number;
    skill_exp: Record<string, number>;
    items: InventoryItem[];
    silver: number;
    insights: string[];
  };
  interruptions: number;
  bonuses: {
    technique: number;
    location: number;
    season: number;
    equipment: number;
    condition: number;
    total: number;
  };
}

// Activity history entry
export interface ActivityLogEntry {
  type: ActivityType;
  started: GameTime;
  ended: GameTime;
  duration_segments: number;
  outcome: "success" | "failure" | "interrupted" | "critical_success";
  rewards_summary: string;
}

// =====================================================
// REPUTATION SYSTEM TYPES
// =====================================================

export type ReputationRank =
  | "hated" // < -750
  | "hostile" // -750 to -500
  | "unfriendly" // -500 to -100
  | "neutral" // -100 to 100
  | "friendly" // 100 to 500
  | "honored" // 500 to 750
  | "revered" // 750 to 900
  | "exalted"; // > 900

export interface ReputationEntry {
  faction_type: "sect" | "region" | "npc" | "faction";
  faction_id: string;
  faction_name: string;
  faction_name_en: string;
  value: number; // -1000 to 1000
  rank: ReputationRank;
  modifiers: {
    source: string;
    amount: number;
    expires?: GameTime;
  }[];
}

// =====================================================
// CHARACTER CONDITION TYPES
// =====================================================

export type MentalState =
  | "enlightened" // Bonus to breakthroughs
  | "calm" // Normal
  | "focused" // Bonus to cultivation
  | "agitated" // Penalty to delicate tasks
  | "fearful" // Penalty to combat
  | "injured" // Healing priority
  | "corrupted"; // Demonic influence

export interface Injury {
  id: string;
  name: string;
  name_en: string;
  type: "physical" | "meridian" | "soul" | "qi_deviation";
  severity: 1 | 2 | 3 | 4 | 5; // 1=minor, 5=crippling
  affected_stats: Partial<CharacterStats & CharacterAttributes>;
  recovery_days: number;
  acquired_time: GameTime;
  can_cultivate: boolean;
  healing_items?: string[]; // Item IDs that can help
}

export interface StatusEffect {
  id: string;
  name: string;
  name_en: string;
  type: "buff" | "debuff";
  source: string;
  stat_modifiers: Partial<CharacterStats & CharacterAttributes>;
  cultivation_modifier?: number; // Percentage
  expires: GameTime;
  stackable: boolean;
  stacks?: number;
}

export interface CharacterCondition {
  injuries: Injury[];
  qi_deviation_level: number; // 0-100
  fatigue: number; // 0-100
  mental_state: MentalState;
  active_effects: StatusEffect[];
  enlightenment_points: number;
}

// =====================================================
// LIFESPAN SYSTEM TYPES
// =====================================================

export interface LifespanInfo {
  base_years: number; // Mortal lifespan
  realm_bonus: number; // From cultivation realm
  special_bonus: number; // From items/events
  penalty: number; // From injuries/qi deviation
  current_age: number;
  max_lifespan: number; // Calculated total
  years_remaining: number;
  urgency_level: "safe" | "caution" | "warning" | "critical";
}

// Realm lifespan bonuses
export const REALM_LIFESPAN_BONUS: Record<Realm, number> = {
  PhàmNhân: 0,
  LuyệnKhí: 50,
  TrúcCơ: 150,
  KếtĐan: 400,
  NguyênAnh: 1000,
};

// =====================================================
// BREAKTHROUGH SYSTEM TYPES
// =====================================================

export interface BreakthroughPreparation {
  target_type: "realm" | "stage" | "body_realm" | "body_stage";
  target_realm?: Realm | BodyRealm;
  target_stage?: number;

  // Preparation items
  pills_prepared: {
    item: InventoryItem;
    bonus: number;
  }[];

  // Location bonus
  location: {
    region: string;
    area: string;
    element_affinity: Element[];
    bonus: number;
  };

  // Technique bonus
  technique?: {
    id: string;
    name: string;
    bonus: number;
  };

  // State checks
  mental_state: MentalState;
  mental_state_bonus: number;
  injury_penalty: number;
  qi_deviation_penalty: number;

  // Final calculation
  base_success_rate: number;
  total_bonus: number;
  final_success_rate: number;

  // Requirements
  requirements_met: boolean;
  missing_requirements: string[];
}

export type BreakthroughOutcome =
  | "success"
  | "failure"
  | "qi_deviation"
  | "minor_injury"
  | "major_injury"
  | "crippled"
  | "near_death";

export interface BreakthroughResult {
  outcome: BreakthroughOutcome;
  from_realm: Realm | BodyRealm;
  from_stage: number;
  to_realm?: Realm | BodyRealm;
  to_stage?: number;
  narrative: string;
  consequences: {
    injuries?: Injury[];
    qi_deviation_increase?: number;
    exp_lost?: number;
    recovery_days?: number;
    lifespan_penalty?: number;
  };
  rewards?: {
    stat_increases?: Partial<CharacterStats & CharacterAttributes>;
    lifespan_bonus?: number;
    new_abilities?: string[];
  };
}

// =====================================================
// WORLD SIMULATION TYPES
// =====================================================

export interface WorldSimulationState {
  last_simulated_time: GameTime;

  // Pending world changes to narrate
  pending_events: WorldEvent[];

  // NPC changes since last check
  npc_changes: {
    npc_id: string;
    change_type: "breakthrough" | "death" | "moved" | "joined_sect" | "left_sect";
    details: string;
  }[];

  // Rumors player has heard
  rumors: {
    id: string;
    content: string;
    content_en: string;
    source: string;
    game_time: GameTime;
    verified: boolean;
    related_to?: string; // NPC or event ID
  }[];

  // Region changes
  region_changes: {
    region_id: string;
    change_type:
      | "danger_increased"
      | "danger_decreased"
      | "new_sect_control"
      | "resource_depleted"
      | "resource_restored";
    details: string;
  }[];
}

export interface WorldEvent {
  id: string;
  type: "sect_war" | "beast_tide" | "treasure_appearance" | "tournament" | "disaster" | "festival";
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  started: GameTime;
  ends?: GameTime;
  affected_regions: string[];
  participation_requirements?: {
    min_realm?: Realm;
    sect_membership?: string;
  };
  rewards?: {
    reputation?: Record<string, number>;
    items?: InventoryItem[];
    exp?: number;
  };
}

// Realm progression
export type Realm = "PhàmNhân" | "LuyệnKhí" | "TrúcCơ" | "KếtĐan" | "NguyênAnh";

// Spirit root elements
export type Element = "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ";

// Spirit root grade
export type SpiritRootGrade = "PhổThông" | "Khá" | "Hiếm" | "ThiênPhẩm";

// Sect rank within a sect
export type SectRank =
  | "NgoạiMôn" // Outer Disciple - Entry level
  | "NộiMôn" // Inner Disciple - Core member
  | "ChânTruyền" // True Disciple - Direct lineage
  | "TrưởngLão" // Elder - Leadership
  | "ChưởngMôn"; // Sect Master - Head of sect

// Sect type based on focus
export type SectType =
  | "Kiếm" // Sword cultivation
  | "Đan" // Alchemy/Pills
  | "Trận" // Formation
  | "YêuThú" // Beast Taming
  | "Ma" // Demonic cultivation
  | "PhậtMôn" // Buddhist cultivation
  | "Tổng" // General cultivation (mixed)
  | "ThươngHội"; // Merchant guild

// Time segments
export type TimeSegment = "Sáng" | "Chiều" | "Tối" | "Đêm";

// Combat behavior
export type CombatBehavior = "Aggressive" | "Defensive" | "Balanced" | "Flee";

// Item rarity
export type ItemRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

// Equipment slot
export type EquipmentSlot =
  | "Weapon"
  | "Head"
  | "Chest"
  | "Legs"
  | "Feet"
  | "Hands"
  | "Accessory"
  | "Artifact"
  | "None";

// Spirit Root definition
export interface SpiritRoot {
  elements: Element[];
  grade: SpiritRootGrade;
}

// Character stats
export interface CharacterStats {
  hp: number;
  hp_max: number;
  qi: number;
  qi_max: number;
  stamina: number;
  stamina_max: number;
}

// Character attributes
export interface CharacterAttributes {
  str: number; // Strength
  agi: number; // Agility
  int: number; // Intelligence
  perception: number;
  luck: number;
}

// Cultivation path type
export type CultivationPath = "qi" | "body" | "dual";

// Body cultivation stages (parallel to Qi cultivation)
export type BodyRealm = "PhàmThể" | "LuyệnCốt" | "ĐồngCân" | "KimCương" | "TháiCổ";

// Cultivation progress
export interface CultivationProgress {
  realm: Realm;
  realm_stage: number; // 0-5 for MVP
  cultivation_exp: number;
  // Dual cultivation support
  cultivation_path?: CultivationPath; // Default 'qi' for backward compatibility
  body_realm?: BodyRealm; // Body cultivation realm
  body_stage?: number; // 0-5 stages within body realm
  body_exp?: number; // Body cultivation exp
  exp_split?: number; // 0-100, percentage of exp going to qi cultivation (rest goes to body)
}

// Location
export interface Location {
  region: string;
  place: string;
}

// Sect definition
export interface Sect {
  id: string;
  name: string;
  name_en: string;
  type: SectType;
  element?: Element; // Primary element affinity
  tier: number; // 1-5, 1=small local sect, 5=supreme immortal sect
  description?: string;
  description_en?: string;
}

// Player's sect membership state
export interface SectMembership {
  sect: Sect;
  rank: SectRank;
  contribution: number; // Sect contribution points
  reputation: number; // Standing within sect (0-100)
  joined_date: string; // ISO timestamp
  missions_completed: number;
  mentor?: string; // Name of mentor elder
  mentor_en?: string;
  benefits: {
    cultivation_bonus: number; // % bonus to cultivation
    resource_access: boolean; // Access to sect resources
    technique_access: boolean; // Access to sect techniques
    protection: boolean; // Sect protection from enemies
  };
}

// Combat Skill - Used in battle
export interface Skill {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: "attack" | "defense" | "support";
  element?: Element; // Optional element for elemental skills
  level: number;
  max_level: number;
  exp?: number; // Current skill experience
  max_exp?: number; // Experience needed for next level
  // Combat properties
  damage_multiplier: number; // Base damage multiplier (1.0 = normal attack)
  qi_cost: number; // Qi required to use
  cooldown: number; // Turns before can use again
  current_cooldown?: number; // Current cooldown remaining
  effects?: {
    stun_chance?: number; // 0-1 chance to stun
    bleed_damage?: number; // Damage over time
    defense_break?: number; // Reduce enemy defense
    heal_percent?: number; // Heal % of max HP
    defense_boost?: number; // Temporary defense boost
    buff_stats?: Record<string, number>; // Temporary stat buffs
  };
}

// Cultivation Technique - Boosts cultivation speed
export interface CultivationTechnique {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  grade: "Mortal" | "Earth" | "Heaven";
  type: "Main" | "Support";
  elements: Element[]; // Elements of the technique (e.g., ['Hỏa', 'Kim'])
  // Cultivation bonuses
  cultivation_speed_bonus: number; // Percentage bonus to cultivation exp (e.g., 10 = +10%)
  qi_recovery_bonus?: number; // Bonus qi recovery during rest
  breakthrough_bonus?: number; // Bonus success rate for breakthroughs
}

// Inventory item
export interface InventoryItem {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: "Medicine" | "Material" | "Equipment" | "Accessory" | "Manual" | "Book" | "Effect" | "Misc";
  rarity: ItemRarity;
  quantity: number;

  // Equipment properties (for Equipment type)
  equipment_slot?: EquipmentSlot;
  level_requirement?: number;
  realm_requirement?: Realm;

  // Enhancement properties
  enhancement_level?: number; // 0-10, default 0
  max_enhancement?: number; // Default 10

  // Stat bonuses (for Equipment)
  bonus_stats?: {
    hp?: number;
    qi?: number;
    stamina?: number;
    str?: number;
    agi?: number;
    int?: number;
    perception?: number;
    luck?: number;
    cultivation_speed?: number; // Percentage bonus
  };

  // Effects (for consumables, artifacts)
  effects?: Record<string, any>;

  // Teaching properties (for Book type)
  teaches_technique?: CultivationTechnique;
  teaches_skill?: Skill;

  // Equipment state
  is_equipped?: boolean;
}

// Storage Ring - Expands inventory capacity
export interface StorageRing {
  id: string;
  name: string;
  name_en: string;
  capacity: number; // Additional item slots
  rarity: ItemRarity;
}

// Inventory
export interface Inventory {
  silver: number;
  spirit_stones: number;
  items: InventoryItem[];
  max_slots: number; // Base inventory slots (default 20)
  storage_ring?: StorageRing; // Equipped storage ring for extra capacity
}

// Market item for buying/selling
export interface MarketItem extends InventoryItem {
  price_silver?: number;
  price_spirit_stones?: number;
}

// Market state
export interface MarketState {
  items: MarketItem[];
  last_regenerated: string; // ISO timestamp
  next_regeneration: {
    month: number;
    year: number;
  };
}

// Auction state
export interface AuctionState {
  active: boolean;
  items: MarketItem[];
  start_time: string;
  end_time: string;
  bids: Record<string, { bidder: string; amount: number; is_ai: boolean }>;
}

// Game state (stored in runs.current_state)
export interface GameState {
  stats: CharacterStats;
  attrs: CharacterAttributes;
  progress: CultivationProgress;
  spirit_root: SpiritRoot;
  inventory: Inventory;
  equipped_items: Partial<Record<EquipmentSlot, InventoryItem>>;
  location: Location; // Legacy - kept for backward compatibility
  time_day: number;
  time_month: number;
  time_year: number;
  time_segment: TimeSegment;
  karma: number;
  reputation: number;
  age: number;
  flags: Record<string, boolean>;
  story_summary: string;
  turn_count: number;
  last_stamina_regen?: string; // ISO timestamp for real-time stamina regeneration
  skills: Skill[];
  techniques: CultivationTechnique[];
  // Queue for excess skills/techniques (when at max capacity)
  skill_queue: Skill[];
  technique_queue: CultivationTechnique[];
  sect?: string; // Môn phái (legacy - kept for backward compatibility)
  sect_en?: string;
  sect_membership?: SectMembership; // Full sect membership data
  market?: MarketState;
  auction?: AuctionState;
  // World system (new)
  travel?: TravelState; // Region/area travel state
  events?: EventState; // Random events state
  dungeon?: DungeonState; // Dungeon progress state

  // =====================================================
  // CULTIVATION SIMULATOR ADDITIONS (Phase 1)
  // =====================================================

  // Activity System
  activity?: {
    current?: CurrentActivity;
    available_activities: ActivityType[];
    cooldowns: Record<ActivityType, GameTime>;
    daily_log: ActivityLogEntry[];
  };

  // Multi-faction Reputation System
  reputations?: Record<string, ReputationEntry>;

  // Character Condition (injuries, fatigue, mental state)
  condition?: CharacterCondition;

  // Lifespan System
  lifespan?: LifespanInfo;

  // Breakthrough Preparation State
  breakthrough_prep?: BreakthroughPreparation;

  // World Simulation State
  world_simulation?: WorldSimulationState;

  // Gathered resources (separate from inventory for clarity)
  gathered_resources?: {
    herbs: Record<string, number>;
    ores: Record<string, number>;
    beast_materials: Record<string, number>;
    essences: Record<string, number>;
  };
}

// Choice for player
export interface Choice {
  id: string;
  text: string;
  cost?: {
    stamina?: number;
    qi?: number;
    silver?: number;
    spirit_stones?: number;
    time_segments?: number;
  };
  requirements?: {
    min_realm_stage?: number;
    min_stats?: Partial<CharacterStats>;
    required_items?: string[];
  };
}

// Event types
export type GameEventType =
  | "combat"
  | "combat_encounter" // Triggers interactive combat mode with CombatView
  | "loot"
  | "breakthrough"
  | "body_breakthrough" // Body cultivation breakthrough
  | "status_effect"
  | "quest_update"
  | "npc_interaction"
  | "sect_join"
  | "sect_promotion"
  | "sect_mission"
  | "sect_expulsion"
  | "random_event" // World system random event triggered
  | "area_discovered" // New area discovered
  | "dungeon_enter" // Entered a dungeon
  | "dungeon_floor_clear" // Cleared a dungeon floor
  | "dungeon_complete" // Completed a dungeon
  | "travel_region" // Traveled to new region
  | "danger_warning"; // Warning about dangerous area

export interface GameEvent {
  type: GameEventType;
  data: Record<string, any>;
}

// Proposed delta from AI
export interface ProposedDelta {
  field: string;
  operation: "add" | "subtract" | "set" | "multiply";
  value: number | string | boolean | any;
  reason?: string;
}

// AI Turn result (what AI returns)
export interface AITurnResult {
  locale: Locale;
  narrative: string;
  choices: Choice[];
  proposed_deltas: ProposedDelta[];
  events: GameEvent[];
}

// Validated turn result (what server sends to client)
export interface ValidatedTurnResult {
  narrative: string;
  choices: Choice[];
  state: GameState;
  events: GameEvent[];
  turn_no: number;
  saveStatus?: {
    success: boolean;
    error?: string;
  };
}

// Enemy for combat
export interface Enemy {
  id: string;
  name: string;
  name_en: string;
  hp: number;
  hp_max: number;
  atk: number;
  def: number;
  behavior: CombatBehavior;
  loot_table_id?: string;
}

// Combat state management
export interface CombatState {
  isActive: boolean;
  enemy: Enemy | null;
  playerTurn: boolean;
  turnNumber: number;
  combatLog: CombatLogEntry[];
}

// Combat log entry for combat history display
export interface CombatLogEntry {
  id: string;
  turn: number;
  actor: "player" | "enemy";
  action: "attack" | "qi_attack" | "defend" | "skill" | "flee";
  actionName?: string;
  damage?: number;
  isCritical?: boolean;
  isMiss?: boolean;
  isDodged?: boolean;
  isBlocked?: boolean;
  healAmount?: number;
  effectText?: string;
  timestamp: number;
}

// Combat turn result from combat.ts
export interface CombatTurnResult {
  narrative: string;
  playerDamageDealt?: number;
  playerDamageTaken?: number;
  enemyDamageDealt?: number;
  playerAction: CombatLogEntry;
  enemyAction?: CombatLogEntry;
  combatEnded: boolean;
  victory?: boolean;
  loot?: {
    silver: number;
    spirit_stones: number;
    items: InventoryItem[];
    exp: number;
  };
}

// Database types
export interface Character {
  id: string;
  user_id: string;
  name: string;
  age: number;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  character_id: string;
  world_seed: string;
  locale: Locale;
  current_state: GameState;
  created_at: string;
  updated_at: string;
}

export interface TurnLog {
  id: string;
  run_id: string;
  turn_no: number;
  choice_id: string | null;
  narrative: string;
  ai_json: AITurnResult | null;
  created_at: string;
}
