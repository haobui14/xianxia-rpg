/**
 * Activity System for Xianxia Cultivation Simulator
 * Manages all player activities, costs, rewards, and progression
 */

import {
  GameState,
  GameTime,
  ActivityType,
  ActivityDefinition,
  ActivityDuration,
  CurrentActivity,
  ActivityLogEntry,
  Locale,
  Element,
  Realm,
  BodyRealm,
  InventoryItem,
  CharacterCondition,
} from "@/types/game";

import {
  getGameTimeFromState,
  advanceTime,
  getSeason,
  calculateTimeCultivationBonus,
  getSpecialTimeBonus,
  DURATION_OPTIONS,
  getDurationOption,
} from "./time";

// =====================================================
// ACTIVITY DEFINITIONS
// =====================================================

export const ACTIVITY_DEFINITIONS: Record<ActivityType, ActivityDefinition> = {
  cultivate_qi: {
    type: "cultivate_qi",
    name: "Tu luyện Khí",
    name_en: "Qi Cultivation",
    description: "Hấp thu linh khí thiên địa, tăng tu vi",
    description_en: "Absorb spiritual energy to increase cultivation",
    icon: "🧘",
    category: "cultivation",
    base_stamina_cost: 2,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 10,
      not_injured: false, // Can cultivate while injured but with penalty
    },
    allowed_durations: ["1_segment", "half_day", "full_day", "3_days", "week", "month"],
    base_rewards: {
      qi_exp: 15,
      insight_chance: 0.05,
    },
    affected_by: ["technique", "location", "season", "equipment", "condition"],
  },

  cultivate_body: {
    type: "cultivate_body",
    name: "Luyện Thể",
    name_en: "Body Cultivation",
    description: "Tôi luyện thể xác, tăng sức mạnh thể chất",
    description_en: "Temper the body to increase physical strength",
    icon: "💪",
    category: "cultivation",
    base_stamina_cost: 4,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 20,
      not_injured: true, // Cannot body cultivate while injured
    },
    allowed_durations: ["1_segment", "half_day", "full_day", "3_days", "week"],
    base_rewards: {
      body_exp: 12,
      insight_chance: 0.03,
    },
    affected_by: ["technique", "location", "equipment", "condition"],
  },

  meditate: {
    type: "meditate",
    name: "Thiền định",
    name_en: "Meditation",
    description: "Tĩnh tâm, tăng cơ hội ngộ đạo",
    description_en: "Clear the mind, increase chance of enlightenment",
    icon: "🪷",
    category: "cultivation",
    base_stamina_cost: 1,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 5,
    },
    allowed_durations: ["1_segment", "half_day", "full_day"],
    base_rewards: {
      qi_exp: 5,
      insight_chance: 0.15, // Higher insight chance
      stamina_recovery: 2,
    },
    affected_by: ["location", "condition"],
  },

  practice_skill: {
    type: "practice_skill",
    name: "Luyện Kỹ năng",
    name_en: "Skill Practice",
    description: "Rèn luyện kỹ năng chiến đấu",
    description_en: "Train combat skills",
    icon: "⚔️",
    category: "combat",
    base_stamina_cost: 3,
    base_qi_cost: 5,
    requirements: {
      min_stamina: 15,
      min_qi: 10,
    },
    allowed_durations: ["1_segment", "half_day", "full_day", "3_days"],
    base_rewards: {
      skill_exp: 20,
    },
    affected_by: ["equipment", "condition"],
  },

  explore: {
    type: "explore",
    name: "Khám phá",
    name_en: "Explore",
    description: "Khám phá khu vực, tìm kiếm cơ duyên",
    description_en: "Explore the area, seek opportunities",
    icon: "🗺️",
    category: "gathering",
    base_stamina_cost: 3,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 20,
    },
    allowed_durations: ["1_segment", "half_day", "full_day"],
    base_rewards: {
      qi_exp: 5,
      insight_chance: 0.1,
    },
    affected_by: ["location", "equipment"],
  },

  gather: {
    type: "gather",
    name: "Thu thập",
    name_en: "Gather",
    description: "Thu thập dược liệu và tài nguyên",
    description_en: "Gather herbs and resources",
    icon: "🌿",
    category: "gathering",
    base_stamina_cost: 2,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 10,
      required_location_type: ["wilderness", "mountain", "forest"],
    },
    allowed_durations: ["1_segment", "half_day", "full_day"],
    base_rewards: {
      qi_exp: 2,
    },
    affected_by: ["location", "equipment"],
  },

  craft_alchemy: {
    type: "craft_alchemy",
    name: "Luyện đan",
    name_en: "Alchemy",
    description: "Luyện chế đan dược",
    description_en: "Craft pills and medicines",
    icon: "⚗️",
    category: "gathering",
    base_stamina_cost: 4,
    base_qi_cost: 10,
    requirements: {
      min_stamina: 20,
      min_qi: 20,
      required_items: ["alchemy_furnace"],
    },
    allowed_durations: ["1_segment", "half_day", "full_day"],
    base_rewards: {
      qi_exp: 3,
      insight_chance: 0.02,
    },
    affected_by: ["equipment", "condition"],
  },

  rest: {
    type: "rest",
    name: "Nghỉ ngơi",
    name_en: "Rest",
    description: "Hồi phục thể lực và trị thương",
    description_en: "Recover stamina and heal injuries",
    icon: "😴",
    category: "recovery",
    base_stamina_cost: 0,
    base_qi_cost: 0,
    requirements: {},
    allowed_durations: ["1_segment", "half_day", "full_day", "3_days", "week"],
    base_rewards: {
      stamina_recovery: 15,
      hp_recovery: 10,
    },
    affected_by: ["location", "condition"],
  },

  socialize: {
    type: "socialize",
    name: "Giao lưu",
    name_en: "Socialize",
    description: "Kết giao, thu thập tin tức",
    description_en: "Make connections, gather information",
    icon: "🤝",
    category: "social",
    base_stamina_cost: 1,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 5,
      required_location_type: ["city", "sect", "town"],
    },
    allowed_durations: ["1_segment", "half_day"],
    base_rewards: {
      insight_chance: 0.05,
    },
    affected_by: ["condition"],
  },

  sect_duty: {
    type: "sect_duty",
    name: "Nhiệm vụ môn phái",
    name_en: "Sect Duty",
    description: "Hoàn thành nhiệm vụ môn phái",
    description_en: "Complete sect missions",
    icon: "📜",
    category: "social",
    base_stamina_cost: 3,
    base_qi_cost: 5,
    requirements: {
      min_stamina: 15,
      in_sect: true,
    },
    allowed_durations: ["half_day", "full_day", "3_days"],
    base_rewards: {
      qi_exp: 10,
      skill_exp: 10,
    },
    affected_by: ["condition"],
  },

  trade: {
    type: "trade",
    name: "Mua bán",
    name_en: "Trade",
    description: "Giao dịch tại chợ",
    description_en: "Trade at the market",
    icon: "💰",
    category: "social",
    base_stamina_cost: 1,
    base_qi_cost: 0,
    requirements: {
      required_location_type: ["city", "town", "market"],
    },
    allowed_durations: ["1_segment", "half_day"],
    base_rewards: {},
    affected_by: [],
  },

  travel: {
    type: "travel",
    name: "Di chuyển",
    name_en: "Travel",
    description: "Di chuyển đến khu vực khác",
    description_en: "Travel to another area",
    icon: "🚶",
    category: "special",
    base_stamina_cost: 2,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 10,
    },
    allowed_durations: ["1_segment", "half_day", "full_day"],
    base_rewards: {
      qi_exp: 2,
    },
    affected_by: ["equipment"],
  },

  dungeon: {
    type: "dungeon",
    name: "Khám phá bí cảnh",
    name_en: "Dungeon",
    description: "Thám hiểm bí cảnh nguy hiểm",
    description_en: "Explore dangerous secret realms",
    icon: "🏛️",
    category: "combat",
    base_stamina_cost: 5,
    base_qi_cost: 10,
    requirements: {
      min_stamina: 30,
      min_qi: 20,
    },
    allowed_durations: ["half_day", "full_day", "3_days"],
    base_rewards: {
      qi_exp: 20,
      skill_exp: 15,
      insight_chance: 0.1,
    },
    affected_by: ["equipment", "condition"],
  },

  breakthrough_prep: {
    type: "breakthrough_prep",
    name: "Chuẩn bị đột phá",
    name_en: "Breakthrough Preparation",
    description: "Chuẩn bị tâm thái và vật phẩm cho đột phá",
    description_en: "Prepare mind and items for breakthrough",
    icon: "🎯",
    category: "special",
    base_stamina_cost: 1,
    base_qi_cost: 0,
    requirements: {
      min_stamina: 20,
    },
    allowed_durations: ["1_segment", "half_day"],
    base_rewards: {
      insight_chance: 0.1,
    },
    affected_by: ["location", "condition"],
  },

  breakthrough: {
    type: "breakthrough",
    name: "Đột phá",
    name_en: "Breakthrough",
    description: "Cố gắng đột phá cảnh giới",
    description_en: "Attempt realm breakthrough",
    icon: "⚡",
    category: "special",
    base_stamina_cost: 10,
    base_qi_cost: 20,
    requirements: {
      min_stamina: 50,
      min_qi: 30,
      not_injured: true,
    },
    allowed_durations: ["full_day"],
    base_rewards: {},
    affected_by: ["technique", "location", "equipment", "condition"],
  },
};

