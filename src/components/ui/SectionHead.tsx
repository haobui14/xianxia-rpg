import React from "react";

export interface SectionHeadProps {
  han?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHead({ han, title, subtitle, right }: SectionHeadProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          {han && (
            <span
              className="t-han"
              style={{
                fontSize: 28,
                color: "var(--cinnabar)",
                lineHeight: 1,
                letterSpacing: 2,
              }}
            >
              {han}
            </span>
          )}
          <div>
            <div
              className="t-display"
              style={{ fontSize: 26, lineHeight: 1.05, fontWeight: 500 }}
            >
              {title}
            </div>
            {subtitle && (
              <div className="label" style={{ marginTop: 4 }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {right}
      </div>
      <div className="brush-rule" />
    </div>
  );
}

export interface SmallHeadProps {
  children: React.ReactNode;
  right?: React.ReactNode;
}

export function SmallHead({ children, right }: SmallHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <div className="label">{children}</div>
      {right}
    </div>
  );
}
