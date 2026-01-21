import {
  GameState,
  CharacterStats,
  CharacterAttributes,
  SpiritRoot,
  Element,
  SpiritRootGrade,
  Inventory,
  CultivationProgress,
  TimeSegment,
  Realm,
} from "@/types/game";
import { DeterministicRNG } from "./rng";

/**
 * Create initial game state for a new character
 */
export function createInitialState(
  name: string,
  age: number,
  spiritRoot: SpiritRoot,
  locale: "vi" | "en",
): GameState {
  const baseStats: CharacterStats = {
    hp: 100,
    hp_max: 100,
    qi: 0,
    qi_max: 0,
    stamina: 999999, // Testing: Unlimited stamina
    stamina_max: 999999,
  };

  const baseAttrs: CharacterAttributes = {
    str: 3,
    agi: 3,
    int: 3,
    perception: 3,
    luck: 3,
  };

  const progress: CultivationProgress = {
    realm: "PhàmNhân",
    realm_stage: 0,
    cultivation_exp: 0,
  };

  const inventory: Inventory = {
    silver: 100,
    spirit_stones: 0,
    items: [],
  };

  const storySummary =
    locale === "vi"
      ? `${name}, một phàm nhân ${age} tuổi, chưa có công pháp hay kĩ năng gì, mới bắt đầu hành trình tu tiên.`
      : `${name}, a ${age}-year-old mortal with no cultivation techniques or skills, has just begun the journey of cultivation.`;

  return {
    stats: baseStats,
    attrs: baseAttrs,
    progress,
    spirit_root: spiritRoot,
    inventory,
    equipped_items: {},
    location: {
      region: locale === "vi" ? "Núi Thanh Vân" : "Azure Cloud Mountains",
      place: locale === "vi" ? "Làng Liễu" : "Willow Village",
    },
    time_day: 1,
    time_month: 1,
    time_year: 1,
    time_segment: "Sáng",
    karma: 0,
    reputation: 0,
    age,
    flags: {},
    story_summary: storySummary,
    turn_count: 0,
    last_stamina_regen: new Date().toISOString(),
    skills: [],
    techniques: [],
    skill_queue: [],
    technique_queue: [],
    sect: undefined,
    sect_en: undefined,
    market: {
      items: [],
      last_regenerated: new Date().toISOString(),
      next_regeneration: {
        month: 2, // Next market refresh at month 2
        year: 1,
      },
    },
  };
}

/**
 * Generate random spirit root
 */
export function generateSpiritRoot(rng: DeterministicRNG): SpiritRoot {
  const allElements: Element[] = ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"];
  const grades: SpiritRootGrade[] = ["PhổThông", "Khá", "Hiếm", "ThiênPhẩm"];

  // Random grade (weighted)
  const gradeRoll = rng.random();
  let grade: SpiritRootGrade;
  if (gradeRoll < 0.6) {
    grade = "PhổThông";
  } else if (gradeRoll < 0.85) {
    grade = "Khá";
  } else if (gradeRoll < 0.97) {
    grade = "Hiếm";
  } else {
    grade = "ThiênPhẩm";
  }

  // Number of elements (1-2 for MVP)
  const elementCount = rng.chance(0.7) ? 1 : 2;
  const elements: Element[] = [];

  for (let i = 0; i < elementCount; i++) {
    let element: Element;
    do {
      element = rng.randomElement(allElements);
    } while (elements.includes(element));
    elements.push(element);
  }

  return { elements, grade };
}

/**
 * Clamp stat to valid range
 */
export function clampStat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Update stamina (cannot exceed max)
 */
export function updateStamina(state: GameState, delta: number): void {
  state.stats.stamina = clampStat(
    state.stats.stamina + delta,
    0,
    state.stats.stamina_max,
  );
}

/**
 * Regenerate stamina based on real-time elapsed (1 stamina per minute)
 */
export function regenerateStamina(state: GameState): void {
  const now = new Date();
  const lastRegen = state.last_stamina_regen
    ? new Date(state.last_stamina_regen)
    : now;
  const minutesElapsed = Math.floor(
    (now.getTime() - lastRegen.getTime()) / 60000,
  );

  if (minutesElapsed > 0 && state.stats.stamina < state.stats.stamina_max) {
    const staminaToRegen = Math.min(
      minutesElapsed,
      state.stats.stamina_max - state.stats.stamina,
    );
    state.stats.stamina += staminaToRegen;
    state.last_stamina_regen = now.toISOString();
  }
}

/**
 * Update HP (cannot exceed max or go below 0)
 */
