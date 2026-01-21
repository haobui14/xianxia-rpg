// World system types for regions, events, and dungeons
import { Element, Realm, ProposedDelta } from './game';

// ========================================
// REGION SYSTEM TYPES
// ========================================

export type RegionId = 'thanh_van' | 'hoa_son' | 'huyen_thuy' | 'tram_loi' | 'vong_linh';

export type AreaType = 'city' | 'wilderness' | 'dungeon' | 'sect' | 'market' | 'secret_realm';

export type AreaActionType = 'explore' | 'cultivate' | 'hunt' | 'gather' | 'rest' | 'travel';

export interface Region {
  id: RegionId;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  element: Element;           // Primary element affinity
  tier: 1 | 2 | 3 | 4 | 5;   // Difficulty tier
  recommended_realm: Realm;   // Soft gate
  areas: Area[];
  adjacent_regions: RegionId[];
  unique_resources: string[]; // Region-specific materials
}

export interface Area {
  id: string;
  region_id: RegionId;
  name: string;
  name_en: string;
  type: AreaType;
  danger_level: 1 | 2 | 3 | 4 | 5;
  description: string;
  description_en: string;
  available_actions: AreaAction[];
  enemy_pool: string[];       // Enemy IDs that can spawn
  loot_table: string;         // Loot table ID
  event_pool: string[];       // Random event IDs
  connected_areas: string[];  // Area IDs within the region
  is_safe: boolean;           // No random combat in safe areas
  cultivation_bonus?: number; // % bonus to cultivation exp
}

export interface AreaAction {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  stamina_cost: number;
  time_segments: number;      // How many time segments this action takes
  type: AreaActionType;
  requires_discovery?: boolean; // Only available after discovering area
}

export interface TravelState {
  current_region: RegionId;
  current_area: string;       // Area ID
  discovered_areas: Record<RegionId, string[]>;
  region_reputation: Record<RegionId, number>;
  travel_history: string[];   // Last 10 area IDs visited
}

// ========================================
// RANDOM EVENTS SYSTEM TYPES
// ========================================

export type EventTrigger = 'exploration' | 'travel' | 'cultivation' | 'rest' | 'combat_end' | 'area_enter';

export type EventRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RandomEvent {
  id: string;
  name: string;
  name_en: string;
  trigger: EventTrigger;
  rarity: EventRarity;
  weight: number;              // For weighted selection (higher = more common)
  regions?: RegionId[];        // Null/undefined = all regions
  areas?: string[];            // Specific areas only
  realm_requirement?: Realm;   // Minimum realm (soft gate)
  realm_maximum?: Realm;       // Maximum realm (event stops appearing)
  element_affinity?: Element;  // Bonus if player has this element

  // Flags/conditions
  requires_flags?: string[];   // Required game flags
  excludes_flags?: string[];   // Cannot trigger if these flags set

  // Narrative
  narrative: string;
  narrative_en: string;

  // Choices
  choices: EventChoice[];

  // Cooldown
  cooldown_turns?: number;     // Turns before can trigger again
}

export interface EventChoice {
  id: string;
  text: string;
  text_en: string;
  requirements?: {
    stat?: { key: string; min: number };
    item?: string;             // Item ID required
    skill?: string;            // Skill ID required
    realm?: Realm;             // Minimum realm
    karma_min?: number;
    karma_max?: number;
  };
  hidden_until_met?: boolean;  // Hide choice until requirements met
  outcomes: EventOutcome[];
  outcome_weights: number[];   // Weights for random outcome selection
}

export interface EventOutcome {
  id: string;
  narrative: string;
  narrative_en: string;
  effects: ProposedDelta[];
  items?: string[];            // Item IDs to grant
  remove_items?: string[];     // Item IDs to remove
  trigger_combat?: string;     // Enemy ID to spawn
  unlock_area?: string;        // Area ID to discover
  set_flags?: string[];        // Flags to set
  clear_flags?: string[];      // Flags to clear
  teleport_to?: {
    region: RegionId;
    area: string;
  };
}

