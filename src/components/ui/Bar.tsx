import React from "react";

export type BarKind = "hp" | "qi" | "stam" | "exp";

export interface BarProps {
  label?: React.ReactNode;
  kind?: BarKind;
  value: number;
  max: number;
  showNums?: boolean;
  sub?: React.ReactNode;
  className?: string;
}

export function Bar({
  label,
  kind = "exp",
  value,
  max,
  showNums = true,
  sub,
  className = "",
}: BarProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div className={className} style={{ marginBottom: 4 }}>
      {(label || showNums) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <span className="label" style={{ fontSize: 10 }}>
            {label}
            {sub && (
              <span className="faint" style={{ marginLeft: 6, letterSpacing: 0 }}>
                {sub}
              </span>
            )}
          </span>
          {showNums && (
            <span className="t-num" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {Math.round(value)}
              <span className="faint"> / {Math.round(max)}</span>
            </span>
          )}
        </div>
      )}
      <div className={`ink-bar ${kind}`}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
