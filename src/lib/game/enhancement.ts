import { InventoryItem, GameState } from '@/types/game';
import { DeterministicRNG } from './rng';

/**
 * Enhancement configuration
 * Each level has a silver cost and success rate
 */
export const ENHANCEMENT_CONFIG: Record<number, { silver: number; successRate: number }> = {
  1: { silver: 100, successRate: 1.0 },
  2: { silver: 200, successRate: 1.0 },
  3: { silver: 400, successRate: 0.95 },
  4: { silver: 800, successRate: 0.90 },
  5: { silver: 1500, successRate: 0.85 },
  6: { silver: 3000, successRate: 0.75 },
  7: { silver: 5000, successRate: 0.65 },
  8: { silver: 8000, successRate: 0.55 },
  9: { silver: 12000, successRate: 0.45 },
  10: { silver: 20000, successRate: 0.35 },
};

/**
 * Enhancement materials required per level
 */
export const ENHANCEMENT_MATERIALS: Record<number, { id: string; quantity: number }[]> = {
  1: [{ id: 'enhancement_stone_common', quantity: 1 }],
  2: [{ id: 'enhancement_stone_common', quantity: 2 }],
  3: [{ id: 'enhancement_stone_common', quantity: 3 }],
  4: [{ id: 'enhancement_stone_uncommon', quantity: 1 }],
  5: [{ id: 'enhancement_stone_uncommon', quantity: 2 }],
  6: [{ id: 'enhancement_stone_uncommon', quantity: 3 }],
  7: [{ id: 'enhancement_stone_rare', quantity: 1 }],
  8: [{ id: 'enhancement_stone_rare', quantity: 2 }],
  9: [{ id: 'enhancement_stone_rare', quantity: 3 }],
  10: [{ id: 'enhancement_stone_epic', quantity: 1 }],
};

/**
 * Stat multiplier per enhancement level (10% per level)
 */
export const STAT_MULTIPLIER_PER_LEVEL = 0.1;

export interface EnhancementCost {
  silver: number;
  materials: { id: string; name: string; name_en: string; quantity: number; hasEnough: boolean }[];
  successRate: number;
  canAfford: boolean;
}

export interface EnhancementResult {
  success: boolean;
  newLevel: number;
  previousLevel: number;
  itemDestroyed?: boolean; // For future: high level failures might destroy item
  statIncrease?: Record<string, number>;
}

/**
 * Get the display name for an enhanced item
 */
export function getEnhancedItemName(item: InventoryItem, locale: 'vi' | 'en'): string {
  const level = item.enhancement_level || 0;
  const baseName = locale === 'vi' ? item.name : item.name_en;
  if (level === 0) return baseName;
  return `+${level} ${baseName}`;
}

/**
 * Get enhancement level color class
 */
export function getEnhancementColor(level: number): string {
  if (level === 0) return '';
  if (level <= 3) return 'text-green-400';
  if (level <= 6) return 'text-blue-400';
  if (level <= 9) return 'text-purple-400';
  return 'text-yellow-400'; // +10
}

/**
 * Check if an item can be enhanced
 */
export function canEnhance(item: InventoryItem): boolean {
  // Only equipment can be enhanced
  if (item.type !== 'Equipment' && item.type !== 'Accessory') return false;

  const currentLevel = item.enhancement_level || 0;
  const maxLevel = item.max_enhancement || 10;

  return currentLevel < maxLevel;
}

/**
 * Get the cost to enhance an item to the next level
 */
export function getEnhancementCost(item: InventoryItem, state: GameState): EnhancementCost {
  const currentLevel = item.enhancement_level || 0;
  const nextLevel = currentLevel + 1;

  if (nextLevel > 10) {
    return {
      silver: 0,
      materials: [],
      successRate: 0,
      canAfford: false,
    };
  }

  const config = ENHANCEMENT_CONFIG[nextLevel];
  const requiredMaterials = ENHANCEMENT_MATERIALS[nextLevel] || [];

  // Check material availability
  const materials = requiredMaterials.map(req => {
    const inventoryItem = state.inventory.items.find(i => i.id === req.id);
    const hasEnough = inventoryItem ? inventoryItem.quantity >= req.quantity : false;

    // Get material display names
    const materialNames: Record<string, { vi: string; en: string }> = {
      'enhancement_stone_common': { vi: 'Đá Cường Hóa (Thường)', en: 'Enhancement Stone (Common)' },
      'enhancement_stone_uncommon': { vi: 'Đá Cường Hóa (Tốt)', en: 'Enhancement Stone (Uncommon)' },
      'enhancement_stone_rare': { vi: 'Đá Cường Hóa (Hiếm)', en: 'Enhancement Stone (Rare)' },
      'enhancement_stone_epic': { vi: 'Đá Cường Hóa (Sử Thi)', en: 'Enhancement Stone (Epic)' },
    };

    return {
      id: req.id,
      name: materialNames[req.id]?.vi || req.id,
      name_en: materialNames[req.id]?.en || req.id,
      quantity: req.quantity,
      hasEnough,
    };
  });

  const hasSilver = state.inventory.silver >= config.silver;
  const hasAllMaterials = materials.every(m => m.hasEnough);

  return {
    silver: config.silver,
    materials,
    successRate: config.successRate,
    canAfford: hasSilver && hasAllMaterials,
  };
}

