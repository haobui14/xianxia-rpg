import {
  GameState,
  Locale,
  ItemRarity,
  InventoryItem,
  EquipmentSlot,
} from "@/types/game";
import { DeterministicRNG } from "../game/rng";

export interface LootEntry {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: InventoryItem["type"];
  rarity: ItemRarity;
  effects?: Record<string, any>;
  weight: number; // Higher = more common
  equipment_slot?: EquipmentSlot;
  bonus_stats?: InventoryItem["bonus_stats"];
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

// Enhancement materials - can be obtained from various sources
export const ENHANCEMENT_MATERIALS: LootEntry[] = [
  {
    id: "enhancement_stone_common",
    name: "Đá Cường Hóa (Thường)",
    name_en: "Enhancement Stone (Common)",
    description: "Đá cường hóa cơ bản, dùng để nâng cấp trang bị +1 đến +3.",
    description_en:
      "Basic enhancement stone, used to upgrade equipment from +1 to +3.",
    type: "Material",
    rarity: "Common",
    weight: 40,
  },
  {
    id: "enhancement_stone_uncommon",
    name: "Đá Cường Hóa (Tốt)",
    name_en: "Enhancement Stone (Uncommon)",
    description:
      "Đá cường hóa chất lượng tốt, dùng để nâng cấp trang bị +4 đến +6.",
    description_en:
      "Good quality enhancement stone, used to upgrade equipment from +4 to +6.",
    type: "Material",
    rarity: "Uncommon",
    weight: 25,
  },
  {
    id: "enhancement_stone_rare",
    name: "Đá Cường Hóa (Hiếm)",
    name_en: "Enhancement Stone (Rare)",
    description: "Đá cường hóa hiếm, dùng để nâng cấp trang bị +7 đến +9.",
    description_en:
      "Rare enhancement stone, used to upgrade equipment from +7 to +9.",
    type: "Material",
    rarity: "Rare",
    weight: 15,
  },
  {
    id: "enhancement_stone_epic",
    name: "Đá Cường Hóa (Sử Thi)",
    name_en: "Enhancement Stone (Epic)",
    description: "Đá cường hóa cực phẩm, dùng để nâng cấp trang bị lên +10.",
    description_en: "Epic enhancement stone, used to upgrade equipment to +10.",
    type: "Material",
    rarity: "Epic",
    weight: 5,
  },
];

// Define loot tables
export const LOOT_TABLES: Record<string, LootTable> = {
  common_herbs: {
    id: "common_herbs",
    tier: 1,
    silverRange: [20, 80],
    spiritStoneChance: 0.3,
    spiritStoneRange: [1, 5],
    entries: [
      {
        id: "lingzhi_grass",
        name: "Linh Chi Thảo",
        name_en: "Spirit Grass",
        description:
          "Cỏ linh thảo thông thường, có thể dùng để luyện đan dược.",
        description_en: "Common spirit grass, can be used for alchemy.",
        type: "Material",
        rarity: "Common",
        weight: 50,
      },
      {
        id: "moonlight_flower",
        name: "Nguyệt Quang Hoa",
        name_en: "Moonlight Flower",
        description: "Hoa nở dưới ánh trăng, hồi phục linh lực.",
        description_en: "Flower that blooms under moonlight, restores Qi.",
        type: "Material",
        rarity: "Uncommon",
        effects: { qi_restore: 20 },
        weight: 20,
      },
      {
        id: "healing_herb",
        name: "Chỉ Huyết Thảo",
        name_en: "Healing Herb",
        description: "Thảo dược cầm máu và hồi phục sinh lực.",
        description_en: "Herb that stops bleeding and restores vitality.",
        type: "Medicine",
        rarity: "Common",
        effects: { hp_restore: 30 },
        weight: 30,
      },
    ],
  },

  bandit_loot: {
    id: "bandit_loot",
    tier: 1,
    silverRange: [50, 150],
    spiritStoneChance: 0.4,
    spiritStoneRange: [2, 8],
    entries: [
      {
        id: "iron_sword",
        name: "Kiếm Sắt",
        name_en: "Iron Sword",
        description: "Một thanh kiếm sắt thông thường.",
        description_en: "An ordinary iron sword.",
        type: "Equipment",
        rarity: "Common",
        equipment_slot: "Weapon",
        bonus_stats: { str: 2 },
        weight: 30,
      },
      {
        id: "leather_armor",
        name: "Giáp Da",
        name_en: "Leather Armor",
        description: "Áo giáp da đơn giản, tăng phòng thủ.",
        description_en: "Simple leather armor, increases defense.",
        type: "Equipment",
        rarity: "Common",
        equipment_slot: "Chest",
        bonus_stats: { hp: 20 },
        weight: 25,
      },
      {
        id: "healing_pill",
        name: "Hồi Huyết Đan",
        name_en: "Healing Pill",
        description: "Đan dược phổ thông, hồi phục 50 HP.",
        description_en: "Common pill, restores 50 HP.",
        type: "Medicine",
        rarity: "Common",
        effects: { hp_restore: 50 },
        weight: 45,
      },
      // Enhancement stones
      ENHANCEMENT_MATERIALS[0], // Common enhancement stone
    ],
  },

  cave_treasure: {
    id: "cave_treasure",
    tier: 2,
    silverRange: [100, 300],
    spiritStoneChance: 0.6,
    spiritStoneRange: [5, 15],
    entries: [
      {
        id: "qi_condensation_manual",
        name: "Luyện Khí Tâm Pháp",
        name_en: "Qi Condensation Manual",
        description: "Bí tịch luyện khí cơ bản, tăng tốc độ tu luyện.",
        description_en:
          "Basic Qi cultivation manual, increases cultivation speed.",
        type: "Manual",
        rarity: "Uncommon",
        effects: { cultivation_speed: 1.2 },
        weight: 20,
      },
      {
        id: "spirit_stone_fragment",
        name: "Mảnh Linh Thạch",
        name_en: "Spirit Stone Fragment",
        description: "Mảnh vỡ của linh thạch, chứa linh khí tinh túy.",
        description_en:
          "Fragment of spirit stone, contains pure spiritual energy.",
        type: "Material",
        rarity: "Rare",
        weight: 15,
      },
      {
        id: "jade_pendant",
        name: "Ngọc Bội",
        name_en: "Jade Pendant",
        description: "Ngọc bội thần bí, tăng may mắn.",
        description_en: "Mysterious jade pendant, increases luck.",
        type: "Equipment",
        rarity: "Rare",
        equipment_slot: "Accessory",
        bonus_stats: { luck: 2 },
        weight: 10,
      },
      {
        id: "qi_gathering_pill",
        name: "Tụ Khí Đan",
        name_en: "Qi Gathering Pill",
        description: "Đan dược giúp tăng Linh lực tối đa.",
        description_en: "Pill that increases maximum Qi.",
        type: "Medicine",
        rarity: "Uncommon",
        effects: { qi_max_bonus: 20 },
        weight: 25,
      },
      // Enhancement stones - common and uncommon
      ENHANCEMENT_MATERIALS[0], // Common enhancement stone
      ENHANCEMENT_MATERIALS[1], // Uncommon enhancement stone
    ],
  },

  // Higher tier loot table with rare enhancement stones
  dungeon_boss: {
    id: "dungeon_boss",
    tier: 3,
    silverRange: [300, 800],
    spiritStoneChance: 0.8,
    spiritStoneRange: [10, 30],
    entries: [
      {
        id: "spirit_sword",
        name: "Linh Kiếm",
        name_en: "Spirit Sword",
        description: "Kiếm chứa linh khí, tăng sức mạnh đáng kể.",
        description_en:
          "Sword imbued with spiritual energy, significantly increases strength.",
        type: "Equipment",
        rarity: "Rare",
        equipment_slot: "Weapon",
        bonus_stats: { str: 8, agi: 3 },
        weight: 20,
      },
      {
        id: "mystic_robe",
        name: "Huyền Bào",
        name_en: "Mystic Robe",
        description: "Áo bào huyền bí, tăng trí tuệ và khí.",
        description_en: "Mysterious robe, increases intelligence and Qi.",
        type: "Equipment",
        rarity: "Rare",
        equipment_slot: "Chest",
        bonus_stats: { int: 5, qi: 30 },
        weight: 20,
      },
      {
        id: "foundation_pill",
        name: "Trúc Cơ Đan",
        name_en: "Foundation Pill",
        description: "Đan dược quý hiếm giúp đột phá cảnh giới.",
        description_en: "Rare pill that helps breakthrough cultivation realm.",
        type: "Medicine",
        rarity: "Epic",
        effects: { cultivation_exp: 500 },
        weight: 10,
      },
      // Enhancement stones - uncommon to epic
      ENHANCEMENT_MATERIALS[1], // Uncommon enhancement stone
      ENHANCEMENT_MATERIALS[2], // Rare enhancement stone
      ENHANCEMENT_MATERIALS[3], // Epic enhancement stone
    ],
  },
};

/**
 * Generate loot from a loot table
 */
export function generateLoot(
  lootTableId: string,
  rng: DeterministicRNG,
  locale: Locale,
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
      table.spiritStoneRange[1],
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
  rng: DeterministicRNG,
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
  items: InventoryItem[],
): boolean {
  const table = LOOT_TABLES[lootTableId];
  if (!table) return false;

  // Check all items are in the loot table
  const validIds = new Set(table.entries.map((e) => e.id));
  return items.every((item) => validIds.has(item.id));
}
