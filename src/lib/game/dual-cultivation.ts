import {
  CultivationProgress,
  CultivationPath,
  Realm,
  BodyRealm,
  CharacterStats,
  CharacterAttributes,
} from "@/types/game";

/**
 * Dual Cultivation System
 * Allows players to cultivate both Qi (spirit) and Body paths simultaneously
 * Experience is split based on the exp_split setting (default 100% to qi)
 */

// Body realm progression (parallel to qi cultivation)
export const BODY_REALMS: BodyRealm[] = ["PhàmThể", "LuyệnCốt", "ĐồngCân", "KimCương", "TháiCổ"];

// Body realm names for display
export const BODY_REALM_NAMES: Record<BodyRealm, { vi: string; en: string }> = {
  PhàmThể: { vi: "Phàm Thể", en: "Mortal Body" },
  LuyệnCốt: { vi: "Luyện Cốt", en: "Bone Forging" },
  ĐồngCân: { vi: "Đồng Cân", en: "Copper Tendon" },
  KimCương: { vi: "Kim Cương", en: "Diamond Body" },
  TháiCổ: { vi: "Thái Cổ", en: "Primordial Body" },
};

// Experience required to advance body cultivation stages
export const BODY_EXP_THRESHOLDS: Record<BodyRealm, number[]> = {
  PhàmThể: [50, 100, 150, 200, 250], // Stage 0-4, stage 5 = breakthrough
  LuyệnCốt: [200, 400, 600, 800, 1000],
  ĐồngCân: [500, 1000, 1500, 2000, 2500],
  KimCương: [1000, 2000, 3000, 4000, 5000],
  TháiCổ: [2500, 5000, 7500, 10000, 15000],
};

// Stat bonuses per body realm breakthrough
export const BODY_REALM_BONUSES: Record<BodyRealm, { hp: number; str: number; stamina: number }> = {
  PhàmThể: { hp: 10, str: 1, stamina: 5 },
  LuyệnCốt: { hp: 25, str: 2, stamina: 10 },
  ĐồngCân: { hp: 50, str: 4, stamina: 20 },
  KimCương: { hp: 100, str: 8, stamina: 40 },
  TháiCổ: { hp: 200, str: 15, stamina: 80 },
};

// Stat bonuses per body stage
export const BODY_STAGE_BONUSES = {
  hp: 5,
  str: 0.5,
  stamina: 2,
};

// Cultivation path names
export const CULTIVATION_PATH_NAMES: Record<CultivationPath, { vi: string; en: string }> = {
  qi: { vi: "Tu Khí", en: "Qi Cultivation" },
  body: { vi: "Tu Thể", en: "Body Cultivation" },
  dual: { vi: "Song Tu", en: "Dual Cultivation" },
};

/**
 * Initialize dual cultivation for a character
 * Preserves existing body cultivation progress if any
 */
export function initDualCultivation(progress: CultivationProgress): CultivationProgress {
  return {
    ...progress,
    cultivation_path: "dual",
    // Preserve existing body progress, or initialize to starting values
    body_realm: progress.body_realm || "PhàmThể",
    body_stage: progress.body_stage ?? 0,
    body_exp: progress.body_exp ?? 0,
    exp_split: progress.exp_split ?? 50, // Keep previous split or default 50/50
  };
}

/**
 * Get the current body realm index
 */
export function getBodyRealmIndex(realm: BodyRealm): number {
  return BODY_REALMS.indexOf(realm);
}

/**
 * Get the next body realm
 */
export function getNextBodyRealm(realm: BodyRealm): BodyRealm | null {
  const index = getBodyRealmIndex(realm);
  if (index >= BODY_REALMS.length - 1) return null;
  return BODY_REALMS[index + 1];
}

/**
 * Calculate exp needed for next body stage/realm
 */
export function getBodyExpToNext(progress: CultivationProgress): number {
  const realm = progress.body_realm || "PhàmThể";
  const stage = progress.body_stage || 0;
  const thresholds = BODY_EXP_THRESHOLDS[realm];

  if (stage >= 5) {
    // At max stage, need next realm threshold
    const nextRealm = getNextBodyRealm(realm);
    if (!nextRealm) return Infinity; // At max
    return BODY_EXP_THRESHOLDS[nextRealm][0];
  }

  return thresholds[stage];
}

/**
 * Calculate body cultivation progress percentage
 */
export function getBodyCultivationProgress(progress: CultivationProgress): number {
  const currentExp = progress.body_exp || 0;
  const expNeeded = getBodyExpToNext(progress);

  if (expNeeded === Infinity) return 100;
  return Math.min(100, Math.round((currentExp / expNeeded) * 100));
}

/**
 * Split experience between qi and body cultivation
 */
