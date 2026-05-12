import React from "react";

export type ResourceVariant = "silver" | "stone" | "default";

export interface ResourceProps {
  glyph: React.ReactNode;
  amount: number;
  label: React.ReactNode;
  variant?: ResourceVariant;
}

export function Resource({ glyph, amount, label, variant = "default" }: ResourceProps) {
  const accent =
    variant === "silver"
      ? "var(--gold-deep)"
      : variant === "stone"
        ? "var(--jade-deep)"
        : "var(--cinnabar-deep)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="t-han" style={{ fontSize: 18, color: accent, lineHeight: 1 }}>
        {glyph}
      </span>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span className="t-num" style={{ fontSize: 14, color: "var(--ink)" }}>
          {amount.toLocaleString()}
        </span>
        <span className="label" style={{ fontSize: 9, marginTop: 2 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
