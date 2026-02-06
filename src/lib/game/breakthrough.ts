import { Realm } from "@/types/game";

/**
 * Breakthrough stat bonus constants
 * Used when a cultivator advances to a new realm or stage
 */

// Realm breakthrough bonuses (when changing realms)
export const REALM_BREAKTHROUGH_BONUSES: Record<
  Realm,
  {
    hp_max: number;
    qi_max: number;
    str: number;
    agi: number;
    int: number;
    perception: number;
  }
> = {
  PhàmNhân: {
    hp_max: 50,
    qi_max: 100,
    str: 2,
    agi: 2,
    int: 2,
    perception: 1,
  },
  LuyệnKhí: {
    hp_max: 100,
    qi_max: 200,
    str: 3,
    agi: 3,
    int: 3,
    perception: 2,
  },
  TrúcCơ: {
    hp_max: 150,
    qi_max: 300,
    str: 4,
    agi: 4,
    int: 4,
    perception: 3,
  },
  KếtĐan: {
    hp_max: 200,
    qi_max: 400,
    str: 5,
    agi: 5,
    int: 5,
    perception: 4,
  },
  NguyênAnh: {
    hp_max: 300,
    qi_max: 600,
    str: 7,
    agi: 7,
    int: 7,
    perception: 5,
  },
};

// Stage breakthrough bonuses (within same realm)
export const STAGE_BREAKTHROUGH_BONUSES: Record<
  Realm,
  {
    hp_max: number;
    qi_max: number;
    str: number;
    agi: number;
    int: number;
    perception: number;
  }
> = {
  PhàmNhân: {
    hp_max: 10,
    qi_max: 20,
    str: 0,
    agi: 0,
    int: 0,
    perception: 0,
  },
  LuyệnKhí: {
    hp_max: 30,
    qi_max: 50,
    str: 1,
    agi: 1,
    int: 1,
    perception: 0,
  },
  TrúcCơ: {
    hp_max: 50,
    qi_max: 80,
    str: 2,
    agi: 2,
    int: 2,
    perception: 1,
  },
  KếtĐan: {
    hp_max: 80,
    qi_max: 120,
    str: 3,
    agi: 3,
    int: 3,
    perception: 2,
  },
  NguyênAnh: {
    hp_max: 120,
    qi_max: 200,
    str: 4,
    agi: 4,
    int: 4,
    perception: 2,
  },
};

/**
 * Get stat bonuses for a breakthrough event
 */
export function getBreakthroughBonuses(
  isRealmChange: boolean,
  previousRealm: Realm
): (typeof REALM_BREAKTHROUGH_BONUSES)[Realm] {
  if (isRealmChange) {
    return REALM_BREAKTHROUGH_BONUSES[previousRealm];
  }
  return STAGE_BREAKTHROUGH_BONUSES[previousRealm];
}
