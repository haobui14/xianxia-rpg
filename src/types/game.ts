// Core game types based on the plan

export type Locale = 'vi' | 'en';

// Realm progression
export type Realm = 'PhàmNhân' | 'LuyệnKhí' | 'TrúcCơ' | 'KếtĐan' | 'NguyênAnh';

// Spirit root elements
export type Element = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

// Spirit root grade
export type SpiritRootGrade = 'PhổThông' | 'Khá' | 'Hiếm' | 'ThiênPhẩm';

// Time segments
export type TimeSegment = 'Sáng' | 'Chiều' | 'Tối' | 'Đêm';

// Combat behavior
export type CombatBehavior = 'Aggressive' | 'Defensive' | 'Balanced' | 'Flee';

// Item rarity
export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

// Equipment slot
export type EquipmentSlot = 
  | 'Weapon' 
  | 'Head' 
  | 'Chest' 
  | 'Legs' 
  | 'Feet' 
  | 'Hands' 
  | 'Accessory' 
  | 'Artifact'
  | 'None';

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
  str: number;  // Strength
  agi: number;  // Agility
  int: number;  // Intelligence
  perception: number;
  luck: number;
}

// Cultivation progress
export interface CultivationProgress {
  realm: Realm;
  realm_stage: number;  // 0-5 for MVP
  cultivation_exp: number;
}

// Location
export interface Location {
  region: string;
  place: string;
}

// Combat Skill - Used in battle
export interface Skill {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: 'Attack' | 'Defense' | 'Movement' | 'Support';
  element?: Element; // Optional element for elemental skills
  level: number;
  max_level: number;
  // Combat properties
  damage_multiplier: number; // Base damage multiplier (1.0 = normal attack)
  qi_cost: number; // Qi required to use
  cooldown: number; // Turns before can use again
  effects?: {
    stun_chance?: number; // 0-1 chance to stun
    bleed_damage?: number; // Damage over time
    defense_break?: number; // Reduce enemy defense
    heal_percent?: number; // Heal % of max HP
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
  grade: 'Mortal' | 'Earth' | 'Heaven';
  type: 'Main' | 'Support';
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
  type: 'Medicine' | 'Material' | 'Equipment' | 'Accessory' | 'Manual' | 'Book' | 'Effect' | 'Misc';
  rarity: ItemRarity;
  quantity: number;
  
  // Equipment properties (for Equipment type)
  equipment_slot?: EquipmentSlot;
  level_requirement?: number;
  realm_requirement?: Realm;
  
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
  sect?: string; // Môn phái
  sect_en?: string;
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
  | 'combat'
  | 'loot'
  | 'breakthrough'
  | 'status_effect'
  | 'quest_update'
  | 'npc_interaction';

export interface GameEvent {
  type: GameEventType;
  data: Record<string, any>;
}

// Proposed delta from AI
export interface ProposedDelta {
  field: string;
  operation: 'add' | 'subtract' | 'set' | 'multiply';
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