export function updateHP(state: GameState, delta: number): void {
  state.stats.hp = clampStat(state.stats.hp + delta, 0, state.stats.hp_max);
}

/**
 * Update Qi (cannot exceed max or go below 0)
 */
export function updateQi(state: GameState, delta: number): void {
  state.stats.qi = clampStat(state.stats.qi + delta, 0, state.stats.qi_max);
}

/**
 * Advance game time (30 days per month, 12 months per year)
 */
export function advanceTime(state: GameState, segments: number = 1): void {
  const timeOrder: TimeSegment[] = ["Sáng", "Chiều", "Tối", "Đêm"];
  let currentIndex = timeOrder.indexOf(state.time_segment);

  for (let i = 0; i < segments; i++) {
    currentIndex++;
    if (currentIndex >= timeOrder.length) {
      currentIndex = 0;
      state.time_day++;

      // Advance month after 30 days
      if (state.time_day > 30) {
        state.time_day = 1;
        state.time_month++;

        // Advance year after 12 months
        if (state.time_month > 12) {
          state.time_month = 1;
          state.time_year++;
          state.age++; // Age increases with year
        }
      }
    }
  }

  state.time_segment = timeOrder[currentIndex];
}

/**
 * Check if character can afford a cost
 */
export function canAffordCost(
  state: GameState,
  cost: {
    stamina?: number;
    qi?: number;
    silver?: number;
    spirit_stones?: number;
  },
): boolean {
  if (cost.stamina && state.stats.stamina < cost.stamina) return false;
  if (cost.qi && state.stats.qi < cost.qi) return false;
  if (cost.silver && state.inventory.silver < cost.silver) return false;
  if (cost.spirit_stones && state.inventory.spirit_stones < cost.spirit_stones)
    return false;
  return true;
}

/**
 * Apply cost to state
 */
export function applyCost(
  state: GameState,
  cost: {
    stamina?: number;
    qi?: number;
    silver?: number;
    spirit_stones?: number;
    time_segments?: number;
  },
): void {
  if (cost.stamina) updateStamina(state, -cost.stamina);
  if (cost.qi) updateQi(state, -cost.qi);
  if (cost.silver) state.inventory.silver -= cost.silver;
  if (cost.spirit_stones) state.inventory.spirit_stones -= cost.spirit_stones;
  if (cost.time_segments) advanceTime(state, cost.time_segments);
}

/**
 * Get spirit root bonus multiplier
 */
export function getSpiritRootBonus(grade: SpiritRootGrade): number {
  switch (grade) {
    case "ThiênPhẩm":
      return 2.0;
    case "Hiếm":
      return 1.5;
    case "Khá":
      return 1.2;
    case "PhổThông":
      return 1.0;
  }
}

/**
 * Element interaction table (Wu Xing - Five Elements)
 * Kim (Metal) -> Mộc (Wood) -> Thổ (Earth) -> Thủy (Water) -> Hỏa (Fire) -> Kim
 */
const ELEMENT_GENERATES: Record<Element, Element> = {
  Kim: "Thủy", // Metal generates Water
  Thủy: "Mộc", // Water generates Wood
  Mộc: "Hỏa", // Wood generates Fire
  Hỏa: "Thổ", // Fire generates Earth
  Thổ: "Kim", // Earth generates Metal
};

const ELEMENT_OVERCOMES: Record<Element, Element> = {
  Kim: "Mộc", // Metal overcomes Wood
  Mộc: "Thổ", // Wood overcomes Earth
  Thổ: "Thủy", // Earth overcomes Water
  Thủy: "Hỏa", // Water overcomes Fire
  Hỏa: "Kim", // Fire overcomes Metal
};

/**
 * Calculate element compatibility bonus between spirit root and technique
 * Perfect Match: +30% (all technique elements in spirit root)
 * Good Match: +15% (generates/supports)
 * Neutral: +0% (no conflict)
 * Weak Conflict: -10% (overcome by technique)
 * Strong Conflict: -20% (technique overcomes spirit root)
 */
