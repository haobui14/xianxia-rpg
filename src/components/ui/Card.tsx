import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: number | string;
  deep?: boolean;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  padding = 20,
  deep = false,
  style,
}: CardProps) {
  const cls = ["ink-card", deep ? "card-deep" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ padding, ...style }}>
      {children}
    </div>
  );
}