export interface EventState {
  active_event: RandomEvent | null;
  selected_choice: string | null;
  event_cooldowns: Record<string, number>; // Event ID -> turns remaining
  recent_events: string[];     // Last 5 event IDs
  total_events_triggered: number;
}

// ========================================
// DUNGEON/SECRET REALM SYSTEM TYPES
// ========================================

export type DungeonType = 'secret_realm' | 'ancient_tomb' | 'beast_lair' | 'trial_ground';

export interface Dungeon {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: DungeonType;
  region: RegionId;
  area: string;                // Area ID where dungeon is located
  tier: 1 | 2 | 3 | 4 | 5;
  recommended_realm: Realm;

  // Structure
  floors: DungeonFloor[];
  time_limit?: number;         // Turns before forced exit (null = unlimited)

  // Entry requirements
  entry_cost?: {
    silver?: number;
    spirit_stones?: number;
    item?: string;             // Item ID consumed on entry
  };
  entry_requirements?: {
    realm?: Realm;
    items?: string[];          // Items needed (not consumed)
    flags?: string[];          // Required flags
  };

  // Rewards
  completion_rewards: DungeonReward[];
  first_clear_bonus?: DungeonReward[];

  // Respawn
  respawn_days?: number;       // Days until dungeon resets (null = one-time)
}

export interface DungeonFloor {
  floor_number: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;

  // Content
  enemy_waves: EnemyWave[];
  mini_boss?: string;          // Enemy ID
  floor_boss?: string;         // Enemy ID (final floor)

  // Loot
  chest_count: number;         // Number of chests on this floor
  chest_loot_table: string;
  hidden_chest_count?: number;
  hidden_loot_table?: string;

  // Events
  floor_events: string[];      // Event IDs that can trigger

  // Navigation
  has_shortcut?: boolean;      // Can unlock shortcut to this floor
  shortcut_requirements?: {
    item?: string;
    skill?: string;
  };
}

export interface EnemyWave {
  id: string;
  enemies: string[];           // Enemy IDs
  spawn_chance: number;        // 0-1
  is_ambush?: boolean;         // Enemy attacks first
}

export interface DungeonReward {
  type: 'item' | 'silver' | 'spirit_stones' | 'exp' | 'technique' | 'skill';
  id?: string;                 // Item/technique/skill ID
  amount?: number;             // For currency/exp
  chance?: number;             // Drop chance (1 = guaranteed)
}

export interface DungeonState {
  dungeon_id: string | null;
  current_floor: number;
  floors_cleared: number[];
  turns_remaining?: number;
  turns_spent: number;
  discovered_secrets: string[];  // Hidden area IDs found
  collected_chests: string[];    // Chest IDs collected
  unlocked_shortcuts: number[];  // Floor numbers with shortcuts
  boss_defeated: boolean;

  // For tracking completion
  completed_dungeons: Record<string, {
    cleared_at: string;          // ISO timestamp
    best_time: number;           // Fastest clear in turns
    times_cleared: number;
  }>;
}

// ========================================
// COMBINED WORLD STATE
// ========================================

export interface WorldState {
  travel: TravelState;
  events: EventState;
  dungeon: DungeonState;
}

// ========================================
// HELPER TYPES
// ========================================

export interface TravelResult {
  success: boolean;
  message: string;
  message_en: string;
  stamina_cost: number;
  time_cost: number;
  triggered_event?: RandomEvent;
  danger_warning?: string;
  danger_warning_en?: string;
}

export interface DungeonActionResult {
  success: boolean;
  message: string;
  message_en: string;
  floor_cleared?: boolean;
  combat_triggered?: string;   // Enemy ID if combat starts
  loot?: DungeonReward[];
  event_triggered?: RandomEvent;
  dungeon_completed?: boolean;
  forced_exit?: boolean;       // Time limit reached
}