// =====================================================
// ACTIVITY COST CALCULATIONS
// =====================================================

/**
 * Get activity definition by type
 */
export function getActivityDefinition(type: ActivityType): ActivityDefinition {
  return ACTIVITY_DEFINITIONS[type];
}

/**
 * Calculate total cost for an activity
 */
export function calculateActivityCost(
  type: ActivityType,
  durationSegments: number,
  state: GameState
): {
  stamina: number;
  qi: number;
  time_segments: number;
  affordable: boolean;
  missing: string[];
} {
  const def = getActivityDefinition(type);

  const staminaCost = def.base_stamina_cost * durationSegments;
  const qiCost = def.base_qi_cost * durationSegments;

  const missing: string[] = [];

  if (state.stats.stamina < staminaCost) {
    missing.push(`stamina (need ${staminaCost}, have ${state.stats.stamina})`);
  }

  if (state.stats.qi < qiCost) {
    missing.push(`qi (need ${qiCost}, have ${state.stats.qi})`);
  }

  return {
    stamina: staminaCost,
    qi: qiCost,
    time_segments: durationSegments,
    affordable: missing.length === 0,
    missing,
  };
}

// =====================================================
// ACTIVITY REQUIREMENTS CHECK
// =====================================================

/**
 * Check if player can perform an activity
 */
