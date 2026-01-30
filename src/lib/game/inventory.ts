import { InventoryItem, ItemRarity, StorageRing, Inventory } from "@/types/game";

/**
 * Sort options for inventory
 */
export type SortOption = "name" | "type" | "rarity" | "quantity" | "recent";

/**
 * Filter options for inventory
 */
export type FilterOption = "all" | "equipment" | "consumable" | "material" | "book";

/**
 * Rarity order for sorting (higher = more rare)
 */
const RARITY_ORDER: Record<ItemRarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
};

/**
 * Type order for sorting
 */
const TYPE_ORDER: Record<string, number> = {
  Equipment: 1,
  Accessory: 2,
  Weapon: 3,
  Medicine: 4,
  Book: 5,
  Manual: 6,
  Material: 7,
  Effect: 8,
  Misc: 9,
};

/**
 * Sort inventory items
 */
export function sortItems(
  items: InventoryItem[],
  sortBy: SortOption,
  ascending: boolean = true
): InventoryItem[] {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "type":
        comparison = (TYPE_ORDER[a.type] || 99) - (TYPE_ORDER[b.type] || 99);
        // Secondary sort by rarity within same type
        if (comparison === 0) {
          comparison = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        }
        break;
      case "rarity":
        comparison = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        // Secondary sort by name within same rarity
        if (comparison === 0) {
          comparison = a.name.localeCompare(b.name);
        }
        break;
      case "quantity":
        comparison = b.quantity - a.quantity;
        break;
      case "recent":
        // Items are generally added at the end, so reverse order = most recent first
        // This is a simple approximation - for true "recent" we'd need timestamps
        comparison = 0; // Keep original order (most recent last in array)
        break;
    }

    return ascending ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filter inventory items
 */
export function filterItems(items: InventoryItem[], filter: FilterOption): InventoryItem[] {
  if (filter === "all") return items;

  return items.filter((item) => {
    switch (filter) {
      case "equipment":
        return item.type === "Equipment" || item.type === "Accessory";
      case "consumable":
        return item.type === "Medicine" || item.type === "Effect";
      case "material":
        return item.type === "Material" || item.type === "Misc";
      case "book":
        return item.type === "Book" || item.type === "Manual";
      default:
        return true;
    }
  });
}

/**
 * Search items by name
 */
export function searchItems(
  items: InventoryItem[],
  query: string,
  locale: "vi" | "en"
): InventoryItem[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    const name = locale === "vi" ? item.name : item.name_en;
    const description = locale === "vi" ? item.description : item.description_en;

    return (
      name.toLowerCase().includes(lowerQuery) ||
      description.toLowerCase().includes(lowerQuery) ||
      item.type.toLowerCase().includes(lowerQuery) ||
      item.rarity.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Auto-sort items by type and rarity (convenience function)
 */
export function autoSortItems(items: InventoryItem[]): InventoryItem[] {
  return sortItems(items, "type", true);
}

/**
 * Calculate total inventory capacity
 */
export function getTotalCapacity(inventory: Inventory): number {
  const baseCapacity = inventory.max_slots || 20;
  const ringCapacity = inventory.storage_ring?.capacity || 0;
  return baseCapacity + ringCapacity;
}

/**
 * Check if inventory is full
 */
export function isInventoryFull(inventory: Inventory): boolean {
  const totalCapacity = getTotalCapacity(inventory);
  return inventory.items.length >= totalCapacity;
}

/**
 * Get inventory usage info
 */
export function getInventoryUsage(inventory: Inventory): {
  used: number;
  total: number;
  percentage: number;
} {
  const total = getTotalCapacity(inventory);
  const used = inventory.items.length;
  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
  };
}

/**
 * Available storage rings that can be found/purchased
 */
export const STORAGE_RINGS: StorageRing[] = [
  {
    id: "storage_ring_basic",
    name: "Trữ Vật Giới (Cơ Bản)",
    name_en: "Basic Storage Ring",
    capacity: 10,
    rarity: "Common",
  },
  {
    id: "storage_ring_uncommon",
    name: "Trữ Vật Giới (Tốt)",
    name_en: "Uncommon Storage Ring",
    capacity: 20,
    rarity: "Uncommon",
  },
  {
    id: "storage_ring_rare",
    name: "Trữ Vật Giới (Hiếm)",
    name_en: "Rare Storage Ring",
    capacity: 35,
    rarity: "Rare",
  },
  {
    id: "storage_ring_epic",
    name: "Trữ Vật Giới (Sử Thi)",
    name_en: "Epic Storage Ring",
    capacity: 50,
    rarity: "Epic",
  },
  {
    id: "storage_ring_legendary",
    name: "Vô Tận Trữ Vật Giới",
    name_en: "Infinite Storage Ring",
    capacity: 100,
    rarity: "Legendary",
  },
];

/**
 * Get storage ring by ID
 */
export function getStorageRingById(id: string): StorageRing | undefined {
  return STORAGE_RINGS.find((ring) => ring.id === id);
}

/**
 * Filter labels for UI
 */
export const FILTER_LABELS: Record<FilterOption, { vi: string; en: string }> = {
  all: { vi: "Tất cả", en: "All" },
  equipment: { vi: "Trang bị", en: "Equipment" },
  consumable: { vi: "Tiêu hao", en: "Consumables" },
  material: { vi: "Nguyên liệu", en: "Materials" },
  book: { vi: "Sách/Bí kíp", en: "Books" },
};

/**
 * Sort labels for UI
 */
export const SORT_LABELS: Record<SortOption, { vi: string; en: string }> = {
  name: { vi: "Tên", en: "Name" },
  type: { vi: "Loại", en: "Type" },
  rarity: { vi: "Độ hiếm", en: "Rarity" },
  quantity: { vi: "Số lượng", en: "Quantity" },
  recent: { vi: "Gần đây", en: "Recent" },
};
