/**
 * CultivatorDashboard Component
 * Main dashboard for the cultivation simulator showing:
 * - Time display with season/bonuses
 * - Activity selection and progress
 * - Character condition and progression
 * - Quick stats overview
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  GameState,
  GameTime,
  TimeSegment,
  ActivityType,
  CurrentActivity,
  Locale,
} from "@/types/game";
import {
  getSeasonFromMonth,
  getSeasonName,
  formatGameTime,
  calculateTimeCultivationBonus,
  getSpecialTimeBonus,
  SEGMENT_NAMES_EN,
  formatDuration,
} from "@/lib/game/time";
import {
  ACTIVITY_DEFINITIONS,
  getAvailableActivities,
  canPerformActivity,
  calculateActivityBonuses,
  calculateExpectedRewards,
  startActivity,
  getActivityDefinition,
} from "@/lib/game/activities";

// =====================================================
// TYPES
// =====================================================

interface CultivatorDashboardProps {
  state: GameState;
  locale: Locale;
  onActivityStart?: (activityType: ActivityType, durationSegments: number) => void;
  onActivityInterrupt?: () => void;
  onTimeSkip?: (segments: number) => void;
  compact?: boolean;
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

/**
 * Time Display Widget
 */
function TimeDisplay({ state, locale }: { state: GameState; locale: Locale }) {
  const time: GameTime = {
    day: state.time_day,
    month: state.time_month,
    year: state.time_year,
    segment: state.time_segment as TimeSegment,
  };

  const season = getSeasonFromMonth(time.month);
  const seasonName = getSeasonName(season, locale);
  const segmentName =
    locale === "en" ? SEGMENT_NAMES_EN[time.segment as TimeSegment] : time.segment;

  const timeBonus = calculateTimeCultivationBonus(time, state.spirit_root.elements);
  const specialBonus = getSpecialTimeBonus(time);

  // Segment icons
  const segmentIcons: Record<TimeSegment, string> = {
    Sáng: "🌅",
    Chiều: "☀️",
    Tối: "🌆",
    Đêm: "🌙",
  };

  // Season colors
  const seasonColors: Record<string, string> = {
    Spring: "bg-green-900 text-green-200",
    Summer: "bg-orange-900 text-orange-200",
    Autumn: "bg-amber-900 text-amber-200",
    Winter: "bg-blue-900 text-blue-200",
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{segmentIcons[time.segment as TimeSegment] || "⏰"}</span>
          <div>
            <div className="font-medium text-white">
              {locale === "vi"
                ? `Năm ${time.year}, Tháng ${time.month}, Ngày ${time.day}`
                : `Year ${time.year}, Month ${time.month}, Day ${time.day}`}
            </div>
            <div className="text-sm text-gray-400">{segmentName}</div>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${seasonColors[season]}`}>
          🌸 {seasonName}
        </span>
      </div>

      {/* Cultivation bonuses */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-purple-900 text-purple-200 rounded">
          {locale === "vi" ? "Tu luyện" : "Cultivation"}: +{timeBonus}%
        </span>
        {specialBonus && (
          <span className="px-2 py-1 bg-yellow-900 text-yellow-200 rounded animate-pulse">
            ✨ {locale === "vi" ? specialBonus.reason_vi : specialBonus.reason_en}: +
            {specialBonus.bonus}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Activity Progress Widget
 */
function ActivityProgress({
  activity,
  locale,
  onInterrupt,
}: {
  activity: CurrentActivity;
  locale: Locale;
  onInterrupt?: () => void;
}) {
  const def = getActivityDefinition(activity.type);

  return (
    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{def?.icon || "⚙️"}</span>
          <span className="font-medium text-white">
            {locale === "vi" ? def?.name : def?.name_en}
          </span>
        </div>
        {onInterrupt && (
          <button
            onClick={onInterrupt}
            className="px-2 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-200 rounded transition-colors"
          >
            {locale === "vi" ? "Dừng" : "Stop"}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${activity.progress}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {activity.progress}% - {activity.duration_segments}{" "}
          {locale === "vi" ? "canh giờ" : "segments"}
        </span>
        <span>
          {locale === "vi" ? "Bonus" : "Bonus"}: +{activity.bonuses.total}%
        </span>
      </div>

      {/* Accumulated rewards preview */}
      {(activity.accumulated_rewards.qi_exp > 0 || activity.accumulated_rewards.body_exp > 0) && (
        <div className="mt-2 pt-2 border-t border-blue-700 text-xs text-gray-400">
          {locale === "vi" ? "Tích lũy" : "Accumulated"}:
          {activity.accumulated_rewards.qi_exp > 0 && (
            <span className="ml-2 text-blue-400">
              +{activity.accumulated_rewards.qi_exp} Qi
            </span>
          )}
          {activity.accumulated_rewards.body_exp > 0 && (
            <span className="ml-2 text-orange-400">
              +{activity.accumulated_rewards.body_exp} Body
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Quick Stats Bar
 */
function QuickStats({ state, locale }: { state: GameState; locale: Locale }) {
  const hpPercent = (state.stats.hp / state.stats.hp_max) * 100;
  const qiPercent = (state.stats.qi / state.stats.qi_max) * 100;
  const staminaPercent = (state.stats.stamina / state.stats.stamina_max) * 100;

  const getBarColor = (percent: number) => {
    if (percent > 60) return "bg-green-500";
    if (percent > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* HP */}
      <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
        <div className="flex items-center gap-1 text-xs mb-1">
          <span>❤️</span>
          <span className="text-gray-400">HP</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
          <div
            className={`${getBarColor(hpPercent)} h-2 rounded-full transition-all`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <div className="text-xs text-right text-gray-400">
          {state.stats.hp}/{state.stats.hp_max}
        </div>
      </div>

      {/* Qi */}
      <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
        <div className="flex items-center gap-1 text-xs mb-1">
          <span>💠</span>
          <span className="text-gray-400">Qi</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${qiPercent}%` }}
          />
        </div>
        <div className="text-xs text-right text-gray-400">
          {state.stats.qi}/{state.stats.qi_max}
        </div>
      </div>

      {/* Stamina */}
      <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
        <div className="flex items-center gap-1 text-xs mb-1">
          <span>⚡</span>
          <span className="text-gray-400">
            {locale === "vi" ? "Thể" : "Sta"}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
          <div
            className={`${getBarColor(staminaPercent)} h-2 rounded-full transition-all`}
            style={{ width: `${staminaPercent}%` }}
          />
        </div>
        <div className="text-xs text-right text-gray-400">
          {state.stats.stamina}/{state.stats.stamina_max}
        </div>
      </div>
    </div>
  );
}

