import { GameState, CharacterAttributes, CharacterStats } from "@/types/game";
import { getEnhancedBonusStats } from "./enhancement";

/**
 * Calculate total attributes including equipment bonuses.
 * Equipment bonus is scaled by the item's `enhancement_level` via
 * `getEnhancedBonusStats` — that's the only way the "+N" multiplier from
 * Khắc Trận / Enhance actually reaches the character sheet and combat math.
 */
export function calculateTotalAttributes(state: GameState): CharacterAttributes {
  const base = { ...state.attrs };

  Object.values(state.equipped_items).forEach((item) => {
    if (!item) return;
    const stats = getEnhancedBonusStats(item);
    if (stats.str) base.str += stats.str;
    if (stats.agi) base.agi += stats.agi;
    if (stats.int) base.int += stats.int;
    if (stats.perception) base.perception += stats.perception;
    if (stats.luck) base.luck += stats.luck;
  });

  return base;
}

/**
 * Calculate total max stats including equipment bonuses (HP / Qi / Stamina).
 * Scaled by enhancement level — see `calculateTotalAttributes`.
 */
export function calculateTotalMaxStats(state: GameState): Partial<CharacterStats> {
  const bonuses: Partial<CharacterStats> = {
    hp_max: 0,
    qi_max: 0,
    stamina_max: 0,
  };

  Object.values(state.equipped_items).forEach((item) => {
    if (!item) return;
    const stats = getEnhancedBonusStats(item);
    if (stats.hp) bonuses.hp_max = (bonuses.hp_max || 0) + stats.hp;
    if (stats.qi) bonuses.qi_max = (bonuses.qi_max || 0) + stats.qi;
    if (stats.stamina) bonuses.stamina_max = (bonuses.stamina_max || 0) + stats.stamina;
  });

  return bonuses;
}

/**
 * Get equipment bonus for a specific stat (used by the CharacterSheet's
 * Sinh Lực bar subs and the Lục Diện Thuộc Tính row values). Scaled by
 * enhancement level via `getEnhancedBonusStats`.
 */
export function getEquipmentBonus(
  state: GameState,
  stat: keyof CharacterAttributes | "hp" | "qi" | "stamina" | "cultivation_speed"
): number {
  let bonus = 0;

  Object.values(state.equipped_items).forEach((item) => {
    if (!item) return;
    const stats = getEnhancedBonusStats(item);
    const value = stats[stat as keyof typeof stats];
    if (typeof value === "number") {
      bonus += value;
    }
  });

  return bonus;
}
