"use client";

import React, { useMemo } from "react";
import { GameState, Locale, Realm, BodyRealm, REALM_LIFESPAN_BONUS } from "@/types/game";
import {
  getGameTimeFromState,
  formatGameTimeShort,
  getSeason,
  getSeasonName,
} from "@/lib/game/time";

interface ProgressionViewProps {
  gameState: GameState;
  locale: Locale;
  characterName: string;
}

// Realm display names
const REALM_NAMES: Record<Realm, { vi: string; en: string }> = {
  PhàmNhân: { vi: "Phàm Nhân", en: "Mortal" },
  LuyệnKhí: { vi: "Luyện Khí", en: "Qi Condensation" },
  TrúcCơ: { vi: "Trúc Cơ", en: "Foundation Establishment" },
  KếtĐan: { vi: "Kết Đan", en: "Core Formation" },
  NguyênAnh: { vi: "Nguyên Anh", en: "Nascent Soul" },
};

const BODY_REALM_NAMES: Record<BodyRealm, { vi: string; en: string }> = {
  PhàmThể: { vi: "Phàm Thể", en: "Mortal Body" },
  LuyệnCốt: { vi: "Luyện Cốt", en: "Bone Forging" },
  ĐồngCân: { vi: "Đồng Cân", en: "Bronze Sinew" },
  KimCương: { vi: "Kim Cương", en: "Diamond Body" },
  TháiCổ: { vi: "Thái Cổ", en: "Primordial Body" },
};

// Experience thresholds per stage (cumulative)
const STAGE_EXP_THRESHOLDS: Record<Realm, number[]> = {
  PhàmNhân: [100, 250, 450, 700, 1000], // Stage 1-5
  LuyệnKhí: [500, 1200, 2100, 3200, 4500],
  TrúcCơ: [2000, 4500, 7500, 11000, 15000],
  KếtĐan: [8000, 18000, 30000, 44000, 60000],
  NguyênAnh: [30000, 65000, 105000, 150000, 200000],
};

