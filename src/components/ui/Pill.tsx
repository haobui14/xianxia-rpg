import React from "react";

export type PillVariant = "default" | "jade" | "cinnabar" | "gold";

export interface PillProps {
  children: React.ReactNode;
  variant?: PillVariant;
  solid?: boolean;
  className?: string;
  withDot?: boolean;
}

export function Pill({
  children,
  variant = "default",
  solid = false,
  className = "",
  withDot = false,
}: PillProps) {
  const cls = [
    "pill",
    variant !== "default" ? variant : "",
    solid ? "solid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      {withDot && <span className="dot" />}
      {children}
    </span>
  );
}