export function canPerformActivity(
  type: ActivityType,
  state: GameState,
  locale: Locale
): {
  canPerform: boolean;
  reasons: string[];
} {
  const def = getActivityDefinition(type);
  const reqs = def.requirements;
  const reasons: string[] = [];

  // Check stamina
  if (reqs?.min_stamina && state.stats.stamina < reqs.min_stamina) {
    reasons.push(
      locale === "vi"
        ? `Cần ít nhất ${reqs.min_stamina} thể lực`
        : `Need at least ${reqs.min_stamina} stamina`
    );
  }

  // Check qi
  if (reqs?.min_qi && state.stats.qi < reqs.min_qi) {
    reasons.push(
      locale === "vi" ? `Cần ít nhất ${reqs.min_qi} khí` : `Need at least ${reqs.min_qi} qi`
    );
  }

  // Check realm
  if (reqs?.min_realm) {
    const realmOrder: Realm[] = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];
    const currentIndex = realmOrder.indexOf(state.progress.realm);
    const requiredIndex = realmOrder.indexOf(reqs.min_realm);
    if (currentIndex < requiredIndex) {
      reasons.push(
        locale === "vi"
          ? `Cần đạt cảnh giới ${reqs.min_realm}`
          : `Need to reach ${reqs.min_realm} realm`
      );
    }
  }

  // Check sect membership
  if (reqs?.in_sect && !state.sect_membership) {
    reasons.push(locale === "vi" ? "Cần gia nhập môn phái" : "Need to join a sect");
  }

  // Check injuries
  if (reqs?.not_injured && state.condition?.injuries?.length) {
    reasons.push(
      locale === "vi" ? "Không thể thực hiện khi bị thương" : "Cannot perform while injured"
    );
  }

  // Check location type
  if (reqs?.required_location_type?.length) {
    // TODO: Check against actual location type from travel state
    // For now, assume location check passes
  }

  // Check required items
  if (reqs?.required_items?.length) {
    const hasItems = reqs.required_items.every((itemId) =>
      state.inventory.items.some((item) => item.id === itemId)
    );
    if (!hasItems) {
      reasons.push(locale === "vi" ? "Thiếu vật phẩm cần thiết" : "Missing required items");
    }
  }

  return {
    canPerform: reasons.length === 0,
    reasons,
  };
}

