// ============================================================
// XIANXIA — Cultivator Rail (persistent left pane)
// ============================================================

function CultivatorRail({ state, onTabChange }) {
  const { character: ch, resources, time, activity } = state;
  const rarity = { common: "var(--rarity-common)", uncommon: "var(--rarity-uncommon)", rare: "var(--rarity-rare)", epic: "var(--rarity-epic)", legendary: "var(--rarity-legendary)" };

  return (
    <aside className="rail" style={{
      position: "sticky", top: 16,
      display: "flex", flexDirection: "column", gap: 18,
    }}>
      {/* Name plate */}
      <Card padding={20} className="card-corner">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 56, height: 72,
            border: "1.5px solid var(--ink)",
            background: "var(--paper-deep)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span className="t-han" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>李</span>
            <span className="t-han" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1, marginTop: 2 }}>無</span>
            <span className="t-han" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1, marginTop: 2 }}>心</span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="t-display" style={{ fontSize: 22, lineHeight: 1.1 }}>{ch.name}</div>
            <div className="faint" style={{ fontSize: 12, fontStyle: "italic" }}>{ch.title}</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              <Pill variant="cinnabar"><span className="t-han" style={{ fontSize: 13, letterSpacing: 0 }}>{ch.realm.han}</span> {ch.realm.stage}</Pill>
              <Pill variant="jade">Age {ch.age}</Pill>
            </div>
          </div>
        </div>
        <div className="hr-soft" style={{ margin: "14px 0 12px" }} />
        <div className="label" style={{ marginBottom: 4 }}>Linh Căn</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>{ch.spiritRoot}</div>
      </Card>

      {/* Realm orb */}
      <Card padding={20}>
        <RealmOrb han={ch.realm.han} name={ch.realm.name} stage={ch.realm.stage} stageMax={ch.realm.stageMax} progress={ch.realm.progress} />
        <div className="hr-soft" style={{ margin: "14px 0 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label">Cảnh Giới Kế Tiếp</div>
          <button className="btn ghost sm">Xem</button>
        </div>
        <div className="t-display" style={{ fontSize: 16, marginTop: 4, lineHeight: 1.2 }}>
          <span className="t-han" style={{ fontSize: 16, color: "var(--cinnabar-deep)", marginRight: 8, letterSpacing: 0 }}>{ch.realm.nextHan}</span>
          {ch.realm.next}
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 2, fontStyle: "italic" }}>Còn {100 - ch.realm.progress}% nữa là có thể đột phá</div>
      </Card>

      {/* Vital stats */}
      <Card padding={20}>
        <SmallHead right={<button className="btn ghost sm" onClick={() => onTabChange?.("character")}>Tu Sĩ →</button>}>Sinh Lực</SmallHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Bar kind="hp"   label="Khí Huyết" value={ch.stats.hp}      max={ch.stats.hpMax} />
          <Bar kind="qi"   label="Linh Lực"  value={ch.stats.qi}      max={ch.stats.qiMax} />
          <Bar kind="stam" label="Thể Lực"   value={ch.stats.stamina} max={ch.stats.staminaMax} />
        </div>
        <div className="hr-soft" style={{ margin: "14px 0 12px" }} />
        <SmallHead>Luyện Thể</SmallHead>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}>
            <span className="t-han" style={{ fontSize: 14, color: "var(--cinnabar-deep)", marginRight: 6 }}>{ch.bodyRealm.han}</span>
            {ch.bodyRealm.name} · {ch.bodyRealm.stage}
          </span>
          <span className="t-num faint" style={{ fontSize: 11 }}>{ch.bodyRealm.progress}%</span>
        </div>
        <div className="bar exp" style={{ marginTop: 6 }}><div className="fill" style={{ width: `${ch.bodyRealm.progress}%` }} /></div>
      </Card>

      {/* Current activity */}
      {activity && (
        <Card padding={20} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
          <span className="han-bg" style={{ fontSize: 110, right: -10, bottom: -34, lineHeight: 0.9 }}>{activity.han}</span>
          <SmallHead right={<button className="btn ghost sm">Dừng</button>}>Đang Tiến Hành</SmallHead>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span className="t-han" style={{ fontSize: 28, color: "var(--cinnabar)" }}>{activity.han}</span>
            <div>
              <div className="t-display" style={{ fontSize: 17 }}>{activity.type}</div>
              <div className="faint" style={{ fontSize: 11 }}>Còn {activity.segmentsLeft} / {activity.segmentsTotal} canh giờ</div>
            </div>
          </div>
          <div className="bar qi"><div className="fill" style={{ width: `${activity.progress * 100}%` }} /></div>
          <div className="hr-soft" style={{ margin: "12px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 10px", fontSize: 11 }}>
            <div className="faint">Công Pháp</div><div className="t-num" style={{ color: "var(--jade-deep)" }}>×{activity.bonuses.technique.toFixed(2)}</div>
            <div className="faint">Địa Lợi</div><div className="t-num" style={{ color: "var(--jade-deep)" }}>×{activity.bonuses.location.toFixed(2)}</div>
            <div className="faint">Thiên Thời</div><div className="t-num" style={{ color: "var(--jade-deep)" }}>×{activity.bonuses.season.toFixed(2)}</div>
            <div style={{ color: "var(--ink)", fontWeight: 500 }}>Tổng</div><div className="t-num" style={{ color: "var(--cinnabar-deep)", fontWeight: 600 }}>×{activity.bonuses.total.toFixed(2)}</div>
          </div>
        </Card>
      )}

      {/* Resources */}
      <Card padding={16}>
        <SmallHead>Tài Vật</SmallHead>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <Resource glyph="銀" amount={resources.silver}       label="Bạc"        variant="silver" />
          <Resource glyph="靈" amount={resources.spiritStones} label="Linh Thạch" variant="stone" />
          <Resource glyph="功" amount={resources.contribution} label="Cống Hiến"  variant="default" />
        </div>
      </Card>
    </aside>
  );
}

window.CultivatorRail = CultivatorRail;
