import React from "react";

export interface MeridianDot {
  id: string;
  name: string;
  flow: number;
  open: boolean;
}

export interface MeridianStripProps {
  meridians: MeridianDot[];
}

export function MeridianStrip({ meridians }: MeridianStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(meridians.length, 1)}, 1fr)`,
        gap: 8,
      }}
    >
      {meridians.map((m) => (
        <div key={m.id} style={{ textAlign: "center" }}>
          <div
            style={{
              width: 28,
              height: 28,
              margin: "0 auto",
              borderRadius: "50%",
              background: m.open
                ? `conic-gradient(var(--jade) ${m.flow * 360}deg, var(--paper-darker) 0)`
                : "var(--paper-darker)",
              border: "1px solid " + (m.open ? "var(--jade-deep)" : "var(--line)"),
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 4,
                borderRadius: "50%",
                background: "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: m.open ? "var(--jade-deep)" : "var(--ink-faint)",
                fontFamily: "var(--font-ui), Inter, sans-serif",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
              }}
            >
              {Math.round(m.flow * 100)}
            </div>
          </div>
          <div
            className="label"
            style={{ fontSize: 9, marginTop: 4, letterSpacing: "0.1em" }}
          >
            {m.name}
          </div>
        </div>
      ))}
    </div>
  );
}
