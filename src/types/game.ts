// Core game types based on the plan

export type Locale = "vi" | "en";

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

// Cultivation progress
export interface CultivationProgress {
  realm: Realm;
  realm_stage: number; // 0-5 for MVP
  cultivation_exp: number;
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
  type:
    | "Medicine"
    | "Material"
    | "Equipment"
    | "Accessory"
    | "Manual"
    | "Book"
    | "Effect"
    | "Misc";
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

// Inventory
export interface Inventory {
  silver: number;
  spirit_stones: number;
  items: InventoryItem[];
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
  location: Location;
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
  | "status_effect"
  | "quest_update"
  | "npc_interaction"
  | "sect_join"
  | "sect_promotion"
  | "sect_mission"
  | "sect_expulsion";

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