// =====================================================
// ACTIVITY REWARDS CALCULATION
// =====================================================

interface ActivityBonuses {
  technique: number;
  location: number;
  season: number;
  equipment: number;
  condition: number;
  special: number;
  total: number;
}

/**
 * Calculate all bonuses for an activity
 */
export function calculateActivityBonuses(type: ActivityType, state: GameState): ActivityBonuses {
  const def = getActivityDefinition(type);
  const bonuses: ActivityBonuses = {
    technique: 0,
    location: 0,
    season: 0,
    equipment: 0,
    condition: 0,
    special: 0,
    total: 0,
  };

  const time = getGameTimeFromState(state);

  // Technique bonus (for cultivation activities)
  if (def.affected_by.includes("technique") && state.techniques.length > 0) {
    // Find best matching technique
    const activeTechnique = state.techniques.find((t) => t.type === "Main");
    if (activeTechnique) {
      bonuses.technique = activeTechnique.cultivation_speed_bonus || 0;
    }
  }

  // Season + time segment bonus
  if (def.affected_by.includes("season")) {
    bonuses.season = calculateTimeCultivationBonus(time, state.spirit_root.elements);
  }

  // Location bonus (from travel state or location_cultivation_bonuses)
  if (def.affected_by.includes("location")) {
    // TODO: Pull from location_cultivation_bonuses table and Area definitions
    // For now, use a base bonus based on current location type
    if (state.travel?.current_area) {
      // Areas with "sect" or "cultivation" in name typically have bonuses
      const areaId = state.travel.current_area.toLowerCase();
      if (areaId.includes("sect") || areaId.includes("cultivation")) {
        bonuses.location = 15;
      } else if (areaId.includes("mountain") || areaId.includes("peak")) {
        bonuses.location = 10;
      } else if (areaId.includes("city") || areaId.includes("market")) {
        bonuses.location = 0;
      } else {
        bonuses.location = 5; // Default wilderness bonus
      }
    }
  }

  // Equipment bonus
  if (def.affected_by.includes("equipment")) {
    // Sum cultivation_speed from equipped items
    Object.values(state.equipped_items).forEach((item) => {
      if (item?.bonus_stats?.cultivation_speed) {
        bonuses.equipment += item.bonus_stats.cultivation_speed;
      }
    });
  }

  // Condition penalty/bonus
  if (def.affected_by.includes("condition") && state.condition) {
    // Injuries reduce effectiveness
    const injuryPenalty = (state.condition.injuries?.length || 0) * -10;

    // Fatigue reduces effectiveness
    const fatiguePenalty = -Math.floor((state.condition.fatigue || 0) / 10);

    // Mental state can help or hurt
    const mentalBonus = {
      enlightened: 20,
      focused: 10,
      calm: 0,
      agitated: -10,
      fearful: -15,
      injured: -20,
      corrupted: -25,
    }[state.condition.mental_state || "calm"];

    // Qi deviation penalty
    const qiDeviationPenalty = -Math.floor((state.condition.qi_deviation_level || 0) / 5);

    bonuses.condition = injuryPenalty + fatiguePenalty + mentalBonus + qiDeviationPenalty;
  }

  // Special time bonuses
  const specialBonus = getSpecialTimeBonus(time);
  if (specialBonus) {
    bonuses.special = specialBonus.bonus;
  }

  // Calculate total (minimum -50% to prevent negative rewards)
  bonuses.total = Math.max(
    -50,
    bonuses.technique +
      bonuses.location +
      bonuses.season +
      bonuses.equipment +
      bonuses.condition +
      bonuses.special
  );

  return bonuses;
}

/**
 * Calculate expected rewards for an activity
 */
export function calculateExpectedRewards(
  type: ActivityType,
  durationSegments: number,
  state: GameState
): {
  qi_exp: number;
  body_exp: number;
  skill_exp: number;
  insight_chance: number;
  stamina_recovery: number;
  hp_recovery: number;
  bonuses: ActivityBonuses;
} {
  const def = getActivityDefinition(type);
  const bonuses = calculateActivityBonuses(type, state);
  const multiplier = 1 + bonuses.total / 100;

  const baseRewards = def.base_rewards;

  return {
    qi_exp: Math.floor((baseRewards.qi_exp || 0) * durationSegments * multiplier),
    body_exp: Math.floor((baseRewards.body_exp || 0) * durationSegments * multiplier),
    skill_exp: Math.floor((baseRewards.skill_exp || 0) * durationSegments * multiplier),
    insight_chance: Math.min(1, (baseRewards.insight_chance || 0) * durationSegments),
    stamina_recovery: Math.floor((baseRewards.stamina_recovery || 0) * durationSegments),
    hp_recovery: Math.floor((baseRewards.hp_recovery || 0) * durationSegments),
    bonuses,
  };
}

