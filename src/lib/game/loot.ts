import { GameState, Locale, ItemRarity, InventoryItem, EquipmentSlot } from '@/types/game';
import { DeterministicRNG } from '../game/rng';

export interface LootEntry {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: InventoryItem['type'];
  rarity: ItemRarity;
  effects?: Record<string, any>;
  weight: number; // Higher = more common
  equipment_slot?: EquipmentSlot;
  bonus_stats?: InventoryItem['bonus_stats'];
  level_requirement?: number;
}

export interface LootTable {
  id: string;
  tier: number; // Difficulty tier
  entries: LootEntry[];
  silverRange: [number, number];
  spiritStoneChance: number;
  spiritStoneRange: [number, number];
}

// Define loot tables
export const LOOT_TABLES: Record<string, LootTable> = {
  common_herbs: {
    id: 'common_herbs',
    tier: 1,
    silverRange: [5, 20],
    spiritStoneChance: 0.05,
    spiritStoneRange: [1, 2],
    entries: [
      {
        id: 'lingzhi_grass',
        name: 'Linh Chi Thảo',
        name_en: 'Spirit Grass',
        description: 'Cỏ linh thảo thông thường, có thể dùng để luyện đan dược.',
        description_en: 'Common spirit grass, can be used for alchemy.',
        type: 'Material',
        rarity: 'Common',
        weight: 50,
      },
      {
        id: 'moonlight_flower',
        name: 'Nguyệt Quang Hoa',
        name_en: 'Moonlight Flower',
        description: 'Hoa nở dưới ánh trăng, hồi phục linh lực.',
        description_en: 'Flower that blooms under moonlight, restores Qi.',
        type: 'Material',
        rarity: 'Uncommon',
        effects: { qi_restore: 20 },
        weight: 20,
      },
      {
        id: 'healing_herb',
        name: 'Chỉ Huyết Thảo',
        name_en: 'Healing Herb',
        description: 'Thảo dược cầm máu và hồi phục sinh lực.',
        description_en: 'Herb that stops bleeding and restores vitality.',
        type: 'Medicine',
        rarity: 'Common',
        effects: { hp_restore: 30 },
        weight: 30,
      },
    ],
  },

  bandit_loot: {
    id: 'bandit_loot',
    tier: 1,
    silverRange: [20, 50],
    spiritStoneChance: 0.1,
    spiritStoneRange: [1, 3],
    entries: [
      {
        id: 'iron_sword',
        name: 'Kiếm Sắt',
        name_en: 'Iron Sword',
        description: 'Một thanh kiếm sắt thông thường.',
        description_en: 'An ordinary iron sword.',
        type: 'Equipment',
        rarity: 'Common',
        equipment_slot: 'Weapon',
        bonus_stats: { str: 2 },
        weight: 30,
      },
      {
        id: 'leather_armor',
        name: 'Giáp Da',
        name_en: 'Leather Armor',
        description: 'Áo giáp da đơn giản, tăng phòng thủ.',
        description_en: 'Simple leather armor, increases defense.',
        type: 'Equipment',
        rarity: 'Common',
        equipment_slot: 'Chest',
        bonus_stats: { hp: 20 },
        weight: 25,
      },
      {
        id: 'healing_pill',
        name: 'Hồi Huyết Đan',
        name_en: 'Healing Pill',
        description: 'Đan dược phổ thông, hồi phục 50 HP.',
        description_en: 'Common pill, restores 50 HP.',
        type: 'Medicine',
        rarity: 'Common',
        effects: { hp_restore: 50 },
        weight: 45,
      },
    ],
  },

  cave_treasure: {
    id: 'cave_treasure',
    tier: 2,
    silverRange: [50, 150],
    spiritStoneChance: 0.3,
    spiritStoneRange: [2, 5],
    entries: [
      {
        id: 'qi_condensation_manual',
        name: 'Luyện Khí Tâm Pháp',
        name_en: 'Qi Condensation Manual',
        description: 'Bí tịch luyện khí cơ bản, tăng tốc độ tu luyện.',
        description_en: 'Basic Qi cultivation manual, increases cultivation speed.',
        type: 'Manual',
        rarity: 'Uncommon',
        effects: { cultivation_speed: 1.2 },
        weight: 20,
      },
      {
        id: 'spirit_stone_fragment',
        name: 'Mảnh Linh Thạch',
        name_en: 'Spirit Stone Fragment',
        description: 'Mảnh vỡ của linh thạch, chứa linh khí tinh túy.',
        description_en: 'Fragment of spirit stone, contains pure spiritual energy.',
        type: 'Material',
        rarity: 'Rare',
        weight: 15,
      },
      {
        id: 'jade_pendant',
        name: 'Ngọc Bội',
        name_en: 'Jade Pendant',
        description: 'Ngọc bội thần bí, tăng may mắn.',
        description_en: 'Mysterious jade pendant, increases luck.',
        type: 'Equipment',
        rarity: 'Rare',
        equipment_slot: 'Accessory',
        bonus_stats: { luck: 2 },
        weight: 10,
      },
      {
        id: 'qi_gathering_pill',
        name: 'Tụ Khí Đan',
        name_en: 'Qi Gathering Pill',
        description: 'Đan dược giúp tăng Linh lực tối đa.',
        description_en: 'Pill that increases maximum Qi.',
        type: 'Medicine',
        rarity: 'Uncommon',
        effects: { qi_max_bonus: 20 },
        weight: 25,
      },
    ],
  },
};

/**
 * Generate loot from a loot table
 */
export function generateLoot(
  lootTableId: string,
  rng: DeterministicRNG,
  locale: Locale
): {
  items: InventoryItem[];
  silver: number;
  spiritStones: number;
} {
  const table = LOOT_TABLES[lootTableId];
  if (!table) {
    return { items: [], silver: 0, spiritStones: 0 };
  }

  const items: InventoryItem[] = [];

  // Generate silver
  const silver = rng.randomInt(table.silverRange[0], table.silverRange[1]);

  // Generate spirit stones
  let spiritStones = 0;
  if (rng.chance(table.spiritStoneChance)) {
    spiritStones = rng.randomInt(
      table.spiritStoneRange[0],
      table.spiritStoneRange[1]
    );
  }

  // Generate 1-3 items
  const itemCount = rng.randomInt(1, 3);
  for (let i = 0; i < itemCount; i++) {
    const entry = selectWeightedEntry(table.entries, rng);
    if (entry) {
      items.push({
        id: entry.id,
        name: entry.name,
        name_en: entry.name_en,
        description: entry.description,
        description_en: entry.description_en,
        type: entry.type,
        rarity: entry.rarity,
        quantity: 1,
        effects: entry.effects,
      });
    }
  }

  return { items, silver, spiritStones };
}

/**
 * Select entry from weighted list
 */
function selectWeightedEntry<T extends { weight: number }>(
  entries: T[],
  rng: DeterministicRNG
): T | null {
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng.random() * totalWeight;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry;
    }
  }

  return entries[entries.length - 1];
}

/**
 * Validate that loot is legitimate for the given tier
 */
export function validateLoot(
  lootTableId: string,
  items: InventoryItem[]
): boolean {
  const table = LOOT_TABLES[lootTableId];
  if (!table) return false;

  // Check all items are in the loot table
  const validIds = new Set(table.entries.map((e) => e.id));
  return items.every((item) => validIds.has(item.id));
}
