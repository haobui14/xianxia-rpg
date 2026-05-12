import React from "react";

export type SealVariant = "cinnabar" | "ink" | "jade" | "ghost";
export type SealSize = "sm" | "md" | "lg";

export interface SealProps {
  children: React.ReactNode;
  variant?: SealVariant;
  size?: SealSize;
  className?: string;
  style?: React.CSSProperties;
}

export function Seal({
  children,
  variant = "cinnabar",
  size = "md",
  className = "",
  style,
}: SealProps) {
  const sizeCls = size === "sm" ? "sm" : size === "lg" ? "lg" : "";
  const variantCls =
    variant === "ink"
      ? "seal-ink"
      : variant === "ghost"
        ? "seal-ghost"
        : variant === "jade"
          ? "seal-jade"
          : "";
  const cls = ["seal", sizeCls, variantCls, className].filter(Boolean).join(" ");
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
