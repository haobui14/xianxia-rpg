/**
 * Dungeon Engine - Handles dungeon state, progression, and rewards
 */

import {
  DungeonState,
  Dungeon,
  DungeonFloor,
  DungeonReward,
  DungeonActionResult,
  EnemyWave,
} from "@/types/world";
import { GameState, Realm, InventoryItem } from "@/types/game";
import { getDungeonById, getDungeonFloor, canEnterDungeon as checkCanEnter } from "./dungeons";

// Realm order for comparison
const REALM_ORDER: Realm[] = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];

/**
 * Initialize dungeon state
 */
export function initDungeonState(): DungeonState {
  return {
    dungeon_id: null,
    current_floor: 0,
    floors_cleared: [],
    turns_remaining: undefined,
    turns_spent: 0,
    discovered_secrets: [],
    collected_chests: [],
    unlocked_shortcuts: [],
    boss_defeated: false,
    completed_dungeons: {},
  };
}

/**
 * Check if player is currently in a dungeon
 */
export function isInDungeon(dungeonState: DungeonState): boolean {
  return dungeonState.dungeon_id !== null;
}

/**
 * Get current dungeon info
 */
export function getCurrentDungeon(dungeonState: DungeonState): Dungeon | null {
  if (!dungeonState.dungeon_id) return null;
  return getDungeonById(dungeonState.dungeon_id) || null;
}

/**
 * Get current floor info
 */
export function getCurrentFloor(dungeonState: DungeonState): DungeonFloor | null {
  if (!dungeonState.dungeon_id) return null;
  return getDungeonFloor(dungeonState.dungeon_id, dungeonState.current_floor) || null;
}

/**
 * Check if player can enter a dungeon
 */
export function canEnterDungeon(
  dungeonId: string,
  state: GameState
): { canEnter: boolean; reason?: string; reason_en?: string } {
  const dungeon = getDungeonById(dungeonId);
  if (!dungeon) {
    return {
      canEnter: false,
      reason: "Dungeon không tồn tại",
      reason_en: "Dungeon does not exist",
    };
  }

  // Check if already in a dungeon
  if (state.dungeon?.dungeon_id) {
    return {
      canEnter: false,
      reason: "Đang ở trong dungeon khác",
      reason_en: "Already in another dungeon",
    };
  }

  // Check dungeon-specific requirements
  const playerItems = state.inventory.items.map((item) => item.id);
  const playerFlags = Object.keys(state.flags).filter((k) => state.flags[k]);

  return checkCanEnter(
    dungeon,
    state.progress.realm,
    playerItems,
    playerFlags,
    state.inventory.silver,
    state.inventory.spirit_stones
  );
}

/**
 * Enter a dungeon
 */
export function enterDungeon(
  dungeonId: string,
  dungeonState: DungeonState
): {
  newState: DungeonState;
  entryCost: { silver: number; spirit_stones: number; item?: string } | null;
} {
  const dungeon = getDungeonById(dungeonId);
  if (!dungeon) {
    return { newState: dungeonState, entryCost: null };
  }

  // Determine starting floor (check for unlocked shortcuts)
  let startFloor = 1;
  const previousCompletion = dungeonState.completed_dungeons[dungeonId];
  if (previousCompletion && dungeonState.unlocked_shortcuts.length > 0) {
    // Can start from any unlocked shortcut floor
    const maxShortcut = Math.max(
      ...dungeonState.unlocked_shortcuts.filter((f) => f <= dungeon.floors.length)
    );
    if (maxShortcut > 1) {
      startFloor = maxShortcut;
    }
  }

  const newState: DungeonState = {
    ...dungeonState,
    dungeon_id: dungeonId,
    current_floor: startFloor,
    floors_cleared: [],
    turns_remaining: dungeon.time_limit,
    turns_spent: 0,
    discovered_secrets: [],
    collected_chests: [],
    boss_defeated: false,
  };

  const entryCost = dungeon.entry_cost
    ? {
        silver: dungeon.entry_cost.silver || 0,
        spirit_stones: dungeon.entry_cost.spirit_stones || 0,
        item: dungeon.entry_cost.item,
      }
    : null;

  return { newState, entryCost };
}

/**
 * Exit dungeon (voluntary or forced)
 */
export function exitDungeon(dungeonState: DungeonState, completed: boolean = false): DungeonState {
  const dungeon = getCurrentDungeon(dungeonState);

  const newCompletedDungeons = { ...dungeonState.completed_dungeons };

  if (completed && dungeon) {
    const existing = newCompletedDungeons[dungeon.id];
    const now = new Date().toISOString();

    newCompletedDungeons[dungeon.id] = {
      cleared_at: now,
      best_time: existing
        ? Math.min(existing.best_time, dungeonState.turns_spent)
        : dungeonState.turns_spent,
      times_cleared: existing ? existing.times_cleared + 1 : 1,
    };
  }

  return {
    ...dungeonState,
    dungeon_id: null,
    current_floor: 0,
    floors_cleared: [],
    turns_remaining: undefined,
    turns_spent: 0,
    discovered_secrets: [],
    collected_chests: [],
    boss_defeated: false,
    completed_dungeons: newCompletedDungeons,
    // Keep unlocked shortcuts
  };
}

