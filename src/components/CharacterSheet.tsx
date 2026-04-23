"use client";

import { useState } from "react";
import { GameState, CultivationTechnique, Skill } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import { calculateTotalAttributes, getEquipmentBonus } from "@/lib/game/equipment";
import { getElementCompatibility, getRequiredExp } from "@/lib/game/mechanics";
import CultivationVisualization from "./CultivationVisualization";
import MeridianDiagram from "./MeridianDiagram";
import DualCultivationView from "./DualCultivationView";
import CharacterStatChart from "./CharacterStatChart";
import CollapsibleSection from "./CollapsibleSection";

// Limits for techniques and skills
const MAX_TECHNIQUES = 5;
const MAX_SKILLS = 6;
const MAX_PER_TYPE = 2;

interface CharacterSheetProps {
  state: GameState;
  locale: Locale;
  previousExp?: number; // For cultivation animation
  onAbilitySwap?: (
    abilityType: "technique" | "skill",
    activeId: string | null,
    queueId: string | null,
    action: "swap" | "forget" | "learn" | "discard"
  ) => Promise<void>;
  onToggleDualCultivation?: () => Promise<void>;
  onSetExpSplit?: (split: number) => Promise<void>;
}

export default function CharacterSheet({
  state,
  locale,
  previousExp,
  onAbilitySwap,
  onToggleDualCultivation,
  onSetExpSplit,
}: CharacterSheetProps) {
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedQueueTech, setSelectedQueueTech] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedQueueSkill, setSelectedQueueSkill] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);

  // Ensure queues exist
  const techniqueQueue = state.technique_queue || [];
  const skillQueue = state.skill_queue || [];

  // Count techniques/skills by type
  const techCountByType = (type: string) =>
    state.techniques?.filter((t) => t.type === type).length || 0;
  const skillCountByType = (type: string) =>
    state.skills?.filter((s) => s.type === type).length || 0;

  // Handle ability actions
  const handleAbilityAction = async (
    abilityType: "technique" | "skill",
    activeId: string | null,
    queueId: string | null,
    action: "swap" | "forget" | "learn" | "discard"
  ) => {
    if (!onAbilitySwap || swapLoading) return;
    setSwapLoading(true);
    try {
      await onAbilitySwap(abilityType, activeId, queueId, action);
      // Clear selections after action
      if (abilityType === "technique") {
        setSelectedTech(null);
        setSelectedQueueTech(null);
      } else {
        setSelectedSkill(null);
        setSelectedQueueSkill(null);
      }
    } finally {
      setSwapLoading(false);
    }
  };

  const totalAttrs = calculateTotalAttributes(state);
  const hpBonus = getEquipmentBonus(state, "hp");
  const qiBonus = getEquipmentBonus(state, "qi");
  const staminaBonus = getEquipmentBonus(state, "stamina");
  const requiredExp = getRequiredExp(state.progress.realm, state.progress.realm_stage);
  const expDisplay =
    requiredExp === Infinity
      ? locale === "vi"
        ? "Đột phá cảnh giới"
        : "Realm Breakthrough"
      : `${state.progress.cultivation_exp}/${requiredExp}`;

  return (
    <div className="space-y-6">
      {/* Location & Time */}
      <CollapsibleSection title={t(locale, "location")}>
        <div className="space-y-2">
          <div>
            <span className="text-gray-400">{t(locale, "location")}: </span>
            <span className="font-medium">
              {state.location.place}, {state.location.region}
            </span>
          </div>
          <div>
            <span className="text-gray-400">{locale === "vi" ? "Thời gian" : "Time"}: </span>
            <span className="font-medium">
              {locale === "vi"
                ? `Năm ${state.time_year}, Tháng ${state.time_month}, Ngày ${state.time_day}`
                : `Year ${state.time_year}, Month ${state.time_month}, Day ${state.time_day}`}
            </span>
            <span className="text-gray-400 ml-4">{t(locale, state.time_segment)}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Cultivation Progress - Enhanced Visualization */}
      <CollapsibleSection title={t(locale, "cultivation")}>
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Main Cultivation Visualization */}
          <div className="flex-1 w-full">
            <CultivationVisualization state={state} locale={locale} previousExp={previousExp} />
          </div>
          {/* Meridian Diagram */}
          <div className="flex-shrink-0">
            <MeridianDiagram state={state} locale={locale} size="medium" />
          </div>
        </div>
      </CollapsibleSection>

      {/* Dual Cultivation */}
      <DualCultivationView
        state={state}
        locale={locale}
        onToggleDualCultivation={onToggleDualCultivation}
        onSetExpSplit={onSetExpSplit}
      />

      {/* Spirit Root */}
      <CollapsibleSection title={t(locale, "spiritRoot")}>
        <div className="space-y-3">
          <div>
            <span className="text-gray-400">{t(locale, "elements")}: </span>
            <span className="font-medium text-xianxia-accent">
              {state.spirit_root.elements.map((e) => t(locale, e)).join(" + ")}
            </span>
          </div>
          <div>
            <span className="text-gray-400">{t(locale, "grade")}: </span>
            <span className="font-bold text-xianxia-gold">
              {t(locale, state.spirit_root.grade)}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Cultivation Techniques */}
      <CollapsibleSection
        title={locale === "vi" ? "Công Pháp" : "Cultivation Techniques"}
        badge={`${state.techniques?.length || 0}/${MAX_TECHNIQUES}${locale === "vi" ? " (Tối đa 2/loại)" : " (Max 2/type)"}`}
      >
        {/* Active Techniques */}
        {!state.techniques || state.techniques.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            {locale === "vi" ? "Chưa có công pháp" : "No techniques learned"}
          </div>
        ) : (
          <div className="space-y-3">
            {state.techniques.map((tech) => {
              const compatibility =
                tech.elements && tech.elements.length > 0
                  ? getElementCompatibility(state.spirit_root.elements, tech.elements)
                  : 0;

              const compatibilityColor =
                compatibility >= 0.25
                  ? "text-green-400"
                  : compatibility >= 0.1
                    ? "text-blue-400"
                    : compatibility >= 0
                      ? "text-gray-400"
                      : compatibility >= -0.15
                        ? "text-orange-400"
                        : "text-red-400";

              const compatibilityText =
                compatibility >= 0.25
                  ? locale === "vi"
                    ? "Tuyệt vời"
                    : "Perfect"
                  : compatibility >= 0.1
                    ? locale === "vi"
                      ? "Tốt"
                      : "Good"
                    : compatibility >= 0
                      ? locale === "vi"
                        ? "Trung bình"
                        : "Neutral"
                      : compatibility >= -0.15
                        ? locale === "vi"
                          ? "Yếu"
                          : "Weak"
                        : locale === "vi"
                          ? "Xung khắc"
                          : "Conflict";

              const isSelected = selectedTech === tech.id;

              return (
                <div
                  key={tech.id}
                  className={`p-3 bg-xianxia-darker rounded border transition-all cursor-pointer ${
                    isSelected
                      ? "border-red-500 bg-red-900/20"
                      : "border-xianxia-accent/20 hover:border-xianxia-accent/50"
                  }`}
                  onClick={() => onAbilitySwap && setSelectedTech(isSelected ? null : tech.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbilitySwap && setSelectedTech(isSelected ? null : tech.id);
                    }
                  }}
                  role={onAbilitySwap ? "button" : undefined}
                  tabIndex={onAbilitySwap ? 0 : undefined}
                  aria-pressed={isSelected}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xianxia-accent">
                          {locale === "vi" ? tech.name : tech.name_en}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded">
                          {tech.type}
                        </span>
                      </div>
                      {tech.elements && tech.elements.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {tech.elements.map((el, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-xianxia-accent/20 text-xianxia-accent rounded"
                            >
                              {t(locale, el)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs px-2 py-1 bg-xianxia-gold/20 text-xianxia-gold rounded">
                        {tech.grade}
                      </span>
                      {tech.elements && tech.elements.length > 0 && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${compatibilityColor} bg-opacity-20`}
                        >
                          {compatibilityText}{" "}
                          {compatibility > 0
                            ? `+${Math.round(compatibility * 100)}%`
                            : compatibility < 0
                              ? `${Math.round(compatibility * 100)}%`
                              : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {locale === "vi" ? tech.description : tech.description_en}
                  </div>
                  {isSelected && onAbilitySwap && (
                    <div className="mt-2 pt-2 border-t border-red-500/30 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbilityAction("technique", tech.id, null, "forget");
                        }}
                        disabled={swapLoading}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded disabled:opacity-50"
                      >
                        {locale === "vi" ? "🗑️ Quên" : "🗑️ Forget"}
                      </button>
                      {selectedQueueTech && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction("technique", tech.id, selectedQueueTech, "swap");
                          }}
                          disabled={swapLoading}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50"
                        >
                          {locale === "vi" ? "🔄 Hoán đổi" : "🔄 Swap"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Technique Queue */}
        {techniqueQueue.length > 0 && (
          <div className="mt-4 pt-4 border-t border-xianxia-accent/20">
            <h3 className="text-lg font-bold text-yellow-400 mb-3">
              {locale === "vi" ? "📚 Hàng Chờ Công Pháp" : "📚 Technique Queue"} (
              {techniqueQueue.length})
            </h3>
            <div className="space-y-2">
              {techniqueQueue.map((tech) => {
                const isSelected = selectedQueueTech === tech.id;
                const canLearn =
                  (state.techniques?.length || 0) < MAX_TECHNIQUES &&
                  techCountByType(tech.type) < MAX_PER_TYPE;

                return (
                  <div
                    key={tech.id}
                    className={`p-3 bg-yellow-900/10 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "border-yellow-500 bg-yellow-900/30"
                        : "border-yellow-500/20 hover:border-yellow-500/50"
                    }`}
                    onClick={() =>
                      onAbilitySwap && setSelectedQueueTech(isSelected ? null : tech.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAbilitySwap && setSelectedQueueTech(isSelected ? null : tech.id);
                      }
                    }}
                    role={onAbilitySwap ? "button" : undefined}
                    tabIndex={onAbilitySwap ? 0 : undefined}
                    aria-pressed={isSelected}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-yellow-400">
                          {locale === "vi" ? tech.name : tech.name_en}
                        </span>
                        <span className="text-xs ml-2 px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded">
                          {tech.type}
                        </span>
                        <span className="text-xs ml-2 px-2 py-0.5 bg-xianxia-gold/20 text-xianxia-gold rounded">
                          {tech.grade}
                        </span>
                      </div>
                    </div>
                    {isSelected && onAbilitySwap && (
                      <div className="mt-2 pt-2 border-t border-yellow-500/30 flex gap-2">
                        {canLearn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction("technique", null, tech.id, "learn");
                            }}
                            disabled={swapLoading}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded disabled:opacity-50"
                          >
                            {locale === "vi" ? "✅ Học" : "✅ Learn"}
                          </button>
                        )}
                        {selectedTech && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction("technique", selectedTech, tech.id, "swap");
                            }}
                            disabled={swapLoading}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50"
                          >
                            {locale === "vi" ? "🔄 Hoán đổi" : "🔄 Swap"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction("technique", null, tech.id, "discard");
                          }}
                          disabled={swapLoading}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded disabled:opacity-50"
                        >
                          {locale === "vi" ? "❌ Vứt" : "❌ Discard"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Skills */}
      <CollapsibleSection
        title={locale === "vi" ? "Kĩ Năng" : "Skills"}
        badge={`${state.skills?.length || 0}/${MAX_SKILLS}${locale === "vi" ? " (Tối đa 2/loại)" : " (Max 2/type)"}`}
      >
        {/* Active Skills */}
        {!state.skills || state.skills.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            {locale === "vi" ? "Chưa có kĩ năng" : "No skills learned"}
          </div>
        ) : (
          <div className="space-y-3">
            {state.skills.map((skill) => {
              const isSelected = selectedSkill === skill.id;

              return (
                <div
                  key={skill.id}
                  className={`p-3 bg-xianxia-darker rounded border transition-all cursor-pointer ${
                    isSelected
                      ? "border-red-500 bg-red-900/20"
                      : "border-xianxia-accent/20 hover:border-xianxia-accent/50"
                  }`}
                  onClick={() => onAbilitySwap && setSelectedSkill(isSelected ? null : skill.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbilitySwap && setSelectedSkill(isSelected ? null : skill.id);
                    }
                  }}
                  role={onAbilitySwap ? "button" : undefined}
                  tabIndex={onAbilitySwap ? 0 : undefined}
                  aria-pressed={isSelected}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-xianxia-accent">
                        {locale === "vi" ? skill.name : skill.name_en}
                      </span>
                      <span className="text-xs ml-2 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded">
                        {skill.type}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">
                      Lv {skill.level}/{skill.max_level}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {locale === "vi" ? skill.description : skill.description_en}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <span>💠 {skill.qi_cost} Qi</span>
                    <span>
                      ⏱️ {skill.cooldown} {locale === "vi" ? "lượt" : "turns"}
                    </span>
                    <span>⚔️ x{skill.damage_multiplier.toFixed(1)}</span>
                  </div>

                  {/* Skill Experience Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{locale === "vi" ? "Kinh nghiệm" : "Experience"}</span>
                      <span>
                        {skill.exp || 0} / {skill.max_exp || skill.level * 100}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-xianxia-accent h-2 rounded-full transition-all"
                        style={{
                          width: `${((skill.exp || 0) / (skill.max_exp || skill.level * 100)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  {isSelected && onAbilitySwap && (
                    <div className="mt-2 pt-2 border-t border-red-500/30 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbilityAction("skill", skill.id, null, "forget");
                        }}
                        disabled={swapLoading}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded disabled:opacity-50"
                      >
                        {locale === "vi" ? "🗑️ Quên" : "🗑️ Forget"}
                      </button>
                      {selectedQueueSkill && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction("skill", skill.id, selectedQueueSkill, "swap");
                          }}
                          disabled={swapLoading}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50"
                        >
                          {locale === "vi" ? "🔄 Hoán đổi" : "🔄 Swap"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Skill Queue */}
        {skillQueue.length > 0 && (
          <div className="mt-4 pt-4 border-t border-xianxia-accent/20">
            <h3 className="text-lg font-bold text-yellow-400 mb-3">
              {locale === "vi" ? "📚 Hàng Chờ Kĩ Năng" : "📚 Skill Queue"} ({skillQueue.length})
            </h3>
            <div className="space-y-2">
              {skillQueue.map((skill) => {
                const isSelected = selectedQueueSkill === skill.id;
                const canLearn =
                  (state.skills?.length || 0) < MAX_SKILLS &&
                  skillCountByType(skill.type) < MAX_PER_TYPE;

                return (
                  <div
                    key={skill.id}
                    className={`p-3 bg-yellow-900/10 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "border-yellow-500 bg-yellow-900/30"
                        : "border-yellow-500/20 hover:border-yellow-500/50"
                    }`}
                    onClick={() =>
                      onAbilitySwap && setSelectedQueueSkill(isSelected ? null : skill.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAbilitySwap && setSelectedQueueSkill(isSelected ? null : skill.id);
                      }
                    }}
                    role={onAbilitySwap ? "button" : undefined}
                    tabIndex={onAbilitySwap ? 0 : undefined}
                    aria-pressed={isSelected}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-yellow-400">
                          {locale === "vi" ? skill.name : skill.name_en}
                        </span>
                        <span className="text-xs ml-2 px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded">
                          {skill.type}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400">
                        Lv {skill.level}/{skill.max_level}
                      </span>
                    </div>
                    {isSelected && onAbilitySwap && (
                      <div className="mt-2 pt-2 border-t border-yellow-500/30 flex gap-2">
                        {canLearn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction("skill", null, skill.id, "learn");
                            }}
                            disabled={swapLoading}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded disabled:opacity-50"
                          >
                            {locale === "vi" ? "✅ Học" : "✅ Learn"}
                          </button>
                        )}
                        {selectedSkill && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbilityAction("skill", selectedSkill, skill.id, "swap");
                            }}
                            disabled={swapLoading}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50"
                          >
                            {locale === "vi" ? "🔄 Hoán đổi" : "🔄 Swap"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbilityAction("skill", null, skill.id, "discard");
                          }}
                          disabled={swapLoading}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded disabled:opacity-50"
                        >
                          {locale === "vi" ? "❌ Vứt" : "❌ Discard"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Stats */}
      <CollapsibleSection title={t(locale, "stats")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">HP:</span>
              <span className="font-medium text-red-400">
                {state.stats.hp} / {state.stats.hp_max}
              </span>
            </div>
            <div
              className="w-full bg-gray-700 rounded-full h-2"
              role="progressbar"
              aria-valuenow={state.stats.hp}
              aria-valuemin={0}
              aria-valuemax={state.stats.hp_max}
              aria-label="HP"
            >
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(state.stats.hp / state.stats.hp_max) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{t(locale, "qi")}:</span>
              <span className="font-medium text-blue-400">
                {state.stats.qi} / {state.stats.qi_max}
              </span>
            </div>
            <div
              className="w-full bg-gray-700 rounded-full h-2"
              role="progressbar"
              aria-valuenow={state.stats.qi}
              aria-valuemin={0}
              aria-valuemax={state.stats.qi_max}
              aria-label={t(locale, "qi")}
            >
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(state.stats.qi / state.stats.qi_max) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{t(locale, "stamina")}:</span>
              <span className="font-medium text-green-400">
                {state.stats.stamina} / {state.stats.stamina_max}
              </span>
            </div>
            <div
              className="w-full bg-gray-700 rounded-full h-2"
              role="progressbar"
              aria-valuenow={state.stats.stamina}
              aria-valuemin={0}
              aria-valuemax={state.stats.stamina_max}
              aria-label={t(locale, "stamina")}
            >
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(state.stats.stamina / state.stats.stamina_max) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Character Stat Chart */}
      <CharacterStatChart state={state} locale={locale} />

      {/* Attribute Effects Guide */}
      <CollapsibleSection
        title={locale === "vi" ? "Hướng Dẫn Thuộc Tính" : "Attribute Effects"}
        defaultOpen={false}
      >
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-xianxia-darker rounded border border-red-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-red-400 min-w-[120px]">
                {t(locale, "strength")}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-red-300 mb-1">
                  {locale === "vi" ? "Ảnh Hưởng:" : "Affects:"}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    {locale === "vi"
                      ? "Sát thương vật lý (+50% STR)"
                      : "Physical damage (+50% STR)"}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Sát thương khí công (+50% STR)"
                      : "Qi attack damage (+50% STR)"}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Tỷ lệ chí mạng (+0.2% mỗi điểm)"
                      : "Critical hit chance (+0.2% per point)"}
                  </li>
                  <li>{locale === "vi" ? "HP tối đa (gián tiếp)" : "Max HP (indirect)"}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-green-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-green-400 min-w-[120px]">
                {t(locale, "agility")}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-green-300 mb-1">
                  {locale === "vi" ? "Ảnh Hưởng:" : "Affects:"}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === "vi" ? "Tốc độ tấn công" : "Attack speed"}</li>
                  <li>{locale === "vi" ? "Tỷ lệ né tránh" : "Evasion rate"}</li>
                  <li>{locale === "vi" ? "Tốc độ di chuyển" : "Movement speed"}</li>
                  <li>
                    {locale === "vi" ? "Thứ tự hành động trong chiến đấu" : "Combat turn order"}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-blue-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-blue-400 min-w-[120px]">
                {t(locale, "intelligence")}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-blue-300 mb-1">
                  {locale === "vi" ? "Ảnh Hưởng:" : "Affects:"}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    {locale === "vi" ? "Sát thương khí công (×2 INT)" : "Qi attack damage (×2 INT)"}
                  </li>
                  <li>{locale === "vi" ? "Khí tối đa" : "Max Qi"}</li>
                  <li>
                    {locale === "vi"
                      ? "Tỷ lệ chí mạng khí công (+0.3%)"
                      : "Qi critical chance (+0.3%)"}
                  </li>
                  <li>{locale === "vi" ? "Hiệu quả hồi khí" : "Qi regeneration"}</li>
                  <li>{locale === "vi" ? "Hiểu biết công pháp" : "Technique comprehension"}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-purple-400/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-purple-400 min-w-[120px]">
                {t(locale, "perception")}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-purple-300 mb-1">
                  {locale === "vi" ? "Ảnh Hưởng:" : "Affects:"}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    {locale === "vi" ? "Phát hiện cơ hội ẩn" : "Hidden opportunity detection"}
                  </li>
                  <li>{locale === "vi" ? "Chất lượng vật phẩm rơi" : "Loot quality"}</li>
                  <li>{locale === "vi" ? "Tỷ lệ gặp sự kiện quý hiếm" : "Rare event chance"}</li>
                  <li>{locale === "vi" ? "Nhận biết nguy hiểm" : "Danger awareness"}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-xianxia-darker rounded border border-xianxia-gold/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl font-bold text-xianxia-gold min-w-[120px]">
                {t(locale, "luck")}
              </div>
              <div className="text-gray-300 flex-1">
                <div className="font-medium text-xianxia-gold mb-1">
                  {locale === "vi" ? "Ảnh Hưởng:" : "Affects:"}
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>{locale === "vi" ? "Tỷ lệ rơi vật phẩm quý" : "Rare item drop rate"}</li>
                  <li>{locale === "vi" ? "Cơ duyên và gặp gỡ" : "Fortuitous encounters"}</li>
                  <li>
                    {locale === "vi" ? "Kết quả sự kiện ngẫu nhiên" : "Random event outcomes"}
                  </li>
                  <li>
                    {locale === "vi" ? "Thành công đột phá cảnh giới" : "Breakthrough success rate"}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Other Stats */}
      <CollapsibleSection title={locale === "vi" ? "Khác" : "Other"}>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-400">{t(locale, "karma")}</div>
            <div className="text-xl font-bold text-xianxia-accent">{state.karma}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">
              {locale === "vi" ? t(locale, "age") : "Age"}
            </div>
            <div className="text-xl font-bold">{state.age}</div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