export default function ProgressionView({
  gameState,
  locale,
  characterName,
}: ProgressionViewProps) {
  const {
    progress,
    stats,
    attrs,
    spirit_root,
    skills,
    techniques,
    inventory,
    condition,
    lifespan,
  } = gameState;

  const currentTime = getGameTimeFromState(gameState);
  const season = getSeason(currentTime);
  const seasonName = getSeasonName(season, locale);

  // Calculate cultivation progress
  const cultivationProgress = useMemo(() => {
    const realm = progress.realm;
    const stage = progress.realm_stage;
    const exp = progress.cultivation_exp;
    const thresholds = STAGE_EXP_THRESHOLDS[realm];

    const currentThreshold = stage > 0 ? thresholds[stage - 1] : 0;
    const nextThreshold = thresholds[stage] || thresholds[thresholds.length - 1];
    const expInStage = exp - currentThreshold;
    const expNeeded = nextThreshold - currentThreshold;
    const percentage = Math.min(100, Math.floor((expInStage / expNeeded) * 100));

    return {
      realm,
      stage,
      exp,
      expInStage,
      expNeeded,
      percentage,
      isMaxStage: stage >= 5,
    };
  }, [progress]);

  // Calculate body cultivation progress (if dual cultivating)
  const bodyCultivationProgress = useMemo(() => {
    if (!progress.body_realm) return null;

    const realm = progress.body_realm;
    const stage = progress.body_stage || 0;
    const exp = progress.body_exp || 0;
    // Simplified thresholds for body cultivation
    const thresholds = [80, 200, 400, 650, 950];

    const currentThreshold = stage > 0 ? thresholds[stage - 1] : 0;
    const nextThreshold = thresholds[stage] || thresholds[thresholds.length - 1];
    const expInStage = exp - currentThreshold;
    const expNeeded = nextThreshold - currentThreshold;
    const percentage = Math.min(100, Math.floor((expInStage / expNeeded) * 100));

    return {
      realm,
      stage,
      exp,
      expInStage,
      expNeeded,
      percentage,
    };
  }, [progress]);

  // Calculate lifespan info
  const lifespanInfo = useMemo(() => {
    const baseLifespan = 80;
    const realmBonus = REALM_LIFESPAN_BONUS[progress.realm];
    const specialBonus = lifespan?.special_bonus || 0;
    const penalty = lifespan?.penalty || 0;
    const maxLifespan = baseLifespan + realmBonus + specialBonus - penalty;
    const currentAge = gameState.age;
    const yearsRemaining = maxLifespan - currentAge;

    let urgency: "safe" | "caution" | "warning" | "critical" = "safe";
    const percentRemaining = yearsRemaining / maxLifespan;
    if (percentRemaining < 0.1) urgency = "critical";
    else if (percentRemaining < 0.25) urgency = "warning";
    else if (percentRemaining < 0.4) urgency = "caution";

    return {
      currentAge,
      maxLifespan,
      yearsRemaining,
      urgency,
      percentRemaining,
    };
  }, [gameState.age, progress.realm, lifespan]);

  // Get top skills
  const topSkills = useMemo(() => {
    return [...skills]
      .sort((a, b) => b.level * 100 + (b.exp || 0) - (a.level * 100 + (a.exp || 0)))
      .slice(0, 5);
  }, [skills]);

  // Spirit root display
  const spiritRootDisplay = useMemo(() => {
    const elementEmoji: Record<string, string> = {
      Kim: "⚔️",
      Mộc: "🌿",
      Thủy: "💧",
      Hỏa: "🔥",
      Thổ: "🪨",
    };
    return spirit_root.elements.map((el) => ({
      element: el,
      emoji: elementEmoji[el] || "❓",
    }));
  }, [spirit_root]);

  const urgencyColors = {
    safe: "text-green-400",
    caution: "text-yellow-400",
    warning: "text-orange-400",
    critical: "text-red-400 animate-pulse",
  };

  return (
    <div className="bg-gray-900/95 border border-amber-900/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b border-amber-900/30">
        <div>
          <h2 className="text-xl font-bold text-amber-400">{characterName}</h2>
          <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
            {spiritRootDisplay.map((sr, i) => (
              <span key={i} title={sr.element}>
                {sr.emoji}
              </span>
            ))}
            <span className="text-amber-300">
              {locale === "vi" ? spirit_root.grade : spirit_root.grade}
              {locale === "vi" ? " Linh căn" : " Spirit Root"}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-amber-300">{formatGameTimeShort(currentTime, locale)}</div>
          <div className="text-emerald-400">{seasonName}</div>
        </div>
      </div>

      {/* Main Stats Bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* HP */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400">❤️ {locale === "vi" ? "Sinh lực" : "HP"}</span>
            <span className="text-gray-300">
              {stats.hp}/{stats.hp_max}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all"
              style={{ width: `${(stats.hp / stats.hp_max) * 100}%` }}
            />
          </div>
        </div>

        {/* Qi */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-400">💠 {locale === "vi" ? "Chân khí" : "Qi"}</span>
            <span className="text-gray-300">
              {stats.qi}/{stats.qi_max}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
              style={{
                width: `${stats.qi_max > 0 ? (stats.qi / stats.qi_max) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Stamina */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-yellow-400">⚡ {locale === "vi" ? "Thể lực" : "Stamina"}</span>
            <span className="text-gray-300">
              {stats.stamina}/{stats.stamina_max}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all"
              style={{ width: `${(stats.stamina / stats.stamina_max) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cultivation Progress */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">
          ✨ {locale === "vi" ? "Tu vi" : "Cultivation"}
        </h3>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-lg font-bold text-purple-300">
                {locale === "vi"
                  ? REALM_NAMES[cultivationProgress.realm].vi
                  : REALM_NAMES[cultivationProgress.realm].en}
              </span>
              <span className="text-amber-400 ml-2">
                {locale === "vi" ? "Tầng" : "Stage"} {cultivationProgress.stage + 1}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              {cultivationProgress.expInStage.toLocaleString()} /{" "}
              {cultivationProgress.expNeeded.toLocaleString()}
            </div>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-amber-400 transition-all relative"
              style={{ width: `${cultivationProgress.percentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className="text-right text-xs text-amber-300 mt-1">
            {cultivationProgress.percentage}%
          </div>
        </div>

        {/* Body Cultivation (if applicable) */}
        {bodyCultivationProgress && (
          <div className="bg-gray-800/50 rounded-lg p-3 mt-2">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-lg font-bold text-orange-300">
                  {locale === "vi"
                    ? BODY_REALM_NAMES[bodyCultivationProgress.realm].vi
                    : BODY_REALM_NAMES[bodyCultivationProgress.realm].en}
                </span>
                <span className="text-amber-400 ml-2">
                  {locale === "vi" ? "Tầng" : "Stage"} {bodyCultivationProgress.stage + 1}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {bodyCultivationProgress.expInStage} / {bodyCultivationProgress.expNeeded}
              </div>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                style={{ width: `${bodyCultivationProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Attributes */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">
          📊 {locale === "vi" ? "Thuộc tính" : "Attributes"}
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            {
              key: "str",
              label: locale === "vi" ? "Lực" : "STR",
              value: attrs.str,
              color: "text-red-400",
            },
            {
              key: "agi",
              label: locale === "vi" ? "Nhanh" : "AGI",
              value: attrs.agi,
              color: "text-green-400",
            },
            {
              key: "int",
              label: locale === "vi" ? "Trí" : "INT",
              value: attrs.int,
              color: "text-blue-400",
            },
            {
              key: "perception",
              label: locale === "vi" ? "Cảm" : "PER",
              value: attrs.perception,
              color: "text-purple-400",
            },
            {
              key: "luck",
              label: locale === "vi" ? "Vận" : "LCK",
              value: attrs.luck,
              color: "text-yellow-400",
            },
          ].map((attr) => (
            <div key={attr.key} className="bg-gray-800/50 rounded p-2 text-center">
              <div className={`text-xs ${attr.color}`}>{attr.label}</div>
              <div className="text-lg font-bold text-white">{attr.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lifespan */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2">
          ⏳ {locale === "vi" ? "Thọ nguyên" : "Lifespan"}
        </h3>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-gray-300">{locale === "vi" ? "Tuổi: " : "Age: "}</span>
              <span className="text-white font-bold">{lifespanInfo.currentAge}</span>
              <span className="text-gray-400"> / {lifespanInfo.maxLifespan}</span>
            </div>
            <div className={urgencyColors[lifespanInfo.urgency]}>
              {lifespanInfo.yearsRemaining} {locale === "vi" ? "năm còn lại" : "years remaining"}
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                lifespanInfo.urgency === "critical"
                  ? "bg-red-500"
                  : lifespanInfo.urgency === "warning"
                    ? "bg-orange-500"
                    : lifespanInfo.urgency === "caution"
                      ? "bg-yellow-500"
                      : "bg-green-500"
              }`}
              style={{ width: `${(1 - lifespanInfo.percentRemaining) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top Skills */}
      {topSkills.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">
            ⚔️ {locale === "vi" ? "Kỹ năng" : "Skills"}
          </h3>
          <div className="space-y-2">
            {topSkills.map((skill) => (
              <div key={skill.id} className="bg-gray-800/50 rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-200 text-sm">
                    {locale === "vi" ? skill.name : skill.name_en}
                  </span>
                  <span className="text-amber-400 text-sm">Lv.{skill.level}</span>
                </div>
                {skill.max_exp && (
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${((skill.exp || 0) / skill.max_exp) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Technique */}
      {techniques.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">
            📖 {locale === "vi" ? "Công pháp" : "Techniques"}
          </h3>
          <div className="space-y-2">
            {techniques
              .filter((t) => t.type === "Main")
              .slice(0, 1)
              .map((tech) => (
                <div
                  key={tech.id}
                  className="bg-gray-800/50 rounded p-2 border border-purple-900/30"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-purple-300 font-medium">
                      {locale === "vi" ? tech.name : tech.name_en}
                    </span>
                    <span className="text-xs text-amber-400 px-2 py-0.5 bg-amber-900/30 rounded">
                      {tech.grade}
                    </span>
                  </div>
                  <div className="text-xs text-green-400 mt-1">
                    +{tech.cultivation_speed_bonus}%{" "}
                    {locale === "vi" ? "tốc độ tu luyện" : "cultivation speed"}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Condition (if has issues) */}
      {condition &&
        (condition.injuries?.length > 0 ||
          condition.qi_deviation_level > 0 ||
          condition.fatigue > 30) && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">
              ⚠️ {locale === "vi" ? "Trạng thái" : "Condition"}
            </h3>
            <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-2 space-y-1 text-sm">
              {condition.injuries?.map((injury, i) => (
                <div key={i} className="text-red-300">
                  🩹 {locale === "vi" ? injury.name : injury.name_en}({injury.recovery_days}{" "}
                  {locale === "vi" ? "ngày hồi phục" : "days to recover"})
                </div>
              ))}
              {condition.qi_deviation_level > 0 && (
                <div className="text-orange-300">
                  💫 {locale === "vi" ? "Tẩu hỏa nhập ma" : "Qi Deviation"}:{" "}
                  {condition.qi_deviation_level}%
                </div>
              )}
              {condition.fatigue > 30 && (
                <div className="text-yellow-300">
                  😴 {locale === "vi" ? "Mệt mỏi" : "Fatigue"}: {condition.fatigue}%
                </div>
              )}
            </div>
          </div>
        )}

      {/* Wealth */}
      <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-2">
          💰 {locale === "vi" ? "Tài sản" : "Wealth"}
        </h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">🥈</span>
            <span className="text-white font-medium">{inventory.silver.toLocaleString()}</span>
            <span className="text-gray-500">{locale === "vi" ? "bạc" : "silver"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-purple-400">💎</span>
            <span className="text-white font-medium">
              {inventory.spirit_stones.toLocaleString()}
            </span>
            <span className="text-gray-500">
              {locale === "vi" ? "linh thạch" : "spirit stones"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400">📦</span>
            <span className="text-white font-medium">{inventory.items.length}</span>
            <span className="text-gray-500">
              / {inventory.max_slots + (inventory.storage_ring?.capacity || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