/**
 * Calculate enhanced stats for an item
 */
export function calculateEnhancedStats(
  baseStats: Record<string, number>,
  enhancementLevel: number
): Record<string, number> {
  if (enhancementLevel === 0) return baseStats;

  const multiplier = 1 + (enhancementLevel * STAT_MULTIPLIER_PER_LEVEL);
  const enhancedStats: Record<string, number> = {};

  for (const [stat, value] of Object.entries(baseStats)) {
    // Round to nearest integer for stats
    enhancedStats[stat] = Math.round(value * multiplier);
  }

  return enhancedStats;
}

/**
 * Get the stat difference between current and next enhancement level
 */
export function getStatDifference(
  item: InventoryItem
): Record<string, { current: number; next: number; diff: number }> {
  if (!item.bonus_stats) return {};

  const currentLevel = item.enhancement_level || 0;
  const nextLevel = currentLevel + 1;

  const currentStats = calculateEnhancedStats(item.bonus_stats as Record<string, number>, currentLevel);
  const nextStats = calculateEnhancedStats(item.bonus_stats as Record<string, number>, nextLevel);

  const diff: Record<string, { current: number; next: number; diff: number }> = {};

  for (const stat of Object.keys(item.bonus_stats)) {
    const currentVal = currentStats[stat] || 0;
    const nextVal = nextStats[stat] || 0;
    if (currentVal > 0 || nextVal > 0) {
      diff[stat] = {
        current: currentVal,
        next: nextVal,
        diff: nextVal - currentVal,
      };
    }
  }

  return diff;
}

/**
 * Attempt to enhance an item
 */
export function attemptEnhancement(
  item: InventoryItem,
  state: GameState,
  rng: DeterministicRNG
): { success: boolean; result: EnhancementResult; updatedState: GameState } {
  const currentLevel = item.enhancement_level || 0;
  const nextLevel = currentLevel + 1;

  const cost = getEnhancementCost(item, state);

  if (!cost.canAfford || nextLevel > 10) {
    return {
      success: false,
      result: {
        success: false,
        newLevel: currentLevel,
        previousLevel: currentLevel,
      },
      updatedState: state,
    };
  }

  // Create a copy of the state to modify
  const newState = JSON.parse(JSON.stringify(state)) as GameState;

  // Deduct silver
  newState.inventory.silver -= cost.silver;

  // Deduct materials
  for (const material of cost.materials) {
    const materialIndex = newState.inventory.items.findIndex(i => i.id === material.id);
    if (materialIndex !== -1) {
      newState.inventory.items[materialIndex].quantity -= material.quantity;
      if (newState.inventory.items[materialIndex].quantity <= 0) {
        newState.inventory.items.splice(materialIndex, 1);
      }
    }
  }

  // Roll for success
  const roll = rng.random();
  const success = roll < cost.successRate;

  if (success) {
    // Find and update the item
    const itemIndex = newState.inventory.items.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
      newState.inventory.items[itemIndex].enhancement_level = nextLevel;
    }

    // Also update equipped item if this is equipped
    if (item.is_equipped && item.equipment_slot) {
      const equippedItem = newState.equipped_items[item.equipment_slot];
      if (equippedItem && equippedItem.id === item.id) {
        equippedItem.enhancement_level = nextLevel;
      }
    }

    // Calculate stat increase
    const statDiff = getStatDifference(item);
    const statIncrease: Record<string, number> = {};
    for (const [stat, diff] of Object.entries(statDiff)) {
      statIncrease[stat] = diff.diff;
    }

    return {
      success: true,
      result: {
        success: true,
        newLevel: nextLevel,
        previousLevel: currentLevel,
        statIncrease,
      },
      updatedState: newState,
    };
  }

  // Failed - level stays the same (no item destruction for now)
  return {
    success: false,
    result: {
      success: false,
      newLevel: currentLevel,
      previousLevel: currentLevel,
    },
    updatedState: newState,
  };
}
