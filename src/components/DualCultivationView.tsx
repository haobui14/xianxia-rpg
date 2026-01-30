"use client";

import { useState } from "react";
import { GameState } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import {
  BODY_REALM_NAMES,
  BODY_REALM_BONUSES,
  BODY_STAGE_BONUSES,
  getBodyCultivationProgress,
  getBodyExpToNext,
  getNextBodyRealm,
} from "@/lib/game/dual-cultivation";
import ParticleEffect from "./ParticleEffect";

interface DualCultivationViewProps {
  state: GameState;
  locale: Locale;
  onToggleDualCultivation?: () => Promise<void>;
  onSetExpSplit?: (split: number) => Promise<void>; // Reserved for future use (currently fixed 70/30 split)
}

// Tooltip component
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg text-xs text-gray-200 whitespace-nowrap z-50 animate-fade-in shadow-lg max-w-xs">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-xianxia-darker" />
        </div>
      )}
    </div>
  );
}

export default function DualCultivationView({
  state,
  locale,
  onToggleDualCultivation,
}: DualCultivationViewProps) {
  const [isToggling, setIsToggling] = useState(false);

  const isDualMode = state.progress.cultivation_path === "dual";
  const bodyRealm = state.progress.body_realm || "PhàmThể";
  const bodyStage = state.progress.body_stage || 0;
  const bodyExp = state.progress.body_exp || 0;
  const bodyProgress = getBodyCultivationProgress(state.progress);
  const bodyExpNeeded = getBodyExpToNext(state.progress);
  const nextBodyRealm = getNextBodyRealm(bodyRealm);

  // Calculate current bonuses from body cultivation
  const currentBonuses = {
    hp:
      bodyStage * BODY_STAGE_BONUSES.hp +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].hp : 0),
    str:
      Math.floor(bodyStage * BODY_STAGE_BONUSES.str) +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].str : 0),
    stamina:
      bodyStage * BODY_STAGE_BONUSES.stamina +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].stamina : 0),
  };

  // Calculate next stage bonuses
  const nextStageBonuses = {
    hp:
      (bodyStage + 1) * BODY_STAGE_BONUSES.hp +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].hp : 0),
    str:
      Math.floor((bodyStage + 1) * BODY_STAGE_BONUSES.str) +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].str : 0),
    stamina:
      (bodyStage + 1) * BODY_STAGE_BONUSES.stamina +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].stamina : 0),
  };

  const handleToggle = async () => {
    if (onToggleDualCultivation) {
      setIsToggling(true);
      await onToggleDualCultivation();
      setIsToggling(false);
    }
  };

  // Get realm colors
  const getBodyRealmColor = (realm: string): string => {
    switch (realm) {
      case "PhàmThể":
        return "text-gray-400";
      case "LuyệnCốt":
        return "text-yellow-600";
      case "ĐồngCân":
        return "text-orange-500";
      case "KimCương":
        return "text-cyan-400";
      case "TháiCổ":
        return "text-purple-500";
      default:
        return "text-gray-400";
    }
  };

  const getBodyRealmBgColor = (realm: string): string => {
    switch (realm) {
      case "PhàmThể":
        return "from-gray-600 to-gray-400";
      case "LuyệnCốt":
        return "from-yellow-600 to-yellow-400";
      case "ĐồngCân":
        return "from-orange-600 to-orange-400";
      case "KimCương":
        return "from-cyan-600 to-cyan-400";
      case "TháiCổ":
        return "from-purple-600 to-purple-400";
      default:
        return "from-gray-600 to-gray-400";
    }
  };

  // Check if ready for body breakthrough
  const isReadyForBodyBreakthrough =
    bodyStage >= 5 && bodyExp >= bodyExpNeeded && nextBodyRealm !== null;

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6 relative overflow-hidden">
      {/* Background particles for dual mode */}
      {isDualMode && (
        <ParticleEffect
          type="cultivation"
          isActive={true}
          intensity="low"
          colors={["#f97316", "#8b5cf6"]}
        />
      )}

      <h2 className="text-2xl font-bold mb-4 text-xianxia-gold relative z-10">
        {locale === "vi" ? "🔄 Tu Luyện Song Đạo" : "🔄 Dual Cultivation"}
      </h2>

      {/* Status Summary Card */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-orange-900/30 rounded-lg border border-purple-500/30 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${isDualMode ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
            />
            <div>
              <div className="font-semibold text-white">
                {isDualMode
                  ? locale === "vi"
                    ? "Song Tu Đang Hoạt Động"
                    : "Dual Cultivation Active"
                  : locale === "vi"
                    ? "Chỉ Tu Khí"
                    : "Qi Cultivation Only"}
              </div>
              <div className="text-xs text-gray-400">
                {isDualMode
                  ? locale === "vi"
                    ? "Khí: 70% | Thể: 30%"
                    : "Qi: 70% | Body: 30%"
                  : locale === "vi"
                    ? "Tất cả kinh nghiệm vào tu khí"
                    : "All exp goes to Qi cultivation"}
              </div>
            </div>
          </div>
          {onToggleDualCultivation && (
            <Tooltip
              content={
                isDualMode
                  ? locale === "vi"
                    ? "Tắt song tu (giữ tiến độ thể chất)"
                    : "Disable dual (keeps body progress)"
                  : locale === "vi"
                    ? "Bật song tu để tăng sức mạnh vật lý"
                    : "Enable dual to increase physical power"
              }
            >
              <button
                onClick={handleToggle}
                disabled={isToggling}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDualMode
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30"
                    : "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isToggling
                  ? locale === "vi"
                    ? "..."
                    : "..."
                  : isDualMode
                    ? locale === "vi"
                      ? "✓ Đang Song Tu"
                      : "✓ Dual Active"
                    : locale === "vi"
                      ? "Kích Hoạt"
                      : "Activate"}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Body Cultivation Progress - Always show if has any progress */}
      {(isDualMode || bodyExp > 0 || bodyStage > 0 || bodyRealm !== "PhàmThể") && (
        <>
          {/* Body Realm Display */}
          <div
            className={`mb-6 p-4 bg-xianxia-darker rounded-lg relative z-10 ${isReadyForBodyBreakthrough ? "animate-breakthrough-ready border-2 border-orange-500" : "border border-xianxia-accent/10"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <Tooltip
                  content={
                    locale === "vi"
                      ? "Cảnh giới tu thể - tăng HP, Sức mạnh và Thể lực"
                      : "Body cultivation realm - increases HP, STR and Stamina"
                  }
                >
                  <div className="text-sm text-gray-400 cursor-help">
                    {locale === "vi" ? "🏋️ Cảnh Giới Thể Chất" : "🏋️ Body Realm"}
                  </div>
                </Tooltip>
                <div
                  className={`text-xl font-bold ${getBodyRealmColor(bodyRealm)} flex items-center gap-2`}
                >
                  {BODY_REALM_NAMES[bodyRealm][locale === "vi" ? "vi" : "en"]}
                  <span className="text-lg opacity-80">
                    {locale === "vi" ? `Tầng ${bodyStage + 1}` : `Stage ${bodyStage + 1}`}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">
                  {locale === "vi" ? "Tiến Độ" : "Progress"}
                </div>
                <div className="text-lg font-semibold text-orange-400">
                  {bodyExp.toLocaleString()} /{" "}
                  {bodyExpNeeded === Infinity ? "∞" : bodyExpNeeded.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Body Progress Bar */}
            <div className="relative h-5 bg-gray-700 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full bg-gradient-to-r ${getBodyRealmBgColor(bodyRealm)} transition-all duration-500 relative`}
                style={{ width: `${bodyProgress}%` }}
              >
                {/* Shimmer effect */}
                <div
                  className="absolute inset-0 animate-shimmer"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {bodyProgress}%
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex justify-center gap-1 mb-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < bodyStage
                      ? `bg-gradient-to-r ${getBodyRealmBgColor(bodyRealm)}`
                      : i === bodyStage
                        ? "bg-orange-500 animate-pulse"
                        : "bg-gray-600"
                  }`}
                  title={`${locale === "vi" ? "Tầng" : "Stage"} ${i + 1}`}
                />
              ))}
            </div>

            {/* Body Bonuses Display */}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Tooltip
                content={
                  locale === "vi"
                    ? `Hiện tại: +${currentBonuses.hp} HP | Tầng sau: +${nextStageBonuses.hp} HP`
                    : `Current: +${currentBonuses.hp} HP | Next stage: +${nextStageBonuses.hp} HP`
                }
              >
                <div className="p-2 bg-red-900/30 rounded cursor-help hover:bg-red-900/50 transition-colors">
                  <div className="text-red-400 text-xs">HP</div>
                  <div className="font-bold text-red-300">+{currentBonuses.hp}</div>
                </div>
              </Tooltip>
              <Tooltip
                content={
                  locale === "vi"
                    ? `Hiện tại: +${currentBonuses.str} STR | Tầng sau: +${nextStageBonuses.str} STR`
                    : `Current: +${currentBonuses.str} STR | Next stage: +${nextStageBonuses.str} STR`
                }
              >
                <div className="p-2 bg-orange-900/30 rounded cursor-help hover:bg-orange-900/50 transition-colors">
                  <div className="text-orange-400 text-xs">
                    {locale === "vi" ? "Sức mạnh" : "STR"}
                  </div>
                  <div className="font-bold text-orange-300">+{currentBonuses.str}</div>
                </div>
              </Tooltip>
              <Tooltip
                content={
                  locale === "vi"
                    ? `Hiện tại: +${currentBonuses.stamina} Stamina | Tầng sau: +${nextStageBonuses.stamina} Stamina`
                    : `Current: +${currentBonuses.stamina} Stamina | Next stage: +${nextStageBonuses.stamina} Stamina`
                }
              >
                <div className="p-2 bg-green-900/30 rounded cursor-help hover:bg-green-900/50 transition-colors">
                  <div className="text-green-400 text-xs">
                    {locale === "vi" ? "Thể lực" : "Stamina"}
                  </div>
                  <div className="font-bold text-green-300">+{currentBonuses.stamina}</div>
                </div>
              </Tooltip>
            </div>

            {/* Breakthrough Ready Alert */}
            {isReadyForBodyBreakthrough && nextBodyRealm && (
              <div className="mt-3 p-2 bg-orange-500/20 rounded-lg text-center border border-orange-500/50">
                <span className="text-orange-400 font-bold animate-pulse">
                  ⚡ {locale === "vi" ? "Sẵn sàng đột phá" : "Ready for Breakthrough"}:{" "}
                  {BODY_REALM_NAMES[nextBodyRealm][locale === "vi" ? "vi" : "en"]} ⚡
                </span>
              </div>
            )}
          </div>

          {/* Fixed Exp Split Display - Only show in dual mode */}
          {isDualMode && (
            <div className="p-4 bg-xianxia-darker rounded-lg border border-xianxia-accent/10 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <Tooltip
                  content={
                    locale === "vi"
                      ? "Tỷ lệ phân chia kinh nghiệm cố định: 70% Khí / 30% Thể"
                      : "Fixed experience split ratio: 70% Qi / 30% Body"
                  }
                >
                  <div className="text-sm text-gray-400 cursor-help">
                    {locale === "vi" ? "⚖️ Phân Chia Kinh Nghiệm" : "⚖️ Experience Split"}
                  </div>
                </Tooltip>
                <div className="text-sm font-medium">
                  <span className="text-blue-400">
                    {locale === "vi" ? "Khí" : "Qi"}: 70%
                  </span>
                  <span className="text-gray-500 mx-2">|</span>
                  <span className="text-orange-400">
                    {locale === "vi" ? "Thể" : "Body"}: 30%
                  </span>
                </div>
              </div>

              {/* Visual split bar - Fixed 70/30 */}
              <div className="h-4 rounded-full overflow-hidden flex border border-xianxia-accent/20">
                <div
                  className="bg-gradient-to-r from-blue-600 to-blue-400 relative"
                  style={{ width: "70%" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    {locale === "vi" ? "Khí 70%" : "Qi 70%"}
                  </span>
                </div>
                <div
                  className="bg-gradient-to-r from-orange-400 to-orange-600 relative"
                  style={{ width: "30%" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    {locale === "vi" ? "Thể 30%" : "Body 30%"}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500 text-center">
                {locale === "vi"
                  ? "Tỷ lệ cố định để cân bằng tiến độ hai con đường"
                  : "Fixed ratio for balanced progression on both paths"}
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-sm text-blue-200 relative z-10">
            <div className="font-semibold mb-2">
              {locale === "vi" ? "💡 Hướng Dẫn Song Tu:" : "💡 Dual Cultivation Guide:"}
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-gray-300">
              <li>
                {locale === "vi"
                  ? "Tu thể tăng HP, Sức mạnh (ATK) và Thể lực (Stamina max)"
                  : "Body cultivation increases HP, STR (ATK) and Stamina (max)"}
              </li>
              <li>
                {locale === "vi"
                  ? "Tiến độ thể chất được giữ lại khi tắt song tu"
                  : "Body progress is preserved when disabling dual cultivation"}
              </li>
              <li>
                {locale === "vi"
                  ? "Tỷ lệ cố định 70% Khí / 30% Thể để cân bằng tiến độ"
                  : "Fixed 70% Qi / 30% Body ratio for balanced progression"}
              </li>
              <li>
                {locale === "vi"
                  ? "Thể tu có yêu cầu EXP thấp hơn để đột phá nhanh hơn"
                  : "Body cultivation has lower EXP requirements for faster breakthroughs"}
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Show prompt to enable dual cultivation - only if no body progress */}
      {!isDualMode && bodyExp === 0 && bodyStage === 0 && bodyRealm === "PhàmThể" && (
        <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg text-center relative z-10">
          <div className="text-lg mb-2">
            {locale === "vi" ? "🏋️ Khai Mở Con Đường Tu Thể?" : "🏋️ Unlock Body Cultivation Path?"}
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {locale === "vi"
              ? "Tu luyện thể chất song song với tu khí để tăng HP, Sức mạnh và Thể lực. Phù hợp với người chơi thích chiến đấu cận chiến."
              : "Cultivate your body alongside Qi to increase HP, Strength and Stamina. Great for melee combat focused players."}
          </p>
          {onToggleDualCultivation && (
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30"
            >
              {isToggling
                ? locale === "vi"
                  ? "⏳ Đang kích hoạt..."
                  : "⏳ Activating..."
                : locale === "vi"
                  ? "🔓 Bắt đầu Song Tu"
                  : "🔓 Start Dual Cultivation"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