/**
 * Advance to next floor
 */
export function advanceFloor(dungeonState: DungeonState): DungeonState {
  const dungeon = getCurrentDungeon(dungeonState);
  if (!dungeon) return dungeonState;

  const nextFloor = dungeonState.current_floor + 1;

  // Check if dungeon is complete
  if (nextFloor > dungeon.floors.length) {
    return dungeonState; // Already at max floor
  }

  return {
    ...dungeonState,
    current_floor: nextFloor,
    floors_cleared: [...dungeonState.floors_cleared, dungeonState.current_floor],
  };
}

/**
 * Mark current floor as cleared
 */
export function clearCurrentFloor(dungeonState: DungeonState): DungeonState {
  if (dungeonState.floors_cleared.includes(dungeonState.current_floor)) {
    return dungeonState;
  }

  return {
    ...dungeonState,
    floors_cleared: [...dungeonState.floors_cleared, dungeonState.current_floor],
  };
}

/**
 * Tick dungeon time (called each turn while in dungeon)
 */
export function tickDungeonTime(dungeonState: DungeonState): {
  newState: DungeonState;
  timeExpired: boolean;
  turnsRemaining: number | null;
} {
  if (!dungeonState.dungeon_id || dungeonState.turns_remaining === undefined) {
    return {
      newState: dungeonState,
      timeExpired: false,
      turnsRemaining: null,
    };
  }

  const newTurnsRemaining = dungeonState.turns_remaining - 1;
  const newTurnsSpent = dungeonState.turns_spent + 1;

  const newState: DungeonState = {
    ...dungeonState,
    turns_remaining: newTurnsRemaining,
    turns_spent: newTurnsSpent,
  };

  return {
    newState,
    timeExpired: newTurnsRemaining <= 0,
    turnsRemaining: newTurnsRemaining,
  };
}

/**
 * Collect a chest
 */
export function collectChest(dungeonState: DungeonState, chestId: string): DungeonState {
  if (dungeonState.collected_chests.includes(chestId)) {
    return dungeonState;
  }

  return {
    ...dungeonState,
    collected_chests: [...dungeonState.collected_chests, chestId],
  };
}

/**
 * Discover a secret
 */
export function discoverSecret(dungeonState: DungeonState, secretId: string): DungeonState {
  if (dungeonState.discovered_secrets.includes(secretId)) {
    return dungeonState;
  }

  return {
    ...dungeonState,
    discovered_secrets: [...dungeonState.discovered_secrets, secretId],
  };
}

/**
 * Unlock a shortcut
 */
export function unlockShortcut(dungeonState: DungeonState, floorNumber: number): DungeonState {
  if (dungeonState.unlocked_shortcuts.includes(floorNumber)) {
    return dungeonState;
  }

  return {
    ...dungeonState,
    unlocked_shortcuts: [...dungeonState.unlocked_shortcuts, floorNumber],
  };
}

/**
 * Mark boss as defeated
 */
export function defeatBoss(dungeonState: DungeonState): DungeonState {
  return {
    ...dungeonState,
    boss_defeated: true,
  };
}

/**
 * Get random enemy wave for current floor
 */
export function getRandomEnemyWave(
  dungeonState: DungeonState,
  rng: () => number
): EnemyWave | null {
  const floor = getCurrentFloor(dungeonState);
  if (!floor) return null;

  // Filter waves by spawn chance
  const possibleWaves = floor.enemy_waves.filter((wave) => rng() < wave.spawn_chance);

  if (possibleWaves.length === 0) return null;

  // Random select from possible waves
  const index = Math.floor(rng() * possibleWaves.length);
  return possibleWaves[index];
}

/**
 * Check if current floor has mini-boss
 */
export function hasMiniBoss(dungeonState: DungeonState): string | null {
  const floor = getCurrentFloor(dungeonState);
  return floor?.mini_boss || null;
}

/**
 * Check if current floor has floor boss
 */
export function hasFloorBoss(dungeonState: DungeonState): string | null {
  const floor = getCurrentFloor(dungeonState);
  return floor?.floor_boss || null;
}

/**
 * Get dungeon progress info
 */
