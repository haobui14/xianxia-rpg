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
  ActivityType,
  GameTime,
  CharacterCondition,
  LifespanInfo,
  REALM_LIFESPAN_BONUS,
} from "@/types/game";
// World system types imported but used via init functions
import { DeterministicRNG } from "./rng";
import { initTravelState } from "@/lib/world/travel";
import { initEventState } from "@/lib/world/event-engine";
import { initDungeonState } from "@/lib/world/dungeon-engine";

/**
 * Create initial game state for a new character
 */
export function createInitialState(
  name: string,
  age: number,
  spiritRoot: SpiritRoot,
  locale: "vi" | "en"
): GameState {
  const baseStats: CharacterStats = {
    hp: 100,
    hp_max: 100,
    qi: 0,
    qi_max: 0,
    stamina: 100,
    stamina_max: 100,
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
    // Body cultivation initialization
    body_realm: "PhàmThể",
    body_stage: 0,
    body_exp: 0,
  };

  const inventory: Inventory = {
    silver: 100,
    spirit_stones: 0,
    items: [],
    max_slots: 20, // Base inventory capacity
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
    // World system initialization
    travel: initTravelState(),
    events: initEventState(),
    dungeon: initDungeonState(),

    // Cultivation simulator systems (Phase 1)
    activity: {
      current: undefined,
      available_activities: [
        "cultivate_qi",
        "cultivate_body",
        "meditate",
        "rest",
        "explore",
        "socialize",
      ] as ActivityType[],
      cooldowns: {} as Record<ActivityType, GameTime>,
      daily_log: [],
    },
    condition: {
      injuries: [],
      qi_deviation_level: 0,
      fatigue: 0,
      mental_state: "calm",
      active_effects: [],
      enlightenment_points: 0,
    } as CharacterCondition,
    lifespan: (() => {
      const maxLifespan = 80 + REALM_LIFESPAN_BONUS["PhàmNhân"];
      const yearsRemaining = maxLifespan - age;
      return {
        base_years: 80,
        realm_bonus: REALM_LIFESPAN_BONUS["PhàmNhân"],
        special_bonus: 0,
        penalty: 0,
        current_age: age,
        max_lifespan: maxLifespan,
        years_remaining: yearsRemaining,
        urgency_level:
          yearsRemaining <= 10 ? "critical" : yearsRemaining <= 20 ? "warning" : "safe",
      } as LifespanInfo;
    })(),
  };
}

/**
 * Migrate existing game state to include world system
 * Called when loading a save that doesn't have the new fields
 */
export function migrateGameState(state: GameState): GameState {
  // Migrate travel state
  if (!state.travel) {
    state.travel = initTravelState();

    // Try to map old location to new system
    if (state.location) {
      const regionMapping: Record<string, string> = {
        "Núi Thanh Vân": "thanh_van",
        "Azure Cloud Mountains": "thanh_van",
        "Thanh Vân": "thanh_van",
        "Hỏa Sơn": "hoa_son",
        "Fire Mountain": "hoa_son",
        "Huyền Thủy": "huyen_thuy",
        "Mystic Waters": "huyen_thuy",
        "Trầm Lôi": "tram_loi",
        "Silent Thunder": "tram_loi",
        "Vọng Linh": "vong_linh",
        "Spirit Watch": "vong_linh",
      };

      const mappedRegion = regionMapping[state.location.region];
      if (mappedRegion) {
        state.travel.current_region = mappedRegion as any;
        // Set to city area of that region
        const areaMapping: Record<string, string> = {
          thanh_van: "thanh_van_village",
          hoa_son: "flame_gate_city",
          huyen_thuy: "pearl_harbor",
          tram_loi: "thunder_citadel",
          vong_linh: "spirit_gate",
        };
        state.travel.current_area = areaMapping[mappedRegion] || "thanh_van_village";
        state.travel.discovered_areas[state.travel.current_region] = [state.travel.current_area];
      }
    }
  }

  // Migrate event state
  if (!state.events) {
    state.events = initEventState();
  }

  // Migrate dungeon state
  if (!state.dungeon) {
    state.dungeon = initDungeonState();
  }

  // Migrate inventory max_slots if missing
  if (!state.inventory.max_slots) {
    state.inventory.max_slots = 20;
  }

  // Migrate cultivation simulator fields (Phase 1)
  if (!state.activity) {
    state.activity = {
      current: undefined,
      available_activities: [
        "cultivate_qi",
        "cultivate_body",
        "meditate",
        "rest",
        "explore",
        "socialize",
      ] as ActivityType[],
      cooldowns: {} as Record<ActivityType, GameTime>,
      daily_log: [],
    };
  }

  if (!state.condition) {
    state.condition = {
      injuries: [],
      qi_deviation_level: 0,
      fatigue: 0,
      mental_state: "calm",
      active_effects: [],
      enlightenment_points: 0,
    };
  }

  if (!state.lifespan) {
    const realmBonus = REALM_LIFESPAN_BONUS[state.progress.realm] || 0;
    const maxLifespan = 80 + realmBonus;
    state.lifespan = {
      base_years: 80,
      realm_bonus: realmBonus,
      special_bonus: 0,
      penalty: 0,
      current_age: state.age,
      max_lifespan: maxLifespan,
      years_remaining: maxLifespan - state.age,
      urgency_level: maxLifespan - state.age <= 20 ? "warning" : "safe",
    };
  }

  return state;
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
  state.stats.stamina = clampStat(state.stats.stamina + delta, 0, state.stats.stamina_max);
}

