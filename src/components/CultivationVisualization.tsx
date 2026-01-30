"use client";

import { useMemo, useState, useEffect } from "react";
import { GameState, Realm } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import { getRequiredExp, getSpiritRootBonus, getTechniqueBonus } from "@/lib/game/mechanics";
import { getEquipmentBonus } from "@/lib/game/equipment";
import { calculateTimeCultivationBonus, getSpecialTimeBonus } from "@/lib/game/time";
import { GameTime, TimeSegment } from "@/types/game";
import ParticleEffect, { MeditationAura } from "./ParticleEffect";

interface CultivationVisualizationProps {
  state: GameState;
  locale: Locale;
  previousExp?: number; // For animation when exp changes
  isMeditating?: boolean; // Show meditation aura effect
}

// Tooltip component for explaining bonuses
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg text-xs text-gray-200 whitespace-nowrap z-50 animate-fade-in shadow-lg">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-xianxia-darker" />
        </div>
      )}
    </div>
  );
}

// Realm color mapping
const REALM_COLORS: Record<Realm, { primary: string; light: string; gradient: string }> = {
  PhàmNhân: {
    primary: "rgb(107, 114, 128)",
    light: "rgb(156, 163, 175)",
    gradient: "from-gray-600 to-gray-400",
  },
  LuyệnKhí: {
    primary: "rgb(16, 185, 129)",
    light: "rgb(52, 211, 153)",
    gradient: "from-emerald-600 to-emerald-400",
  },
  TrúcCơ: {
    primary: "rgb(59, 130, 246)",
    light: "rgb(96, 165, 250)",
    gradient: "from-blue-600 to-blue-400",
  },
  KếtĐan: {
    primary: "rgb(139, 92, 246)",
    light: "rgb(167, 139, 250)",
    gradient: "from-violet-600 to-violet-400",
  },
  NguyênAnh: {
    primary: "rgb(245, 158, 11)",
    light: "rgb(251, 191, 36)",
    gradient: "from-amber-500 to-yellow-400",
  },
};

// Realm order for progression display
const REALM_ORDER: Realm[] = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];

// Realm descriptions for tooltips
const REALM_DESCRIPTIONS: Record<Realm, { vi: string; en: string }> = {
  PhàmNhân: {
    vi: "Cảnh giới khởi đầu - chưa tiếp xúc với tu luyện",
    en: "Starting realm - no cultivation experience",
  },
  LuyệnKhí: {
    vi: "Ngưng tụ khí trời đất trong cơ thể",
    en: "Condensing heaven and earth qi in the body",
  },
  TrúcCơ: {
    vi: "Xây dựng nền móng tu luyện vững chắc",
    en: "Building a solid cultivation foundation",
  },
  KếtĐan: {
    vi: "Kết tinh linh lực thành kim đan",
    en: "Crystallizing spiritual power into a golden core",
  },
  NguyênAnh: {
    vi: "Hình thành nguyên anh - đỉnh cao tu tiên",
    en: "Forming the nascent soul - peak of cultivation",
  },
};