export function getDungeonProgress(dungeonState: DungeonState): {
  currentFloor: number;
  totalFloors: number;
  floorsCleared: number;
  percentComplete: number;
  turnsRemaining: number | null;
  turnsSpent: number;
  chestsCollected: number;
  secretsFound: number;
} {
  const dungeon = getCurrentDungeon(dungeonState);

  if (!dungeon) {
    return {
      currentFloor: 0,
      totalFloors: 0,
      floorsCleared: 0,
      percentComplete: 0,
      turnsRemaining: null,
      turnsSpent: 0,
      chestsCollected: 0,
      secretsFound: 0,
    };
  }

  return {
    currentFloor: dungeonState.current_floor,
    totalFloors: dungeon.floors.length,
    floorsCleared: dungeonState.floors_cleared.length,
    percentComplete: Math.round((dungeonState.floors_cleared.length / dungeon.floors.length) * 100),
    turnsRemaining: dungeonState.turns_remaining ?? null,
    turnsSpent: dungeonState.turns_spent,
    chestsCollected: dungeonState.collected_chests.length,
    secretsFound: dungeonState.discovered_secrets.length,
  };
}

/**
 * Check if dungeon is complete (boss defeated on final floor)
 */
export function isDungeonComplete(dungeonState: DungeonState): boolean {
  const dungeon = getCurrentDungeon(dungeonState);
  if (!dungeon) return false;

  // Check if on final floor and boss defeated
  const finalFloor = dungeon.floors[dungeon.floors.length - 1];
  return dungeonState.current_floor === finalFloor.floor_number && dungeonState.boss_defeated;
}

/**
 * Get completion rewards
 */
export function getCompletionRewards(
  dungeonState: DungeonState,
  rng: () => number
): DungeonReward[] {
  const dungeon = getCurrentDungeon(dungeonState);
  if (!dungeon) return [];

  const rewards: DungeonReward[] = [];

  // Add base completion rewards
  for (const reward of dungeon.completion_rewards) {
    if (reward.chance === undefined || rng() < reward.chance) {
      rewards.push(reward);
    }
  }

  // Add first clear bonus if applicable
  const previousCompletion = dungeonState.completed_dungeons[dungeon.id];
  if (!previousCompletion && dungeon.first_clear_bonus) {
    rewards.push(...dungeon.first_clear_bonus);
  }

  return rewards;
}

/**
 * Get available chests on current floor
 */
export function getAvailableChests(dungeonState: DungeonState): {
  regular: number;
  hidden: number;
  collected: number;
} {
  const floor = getCurrentFloor(dungeonState);
  if (!floor) return { regular: 0, hidden: 0, collected: 0 };

  const collectedOnFloor = dungeonState.collected_chests.filter((id) =>
    id.startsWith(`floor_${dungeonState.current_floor}_`)
  ).length;

  return {
    regular: floor.chest_count,
    hidden: floor.hidden_chest_count || 0,
    collected: collectedOnFloor,
  };
}

/**
 * Check if floor has shortcut available
 */
export function canUnlockShortcut(
  dungeonState: DungeonState,
  playerItems: string[],
  playerSkills: string[]
): { canUnlock: boolean; reason?: string } {
  const floor = getCurrentFloor(dungeonState);
  if (!floor || !floor.has_shortcut) {
    return { canUnlock: false, reason: "No shortcut on this floor" };
  }

  if (dungeonState.unlocked_shortcuts.includes(floor.floor_number)) {
    return { canUnlock: false, reason: "Shortcut already unlocked" };
  }

  if (floor.shortcut_requirements) {
    if (
      floor.shortcut_requirements.item &&
      !playerItems.includes(floor.shortcut_requirements.item)
    ) {
      return { canUnlock: false, reason: `Requires item: ${floor.shortcut_requirements.item}` };
    }
    if (
      floor.shortcut_requirements.skill &&
      !playerSkills.includes(floor.shortcut_requirements.skill)
    ) {
      return { canUnlock: false, reason: `Requires skill: ${floor.shortcut_requirements.skill}` };
    }
  }

  return { canUnlock: true };
}

/**
 * Get dungeon difficulty rating relative to player
 */
export function getDifficultyRating(
  dungeonId: string,
  playerRealm: Realm
): "easy" | "normal" | "hard" | "deadly" {
  const dungeon = getDungeonById(dungeonId);
  if (!dungeon) return "normal";

  const playerIndex = REALM_ORDER.indexOf(playerRealm);
  const recommendedIndex = REALM_ORDER.indexOf(dungeon.recommended_realm);
  const diff = playerIndex - recommendedIndex;

  if (diff >= 2) return "easy";
  if (diff >= 0) return "normal";
  if (diff >= -1) return "hard";
  return "deadly";
}

/**
 * Check if dungeon has been cleared before
 */
export function hasBeenCleared(dungeonState: DungeonState, dungeonId: string): boolean {
  return dungeonId in dungeonState.completed_dungeons;
}

/**
 * Get best clear time for a dungeon
 */
export function getBestClearTime(dungeonState: DungeonState, dungeonId: string): number | null {
  const completion = dungeonState.completed_dungeons[dungeonId];
  return completion?.best_time || null;
}

/**
 * Get number of times cleared
 */
export function getTimesCleared(dungeonState: DungeonState, dungeonId: string): number {
  const completion = dungeonState.completed_dungeons[dungeonId];
  return completion?.times_cleared || 0;
}