// =====================================================
// ACTIVITY EXECUTION
// =====================================================

/**
 * Start an activity
 */
export function startActivity(
  state: GameState,
  type: ActivityType,
  durationSegments: number,
  techniqueId?: string
): {
  newState: GameState;
  activity: CurrentActivity;
} {
  const currentTime = getGameTimeFromState(state);
  const targetEndTime = advanceTime(currentTime, durationSegments);
  const bonuses = calculateActivityBonuses(type, state);

  const activity: CurrentActivity = {
    type,
    started_time: currentTime,
    target_end_time: targetEndTime,
    duration_segments: durationSegments,
    progress: 0,
    technique_id: techniqueId,
    accumulated_rewards: {
      qi_exp: 0,
      body_exp: 0,
      skill_exp: {},
      items: [],
      silver: 0,
      insights: [],
    },
    interruptions: 0,
    bonuses,
  };

  const newState: GameState = {
    ...state,
    activity: {
      ...state.activity,
      current: activity,
      available_activities: state.activity?.available_activities || [],
      cooldowns: state.activity?.cooldowns || ({} as Record<ActivityType, GameTime>),
      daily_log: state.activity?.daily_log || [],
    },
  };

  return { newState, activity };
}

/**
 * Process activity progress (called each turn during activity)
 */
export function processActivityProgress(
  state: GameState,
  segmentsPassed: number = 1
): {
  newState: GameState;
  completed: boolean;
  rewards?: {
    qi_exp: number;
    body_exp: number;
    skill_exp: Record<string, number>;
    items: InventoryItem[];
    silver: number;
    insights: string[];
  };
  narrative_context?: string;
} {
  if (!state.activity?.current) {
    return { newState: state, completed: false };
  }

  const activity = state.activity.current;
  const def = getActivityDefinition(activity.type);
  const expectedRewards = calculateExpectedRewards(activity.type, segmentsPassed, state);

  // Accumulate rewards
  const newAccumulatedRewards = {
    qi_exp: activity.accumulated_rewards.qi_exp + expectedRewards.qi_exp,
    body_exp: activity.accumulated_rewards.body_exp + expectedRewards.body_exp,
    skill_exp: { ...activity.accumulated_rewards.skill_exp },
    items: [...activity.accumulated_rewards.items],
    silver: activity.accumulated_rewards.silver,
    insights: [...activity.accumulated_rewards.insights],
  };

  // Check for insight
  if (Math.random() < expectedRewards.insight_chance / activity.duration_segments) {
    newAccumulatedRewards.insights.push(generateInsight(activity.type, state));
  }

  // Update progress
  const newProgress = Math.min(
    100,
    (((activity.progress / 100) * activity.duration_segments + segmentsPassed) /
      activity.duration_segments) *
      100
  );

  const completed = newProgress >= 100;

  // Apply costs
  const costs = calculateActivityCost(activity.type, segmentsPassed, state);
  let newStats = {
    ...state.stats,
    stamina: Math.max(0, state.stats.stamina - costs.stamina),
    qi: Math.max(0, state.stats.qi - costs.qi),
  };

  // Apply recovery if resting
  if (activity.type === "rest" || activity.type === "meditate") {
    newStats = {
      ...newStats,
      stamina: Math.min(
        state.stats.stamina_max,
        newStats.stamina + expectedRewards.stamina_recovery
      ),
      hp: Math.min(
        state.stats.hp_max,
        (newStats.hp || state.stats.hp) + expectedRewards.hp_recovery
      ),
    };
  }

  // Update activity state
  const updatedActivity: CurrentActivity = {
    ...activity,
    progress: newProgress,
    accumulated_rewards: newAccumulatedRewards,
  };

  let newState: GameState = {
    ...state,
    stats: newStats,
    activity: {
      ...state.activity!,
      current: completed ? undefined : updatedActivity,
    },
  };

  // If completed, apply final rewards
  if (completed) {
    newState = applyActivityRewards(newState, newAccumulatedRewards);

    // Add to activity log
    const logEntry: ActivityLogEntry = {
      type: activity.type,
      started: activity.started_time,
      ended: getGameTimeFromState(newState),
      duration_segments: activity.duration_segments,
      outcome: "success",
      rewards_summary: formatRewardsSummary(newAccumulatedRewards),
    };

    newState = {
      ...newState,
      activity: {
        ...newState.activity!,
        daily_log: [...(newState.activity?.daily_log || []), logEntry].slice(-20),
      },
    };

    return {
      newState,
      completed: true,
      rewards: newAccumulatedRewards,
      narrative_context: generateActivityNarrative(activity, newAccumulatedRewards, state),
    };
  }

  return {
    newState,
    completed: false,
    narrative_context: generateProgressNarrative(activity, newProgress, state),
  };
}

