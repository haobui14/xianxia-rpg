// ============================================================
// XIANXIA — shared components
// ============================================================

const { useState, useEffect, useRef, useMemo, Fragment } = React;

// Bar — horizontal stat bar with label, numbers, color variant
function Bar({ label, kind = "exp", value, max, showNums = true, sub }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-wrap" style={{ marginBottom: 4 }}>
      {(label || showNums) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span className="label" style={{ fontSize: 10 }}>{label}{sub && <span className="faint" style={{marginLeft:6, letterSpacing:0}}>{sub}</span>}</span>
          {showNums && (
            <span className="t-num" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {value}<span className="faint"> / {max}</span>
            </span>
          )}
        </div>
      )}
      <div className={`bar ${kind}`}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Pill
function Pill({ children, variant = "default", solid = false }) {
  const cls = ["pill", variant !== "default" ? variant : "", solid ? "solid" : ""].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

// Seal — square cinnabar stamp
function Seal({ children, variant = "cinnabar", size = "" }) {
  const cls = ["seal", size, variant === "ink" ? "seal-ink" : variant === "ghost" ? "seal-ghost" : variant === "jade" ? "seal-jade" : ""].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

// SectionHead — brush rule + han title + english subtitle
function SectionHead({ han, title, subtitle, right }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          {han && <span className="t-han" style={{ fontSize: 28, color: "var(--cinnabar)", lineHeight: 1, letterSpacing: 2 }}>{han}</span>}
          <div>
            <div className="t-display" style={{ fontSize: 26, lineHeight: 1.05, fontWeight: 500 }}>{title}</div>
            {subtitle && <div className="label" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
      <div className="brush-rule" />
    </div>
  );
}

// SmallHead
function SmallHead({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div className="label">{children}</div>
      {right}
    </div>
  );
}

// Card
function Card({ children, className = "", padding = 20, deep = false, style = {} }) {
  const cls = ["card", deep ? "card-deep" : "", className].filter(Boolean).join(" ");
  return <div className={cls} style={{ padding, ...style }}>{children}</div>;
}

// Realm Orb — circular SVG with stage ticks and qi flow
function RealmOrb({ han, name, stage, stageMax, progress }) {
  const r = 72;
  const cx = 84, cy = 84;
  const c = 2 * Math.PI * r;
  const off = c * (1 - progress / 100);
  const ticks = Array.from({ length: stageMax }, (_, i) => i);
  return (
    <div className="realm-orb breathe">
      <svg viewBox="0 0 168 168">
        {/* outer ring */}
        <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="var(--line)" strokeWidth="1" />
        {/* stage ticks */}
        {ticks.map((i) => {
          const a = (i / stageMax) * 2 * Math.PI - Math.PI / 2;
          const x1 = cx + Math.cos(a) * (r + 4);
          const y1 = cy + Math.sin(a) * (r + 4);
          const x2 = cx + Math.cos(a) * (r + 12);
          const y2 = cy + Math.sin(a) * (r + 12);
          const filled = i < stage;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={filled ? "var(--cinnabar)" : "var(--line-strong)"} strokeWidth={filled ? 2.2 : 1} />;
        })}
        {/* base ring */}
        <circle cx={cx} cy={cy} r={r} fill="var(--paper-deep)" stroke="var(--ink)" strokeWidth="1.5" />
        {/* progress arc */}
        <circle cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--jade)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        {/* inner texture - subtle qi swirl */}
        <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke="var(--jade-soft)" strokeWidth="0.5" opacity="0.4" strokeDasharray="3 5" />
        <circle cx={cx} cy={cy} r={r - 18} fill="none" stroke="var(--jade-soft)" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 7" />
      </svg>
      <div className="center">
        <div className="han">{han}</div>
        <div className="stage">{name} · {stage}/{stageMax}</div>
        <div className="pct">{progress}%</div>
      </div>
    </div>
  );
}

// Meridian dot diagram (compact)
function MeridianStrip({ meridians }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
      {meridians.map((m) => (
        <div key={m.id} style={{ textAlign: "center" }}>
          <div style={{
            width: 28, height: 28, margin: "0 auto",
            borderRadius: "50%",
            background: m.open ? `conic-gradient(var(--jade) ${m.flow * 360}deg, var(--paper-darker) 0)` : "var(--paper-darker)",
            border: "1px solid " + (m.open ? "var(--jade-deep)" : "var(--line)"),
            position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 4, borderRadius: "50%",
              background: "var(--paper)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: m.open ? "var(--jade-deep)" : "var(--ink-faint)",
              fontFamily: "var(--font-num)", fontWeight: 600,
            }}>{Math.round(m.flow * 100)}</div>
          </div>
          <div className="label" style={{ fontSize: 9, marginTop: 4, letterSpacing: "0.1em" }}>{m.name}</div>
        </div>
      ))}
    </div>
  );
}

// Item slot — used in inventory + market grids
function ItemSlot({ item, onClick, selected = false, showQty = true, showLvl = true }) {
  if (!item) return <div className="slot empty"><span style={{ fontSize: 12 }}>·</span></div>;
  return (
    <div className={`slot rare-${item.rarity || "common"} ${selected ? "selected" : ""}`} onClick={onClick} title={item.name}>
      <div className="rarity-edge" />
      <span className="glyph">{item.glyph}</span>
      {showLvl && item.lvl && <span className="lvl">{item.lvl}</span>}
      {showQty && item.qty && item.qty > 1 && <span className="qty">{item.qty}</span>}
    </div>
  );
}

// Resource counter (silver / spirit stones / contribution)
function Resource({ glyph, amount, label, variant = "default" }) {
  const accent = variant === "silver" ? "var(--gold-deep)" : variant === "stone" ? "var(--jade-deep)" : "var(--cinnabar-deep)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="t-han" style={{ fontSize: 18, color: accent, lineHeight: 1 }}>{glyph}</span>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span className="t-num" style={{ fontSize: 14, color: "var(--ink)" }}>{amount.toLocaleString()}</span>
        <span className="label" style={{ fontSize: 9, marginTop: 2 }}>{label}</span>
      </div>
    </div>
  );
}

// Tooltip text (used for stat names)
function Stat({ label, value, icon }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: "1px dotted var(--line)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-soft)", fontSize: 13 }}>
        {icon && <span className="t-han" style={{ fontSize: 14, color: "var(--cinnabar-deep)" }}>{icon}</span>}
        {label}
      </span>
      <span className="t-num" style={{ fontSize: 14, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

// Make available globally
Object.assign(window, {
  Bar, Pill, Seal, SectionHead, SmallHead, Card,
  RealmOrb, MeridianStrip, ItemSlot, Resource, Stat,
});