export default function CultivationVisualization({
  state,
  locale,
  previousExp,
  isMeditating = false,
}: CultivationVisualizationProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayExp, setDisplayExp] = useState(state.progress.cultivation_exp);
  const [showExpGain, setShowExpGain] = useState(false);
  const [expGainAmount, setExpGainAmount] = useState(0);

  const { realm, realm_stage, cultivation_exp } = state.progress;
  const requiredExp = getRequiredExp(realm, realm_stage);
  const realmColors = REALM_COLORS[realm];

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (requiredExp === Infinity) return 100;
    return Math.min((cultivation_exp / requiredExp) * 100, 100);
  }, [cultivation_exp, requiredExp]);

  // Check if near breakthrough (>90%)
  const isNearBreakthrough = progressPercent >= 90 && requiredExp !== Infinity;
  const isReadyForBreakthrough = cultivation_exp >= requiredExp && requiredExp !== Infinity;

  // Calculate cultivation speed multiplier
  const spiritRootMultiplier = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueMultiplier = getTechniqueBonus(state);
  const equipmentBonus = getEquipmentBonus(state, "cultivation_speed");
  const sectBonus = state.sect_membership?.benefits?.cultivation_bonus || 0;

  // Calculate time-based bonus
  const currentTime: GameTime = {
    segment: state.time_segment as TimeSegment,
    day: state.time_day,
    month: state.time_month,
    year: state.time_year,
  };
  const timeBonus = calculateTimeCultivationBonus(currentTime, state.spirit_root.elements);
  const specialBonus = getSpecialTimeBonus(currentTime);

  // Total cultivation speed (all bonuses combined)
  const totalCultivationSpeed =
    spiritRootMultiplier *
    techniqueMultiplier *
    (1 + equipmentBonus / 100) *
    (1 + sectBonus / 100) *
    (1 + timeBonus / 100);

  // Calculate time to next level estimate
  const timeToNextLevel = useMemo(() => {
    if (requiredExp === Infinity) return null;
    const expNeeded = requiredExp - cultivation_exp;
    if (expNeeded <= 0) return null;

    // Assume average base exp gain of 25 per turn
    const avgExpPerTurn = 25 * totalCultivationSpeed;
    const turnsNeeded = Math.ceil(expNeeded / avgExpPerTurn);

    return turnsNeeded;
  }, [cultivation_exp, requiredExp, totalCultivationSpeed]);

  // Animate exp changes
  useEffect(() => {
    if (previousExp !== undefined && previousExp !== cultivation_exp) {
      setIsAnimating(true);
      setDisplayExp(previousExp);

      // Show exp gain popup
      const gained = cultivation_exp - previousExp;
      if (gained > 0) {
        setExpGainAmount(gained);
        setShowExpGain(true);
        setTimeout(() => setShowExpGain(false), 1500);
      }

      // Animate to new value
      const startTime = Date.now();
      const duration = 500;
      const startExp = previousExp;
      const endExp = cultivation_exp;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setDisplayExp(Math.floor(startExp + (endExp - startExp) * easeOut));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayExp(cultivation_exp);
    }
  }, [cultivation_exp, previousExp]);

  // Get realm index for progression dots
  const currentRealmIndex = REALM_ORDER.indexOf(realm);

  return (
    <div className="space-y-4">
      {/* Realm Title with Animation */}
      <div className="text-center">
        <div
          className={`inline-block px-6 py-2 rounded-lg border-2 transition-all duration-300 ${
            isReadyForBreakthrough
              ? "animate-near-breakthrough border-xianxia-gold"
              : "border-current"
          }`}
          style={{
            borderColor: isReadyForBreakthrough ? undefined : realmColors.primary,
            color: realmColors.primary,
          }}
        >
          <span className="text-2xl font-bold">{t(locale, realm)}</span>
          <span className="ml-2 text-lg opacity-80">
            {locale === "vi" ? `Tầng ${realm_stage}` : `Stage ${realm_stage}`}
          </span>
        </div>
      </div>

      {/* Realm Progression Dots */}
      <div className="flex justify-center items-center gap-2">
        {REALM_ORDER.map((r, index) => {
          const isCurrentRealm = r === realm;
          const isPastRealm = index < currentRealmIndex;
          const colors = REALM_COLORS[r];

          return (
            <div key={r} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCurrentRealm
                    ? "animate-glow-pulse scale-125"
                    : isPastRealm
                      ? "opacity-100"
                      : "opacity-30"
                }`}
                style={{
                  backgroundColor: isPastRealm || isCurrentRealm ? colors.primary : colors.light,
                  boxShadow: isCurrentRealm ? `0 0 10px ${colors.primary}` : "none",
                }}
                title={t(locale, r)}
              />
              {index < REALM_ORDER.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                    isPastRealm ? "opacity-100" : "opacity-30"
                  }`}
                  style={{
                    backgroundColor: isPastRealm ? colors.primary : "#4b5563",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main Progress Bar */}
      <div className="relative">
        {/* Background */}
        <div className="h-6 bg-xianxia-darker rounded-full overflow-hidden border border-xianxia-accent/20">
          {/* Progress Fill */}
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
              isNearBreakthrough ? "animate-near-breakthrough" : ""
            } ${isAnimating ? "animate-exp-gain" : ""}`}
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${realmColors.primary}, ${realmColors.light})`,
            }}
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                backgroundSize: "200% 100%",
              }}
            />
          </div>
        </div>

        {/* Exp Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white drop-shadow-lg">
            {requiredExp === Infinity
              ? locale === "vi"
                ? "Cảnh giới tối đa"
                : "Max Realm"
              : `${displayExp.toLocaleString()} / ${requiredExp.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Stage Progress Indicators */}
      {realm !== "PhàmNhân" && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((stage) => (
            <div
              key={stage}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                stage < realm_stage
                  ? ""
                  : stage === realm_stage
                    ? "animate-meridian-pulse"
                    : "opacity-30"
              }`}
              style={{
                backgroundColor: stage <= realm_stage ? realmColors.primary : "#4b5563",
                boxShadow: stage === realm_stage ? `0 0 5px ${realmColors.primary}` : "none",
              }}
              title={`${locale === "vi" ? "Tầng" : "Stage"} ${stage}`}
            />
          ))}
        </div>
      )}

      {/* Cultivation Speed Display with Tooltip */}
      <div className="flex justify-center items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Tooltip
            content={
              locale === "vi"
                ? "Tổng hệ số nhân cho kinh nghiệm tu luyện. Càng cao thì tu luyện càng nhanh."
                : "Total multiplier for cultivation exp. Higher means faster cultivation."
            }
          >
            <span className="text-gray-400 cursor-help underline decoration-dotted">
              {locale === "vi" ? "Tốc độ tu luyện:" : "Cultivation Speed:"}
            </span>
          </Tooltip>
          <span className="font-bold text-lg" style={{ color: realmColors.light }}>
            x{totalCultivationSpeed.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Time to Next Level Estimate */}
      {timeToNextLevel && timeToNextLevel < 100 && (
        <div className="text-center text-xs text-gray-500">
          <Tooltip
            content={
              locale === "vi"
                ? "Ước tính dựa trên tốc độ tu luyện hiện tại và exp trung bình"
                : "Estimate based on current cultivation speed and average exp gain"
            }
          >
            <span className="cursor-help">
              {locale === "vi"
                ? `~${timeToNextLevel} lượt nữa đến đột phá`
                : `~${timeToNextLevel} turns to breakthrough`}
            </span>
          </Tooltip>
        </div>
      )}

      {/* Speed Breakdown with Tooltips */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-center">
        <Tooltip
          content={
            locale === "vi"
              ? `Linh Căn ${state.spirit_root.grade}: Phẩm chất linh căn ảnh hưởng trực tiếp đến tốc độ hấp thụ linh khí`
              : `${state.spirit_root.grade} Spirit Root: Root quality directly affects qi absorption speed`
          }
        >
          <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10 cursor-help hover:border-green-500/50 transition-colors">
            <div className="text-gray-400 mb-1">{locale === "vi" ? "Linh Căn" : "Spirit Root"}</div>
            <div className="font-bold text-green-400">x{spiritRootMultiplier.toFixed(2)}</div>
          </div>
        </Tooltip>
        <Tooltip
          content={
            locale === "vi"
              ? `Công pháp đang luyện tập cung cấp bonus dựa trên cấp độ và nguyên tố phù hợp linh căn`
              : `Active techniques provide bonus based on grade and element matching your spirit root`
          }
        >
          <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10 cursor-help hover:border-purple-500/50 transition-colors">
            <div className="text-gray-400 mb-1">{locale === "vi" ? "Công Pháp" : "Techniques"}</div>
            <div className="font-bold text-purple-400">x{techniqueMultiplier.toFixed(2)}</div>
          </div>
        </Tooltip>
        <Tooltip
          content={
            locale === "vi"
              ? sectBonus > 0
                ? `Tông môn cung cấp +${sectBonus}% bonus tu luyện từ tài nguyên và môi trường`
                : "Chưa gia nhập tông môn. Gia nhập để nhận bonus tu luyện."
              : sectBonus > 0
                ? `Sect provides +${sectBonus}% cultivation bonus from resources and environment`
                : "Not in a sect. Join one to receive cultivation bonus."
          }
        >
          <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10 cursor-help hover:border-yellow-500/50 transition-colors">
            <div className="text-gray-400 mb-1">{locale === "vi" ? "Tông Môn" : "Sect"}</div>
            <div className="font-bold text-yellow-400">
              {sectBonus > 0 ? `+${sectBonus}%` : "-"}
            </div>
          </div>
        </Tooltip>
        <Tooltip
          content={
            locale === "vi"
              ? equipmentBonus > 0
                ? `Trang bị đang đeo cung cấp +${equipmentBonus}% tốc độ tu luyện`
                : "Không có trang bị nào tăng tốc độ tu luyện"
              : equipmentBonus > 0
                ? `Equipped items provide +${equipmentBonus}% cultivation speed`
                : "No equipment with cultivation speed bonus"
          }
        >
          <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10 cursor-help hover:border-blue-500/50 transition-colors">
            <div className="text-gray-400 mb-1">{locale === "vi" ? "Trang Bị" : "Equipment"}</div>
            <div className="font-bold text-blue-400">
              {equipmentBonus > 0 ? `+${equipmentBonus}%` : "-"}
            </div>
          </div>
        </Tooltip>
        <Tooltip
          content={
            locale === "vi"
              ? timeBonus > 0
                ? `Thời điểm hiện tại có linh khí đậm đặc, +${timeBonus}% tu luyện`
                : "Thời điểm bình thường, không có bonus thời gian"
              : timeBonus > 0
                ? `Current time has dense spiritual qi, +${timeBonus}% cultivation`
                : "Normal time period, no time bonus"
          }
        >
          <div className="p-2 bg-xianxia-darker rounded border border-xianxia-accent/10 cursor-help hover:border-orange-500/50 transition-colors">
            <div className="text-gray-400 mb-1">{locale === "vi" ? "Thời Gian" : "Time"}</div>
            <div className="font-bold text-orange-400">
              {timeBonus > 0 ? `+${timeBonus}%` : "-"}
            </div>
            {specialBonus && (
              <div
                className="text-[10px] text-orange-300 mt-1 truncate"
                title={locale === "vi" ? specialBonus.reason_vi : specialBonus.reason_en}
              >
                {locale === "vi" ? specialBonus.reason_vi : specialBonus.reason_en}
              </div>
            )}
          </div>
        </Tooltip>
      </div>

      {/* Exp Gain Popup */}
      {showExpGain && expGainAmount > 0 && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full animate-exp-particle text-green-400 font-bold">
          +{expGainAmount} EXP
        </div>
      )}

      {/* Exp Particles when gaining */}
      {isAnimating && <ParticleEffect type="exp" isActive={true} intensity="medium" />}

      {/* Meditation Aura when active */}
      {isMeditating && (
        <MeditationAura isActive={true} color={realmColors.primary} intensity="medium" />
      )}

      {/* Breakthrough Ready Alert */}
      {isReadyForBreakthrough && (
        <div className="text-center p-3 bg-gradient-to-r from-xianxia-gold/20 via-yellow-500/30 to-xianxia-gold/20 rounded-lg border border-xianxia-gold animate-breakthrough-ready">
          <span className="text-xianxia-gold font-bold animate-pulse">
            ⚡ {locale === "vi" ? "Sẵn sàng đột phá cảnh giới!" : "Ready for Breakthrough!"} ⚡
          </span>
          <div className="text-xs text-yellow-300 mt-1">
            {locale === "vi"
              ? "Tìm nơi yên tĩnh và chọn đột phá trong lựa chọn"
              : "Find a quiet place and choose breakthrough in your options"}
          </div>
        </div>
      )}

      {/* Near Breakthrough Warning */}
      {isNearBreakthrough && !isReadyForBreakthrough && (
        <div className="text-center text-xs text-yellow-500">
          {locale === "vi"
            ? `Còn ${Math.ceil(requiredExp - cultivation_exp)} exp nữa là đủ đột phá`
            : `${Math.ceil(requiredExp - cultivation_exp)} more exp needed for breakthrough`}
        </div>
      )}
    </div>
  );
}
