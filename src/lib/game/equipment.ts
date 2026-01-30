import { GameState, CharacterAttributes, CharacterStats } from "@/types/game";

/**
 * Calculate total attributes including equipment bonuses
 */
export function calculateTotalAttributes(state: GameState): CharacterAttributes {
  const base = { ...state.attrs };

  // Add bonuses from equipped items
  Object.values(state.equipped_items).forEach((item) => {
    if (item?.bonus_stats) {
      if (item.bonus_stats.str) base.str += item.bonus_stats.str;
      if (item.bonus_stats.agi) base.agi += item.bonus_stats.agi;
      if (item.bonus_stats.int) base.int += item.bonus_stats.int;
      if (item.bonus_stats.perception) base.perception += item.bonus_stats.perception;
      if (item.bonus_stats.luck) base.luck += item.bonus_stats.luck;
    }
  });

  return base;
}

/**
 * Calculate total max stats including equipment bonuses
 */
export function calculateTotalMaxStats(state: GameState): Partial<CharacterStats> {
  const bonuses: Partial<CharacterStats> = {
    hp_max: 0,
    qi_max: 0,
    stamina_max: 0,
  };

  // Add bonuses from equipped items
  Object.values(state.equipped_items).forEach((item) => {
    if (item?.bonus_stats) {
      if (item.bonus_stats.hp) bonuses.hp_max = (bonuses.hp_max || 0) + item.bonus_stats.hp;
      if (item.bonus_stats.qi) bonuses.qi_max = (bonuses.qi_max || 0) + item.bonus_stats.qi;
      if (item.bonus_stats.stamina)
        bonuses.stamina_max = (bonuses.stamina_max || 0) + item.bonus_stats.stamina;
    }
  });

  return bonuses;
}

/**
 * Get equipment bonus for a specific stat
 */
export function getEquipmentBonus(
  state: GameState,
  stat: keyof CharacterAttributes | "hp" | "qi" | "stamina" | "cultivation_speed"
): number {
  let bonus = 0;

  Object.values(state.equipped_items).forEach((item) => {
    if (item?.bonus_stats) {
      const value = item.bonus_stats[stat as keyof typeof item.bonus_stats];
      if (typeof value === "number") {
        bonus += value;
      }
    }
  });

  return bonus;
}
