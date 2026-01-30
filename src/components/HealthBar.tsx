"use client";

import { useState, useEffect, useRef } from "react";

interface HealthBarProps {
  current: number;
  max: number;
  type: "hp" | "qi" | "stamina" | "enemy";
  showNumbers?: boolean;
  showPercentage?: boolean;
  size?: "small" | "medium" | "large";
  animate?: boolean;
  label?: string;
}

const BAR_COLORS = {
  hp: {
    fill: "from-red-600 to-red-400",
    bg: "bg-red-950",
    border: "border-red-700/50",
    text: "text-red-400",
    glow: "shadow-red-500/30",
    damage: "bg-red-300",
  },
  qi: {
    fill: "from-blue-600 to-blue-400",
    bg: "bg-blue-950",
    border: "border-blue-700/50",
    text: "text-blue-400",
    glow: "shadow-blue-500/30",
    damage: "bg-blue-300",
  },
  stamina: {
    fill: "from-green-600 to-green-400",
    bg: "bg-green-950",
    border: "border-green-700/50",
    text: "text-green-400",
    glow: "shadow-green-500/30",
    damage: "bg-green-300",
  },
  enemy: {
    fill: "from-orange-600 to-orange-400",
    bg: "bg-orange-950",
    border: "border-orange-700/50",
    text: "text-orange-400",
    glow: "shadow-orange-500/30",
    damage: "bg-orange-300",
  },
};

const SIZE_CLASSES = {
  small: "h-2",
  medium: "h-4",
  large: "h-6",
};

export default function HealthBar({
  current,
  max,
  type,
  showNumbers = true,
  showPercentage = false,
  size = "medium",
  animate = true,
  label,
}: HealthBarProps) {
  const [displayCurrent, setDisplayCurrent] = useState(current);
  const [damageChunk, setDamageChunk] = useState<number | null>(null);
  const previousCurrentRef = useRef(current);
  const colors = BAR_COLORS[type];

  // Calculate percentage
  const percentage = max > 0 ? Math.max(0, Math.min(100, (displayCurrent / max) * 100)) : 0;
  const isLow = percentage < 25;
  const isCritical = percentage < 10;

  // Animate value changes
  useEffect(() => {
    if (!animate) {
      setDisplayCurrent(current);
      return;
    }

    const prevCurrent = previousCurrentRef.current;
    previousCurrentRef.current = current;

    // Detect damage taken
    if (current < prevCurrent) {
      const damageTaken = prevCurrent - current;
      setDamageChunk(damageTaken);

      // Animate the bar smoothly
      const startTime = Date.now();
      const duration = 300;
      const startValue = prevCurrent;
      const endValue = current;

      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setDisplayCurrent(Math.floor(startValue + (endValue - startValue) * easeOut));

        if (progress < 1) {
          requestAnimationFrame(animateValue);
        }
      };

      requestAnimationFrame(animateValue);

      // Clear damage chunk after animation
      setTimeout(() => setDamageChunk(null), 600);
    } else if (current > prevCurrent) {
      // Healing animation (faster)
      const startTime = Date.now();
      const duration = 200;
      const startValue = prevCurrent;
      const endValue = current;

      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        setDisplayCurrent(Math.floor(startValue + (endValue - startValue) * progress));

        if (progress < 1) {
          requestAnimationFrame(animateValue);
        }
      };

      requestAnimationFrame(animateValue);
    } else {
      setDisplayCurrent(current);
    }
  }, [current, animate]);

  return (
    <div className="w-full">
      {/* Label row */}
      {(label || showNumbers) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className={`text-xs font-medium ${colors.text}`}>{label}</span>}
          {showNumbers && (
            <span className={`text-xs font-mono ${colors.text}`}>
              {displayCurrent.toLocaleString()} / {max.toLocaleString()}
              {showPercentage && ` (${Math.round(percentage)}%)`}
            </span>
          )}
        </div>
      )}

      {/* Bar container */}
      <div
        className={`relative w-full ${SIZE_CLASSES[size]} rounded-full overflow-hidden border ${colors.border} ${colors.bg}`}
      >
        {/* Damage chunk (shows what was lost) */}
        {damageChunk !== null && (
          <div
            className={`absolute inset-y-0 ${colors.damage} opacity-70 transition-all duration-500`}
            style={{
              left: `${percentage}%`,
              width: `${(damageChunk / max) * 100}%`,
            }}
          />
        )}

        {/* Main fill bar */}
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors.fill} transition-all duration-300 ease-out relative overflow-hidden ${
            isLow && animate ? (isCritical ? "animate-pulse" : "animate-progress-pulse") : ""
          }`}
          style={{
            width: `${percentage}%`,
            boxShadow: isLow ? `0 0 10px ${colors.glow}` : undefined,
          }}
        >
          {/* Shimmer effect */}
          {animate && percentage > 0 && (
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>

        {/* Segment markers for medium/large bars */}
        {size !== "small" && (
          <div className="absolute inset-0 flex">
            {[25, 50, 75].map((mark) => (
              <div
                key={mark}
                className="absolute top-0 bottom-0 w-px bg-black/20"
                style={{ left: `${mark}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Low health warning text */}
      {isLow && type === "hp" && (
        <div
          className={`text-xs mt-1 ${isCritical ? "text-red-500 animate-pulse" : "text-red-400"}`}
        >
          {isCritical ? "!! CRITICAL !!" : "! Low Health !"}
        </div>
      )}
    </div>
  );
}