/**
 * Activity Quick Select
 */
function ActivityQuickSelect({
  state,
  locale,
  onActivityStart,
}: {
  state: GameState;
  locale: Locale;
  onActivityStart?: (type: ActivityType, duration: number) => void;
}) {
  const [selectedDuration, setSelectedDuration] = useState(4); // Default 1 day

  const availableActivities = useMemo(() => getAvailableActivities(state, locale), [state, locale]);

  // Group activities by category
  const groupedActivities = useMemo(() => {
    const groups: Record<string, typeof availableActivities> = {};
    availableActivities.forEach((activity) => {
      const category = activity.definition.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(activity);
    });
    return groups;
  }, [availableActivities]);

  const categoryLabels: Record<string, { vi: string; en: string }> = {
    cultivation: { vi: "Tu luyện", en: "Cultivation" },
    combat: { vi: "Chiến đấu", en: "Combat" },
    gathering: { vi: "Thu thập", en: "Gathering" },
    social: { vi: "Giao lưu", en: "Social" },
    recovery: { vi: "Hồi phục", en: "Recovery" },
    special: { vi: "Đặc biệt", en: "Special" },
  };

  const handleActivityClick = useCallback(
    (type: ActivityType) => {
      const result = canPerformActivity(type, state, locale);
      if (result.canPerform && onActivityStart) {
        onActivityStart(type, selectedDuration);
      }
    },
    [state, selectedDuration, locale, onActivityStart]
  );

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-white">
          {locale === "vi" ? "Hoạt động" : "Activities"}
        </h3>
        <select
          value={selectedDuration}
          onChange={(e) => setSelectedDuration(Number(e.target.value))}
          className="text-xs border border-gray-600 rounded px-2 py-1 bg-gray-700 text-white"
        >
          <option value={1}>{locale === "vi" ? "1 canh" : "1 segment"}</option>
          <option value={2}>{locale === "vi" ? "Nửa ngày" : "Half day"}</option>
          <option value={4}>{locale === "vi" ? "1 ngày" : "1 day"}</option>
          <option value={12}>{locale === "vi" ? "3 ngày" : "3 days"}</option>
          <option value={28}>{locale === "vi" ? "1 tuần" : "1 week"}</option>
        </select>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedActivities).map(([category, activities]) => (
          <div key={category}>
            <div className="text-xs text-gray-400 mb-1">
              {locale === "vi" ? categoryLabels[category]?.vi : categoryLabels[category]?.en}
            </div>
            <div className="flex flex-wrap gap-1">
              {activities.map((activity) => {
                const def = activity.definition;

                return (
                  <button
                    key={activity.type}
                    onClick={() => handleActivityClick(activity.type)}
                    disabled={!activity.canPerform}
                    title={
                      activity.canPerform
                        ? locale === "vi"
                          ? def.description
                          : def.description_en
                        : activity.reasons.join(", ")
                    }
                    className={`
                      flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors
                      ${
                        activity.canPerform
                          ? "bg-gray-700 hover:bg-gray-600 text-white cursor-pointer"
                          : "bg-gray-800 text-gray-500 cursor-not-allowed"
                      }
                    `}
                  >
                    <span>{def.icon}</span>
                    <span>{locale === "vi" ? def.name : def.name_en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Condition Warnings
 */
function ConditionWarnings({ state, locale }: { state: GameState; locale: Locale }) {
  const warnings: Array<{ icon: string; message: string; severity: string }> = [];

  // Stamina warning
  if (state.stats.stamina < 20) {
    warnings.push({
      icon: "😴",
      message: locale === "vi" ? "Thể lực thấp - cần nghỉ ngơi" : "Low stamina - rest needed",
      severity: "warning",
    });
  }

  // HP warning
  if (state.stats.hp < state.stats.hp_max * 0.3) {
    warnings.push({
      icon: "💔",
      message: locale === "vi" ? "HP thấp nguy hiểm!" : "Critically low HP!",
      severity: "danger",
    });
  }

  // Condition warnings
  if (state.condition) {
    if (state.condition.fatigue > 70) {
      warnings.push({
        icon: "😓",
        message:
          locale === "vi" ? "Mệt mỏi cao - hiệu quả giảm" : "High fatigue - reduced efficiency",
        severity: "warning",
      });
    }

    if (state.condition.qi_deviation_level > 30) {
      warnings.push({
        icon: "⚠️",
        message:
          locale === "vi"
            ? `Nguy cơ tẩu hỏa: ${state.condition.qi_deviation_level}%`
            : `Qi deviation risk: ${state.condition.qi_deviation_level}%`,
        severity: "danger",
      });
    }

    if (state.condition.injuries.length > 0) {
      warnings.push({
        icon: "🩹",
        message:
          locale === "vi"
            ? `${state.condition.injuries.length} chấn thương chưa lành`
            : `${state.condition.injuries.length} unhealed injuries`,
        severity: "warning",
      });
    }
  }

  // Lifespan warning
  if (state.lifespan && state.lifespan.years_remaining <= 20) {
    warnings.push({
      icon: "⏳",
      message:
        locale === "vi"
          ? `Chỉ còn ${state.lifespan.years_remaining} năm - cần đột phá!`
          : `Only ${state.lifespan.years_remaining} years left - breakthrough needed!`,
      severity: "danger",
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
            w.severity === "danger"
              ? "bg-red-900/30 text-red-200 animate-pulse"
              : "bg-yellow-900/30 text-yellow-200"
          }`}
        >
          <span>{w.icon}</span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function CultivatorDashboard({
  state,
  locale,
  onActivityStart,
  onActivityInterrupt,
  onTimeSkip,
  compact = false,
}: CultivatorDashboardProps) {
  const hasActiveActivity = !!state.activity?.current;

  return (
    <div className="space-y-3">
      {/* Time Display */}
      <TimeDisplay state={state} locale={locale} />

      {/* Quick Stats */}
      <QuickStats state={state} locale={locale} />

      {/* Condition Warnings */}
      <ConditionWarnings state={state} locale={locale} />

      {/* Activity Section */}
      {hasActiveActivity && state.activity?.current ? (
        <ActivityProgress
          activity={state.activity.current}
          locale={locale}
          onInterrupt={onActivityInterrupt}
        />
      ) : (
        !compact && (
          <ActivityQuickSelect state={state} locale={locale} onActivityStart={onActivityStart} />
        )
      )}

      {/* Quick actions for compact mode */}
      {compact && !hasActiveActivity && (
        <div className="flex gap-2">
          <button
            onClick={() => onActivityStart?.("cultivate_qi", 4)}
            className="flex-1 px-3 py-2 bg-blue-900 hover:bg-blue-800 text-blue-200 rounded text-xs font-medium transition-colors"
          >
            🧘 {locale === "vi" ? "Tu luyện" : "Cultivate"}
          </button>
          <button
            onClick={() => onActivityStart?.("rest", 2)}
            className="flex-1 px-3 py-2 bg-green-900 hover:bg-green-800 text-green-200 rounded text-xs font-medium transition-colors"
          >
            😴 {locale === "vi" ? "Nghỉ ngơi" : "Rest"}
          </button>
          <button
            onClick={() => onActivityStart?.("explore", 4)}
            className="flex-1 px-3 py-2 bg-amber-900 hover:bg-amber-800 text-amber-200 rounded text-xs font-medium transition-colors"
          >
            🗺️ {locale === "vi" ? "Khám phá" : "Explore"}
          </button>
        </div>
      )}
    </div>
  );
}