/**
 * Regenerate stamina based on real-time elapsed (1 stamina per minute)
 */
export function regenerateStamina(state: GameState): void {
  const now = new Date();
  const lastRegen = state.last_stamina_regen ? new Date(state.last_stamina_regen) : now;
  const minutesElapsed = Math.floor((now.getTime() - lastRegen.getTime()) / 60000);

  if (minutesElapsed > 0 && state.stats.stamina < state.stats.stamina_max) {
    const staminaToRegen = Math.min(minutesElapsed, state.stats.stamina_max - state.stats.stamina);
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
  // Handle English time segments by mapping them to Vietnamese
  const englishToVietnamese: Record<string, TimeSegment> = {
    Morning: "Sáng",
    Afternoon: "Chiều",
    Evening: "Tối",
    Night: "Đêm",
  };

  // Get current index, handling both Vietnamese and English segments
  let currentIndex = timeOrder.indexOf(state.time_segment);
  if (currentIndex === -1) {
    // Try to map from English
    const mappedSegment = englishToVietnamese[state.time_segment as string];
    currentIndex = mappedSegment ? timeOrder.indexOf(mappedSegment) : 0;
  }

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

          // Update lifespan info when age increases
          if (state.lifespan) {
            state.lifespan.current_age = state.age;
            state.lifespan.years_remaining = state.lifespan.max_lifespan - state.age;
            state.lifespan.urgency_level =
              state.lifespan.years_remaining <= 10
                ? "critical"
                : state.lifespan.years_remaining <= 20
                  ? "warning"
                  : "safe";
          }
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
  }
): boolean {
  if (cost.stamina && state.stats.stamina < cost.stamina) return false;
  if (cost.qi && state.stats.qi < cost.qi) return false;
  if (cost.silver && state.inventory.silver < cost.silver) return false;
  if (cost.spirit_stones && state.inventory.spirit_stones < cost.spirit_stones) return false;
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
  }
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
  techniqueElements: Element[]
): number {
  if (techniqueElements.length === 0) return 0;

  // Perfect match: all technique elements are in spirit root
  const perfectMatch = techniqueElements.every((te) => spiritRootElements.includes(te));
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
      elementBonus = getElementCompatibility(state.spirit_root.elements, technique.elements);
    } else {
      // Techniques with no element get a universal 20% bonus
      elementBonus = 0.2;
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
  PhàmNhân: [100], // Stage 0 -> Stage 1 (breakthrough to LuyệnKhí) - reduced from 150
  LuyệnKhí: [200, 350, 550, 800, 1200, 1700, 2400, 3400, 4800], // Stages 1-9 - reduced ~30%
  TrúcCơ: [5500, 7000, 8500, 10500, 13000, 16000, 19500, 24000, 29000], // Stages 1-9 - reduced ~30%
  KếtĐan: [32000, 36000, 43000, 50000, 60000, 72000, 86000, 100000, 120000], // Stages 1-9 - reduced ~30%
  NguyênAnh: [140000, 165000, 190000, 225000, 270000, 320000, 375000, 440000, 530000], // Stages 1-9 - reduced ~30%
};