export function splitExperience(
  totalExp: number,
  expSplit: number
): { qiExp: number; bodyExp: number } {
  const qiPercent = Math.max(0, Math.min(100, expSplit)) / 100;
  const qiExp = Math.floor(totalExp * qiPercent);
  const bodyExp = totalExp - qiExp; // Remainder goes to body

  return { qiExp, bodyExp };
}

/**
 * Add body experience and check for advancement
 */
export function addBodyExperience(
  progress: CultivationProgress,
  expGained: number
): {
  updatedProgress: CultivationProgress;
  stageUp: boolean;
  realmUp: boolean;
  statBonuses: { hp: number; str: number; stamina: number };
} {
  const newProgress = { ...progress };
  let stageUp = false;
  let realmUp = false;
  const statBonuses = { hp: 0, str: 0, stamina: 0 };

  // Initialize if needed
  if (!newProgress.body_realm) {
    newProgress.body_realm = "PhàmThể";
    newProgress.body_stage = 0;
    newProgress.body_exp = 0;
  }

  newProgress.body_exp = (newProgress.body_exp || 0) + expGained;

  // Check for advancement
  let expNeeded = getBodyExpToNext(newProgress);

  while (newProgress.body_exp! >= expNeeded && expNeeded !== Infinity) {
    newProgress.body_exp! -= expNeeded;

    if ((newProgress.body_stage || 0) >= 5) {
      // Realm breakthrough
      const nextRealm = getNextBodyRealm(newProgress.body_realm!);
      if (nextRealm) {
        newProgress.body_realm = nextRealm;
        newProgress.body_stage = 0;
        realmUp = true;

        // Apply realm bonuses
        const realmBonus = BODY_REALM_BONUSES[nextRealm];
        statBonuses.hp += realmBonus.hp;
        statBonuses.str += realmBonus.str;
        statBonuses.stamina += realmBonus.stamina;
      } else {
        // At max realm, refund exp
        newProgress.body_exp! += expNeeded;
        break;
      }
    } else {
      // Stage advancement
      newProgress.body_stage = (newProgress.body_stage || 0) + 1;
      stageUp = true;

      // Apply stage bonuses
      statBonuses.hp += BODY_STAGE_BONUSES.hp;
      statBonuses.str += BODY_STAGE_BONUSES.str;
      statBonuses.stamina += BODY_STAGE_BONUSES.stamina;
    }

    expNeeded = getBodyExpToNext(newProgress);
  }

  return {
    updatedProgress: newProgress,
    stageUp,
    realmUp,
    statBonuses,
  };
}

/**
 * Apply experience to dual cultivation paths
 */
export function applyDualCultivationExp(
  progress: CultivationProgress,
  totalExp: number
): {
  updatedProgress: CultivationProgress;
  qiExpGained: number;
  bodyExpGained: number;
  bodyStageUp: boolean;
  bodyRealmUp: boolean;
  bodyStatBonuses: { hp: number; str: number; stamina: number };
} {
  // Default to 100% qi if not in dual cultivation mode
  const expSplit = progress.cultivation_path === "dual" ? (progress.exp_split ?? 50) : 100;
  const { qiExp, bodyExp } = splitExperience(totalExp, expSplit);

  // Apply qi exp (handled by existing system)
  const updatedProgress = {
    ...progress,
    cultivation_exp: progress.cultivation_exp + qiExp,
  };

  // Apply body exp if in dual mode
  let bodyStageUp = false;
  let bodyRealmUp = false;
  let bodyStatBonuses = { hp: 0, str: 0, stamina: 0 };

  if (progress.cultivation_path === "dual" && bodyExp > 0) {
    const bodyResult = addBodyExperience(updatedProgress, bodyExp);
    Object.assign(updatedProgress, bodyResult.updatedProgress);
    bodyStageUp = bodyResult.stageUp;
    bodyRealmUp = bodyResult.realmUp;
    bodyStatBonuses = bodyResult.statBonuses;
  }

  return {
    updatedProgress,
    qiExpGained: qiExp,
    bodyExpGained: bodyExp,
    bodyStageUp,
    bodyRealmUp,
    bodyStatBonuses,
  };
}

/**
 * Set the exp split ratio
 */
export function setExpSplit(progress: CultivationProgress, split: number): CultivationProgress {
  return {
    ...progress,
    exp_split: Math.max(0, Math.min(100, split)),
  };
}

/**
 * Get body cultivation display text
 */
export function getBodyCultivationDisplay(
  progress: CultivationProgress,
  locale: "vi" | "en"
): string {
  if (!progress.body_realm) return locale === "vi" ? "Chưa tu thể" : "No Body Cultivation";

  const realmName = BODY_REALM_NAMES[progress.body_realm][locale === "vi" ? "vi" : "en"];
  const stage = progress.body_stage || 0;

  return `${realmName} ${stage + 1}`;
}
