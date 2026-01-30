"use client";

import React, { useState, useMemo } from "react";
import { GameState, ActivityType, ActivityDuration, Locale } from "@/types/game";
import {
  getAvailableActivities,
  getActivityDefinition,
  calculateActivityCost,
  calculateExpectedRewards,
  ACTIVITY_DEFINITIONS,
} from "@/lib/game/activities";
import {
  DURATION_OPTIONS,
  getDurationOption,
  formatDuration,
  getGameTimeFromState,
  formatGameTime,
  getSeason,
  getSeasonName,
} from "@/lib/game/time";

interface ActivitySelectorProps {
  gameState: GameState;
  locale: Locale;
  onSelectActivity: (type: ActivityType, durationSegments: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function ActivitySelector({
  gameState,
  locale,
  onSelectActivity,
  onCancel,
  disabled = false,
}: ActivitySelectorProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string>("1_segment");
  const [showDetails, setShowDetails] = useState(false);

  // Get current time info
  const currentTime = getGameTimeFromState(gameState);
  const season = getSeason(currentTime);
  const seasonName = getSeasonName(season, locale);

  // Get available activities
  const activities = useMemo(() => {
    return getAvailableActivities(gameState, locale);
  }, [gameState, locale]);

  // Group activities by category
  const activityGroups = useMemo(() => {
    return {
      cultivation: activities.filter((a) =>
        [
          "cultivate_qi",
          "cultivate_body",
          "meditate",
          "breakthrough_prep",
          "breakthrough",
        ].includes(a.type)
      ),
      training: activities.filter((a) => ["practice_skill", "sect_duty"].includes(a.type)),
      exploration: activities.filter((a) =>
        ["explore", "gather", "travel", "dungeon"].includes(a.type)
      ),
      social: activities.filter((a) => ["socialize", "trade"].includes(a.type)),
      recovery: activities.filter((a) => ["rest", "craft_alchemy"].includes(a.type)),
    };
  }, [activities]);

  // Get selected activity details
  const selectedDef = selectedActivity ? getActivityDefinition(selectedActivity) : null;
  const durationOption = getDurationOption(selectedDuration);
  const durationSegments = durationOption?.segments || 1;

  // Calculate costs and rewards for selected activity
  const costs = useMemo(() => {
    if (!selectedActivity) return null;
    return calculateActivityCost(selectedActivity, durationSegments, gameState);
  }, [selectedActivity, durationSegments, gameState]);

  const rewards = useMemo(() => {
    if (!selectedActivity) return null;
    return calculateExpectedRewards(selectedActivity, durationSegments, gameState);
  }, [selectedActivity, durationSegments, gameState]);

  // Check if can start activity
  const canStart = selectedActivity && costs?.affordable && !disabled;

  const handleStart = () => {
    if (canStart && selectedActivity) {
      onSelectActivity(selectedActivity, durationSegments);
    }
  };

  const groupLabels: Record<string, { vi: string; en: string }> = {
    cultivation: { vi: "🧘 Tu luyện", en: "🧘 Cultivation" },
    training: { vi: "⚔️ Rèn luyện", en: "⚔️ Training" },
    exploration: { vi: "🗺️ Khám phá", en: "🗺️ Exploration" },
    social: { vi: "🤝 Giao lưu", en: "🤝 Social" },
    recovery: { vi: "💚 Hồi phục", en: "💚 Recovery" },
  };

  return (
    <div className="bg-gray-900/95 border border-amber-900/50 rounded-lg p-4 max-w-2xl mx-auto">
      {/* Header with time info */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-amber-900/30">
        <h2 className="text-xl font-bold text-amber-400">
          {locale === "vi" ? "Chọn hoạt động" : "Select Activity"}
        </h2>
        <div className="text-sm text-gray-400">
          <span className="text-amber-300">{formatGameTime(currentTime, locale)}</span>
          <span className="ml-2 text-emerald-400">({seasonName})</span>
        </div>
      </div>

      {/* Current stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">⚡</span>
          <span className="text-gray-300">{locale === "vi" ? "Thể lực" : "Stamina"}:</span>
          <span
            className={`font-bold ${gameState.stats.stamina < 20 ? "text-red-400" : "text-green-400"}`}
          >
            {gameState.stats.stamina}/{gameState.stats.stamina_max}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-blue-400">💠</span>
          <span className="text-gray-300">{locale === "vi" ? "Khí" : "Qi"}:</span>
          <span
            className={`font-bold ${gameState.stats.qi < 10 ? "text-red-400" : "text-blue-400"}`}
          >
            {gameState.stats.qi}/{gameState.stats.qi_max}
          </span>
        </div>
      </div>

      {/* Activity selection grid */}
      <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
        {Object.entries(activityGroups).map(([groupKey, groupActivities]) => (
          <div key={groupKey}>
            <h3 className="text-sm font-semibold text-amber-500 mb-2">
              {groupLabels[groupKey][locale]}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {groupActivities.map(({ type, definition, canPerform, reasons }) => (
                <button
                  key={type}
                  onClick={() => setSelectedActivity(type)}
                  disabled={!canPerform || disabled}
                  className={`
                    p-2 rounded-lg text-left transition-all
                    ${
                      selectedActivity === type
                        ? "bg-amber-900/50 border-2 border-amber-500"
                        : "bg-gray-800/50 border border-gray-700 hover:border-amber-700"
                    }
                    ${!canPerform ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  title={!canPerform ? reasons.join(", ") : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{definition.icon}</span>
                    <span
                      className={`text-sm font-medium ${
                        selectedActivity === type ? "text-amber-300" : "text-gray-200"
                      }`}
                    >
                      {locale === "vi" ? definition.name : definition.name_en}
                    </span>
                  </div>
                  {!canPerform && (
                    <div className="text-xs text-red-400 mt-1 truncate">{reasons[0]}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Duration selection */}
      {selectedActivity && selectedDef && (
        <div className="border-t border-amber-900/30 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">
            {locale === "vi" ? "Thời gian" : "Duration"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.filter((opt) =>
              selectedDef.allowed_durations.includes(opt.id as ActivityDuration)
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedDuration(opt.id)}
                className={`
                  px-3 py-1.5 rounded text-sm transition-all
                  ${
                    selectedDuration === opt.id
                      ? "bg-amber-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }
                `}
              >
                {locale === "vi" ? opt.label_vi : opt.label_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cost and reward preview */}
      {selectedActivity && costs && rewards && (
        <div className="border-t border-amber-900/30 pt-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Costs */}
            <div>
              <h4 className="text-sm font-semibold text-red-400 mb-2">
                {locale === "vi" ? "Chi phí" : "Cost"}
              </h4>
              <div className="space-y-1 text-sm">
                {costs.stamina > 0 && (
                  <div
                    className={`flex justify-between ${
                      gameState.stats.stamina < costs.stamina ? "text-red-400" : "text-gray-300"
                    }`}
                  >
                    <span>⚡ {locale === "vi" ? "Thể lực" : "Stamina"}</span>
                    <span>-{costs.stamina}</span>
                  </div>
                )}
                {costs.qi > 0 && (
                  <div
                    className={`flex justify-between ${
                      gameState.stats.qi < costs.qi ? "text-red-400" : "text-gray-300"
                    }`}
                  >
                    <span>💠 {locale === "vi" ? "Khí" : "Qi"}</span>
                    <span>-{costs.qi}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>⏱️ {locale === "vi" ? "Thời gian" : "Time"}</span>
                  <span>{formatDuration(costs.time_segments, locale)}</span>
                </div>
              </div>
            </div>

            {/* Rewards */}
            <div>
              <h4 className="text-sm font-semibold text-green-400 mb-2">
                {locale === "vi" ? "Dự kiến nhận" : "Expected Rewards"}
              </h4>
              <div className="space-y-1 text-sm">
                {rewards.qi_exp > 0 && (
                  <div className="flex justify-between text-purple-300">
                    <span>✨ {locale === "vi" ? "Tu vi" : "Cultivation"}</span>
                    <span>+{rewards.qi_exp}</span>
                  </div>
                )}
                {rewards.body_exp > 0 && (
                  <div className="flex justify-between text-orange-300">
                    <span>💪 {locale === "vi" ? "Thể tu" : "Body Exp"}</span>
                    <span>+{rewards.body_exp}</span>
                  </div>
                )}
                {rewards.skill_exp > 0 && (
                  <div className="flex justify-between text-blue-300">
                    <span>⚔️ {locale === "vi" ? "Kỹ năng" : "Skill"}</span>
                    <span>+{rewards.skill_exp}</span>
                  </div>
                )}
                {rewards.stamina_recovery > 0 && (
                  <div className="flex justify-between text-yellow-300">
                    <span>⚡ {locale === "vi" ? "Hồi phục" : "Recovery"}</span>
                    <span>+{rewards.stamina_recovery}</span>
                  </div>
                )}
                {rewards.insight_chance > 0 && (
                  <div className="flex justify-between text-cyan-300">
                    <span>💡 {locale === "vi" ? "Cơ hội ngộ đạo" : "Insight Chance"}</span>
                    <span>{Math.round(rewards.insight_chance * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bonuses breakdown */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-amber-500 hover:text-amber-400 mt-2"
          >
            {showDetails
              ? locale === "vi"
                ? "▼ Ẩn chi tiết"
                : "▼ Hide details"
              : locale === "vi"
                ? "▶ Xem chi tiết bonus"
                : "▶ Show bonus details"}
          </button>

          {showDetails && (
            <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">{locale === "vi" ? "Công pháp" : "Technique"}</span>
                <span
                  className={rewards.bonuses.technique >= 0 ? "text-green-400" : "text-red-400"}
                >
                  {rewards.bonuses.technique >= 0 ? "+" : ""}
                  {rewards.bonuses.technique}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{locale === "vi" ? "Địa điểm" : "Location"}</span>
                <span className={rewards.bonuses.location >= 0 ? "text-green-400" : "text-red-400"}>
                  {rewards.bonuses.location >= 0 ? "+" : ""}
                  {rewards.bonuses.location}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">
                  {locale === "vi" ? "Mùa + Thời gian" : "Season + Time"}
                </span>
                <span className={rewards.bonuses.season >= 0 ? "text-green-400" : "text-red-400"}>
                  {rewards.bonuses.season >= 0 ? "+" : ""}
                  {rewards.bonuses.season}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{locale === "vi" ? "Trang bị" : "Equipment"}</span>
                <span
                  className={rewards.bonuses.equipment >= 0 ? "text-green-400" : "text-red-400"}
                >
                  {rewards.bonuses.equipment >= 0 ? "+" : ""}
                  {rewards.bonuses.equipment}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">
                  {locale === "vi" ? "Trạng thái" : "Condition"}
                </span>
                <span
                  className={rewards.bonuses.condition >= 0 ? "text-green-400" : "text-red-400"}
                >
                  {rewards.bonuses.condition >= 0 ? "+" : ""}
                  {rewards.bonuses.condition}%
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                <span className="text-amber-400 font-semibold">
                  {locale === "vi" ? "Tổng cộng" : "Total"}
                </span>
                <span
                  className={`font-semibold ${rewards.bonuses.total >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {rewards.bonuses.total >= 0 ? "+" : ""}
                  {rewards.bonuses.total}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
        >
          {locale === "vi" ? "Hủy" : "Cancel"}
        </button>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`
            px-6 py-2 rounded-lg font-semibold transition-all
            ${
              canStart
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {locale === "vi" ? "Bắt đầu" : "Start"}
        </button>
      </div>

      {/* Error message */}
      {selectedActivity && costs && !costs.affordable && (
        <div className="mt-3 text-center text-sm text-red-400">
          {locale === "vi" ? "Không đủ: " : "Insufficient: "}
          {costs.missing.join(", ")}
        </div>
      )}
    </div>
  );
}