/**
 * Body cultivation exp requirements by realm and stage
 * Parallel to Qi cultivation but slightly different values
 */
export const BODY_CULTIVATION_EXP_REQUIREMENTS: Record<string, number[]> = {
  PhàmThể: [50], // Stage 0 -> Stage 1 (breakthrough to LuyệnCốt)
  LuyệnCốt: [150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000], // Stages 1-9
  ĐồngCân: [6000, 8000, 10000, 12000, 15000, 18000, 22000, 27000, 33000], // Stages 1-9
  KimCương: [40000, 50000, 60000, 75000, 90000, 110000, 130000, 160000, 200000], // Stages 1-9
  TháiCổ: [250000, 300000, 350000, 420000, 500000, 600000, 720000, 860000, 1000000], // Stages 1-9
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
 * Get required exp for next body cultivation breakthrough
 */
export function getRequiredBodyExp(realm: string, stage: number): number {
  const requirements = BODY_CULTIVATION_EXP_REQUIREMENTS[realm];
  if (!requirements || stage >= requirements.length) {
    return Infinity; // Max level reached
  }
  return requirements[stage];
}

/**
 * Calculate cultivation experience gain
 */
export function calculateCultivationExpGain(state: GameState, baseExp: number): number {
  const spiritRootBonus = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueBonus = getTechniqueBonus(state);

  // Add sect cultivation bonus if member of a sect
  let sectBonus = 1.0;
  if (state.sect_membership && state.sect_membership.benefits) {
    sectBonus = 1.0 + state.sect_membership.benefits.cultivation_bonus / 100;
  }

  return Math.floor(baseExp * spiritRootBonus * techniqueBonus * sectBonus);
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
  } else if (realm === "KếtĐan" && realm_stage === 9) {
    // Breakthrough to Nguyên Anh realm
    state.progress.realm = "NguyênAnh";
    state.progress.realm_stage = 1;
    state.progress.cultivation_exp = 0;

    // Major stat increases for realm breakthrough
    state.stats.hp_max += 200;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 400;
    state.stats.qi = state.stats.qi_max;
    state.stats.stamina_max += 10;

    state.attrs.str += 5;
    state.attrs.agi += 5;
    state.attrs.int += 5;
    state.attrs.perception += 4;

    return true;
  } else if (realm === "NguyênAnh" && realm_stage < 9) {
    // Advance within Nguyên Anh realm
    state.progress.realm_stage++;
    state.progress.cultivation_exp = 0;

    state.stats.hp_max += 100;
    state.stats.hp = state.stats.hp_max;
    state.stats.qi_max += 150;
    state.stats.qi = state.stats.qi_max;

    state.attrs.str += 4;
    state.attrs.agi += 4;
    state.attrs.int += 4;

    return true;
  }

  return false;
}

/**
 * Check if character can breakthrough body cultivation to next stage
 */
export function canBodyBreakthrough(state: GameState): boolean {
  if (!state.progress.body_realm || !state.progress.body_exp) return false;

  const realm = state.progress.body_realm;
  const stage = state.progress.body_stage || 0;
  const exp = state.progress.body_exp;

  const requiredExp = getRequiredBodyExp(realm, stage);

  if (requiredExp === Infinity) return false;

  return exp >= requiredExp;
}

/**
 * Perform body cultivation breakthrough
 */
