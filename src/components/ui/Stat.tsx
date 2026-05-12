import React from "react";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export function Stat({ label, value, icon }: StatProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px dotted var(--line)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--ink-soft)",
          fontSize: 13,
        }}
      >
        {icon && (
          <span className="t-han" style={{ fontSize: 14, color: "var(--cinnabar-deep)" }}>
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className="t-num" style={{ fontSize: 14, color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}