/**
 * Interrupt current activity
 */
export function interruptActivity(
  state: GameState,
  reason: string
): {
  newState: GameState;
  partialRewards: CurrentActivity["accumulated_rewards"];
} {
  if (!state.activity?.current) {
    return {
      newState: state,
      partialRewards: {
        qi_exp: 0,
        body_exp: 0,
        skill_exp: {},
        items: [],
        silver: 0,
        insights: [],
      },
    };
  }

  const activity = state.activity.current;
  const partialRewards = activity.accumulated_rewards;

  // Apply partial rewards
  let newState = applyActivityRewards(state, partialRewards);

  // Log the interruption
  const logEntry: ActivityLogEntry = {
    type: activity.type,
    started: activity.started_time,
    ended: getGameTimeFromState(newState),
    duration_segments: Math.floor((activity.progress / 100) * activity.duration_segments),
    outcome: "interrupted",
    rewards_summary: `Interrupted: ${reason}. ${formatRewardsSummary(partialRewards)}`,
  };

  newState = {
    ...newState,
    activity: {
      ...newState.activity!,
      current: undefined,
      daily_log: [...(newState.activity?.daily_log || []), logEntry].slice(-20),
    },
  };

  return { newState, partialRewards };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Apply accumulated rewards to game state
 */
function applyActivityRewards(
  state: GameState,
  rewards: CurrentActivity["accumulated_rewards"]
): GameState {
  let newState = { ...state };

  // Apply qi cultivation exp
  if (rewards.qi_exp > 0) {
    newState = {
      ...newState,
      progress: {
        ...newState.progress,
        cultivation_exp: newState.progress.cultivation_exp + rewards.qi_exp,
      },
    };
  }

  // Apply body cultivation exp
  if (
    (rewards.body_exp > 0 && newState.progress.cultivation_path === "body") ||
    newState.progress.cultivation_path === "dual"
  ) {
    newState = {
      ...newState,
      progress: {
        ...newState.progress,
        body_exp: (newState.progress.body_exp || 0) + rewards.body_exp,
      },
    };
  }

  // Apply skill exp
  Object.entries(rewards.skill_exp).forEach(([skillId, exp]) => {
    const skillIndex = newState.skills.findIndex((s) => s.id === skillId);
    if (skillIndex !== -1) {
      const skill = newState.skills[skillIndex];
      newState = {
        ...newState,
        skills: [
          ...newState.skills.slice(0, skillIndex),
          { ...skill, exp: (skill.exp || 0) + exp },
          ...newState.skills.slice(skillIndex + 1),
        ],
      };
    }
  });

  // Apply items
  if (rewards.items.length > 0) {
    newState = {
      ...newState,
      inventory: {
        ...newState.inventory,
        items: [...newState.inventory.items, ...rewards.items],
      },
    };
  }

  // Apply silver
  if (rewards.silver > 0) {
    newState = {
      ...newState,
      inventory: {
        ...newState.inventory,
        silver: newState.inventory.silver + rewards.silver,
      },
    };
  }

  return newState;
}

/**
 * Generate an insight message
 */
function generateInsight(type: ActivityType, state: GameState): string {
  const insights: Record<ActivityType, string[]> = {
    cultivate_qi: [
      "Cảm nhận được dòng chảy của linh khí trong kinh mạch",
      "Hiểu thêm về bản chất của khí nguyên",
      "Phát hiện một nút thắt nhỏ trong kinh mạch",
    ],
    cultivate_body: [
      "Cơ thể trở nên nhẹ nhàng hơn",
      "Cảm nhận sức mạnh tiềm ẩn trong cơ bắp",
      "Hiểu thêm về giới hạn của thể xác",
    ],
    meditate: [
      "Tâm trí trở nên thanh tịnh",
      "Nhìn thấu được một đạo lý nhỏ",
      "Cảm nhận sự hài hòa của thiên địa",
    ],
    practice_skill: ["Động tác trở nên mượt mà hơn", "Hiểu thêm về tinh túy của chiêu thức"],
    explore: ["Phát hiện một con đường mòn ẩn giấu", "Nghe được tin đồn thú vị"],
    gather: ["Nhận ra loại dược liệu hiếm", "Hiểu thêm về đặc tính của thảo dược"],
    craft_alchemy: [
      "Lĩnh ngộ được một bí quyết luyện đan",
      "Hiểu thêm về sự cân bằng của dược tính",
    ],
    rest: ["Giấc mơ mang đến điều kỳ lạ"],
    socialize: ["Nghe được tin tức quan trọng"],
    sect_duty: ["Được sư huynh chỉ điểm"],
    trade: [],
    travel: ["Nhìn thấy cảnh vật đẹp đẽ"],
    dungeon: ["Phát hiện bí mật của bí cảnh"],
    breakthrough_prep: ["Cảm nhận được cơ duyên đang đến gần"],
    breakthrough: [],
  };

  const pool = insights[type] || [];
  return pool[Math.floor(Math.random() * pool.length)] || "Có điều gì đó lạ lùng...";
}

/**
 * Format rewards summary for logging
 */
function formatRewardsSummary(rewards: CurrentActivity["accumulated_rewards"]): string {
  const parts: string[] = [];

  if (rewards.qi_exp > 0) parts.push(`+${rewards.qi_exp} tu vi`);
  if (rewards.body_exp > 0) parts.push(`+${rewards.body_exp} thể tu`);
  if (rewards.silver > 0) parts.push(`+${rewards.silver} bạc`);
  if (rewards.items.length > 0) parts.push(`+${rewards.items.length} vật phẩm`);
  if (rewards.insights.length > 0) parts.push(`${rewards.insights.length} ngộ đạo`);

  return parts.join(", ") || "Không có phần thưởng";
}

/**
 * Generate narrative context for completed activity
 */
function generateActivityNarrative(
  activity: CurrentActivity,
  rewards: CurrentActivity["accumulated_rewards"],
  state: GameState
): string {
  const def = getActivityDefinition(activity.type);

  let narrative = `Sau ${activity.duration_segments} canh giờ ${def.name.toLowerCase()}, `;

  if (rewards.qi_exp > 0) {
    narrative += `tu vi tăng thêm ${rewards.qi_exp} điểm. `;
  }

  if (rewards.insights.length > 0) {
    narrative += `Trong quá trình đó, ${rewards.insights[0]}. `;
  }

  if (activity.bonuses.total > 20) {
    narrative += `Điều kiện thuận lợi giúp hiệu quả tăng đáng kể. `;
  } else if (activity.bonuses.total < -20) {
    narrative += `Điều kiện không thuận lợi ảnh hưởng đến kết quả. `;
  }

  return narrative;
}

/**
 * Generate progress narrative
 */
function generateProgressNarrative(
  activity: CurrentActivity,
  progress: number,
  state: GameState
): string {
  const def = getActivityDefinition(activity.type);

  if (progress < 25) {
    return `Mới bắt đầu ${def.name.toLowerCase()}...`;
  } else if (progress < 50) {
    return `Đang tiến hành ${def.name.toLowerCase()}...`;
  } else if (progress < 75) {
    return `Đã hoàn thành hơn nửa ${def.name.toLowerCase()}...`;
  } else {
    return `Sắp hoàn thành ${def.name.toLowerCase()}...`;
  }
}

/**
 * Get available activities for current state
 */
export function getAvailableActivities(
  state: GameState,
  locale: Locale
): {
  type: ActivityType;
  definition: ActivityDefinition;
  canPerform: boolean;
  reasons: string[];
}[] {
  return Object.values(ACTIVITY_DEFINITIONS).map((def) => {
    const check = canPerformActivity(def.type, state, locale);
    return {
      type: def.type,
      definition: def,
      canPerform: check.canPerform,
      reasons: check.reasons,
    };
  });
}