export function performBodyBreakthrough(state: GameState): boolean {
  if (!canBodyBreakthrough(state)) return false;

  const realm = state.progress.body_realm || "PhàmThể";
  const stage = state.progress.body_stage || 0;

  if (realm === "PhàmThể") {
    // Break through to Bone Forging stage 1
    state.progress.body_realm = "LuyệnCốt";
    state.progress.body_stage = 1;
    state.progress.body_exp = 0;

    // Body cultivation increases HP and STR primarily
    state.stats.hp_max += 80;
    state.stats.hp = state.stats.hp_max;
    state.stats.stamina_max += 3;

    state.attrs.str += 3;
    state.attrs.agi += 1;

    return true;
  } else if (realm === "LuyệnCốt" && stage < 9) {
    // Advance within Bone Forging realm
    state.progress.body_stage = (stage || 0) + 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 40;
    state.stats.hp = state.stats.hp_max;

    state.attrs.str += 2;
    state.attrs.agi += 1;

    return true;
  } else if (realm === "LuyệnCốt" && stage === 9) {
    // Breakthrough to Copper Tendon
    state.progress.body_realm = "ĐồngCân";
    state.progress.body_stage = 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 120;
    state.stats.hp = state.stats.hp_max;
    state.stats.stamina_max += 5;

    state.attrs.str += 4;
    state.attrs.agi += 2;

    return true;
  } else if (realm === "ĐồngCân" && stage < 9) {
    // Advance within Copper Tendon realm
    state.progress.body_stage = (stage || 0) + 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 60;
    state.stats.hp = state.stats.hp_max;

    state.attrs.str += 3;
    state.attrs.agi += 1;

    return true;
  } else if (realm === "ĐồngCân" && stage === 9) {
    // Breakthrough to Diamond Body
    state.progress.body_realm = "KimCương";
    state.progress.body_stage = 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 180;
    state.stats.hp = state.stats.hp_max;
    state.stats.stamina_max += 8;

    state.attrs.str += 5;
    state.attrs.agi += 3;

    return true;
  } else if (realm === "KimCương" && stage < 9) {
    // Advance within Diamond Body realm
    state.progress.body_stage = (stage || 0) + 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 100;
    state.stats.hp = state.stats.hp_max;

    state.attrs.str += 4;
    state.attrs.agi += 2;

    return true;
  } else if (realm === "KimCương" && stage === 9) {
    // Breakthrough to Thái Cổ realm
    state.progress.body_realm = "TháiCổ";
    state.progress.body_stage = 1;
    state.progress.body_exp = 0;

    // Major stat increases for realm breakthrough
    state.stats.hp_max += 250;
    state.stats.hp = state.stats.hp_max;
    state.stats.stamina_max += 12;

    state.attrs.str += 6;
    state.attrs.agi += 4;

    return true;
  } else if (realm === "TháiCổ" && stage < 9) {
    // Advance within Thái Cổ realm
    state.progress.body_stage = (stage || 0) + 1;
    state.progress.body_exp = 0;

    state.stats.hp_max += 150;
    state.stats.hp = state.stats.hp_max;

    state.attrs.str += 5;
    state.attrs.agi += 3;

    return true;
  }

  return false;
}

/**
 * Use a consumable item from inventory
 */
export function useConsumableItem(state: GameState, itemId: string): boolean {
  const itemIndex = state.inventory.items.findIndex((item) => item.id === itemId);
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
        state.stats.hp + (item.effects.hp_restore as number)
      );
    }

    // Qi restoration
    if (item.effects.qi_restore) {
      state.stats.qi = Math.min(
        state.stats.qi_max,
        state.stats.qi + (item.effects.qi_restore as number)
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

    if (item.effects.permanent_str) state.attrs.str += item.effects.permanent_str as number;
    if (item.effects.permanent_agi) state.attrs.agi += item.effects.permanent_agi as number;
    if (item.effects.permanent_int) state.attrs.int += item.effects.permanent_int as number;
    if (item.effects.permanent_perception)
      state.attrs.perception += item.effects.permanent_perception as number;
    if (item.effects.permanent_luck) state.attrs.luck += item.effects.permanent_luck as number;
  }

  // Decrease quantity or remove item
  if (item.quantity > 1) {
    state.inventory.items[itemIndex].quantity--;
  } else {
    state.inventory.items.splice(itemIndex, 1);
  }

  return true;
}
