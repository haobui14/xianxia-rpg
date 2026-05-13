"use client";

import { useState, useEffect, useCallback } from "react";
import { Realm } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";

export interface BreakthroughEvent {
  previousRealm: Realm;
  previousStage: number;
  newRealm: Realm;
  newStage: number;
  statIncreases: {
    hp_max?: number;
    qi_max?: number;
    stamina_max?: number;
    str?: number;
    agi?: number;
    int?: number;
    perception?: number;
    luck?: number;
  };
}

interface BreakthroughModalProps {
  event: BreakthroughEvent;
  locale: Locale;
  onClose: () => void;
}

// Realm color mapping
const REALM_COLORS: Record<Realm, { primary: string; glow: string }> = {
  PhàmNhân: { primary: "#6b7280", glow: "rgba(107, 114, 128, 0.5)" },
  LuyệnKhí: { primary: "#10b981", glow: "rgba(16, 185, 129, 0.5)" },
  TrúcCơ: { primary: "#3b82f6", glow: "rgba(59, 130, 246, 0.5)" },
  KếtĐan: { primary: "#8b5cf6", glow: "rgba(139, 92, 246, 0.5)" },
  NguyênAnh: { primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.5)" },
};

export default function BreakthroughModal({ event, locale, onClose }: BreakthroughModalProps) {
  const [phase, setPhase] = useState<"lightning" | "reveal" | "stats" | "complete">("lightning");
  const [showStats, setShowStats] = useState<string[]>([]);

  const { newRealm, newStage, statIncreases } = event;
  const colors = REALM_COLORS[newRealm];

  // Check if this is a major realm breakthrough (not just stage increase)
  const isRealmBreakthrough = event.previousRealm !== event.newRealm;

  // Animation sequence
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Lightning phase
    timers.push(setTimeout(() => setPhase("reveal"), 800));

    // Reveal phase
    timers.push(setTimeout(() => setPhase("stats"), 2000));

    // Stats animation - show each stat one by one
    const statKeys = Object.keys(statIncreases).filter(
      (key) =>
        statIncreases[key as keyof typeof statIncreases] !== undefined &&
        statIncreases[key as keyof typeof statIncreases]! > 0
    );

    statKeys.forEach((key, index) => {
      timers.push(
        setTimeout(
          () => {
            setShowStats((prev) => [...prev, key]);
          },
          2200 + index * 300
        )
      );
    });

    // Complete phase
    timers.push(setTimeout(() => setPhase("complete"), 2200 + statKeys.length * 300 + 500));

    return () => timers.forEach((t) => clearTimeout(t));
  }, [statIncreases]);

  // Handle click to skip or close
  const handleClick = useCallback(() => {
    if (phase === "complete") {
      onClose();
    } else {
      // Skip to complete
      setPhase("complete");
      setShowStats(
        Object.keys(statIncreases).filter(
          (key) =>
            statIncreases[key as keyof typeof statIncreases] !== undefined &&
            statIncreases[key as keyof typeof statIncreases]! > 0
        )
      );
    }
  }, [phase, onClose, statIncreases]);

  // Format stat name for display
  const formatStatName = (key: string): string => {
    const names: Record<string, { vi: string; en: string }> = {
      hp_max: { vi: "HP Tối Đa", en: "Max HP" },
      qi_max: { vi: "Khí Tối Đa", en: "Max Qi" },
      stamina_max: { vi: "Thể Lực Tối Đa", en: "Max Stamina" },
      str: { vi: "Sức Mạnh", en: "Strength" },
      agi: { vi: "Nhanh Nhẹn", en: "Agility" },
      int: { vi: "Trí Tuệ", en: "Intelligence" },
      perception: { vi: "Giác Quan", en: "Perception" },
      luck: { vi: "May Mắn", en: "Luck" },
    };
    return locale === "vi" ? names[key]?.vi || key : names[key]?.en || key;
  };

  return (
    <div
      data-theme="night"
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      style={{ background: "rgba(8, 10, 16, 0.85)", backdropFilter: "blur(6px)" }}
      onClick={handleClick}
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Lightning flashes */}
        {phase === "lightning" && (
          <>
            <div
              className="absolute inset-0 animate-lightning-flash"
              style={{ backgroundColor: colors.glow }}
            />
            <div
              className="absolute inset-0 animate-lightning-flash"
              style={{
                backgroundColor: "white",
                animationDelay: "0.2s",
                opacity: 0.3,
              }}
            />
          </>
        )}

        {/* Expanding rings */}
        {(phase === "reveal" || phase === "stats" || phase === "complete") && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute rounded-full border-2 animate-breakthrough-ring"
                style={{
                  borderColor: colors.primary,
                  width: "100px",
                  height: "100px",
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Particle effects */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => {
            return (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-particle-rise"
                style={
                  {
                    backgroundColor: i % 2 === 0 ? colors.primary : "#fbbf24",
                    // eslint-disable-next-line react-hooks/purity
                    left: `${30 + Math.random() * 40}%`,
                    top: "60%",
                    // eslint-disable-next-line react-hooks/purity
                    "--particle-drift": `${(Math.random() - 0.5) * 100}px`,
                    // eslint-disable-next-line react-hooks/purity
                    animationDelay: `${Math.random() * 2}s`,
                    // eslint-disable-next-line react-hooks/purity
                    animationDuration: `${1.5 + Math.random()}s`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-8 max-w-lg">
        {/* Realm breakthrough title */}
        {(phase === "reveal" || phase === "stats" || phase === "complete") && (
          <div className="mb-8">
            <div
              style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}
              className="animate-realm-reveal opacity-0"
            >
              <span
                className="seal lg"
                style={{
                  background: colors.primary,
                  color: "#fbe9b8",
                  boxShadow: `0 0 0 1px ${colors.primary} inset, 0 0 0 3px ${colors.primary} inset, 0 0 0 4px ${colors.glow} inset, 0 0 24px ${colors.glow}`,
                }}
              >
                破
              </span>
            </div>
            {isRealmBreakthrough && (
              <div
                className="label animate-realm-reveal opacity-0"
                style={{
                  color: colors.primary,
                  animationFillMode: "forwards",
                  letterSpacing: "0.2em",
                }}
              >
                {locale === "vi" ? "Đột Phá Cảnh Giới" : "Realm Breakthrough"}
              </div>
            )}
            <h1
              className="t-display animate-realm-reveal opacity-0"
              style={{
                color: colors.primary,
                textShadow: `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}`,
                animationFillMode: "forwards",
                animationDelay: "0.2s",
                fontSize: 52,
                margin: "10px 0 4px",
                lineHeight: 1,
              }}
            >
              {t(locale, newRealm)}
            </h1>
            <div
              className="brush-rule animate-realm-reveal opacity-0"
              style={{
                maxWidth: 220,
                margin: "12px auto",
                animationFillMode: "forwards",
                animationDelay: "0.3s",
                background: `linear-gradient(90deg, transparent 0%, ${colors.primary} 8%, ${colors.primary} 78%, transparent 100%)`,
              }}
            />
            <div
              className="t-display animate-realm-reveal opacity-0"
              style={{
                color: colors.primary,
                animationFillMode: "forwards",
                animationDelay: "0.4s",
                fontSize: 22,
                fontStyle: "italic",
              }}
            >
              {locale === "vi" ? `Tầng ${newStage}` : `Stage ${newStage}`}
            </div>
          </div>
        )}

        {/* Stat increases */}
        {(phase === "stats" || phase === "complete") && (
          <div>
            <div
              className="label animate-stat-count opacity-0"
              style={{
                animationFillMode: "forwards",
                marginBottom: 12,
                color: "var(--ink-mute)",
              }}
            >
              {locale === "vi" ? "Thuộc Tính Tăng Tiến" : "Stats Increased"}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(statIncreases).map(([key, value]) => {
                if (!value || value <= 0) return null;
                const isVisible = showStats.includes(key);
                return (
                  <div
                    key={key}
                    className="ink-card"
                    style={{
                      padding: 12,
                      borderColor: colors.primary,
                      background: "var(--card)",
                      boxShadow: `0 0 18px ${colors.glow}, 0 1px 0 rgba(255,250,230,0.06) inset`,
                      transition: "all 0.3s",
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateY(0)" : "translateY(8px)",
                    }}
                  >
                    <div
                      className="label"
                      style={{ color: "var(--ink-mute)", fontSize: 10 }}
                    >
                      {formatStatName(key)}
                    </div>
                    <div
                      className="t-num"
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: colors.primary,
                        marginTop: 2,
                      }}
                    >
                      +{value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div
            className="label animate-pulse"
            style={{ marginTop: 28, color: "var(--ink-mute)", letterSpacing: "0.2em" }}
          >
            {locale === "vi" ? "Nhấn để tiếp tục" : "Click to continue"}
          </div>
        )}
      </div>
    </div>
  );
}