export function getElementCompatibility(
  spiritRootElements: Element[],
  techniqueElements: Element[],
): number {
  if (techniqueElements.length === 0) return 0;

  // Perfect match: all technique elements are in spirit root
  const perfectMatch = techniqueElements.every((te) =>
    spiritRootElements.includes(te),
  );
  if (perfectMatch) return 0.3;

  let compatibility = 0;
  let matchCount = 0;

  for (const techElement of techniqueElements) {
    for (const spiritElement of spiritRootElements) {
      if (techElement === spiritElement) {
        // Direct match
        compatibility += 0.3;
        matchCount++;
      } else if (ELEMENT_GENERATES[spiritElement] === techElement) {
        // Spirit root generates technique element (good)
        compatibility += 0.15;
        matchCount++;
      } else if (ELEMENT_GENERATES[techElement] === spiritElement) {
        // Technique generates spirit root (ok)
        compatibility += 0.1;
        matchCount++;
      } else if (ELEMENT_OVERCOMES[techElement] === spiritElement) {
        // Technique overcomes spirit root (bad)
        compatibility -= 0.2;
        matchCount++;
      } else if (ELEMENT_OVERCOMES[spiritElement] === techElement) {
        // Spirit root overcomes technique (weak conflict)
        compatibility -= 0.1;
        matchCount++;
      }
    }
  }

  // Average the compatibility
  return matchCount > 0 ? compatibility / matchCount : 0;
}

/**
 * Get technique bonus considering element compatibility AND cultivation speed bonus
 * Techniques boost cultivation speed, not combat
 */
export function getTechniqueBonus(state: GameState): number {
  if (!state.techniques || state.techniques.length === 0) return 1.0;

  let totalBonus = 0;
  let mainTechniqueBonus = 0;
  let supportTechniqueBonus = 0;

  for (const technique of state.techniques) {
    // Base cultivation speed bonus from technique grade
    const cultivationSpeedBonus = technique.cultivation_speed_bonus || 0;
    const baseBonus = cultivationSpeedBonus / 100; // Convert percentage to multiplier

    // Element compatibility bonus
    let elementBonus = 0;
    if (technique.elements && technique.elements.length > 0) {
      elementBonus = getElementCompatibility(
        state.spirit_root.elements,
        technique.elements,
      );
    }

    const techBonus = baseBonus + elementBonus;

    // Main techniques give full bonus, support techniques stack 50%
    if (technique.type === "Main") {
      mainTechniqueBonus = Math.max(mainTechniqueBonus, techBonus);
    } else {
      supportTechniqueBonus += techBonus * 0.5;
    }
  }

  // Cap support bonus at 50% extra
  supportTechniqueBonus = Math.min(supportTechniqueBonus, 0.5);

  totalBonus = mainTechniqueBonus + supportTechniqueBonus;

  return 1.0 + totalBonus;
}

/**
 * Cultivation exp requirements by realm and stage
 * Each realm has 9 stages (0-8)
 */
export const CULTIVATION_EXP_REQUIREMENTS: Record<string, number[]> = {
  PhàmNhân: [150], // Stage 0 -> Stage 1 (breakthrough to LuyệnKhí)
  LuyệnKhí: [300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000], // Stages 1-9
  TrúcCơ: [8000, 10000, 12000, 15000, 18000, 22000, 27000, 33000, 40000], // Stages 1-9
  KếtĐan: [45000, 50000, 60000, 70000, 85000, 100000, 120000, 140000, 170000], // Stages 1-9
  NguyênAnh: [
    200000, 230000, 270000, 320000, 380000, 450000, 530000, 620000, 750000,
  ], // Stages 1-9
};

/**
 * Get required exp for next breakthrough
 */
export function getRequiredExp(realm: Realm, stage: number): number {
  const requirements = CULTIVATION_EXP_REQUIREMENTS[realm];
  if (!requirements || stage >= requirements.length) {
    return Infinity; // Max level reached
  }
  return requirements[stage];
}

/**
 * Calculate cultivation experience gain
 */
export function calculateCultivationExpGain(
  state: GameState,
  baseExp: number,
): number {
  const spiritRootBonus = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueBonus = getTechniqueBonus(state);
  return Math.floor(baseExp * spiritRootBonus * techniqueBonus);
}

/**
 * Check if character can breakthrough to next stage
 */
export function canBreakthrough(state: GameState): boolean {
  const { realm, realm_stage, cultivation_exp } = state.progress;
  const requiredExp = getRequiredExp(realm, realm_stage);

  if (requiredExp === Infinity) return false;

  return cultivation_exp >= requiredExp;
}

/**
 * Perform breakthrough
 */
