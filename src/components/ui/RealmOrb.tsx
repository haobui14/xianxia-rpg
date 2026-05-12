import React from "react";

export interface RealmOrbProps {
  han: React.ReactNode;
  name: string;
  stage: number;
  stageMax: number;
  progress: number;
  breathe?: boolean;
  size?: number;
}

export function RealmOrb({
  han,
  name,
  stage,
  stageMax,
  progress,
  breathe = true,
  size = 168,
}: RealmOrbProps) {
  const cx = 84;
  const cy = 84;
  const r = 72;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  const off = c * (1 - pct / 100);
  const safeMax = Math.max(stageMax, 1);
  const ticks = Array.from({ length: safeMax }, (_, i) => i);
  return (
    <div
      className={breathe ? "realm-orb breathe" : "realm-orb"}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 168 168">
        <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="var(--line)" strokeWidth="1" />
        {ticks.map((i) => {
          const a = (i / safeMax) * 2 * Math.PI - Math.PI / 2;
          const x1 = cx + Math.cos(a) * (r + 4);
          const y1 = cy + Math.sin(a) * (r + 4);
          const x2 = cx + Math.cos(a) * (r + 12);
          const y2 = cy + Math.sin(a) * (r + 12);
          const filled = i < stage;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={filled ? "var(--cinnabar)" : "var(--line-strong)"}
              strokeWidth={filled ? 2.2 : 1}
            />
          );
        })}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--paper-deep)"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--jade)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r - 8}
          fill="none"
          stroke="var(--jade-soft)"
          strokeWidth="0.5"
          opacity="0.4"
          strokeDasharray="3 5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r - 18}
          fill="none"
          stroke="var(--jade-soft)"
          strokeWidth="0.5"
          opacity="0.3"
          strokeDasharray="2 7"
        />
      </svg>
      <div className="center">
        <div className="han">{han}</div>
        <div className="stage">
          {name} · {stage}/{stageMax}
        </div>
        <div className="pct">{Math.round(pct)}%</div>
      </div>
    </div>
  );
}
