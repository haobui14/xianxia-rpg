// ============================================================
// XIANXIA — Screens, part 1 (Game, Character) — Tiếng Việt
// ============================================================

// ---------- GAME (narrative + choices) ----------
function GameScreen({ state, onChoice }) {
  const { narrative, choices, time, activity, character: ch } = state;
  const [custom, setCustom] = useState("");

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Time + setting strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Seal variant="ink" size="lg">境</Seal>
          <div>
            <div className="label">Cảnh Hiện Tại</div>
            <div className="t-display" style={{ fontSize: 26, lineHeight: 1.1 }}>Nam Đài — Bích Vân Các</div>
            <div className="faint" style={{ fontSize: 13, fontStyle: "italic" }}>{ch.sect} — viện ngoài</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div className="label">Thời Gian</div>
            <div className="t-display" style={{ fontSize: 16 }}>
              Năm {time.year} · Tháng {time.month} · Ngày {time.day}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>{time.segmentName} · {time.season}</div>
          </div>
          <div style={{
            width: 44, height: 44,
            borderRadius: "50%",
            border: "1.5px solid var(--ink)",
            background: "var(--paper-deep)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, color: "var(--gold-deep)",
          }}>{time.icon}</div>
        </div>
      </div>

      {/* Narrative — paper card */}
      <div style={{ position: "relative" }}>
        <Card padding={36} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
          <span className="han-bg" style={{ fontSize: 220, right: -20, bottom: -80, lineHeight: 0.85 }}>道</span>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <Seal>章</Seal>
            <div>
              <div className="label">Chương Hai Mươi Tư</div>
              <div className="t-display" style={{ fontSize: 20, lineHeight: 1 }}>Một Sợi Linh Khí Lạnh</div>
            </div>
          </div>

          <div className="brush-rule" style={{ marginBottom: 22, maxWidth: 280 }} />

          {/* drop cap */}
          <div style={{ position: "relative" }}>
            <span style={{
              float: "left",
              fontFamily: "var(--font-han)",
              fontSize: 78,
              lineHeight: 0.85,
              color: "var(--cinnabar)",
              marginRight: 14,
              marginTop: 4,
              marginBottom: -4,
            }}>霧</span>
            <p className="t-body" style={{ fontSize: 17, lineHeight: 1.75, color: "var(--ink)", margin: 0, textWrap: "pretty" }}>
              {narrative}
            </p>
          </div>

          <div className="hr-soft" style={{ margin: "22px 0 14px" }} />
          <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-ui)", letterSpacing: "0.06em" }}>
            <span><span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)", marginRight: 6 }}>處</span>Nam Đài</span>
            <span><span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)", marginRight: 6 }}>時</span>{time.segmentName}</span>
            <span><span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)", marginRight: 6 }}>氣</span>Bất An</span>
          </div>
        </Card>
      </div>

      {/* Choices */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className="t-han" style={{ fontSize: 22, color: "var(--cinnabar)" }}>抉</span>
            <span className="t-display" style={{ fontSize: 20 }}>Lựa Chọn Của Ngươi</span>
            <span className="label">chọn một con đường</span>
          </div>
          <span className="faint" style={{ fontSize: 12, fontStyle: "italic" }}>mỗi lựa chọn tiêu hao một phần ngày</span>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {choices.map((c) => {
            const cost = c.cost || {};
            const cantQi   = cost.qi      && state.character.stats.qi      < cost.qi;
            const cantStam = cost.stamina && state.character.stats.stamina < cost.stamina;
            const cantSilv = cost.silver  && state.resources.silver        < cost.silver;
            const cant = cantQi || cantStam || cantSilv;
            return (
              <button key={c.id}
                className={"choice " + (cant ? "cant-afford" : "")}
                onClick={() => !cant && onChoice?.(c.id)}>
                <span className="ord">{c.ord}</span>
                <div>{c.text}</div>
                {(cost.qi || cost.stamina || cost.silver || cost.time) && (
                  <div className="cost">
                    {cost.qi      && <span className={"c-item " + (cantQi   ? "out" : "")}>氣 Linh Lực {cost.qi}</span>}
                    {cost.stamina && <span className={"c-item " + (cantStam ? "out" : "")}>力 Thể Lực {cost.stamina}</span>}
                    {cost.silver  && <span className={"c-item " + (cantSilv ? "out" : "")}>銀 Bạc {cost.silver}</span>}
                    {cost.time    && <span className="c-item">時 {cost.time} canh giờ</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom action */}
        <div style={{
          marginTop: 14, padding: "14px 16px",
          background: "var(--paper-deep)",
          border: "1px dashed var(--line-strong)",
          borderRadius: 3,
        }}>
          <div className="label" style={{ marginBottom: 8 }}>或 — Tự Nói Hành Động Riêng</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Nói ra một con đường mà thiên cơ chưa hé lộ…"
              style={{
                flex: 1, padding: "10px 14px",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontStyle: "italic",
                borderRadius: 2,
                outline: "none",
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChoice?.("custom"); setCustom(""); } }}
            />
            <button className="btn primary" disabled={!custom.trim()}>Khắc Lên</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- CHARACTER SHEET ----------
function CharacterScreen({ state }) {
  const { character: ch } = state;
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead han="身" title="Bảng Tu Sĩ" subtitle="Thân — Tâm — Pháp" right={
        <div style={{ display: "flex", gap: 8 }}>
          <Pill variant="cinnabar"><span className="t-han" style={{fontSize:12}}>{ch.realm.han}</span> {ch.realm.stage}/{ch.realm.stageMax}</Pill>
          <Pill variant="jade">{ch.realm.progress}% đến cảnh kế</Pill>
        </div>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 18 }}>
        {/* Realm progression */}
        <Card padding={24}>
          <SmallHead>Song Tu Pháp Lộ</SmallHead>
          <div style={{ marginTop: 8 }}>
            <RealmOrb han={ch.realm.han} name={ch.realm.name} stage={ch.realm.stage} stageMax={ch.realm.stageMax} progress={ch.realm.progress} />
          </div>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          {/* Body realm */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div className="label">Thân Cảnh</div>
              <div style={{ fontSize: 15, marginTop: 3 }}>
                <span className="t-han" style={{ fontSize: 16, color: "var(--cinnabar-deep)", marginRight: 6 }}>{ch.bodyRealm.han}</span>
                {ch.bodyRealm.name}
              </div>
            </div>
            <div className="t-num faint">tầng {ch.bodyRealm.stage}</div>
          </div>
          <div className="bar exp" style={{ marginTop: 8 }}><div className="fill" style={{ width: `${ch.bodyRealm.progress}%` }} /></div>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          {/* Realm timeline */}
          <div className="label" style={{ marginBottom: 10 }}>Đại Đạo Thăng Tiến</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { han: "凡人", name: "Phàm Nhân",  state: "past" },
              { han: "練氣", name: "Luyện Khí",  state: "current", sub: `tầng ${ch.realm.stage}/${ch.realm.stageMax}` },
              { han: "築基", name: "Trúc Cơ",    state: "next" },
              { han: "結丹", name: "Kết Đan",    state: "locked" },
              { han: "元嬰", name: "Nguyên Anh", state: "locked" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: r.state === "locked" ? 0.4 : 1 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: r.state === "current" ? "var(--cinnabar)" : r.state === "past" ? "var(--ink)" : "transparent",
                  border: "1.5px solid " + (r.state === "current" ? "var(--cinnabar)" : "var(--ink-soft)"),
                  flexShrink: 0,
                }} />
                <span className="t-han" style={{ fontSize: 16, color: r.state === "current" ? "var(--cinnabar-deep)" : "var(--ink)" }}>{r.han}</span>
                <span style={{ fontSize: 13, color: "var(--ink-soft)", flex: 1 }}>{r.name}</span>
                {r.sub && <span className="t-num faint" style={{ fontSize: 11 }}>{r.sub}</span>}
              </div>
            ))}
          </div>
        </Card>

        {/* Attributes */}
        <Card padding={24}>
          <SmallHead right={<Pill>linh căn +2 ngộ tính</Pill>}>Lục Diện Thuộc Tính</SmallHead>
          <div style={{ marginTop: 6 }}>
            <Stat icon="力" label="Lực Lượng"     value={ch.attrs.strength} />
            <Stat icon="敏" label="Nhanh Nhẹn"    value={ch.attrs.agility} />
            <Stat icon="體" label="Thể Phách"     value={ch.attrs.constitution} />
            <Stat icon="覺" label="Ngộ Tính"      value={ch.attrs.perception} />
            <Stat icon="志" label="Tâm Cảnh"      value={ch.attrs.willpower} />
            <Stat icon="儀" label="Khí Chất"      value={ch.attrs.charisma} />
          </div>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          <SmallHead>Sinh Lực</SmallHead>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            <Bar kind="hp"   label="Khí Huyết"   value={ch.stats.hp}      max={ch.stats.hpMax} />
            <Bar kind="qi"   label="Linh Lực"    value={ch.stats.qi}      max={ch.stats.qiMax} />
            <Bar kind="stam" label="Thể Lực"     value={ch.stats.stamina} max={ch.stats.staminaMax} />
          </div>
        </Card>

        {/* Meridians */}
        <Card padding={24}>
          <SmallHead right={<button className="btn ghost sm">Mở</button>}>Kinh Mạch Đồ</SmallHead>
          <div style={{ marginTop: 12 }}>
            <MeridianStrip meridians={ch.meridians} />
          </div>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          <div className="label" style={{ marginBottom: 8 }}>Khí Lưu Tâm Đắc</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0, fontStyle: "italic" }}>
            Trong sáu kinh, năm đã thông. Tỳ kinh vẫn trì trệ — cản trở công pháp Thổ thuộc. Đốc kinh có thể khai sau lần đột phá kế tiếp.
          </p>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          <SmallHead>Vị Thế Trong Môn Phái</SmallHead>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <div>
              <div style={{ fontSize: 15 }}>{state.sect.rank}</div>
              <div className="faint" style={{ fontSize: 11 }}>{state.sect.name}</div>
            </div>
            <Pill variant="cinnabar"><span className="dot" />{state.sect.repRank}</Pill>
          </div>
          <div className="bar exp" style={{ marginTop: 8 }}><div className="fill" style={{ width: `${state.sect.rankProgress}%` }} /></div>
        </Card>
      </div>

      {/* Abilities */}
      <Card padding={24}>
        <SmallHead right={<button className="btn ghost sm">Quản Lý Công Pháp</button>}>Công Pháp · Đã Trang Bị</SmallHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {ch.abilities.map((a, i) => (
            <div key={a.id} style={{
              position: "relative",
              padding: 16,
              border: "1px solid var(--line)",
              background: "var(--paper-deep)",
              borderRadius: 3,
            }}>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <span className="t-num faint" style={{ fontSize: 10 }}>F{i+1}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className="t-han" style={{ fontSize: 26, color: "var(--cinnabar)", lineHeight: 1 }}>{a.han}</span>
                <div>
                  <div className="t-display" style={{ fontSize: 15, lineHeight: 1.1 }}>{a.name}</div>
                  <div className="label" style={{ fontSize: 9, marginTop: 2 }}>{a.type}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                <span className="t-num" style={{ color: "var(--jade-deep)" }}>氣 {a.qi}</span>
                <span className="t-num faint">Hồi {a.cd}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.GameScreen = GameScreen;
window.CharacterScreen = CharacterScreen;
