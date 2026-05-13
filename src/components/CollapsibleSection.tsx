"use client";

import { useState, ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  /** Extra text/badge displayed inline next to the title */
  badge?: ReactNode;
  /** Whether the section starts expanded (default: true) */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`ink-card ${className}`}
      style={{ overflow: "hidden", marginBottom: 16 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 22px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={isOpen}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2
            className="t-display"
            style={{
              fontSize: 20,
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1.1,
              fontWeight: 500,
            }}
          >
            {title}
          </h2>
          {badge && (
            <span
              className="label"
              style={{ color: "var(--ink-mute)", fontSize: 11 }}
            >
              {badge}
            </span>
          )}
        </div>
        <span
          className="t-han"
          style={{
            color: "var(--cinnabar)",
            fontSize: 16,
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(0)" : "rotate(-90deg)",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      <div
        style={{
          transition: "all 0.3s ease-in-out",
          maxHeight: isOpen ? "5000px" : 0,
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0 22px 22px",
            borderTop: isOpen ? "1px solid var(--line-soft)" : "none",
            paddingTop: isOpen ? 16 : 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
