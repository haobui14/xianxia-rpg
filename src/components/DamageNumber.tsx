"use client";

import { useState, useEffect } from "react";

export interface DamageNumberData {
  id: string;
  value: number;
  type: "damage" | "critical" | "heal" | "miss" | "dodge" | "blocked";
  x?: number; // Position offset from center (-50 to 50)
  y?: number; // Starting Y position offset
}

interface DamageNumberProps {
  data: DamageNumberData;
  onComplete: (id: string) => void;
}

const TYPE_STYLES = {
  damage: {
    color: "text-red-500",
    size: "text-2xl",
    shadow: "drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]",
  },
  critical: {
    color: "text-yellow-400",
    size: "text-4xl",
    shadow: "drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]",
  },
  heal: {
    color: "text-green-400",
    size: "text-2xl",
    shadow: "drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  },
  miss: {
    color: "text-gray-400",
    size: "text-xl",
    shadow: "drop-shadow-[0_0_4px_rgba(156,163,175,0.5)]",
  },
  dodge: {
    color: "text-cyan-400",
    size: "text-xl",
    shadow: "drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]",
  },
  blocked: {
    color: "text-orange-400",
    size: "text-xl",
    shadow: "drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]",
  },
};

function DamageNumber({ data, onComplete }: DamageNumberProps) {
  const [visible, setVisible] = useState(true);

  const style = TYPE_STYLES[data.type];

  useEffect(() => {
    // Remove after animation
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete(data.id);
    }, 1500);

    return () => clearTimeout(timer);
  }, [data.id, onComplete]);

  if (!visible) return null;

  const displayText =
    data.type === "miss"
      ? "MISS"
      : data.type === "dodge"
        ? "DODGE"
        : data.type === "blocked"
          ? "BLOCKED"
          : data.type === "heal"
            ? `+${data.value}`
            : data.type === "critical"
              ? `${data.value}!`
              : `-${data.value}`;

  return (
    <div
      className={`absolute pointer-events-none font-bold ${style.color} ${style.size} ${style.shadow} animate-particle-rise`}
      style={
        {
          left: `calc(50% + ${data.x || 0}px)`,
          top: `calc(50% + ${data.y || 0}px)`,
          transform: "translate(-50%, -50%)",
          // eslint-disable-next-line react-hooks/purity
          "--particle-drift": `${(Math.random() - 0.5) * 30}px`,
        } as React.CSSProperties
      }
    >
      {displayText}
    </div>
  );
}

// Container component to manage multiple damage numbers
interface DamageNumberManagerProps {
  numbers: DamageNumberData[];
  onRemove: (id: string) => void;
}

export function DamageNumberManager({ numbers, onRemove }: DamageNumberManagerProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {numbers.map((num) => (
        <DamageNumber key={num.id} data={num} onComplete={onRemove} />
      ))}
    </div>
  );
}

export default DamageNumber;