export function performBreakthrough(state: GameState): boolean {
  if (!canBreakthrough(state)) return false;

  const { realm, realm_stage } = state.progress;

  if (realm === "PhàmNhân") {
    // Break through to Qi Condensation stage 1
    state.progress.realm = "LuyệnKhí";
    state.progress.realm_stage = 1;
    state.progress.cultivation_exp = 0;

    // Stat increases
    state.stats.hp_max += 50;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 100;
    state.stats.qi = state.stats.qi_max;
    state.stats.stamina_max += 2;

    // Attr increases
    state.attrs.str += 2;
    state.attrs.agi += 2;
    state.attrs.int += 2;
    state.attrs.perception += 1;

    return true;
  } else if (realm === "LuyệnKhí" && realm_stage < 9) {
    // Advance to next stage within Luyện Khí realm
    state.progress.realm_stage++;
    state.progress.cultivation_exp = 0;

    // Incremental stat increases
    state.stats.hp_max += 30;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 50;
    state.stats.qi = state.stats.qi_max;

    state.attrs.str += 1;
    state.attrs.agi += 1;
    state.attrs.int += 1;

    return true;
  } else if (realm === "LuyệnKhí" && realm_stage === 9) {
    // Breakthrough to Trúc Cơ realm
    state.progress.realm = "TrúcCơ";
    state.progress.realm_stage = 1;
    state.progress.cultivation_exp = 0;

    // Major stat increases for realm breakthrough
    state.stats.hp_max += 100;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 200;
    state.stats.qi = state.stats.qi_max;
    state.stats.stamina_max += 5;

    state.attrs.str += 3;
    state.attrs.agi += 3;
    state.attrs.int += 3;
    state.attrs.perception += 2;

    return true;
  } else if (realm === "TrúcCơ" && realm_stage < 9) {
    // Advance within Trúc Cơ realm
    state.progress.realm_stage++;
    state.progress.cultivation_exp = 0;

    state.stats.hp_max += 50;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 80;
    state.stats.qi = state.stats.qi_max;

    state.attrs.str += 2;
    state.attrs.agi += 2;
    state.attrs.int += 2;

    return true;
  } else if (realm === "TrúcCơ" && realm_stage === 9) {
    // Breakthrough to Kết Đan realm
    state.progress.realm = "KếtĐan";
    state.progress.realm_stage = 1;
    state.progress.cultivation_exp = 0;

    state.stats.hp_max += 150;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 300;
    state.stats.qi = state.stats.qi_max;
    state.stats.stamina_max += 8;

    state.attrs.str += 4;
    state.attrs.agi += 4;
    state.attrs.int += 4;
    state.attrs.perception += 3;

    return true;
  } else if (realm === "KếtĐan" && realm_stage < 9) {
    // Advance within Kết Đan realm
    state.progress.realm_stage++;
    state.progress.cultivation_exp = 0;

    state.stats.hp_max += 80;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 120;
    state.stats.qi = state.stats.qi_max;

    state.attrs.str += 3;
    state.attrs.agi += 3;
    state.attrs.int += 3;

    return true;
  }

  return false;
}

/**
 * Use a consumable item from inventory
 */
export function useConsumableItem(state: GameState, itemId: string): boolean {
  const itemIndex = state.inventory.items.findIndex(
    (item) => item.id === itemId,
  );
  if (itemIndex === -1) return false;

  const item = state.inventory.items[itemIndex];

  // Only consumables (Medicine, Material with effects) can be used
  if (item.type !== "Medicine" && !item.effects) return false;

  // Apply effects
  if (item.effects) {
    // HP restoration
    if (item.effects.hp_restore) {
      state.stats.hp = Math.min(
        state.stats.hp_max,
        state.stats.hp + (item.effects.hp_restore as number),
      );
    }

    // Qi restoration
    if (item.effects.qi_restore) {
      state.stats.qi = Math.min(
        state.stats.qi_max,
        state.stats.qi + (item.effects.qi_restore as number),
      );
    }

    // Cultivation exp boost
    if (item.effects.cultivation_exp) {
      state.progress.cultivation_exp += item.effects.cultivation_exp as number;
    }

    // Permanent stat increases
    if (item.effects.permanent_hp) {
      state.stats.hp_max += item.effects.permanent_hp as number;
      state.stats.hp += item.effects.permanent_hp as number;
    }

    if (item.effects.permanent_qi) {
      state.stats.qi_max += item.effects.permanent_qi as number;
      state.stats.qi += item.effects.permanent_qi as number;
    }

    if (item.effects.permanent_str)
      state.attrs.str += item.effects.permanent_str as number;
    if (item.effects.permanent_agi)
      state.attrs.agi += item.effects.permanent_agi as number;
    if (item.effects.permanent_int)
      state.attrs.int += item.effects.permanent_int as number;
    if (item.effects.permanent_perception)
      state.attrs.perception += item.effects.permanent_perception as number;
    if (item.effects.permanent_luck)
      state.attrs.luck += item.effects.permanent_luck as number;
  }

  // Decrease quantity or remove item
  if (item.quantity > 1) {
    state.inventory.items[itemIndex].quantity--;
  } else {
    state.inventory.items.splice(itemIndex, 1);
  }

  return true;
}
