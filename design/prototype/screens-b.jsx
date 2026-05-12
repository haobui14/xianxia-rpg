// ============================================================
// XIANXIA — Screens, part 2 (Inventory, Market, World, Sect, Combat) — Tiếng Việt
// ============================================================

const RARITY_VI = {
  common:    "Phàm Phẩm",
  uncommon:  "Hạ Phẩm",
  rare:      "Trung Phẩm",
  epic:      "Thượng Phẩm",
  legendary: "Cực Phẩm",
};

// ---------- INVENTORY ----------
function InventoryScreen({ state }) {
  const { inventory, equipment } = state;
  const [selected, setSelected] = useState(inventory[2]);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? inventory : inventory.filter((i) => i.type === filter);

  const filters = [
    { id: "all",        han: "全", label: "Tất Cả" },
    { id: "weapon",     han: "兵", label: "Vũ Khí" },
    { id: "armor",      han: "甲", label: "Hộ Giáp" },
    { id: "pill",       han: "丹", label: "Đan Dược" },
    { id: "talisman",   han: "符", label: "Phù Lục" },
    { id: "manual",     han: "經", label: "Công Pháp" },
    { id: "ingredient", han: "藥", label: "Linh Dược" },
    { id: "material",   han: "材", label: "Vật Liệu" },
  ];

  const slots = [
    { id: "head",  han: "首", label: "Đầu",   item: equipment.head },
    { id: "chest", han: "袍", label: "Thân",  item: equipment.chest },
    { id: "hand",  han: "手", label: "Tay",   item: equipment.hand },
    { id: "waist", han: "腰", label: "Lưng",  item: equipment.waist },
    { id: "leg",   han: "腿", label: "Chân",  item: equipment.leg },
    { id: "foot",  han: "履", label: "Giày",  item: equipment.foot },
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead han="物" title="Túi Đồ Trữ Vật" subtitle="Pháp bảo · linh dược · vật phẩm thế gian" right={
        <div style={{ display: "flex", gap: 10 }}>
          <Pill variant="gold"><span className="dot" />{inventory.length} / 64 ô</Pill>
          <button className="btn ghost sm">Sắp Xếp</button>
        </div>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        {/* Items grid */}
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {filters.map((f) => (
              <button key={f.id}
                onClick={() => setFilter(f.id)}
                className="pill"
                style={{
                  cursor: "pointer",
                  background: filter === f.id ? "var(--ink)" : "transparent",
                  color: filter === f.id ? "var(--paper)" : "var(--ink-soft)",
                  borderColor: filter === f.id ? "var(--ink)" : "var(--line-strong)",
                }}>
                <span className="t-han" style={{ fontSize: 12, marginRight: 2, color: filter === f.id ? "var(--paper)" : "var(--cinnabar)" }}>{f.han}</span>
                {f.label}
              </button>
            ))}
          </div>

          <Card padding={20}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
              {filtered.map((it) => (
                <ItemSlot key={it.id} item={it} selected={selected?.id === it.id} onClick={() => setSelected(it)} />
              ))}
              {Array.from({ length: Math.max(0, 32 - filtered.length) }).map((_, i) => (
                <ItemSlot key={"e" + i} item={null} />
              ))}
            </div>
            <div className="hr-soft" style={{ margin: "16px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="faint" style={{ fontSize: 12, fontStyle: "italic" }}>Di chuột để xem · kéo thả để sắp lại</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill><span className="dot" style={{background:"var(--rarity-uncommon)"}} />Hạ Phẩm</Pill>
                <Pill><span className="dot" style={{background:"var(--rarity-rare)"}} />Trung Phẩm</Pill>
                <Pill><span className="dot" style={{background:"var(--rarity-epic)"}} />Thượng Phẩm</Pill>
                <Pill><span className="dot" style={{background:"var(--rarity-legendary)"}} />Cực Phẩm</Pill>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card padding={20}>
            <SmallHead right={<Pill variant="jade">+12% Hồi Linh</Pill>}>Trang Bị Đang Mang</SmallHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
              {slots.map((s) => (
                <div key={s.id} style={{ textAlign: "center" }}>
                  <ItemSlot item={s.item} />
                  <div className="label" style={{ marginTop: 6, fontSize: 9 }}>
                    <span className="t-han" style={{ fontSize: 11, color: "var(--cinnabar-deep)", marginRight: 4, letterSpacing: 0 }}>{s.han}</span>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {selected && (
            <Card padding={24} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
              <span className="han-bg" style={{ fontSize: 180, right: -30, bottom: -60, lineHeight: 0.85 }}>{selected.glyph}</span>

              <div style={{ display: "flex", gap: 14 }}>
                <ItemSlot item={selected} showQty={false} showLvl={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-display" style={{ fontSize: 20, lineHeight: 1.1 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2, fontStyle: "italic" }}>
                    <span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)", marginRight: 6 }}>{selected.han}</span>
                    {selected.type} · <span style={{ color: `var(--rarity-${selected.rarity})`, fontStyle: "normal" }}>{RARITY_VI[selected.rarity]}</span>
                  </div>
                </div>
                {selected.lvl && <Pill variant="gold">{selected.lvl}</Pill>}
              </div>

              <div className="hr-soft" style={{ margin: "16px 0" }} />

              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0, fontStyle: "italic" }}>
                {selected.type === "weapon"
                  ? "Một thanh đao cong rèn từ vân thiết tầng tầng. Lưỡi đao ngâm rung khi rút ra dưới trời lạnh."
                  : selected.type === "manual"
                  ? "Cửu Tâm Kinh, truyền rằng đan chín đường tinh thần thành một mũi ý chí."
                  : selected.type === "pill"
                  ? "Một viên đan luyện từ thảo dược, được hỏa hậu nung vào da thịt và xương cốt."
                  : "Vật trữ trong túi đồ."}
              </p>

              <div className="hr-soft" style={{ margin: "16px 0" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 13 }}>
                <span className="faint">Sát thương</span><span className="t-num">{selected.type === "weapon" ? "+38 sắc" : "—"}</span>
                <span className="faint">Thuộc linh</span><span className="t-num" style={{ color: "var(--jade-deep)" }}>Thủy · Phong</span>
                <span className="faint">Hấp thụ</span><span>{selected.type === "weapon" ? "Khế hồn" : "Tự do"}</span>
                <span className="faint">Giá trị</span><span className="t-num">{(selected.rarity === "legendary" ? 9999 : selected.rarity === "epic" ? 1280 : 320).toLocaleString()} bạc</span>
              </div>

              <div className="hr-soft" style={{ margin: "16px 0" }} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary">{selected.type === "weapon" || selected.type === "armor" ? "Trang Bị" : selected.type === "pill" || selected.type === "consumable" ? "Dùng" : "Sử Dụng"}</button>
                <button className="btn ghost">Khắc Trận</button>
                <button className="btn ghost">Vứt Đi</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- MARKET ----------
function MarketScreen({ state }) {
  const { market, resources } = state;
  const [tab, setTab] = useState("buy");
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead han="市" title="Chợ Linh Vật" subtitle="Nơi tiền bạc và nhân quả trao tay" right={
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Resource glyph="銀" amount={resources.silver} label="Bạc" variant="silver" />
          <Resource glyph="靈" amount={resources.spiritStones} label="Linh Thạch" variant="stone" />
          <button className="btn ghost sm">Làm Mới — 50 bạc</button>
        </div>
      } />

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)" }}>
        {[
          { id: "buy",      han: "買", label: "Mua" },
          { id: "sell",     han: "賣", label: "Bán" },
          { id: "exchange", han: "兌", label: "Đổi" },
        ].map((t) => (
          <button key={t.id} className={"tab " + (tab === t.id ? "active" : "")} onClick={() => setTab(t.id)}>
            <span className="han">{t.han}</span>{t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", paddingRight: 12, gap: 10 }}>
          <span className="faint" style={{ fontSize: 12 }}>Quầy hàng đổi mới mỗi 3 ngày</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {market.map((m) => (
          <Card key={m.id} padding={16} style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <ItemSlot item={m} showQty={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div className="t-display" style={{ fontSize: 17, lineHeight: 1.15 }}>{m.name}</div>
                <span className="t-num" style={{ fontSize: 16, color: "var(--gold-deep)" }}>{m.price.toLocaleString()}<span className="faint" style={{ fontSize: 11, marginLeft: 4 }}>銀</span></span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)" }}>{m.han}</span>
                <span style={{ fontSize: 12, color: `var(--rarity-${m.rarity})` }}>{RARITY_VI[m.rarity]}</span>
                <span className="faint" style={{ fontSize: 11 }}>· tồn {m.stock}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn primary sm" disabled={resources.silver < m.price}>Mua 1</button>
                <button className="btn ghost sm">Xem Kỹ</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- WORLD MAP ----------
function WorldScreen({ state }) {
  const { world } = state;
  const [hovered, setHovered] = useState(world.regions.find((r) => r.current));

  const dangerVi = (tier) =>
    tier === "Kết Đan" ? "Sát Cảnh" :
    tier === "Trúc Cơ" ? "Cao" :
    tier === "Phàm Tục" ? "Thấp" : "Vừa";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead han="界" title="Thiên Hạ Lục Cảnh" subtitle="Du hành bằng chân, kiếm, hoặc niệm" right={
        <Pill variant="cinnabar"><span className="dot" />Đang ở {world.regions.find((r) => r.current)?.name}</Pill>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: 18 }}>
        <Card padding={0} style={{ position: "relative", aspectRatio: "16 / 10", overflow: "hidden" }}>
          <svg viewBox="0 0 100 62" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <defs>
              <pattern id="paperGrid" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M6 0 H0 V6" fill="none" stroke="var(--line)" strokeWidth="0.1" opacity="0.45"/>
              </pattern>
              <linearGradient id="mountainInk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.45"/>
                <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.05"/>
              </linearGradient>
            </defs>
            <rect width="100" height="62" fill="url(#paperGrid)" />
            <path d="M0 28 Q 18 8 28 16 T 50 12 T 76 20 T 100 14 L 100 0 L 0 0 Z" fill="url(#mountainInk)" opacity="0.55" />
            <path d="M0 38 Q 14 26 24 30 T 52 26 T 80 34 T 100 28 L 100 0 L 0 0 Z" fill="url(#mountainInk)" opacity="0.35" />
            <path d="M0 48 Q 12 40 22 44 T 50 42 T 78 46 T 100 42 L 100 62 L 0 62 Z" fill="url(#mountainInk)" opacity="0.18" transform="scale(1, -1) translate(0, -62)" />
            <path d="M -2 36 Q 20 40 38 46 T 78 50 T 102 48" fill="none" stroke="var(--jade)" strokeWidth="0.35" opacity="0.6" />
            <path d="M -2 36 Q 20 40 38 46 T 78 50 T 102 48" fill="none" stroke="var(--jade)" strokeWidth="0.9" opacity="0.18" />
            {[
              ["bichvancac", "bachtungthon"],
              ["bichvancac", "namtruclam"],
              ["bichvancac", "thietcotbao"],
              ["thietcotbao", "notrieuloan"],
              ["bichvancac", "cuutrungphong"],
            ].map(([a, b], i) => {
              const A = world.regions.find((r) => r.id === a);
              const B = world.regions.find((r) => r.id === b);
              if (!A || !B) return null;
              return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--ink-soft)" strokeWidth="0.15" strokeDasharray="0.6 0.6" opacity="0.7" />;
            })}
          </svg>

          {/* compass */}
          <div style={{ position: "absolute", left: 18, top: 18 }}>
            <svg viewBox="0 0 60 60" width="50" height="50">
              <circle cx="30" cy="30" r="22" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
              <polygon points="30,12 33,30 30,48 27,30" fill="var(--cinnabar)" />
              <text x="30" y="10" textAnchor="middle" fontSize="6" fill="var(--ink)" fontFamily="var(--font-han)">北</text>
              <text x="30" y="58" textAnchor="middle" fontSize="6" fill="var(--ink-soft)" fontFamily="var(--font-han)">南</text>
            </svg>
          </div>

          <span className="han-bg" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontSize: 240, lineHeight: 0.85 }}>界</span>

          {world.regions.map((r) => (
            <button key={r.id}
              className={"region " + (r.current ? "current" : "") + (r.locked ? " locked" : "")}
              style={{ left: `${r.x}%`, top: `${r.y}%`, transform: "translate(-50%, -50%)", background: "none", border: 0, padding: 6 }}
              onMouseEnter={() => setHovered(r)}>
              <span className="pin" />
              <div style={{
                background: "var(--paper)",
                border: "1px solid var(--ink)",
                padding: "3px 8px",
                fontSize: 11,
                fontFamily: "var(--font-ui)",
                whiteSpace: "nowrap",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                <span className="t-han" style={{ fontSize: 12, color: "var(--cinnabar-deep)", marginRight: 4 }}>{r.han}</span>
                {r.name}
              </div>
            </button>
          ))}

          <div style={{
            position: "absolute", right: 18, bottom: 18,
            background: "var(--paper)",
            padding: "5px 10px",
            border: "1px solid var(--line)",
            fontSize: 10,
            fontFamily: "var(--font-ui)",
            letterSpacing: "0.06em",
            color: "var(--ink-soft)",
          }}>
            一 = 三百里 · 1 tấc = 300 lý
          </div>
        </Card>

        {/* Region detail */}
        <Card padding={24} style={{ position: "relative", overflow: "hidden" }}>
          <span className="han-bg" style={{ right: -10, bottom: -40, fontSize: 160, lineHeight: 0.85 }}>{hovered.han[0]}</span>
          <SmallHead>Chi Tiết Vùng</SmallHead>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span className="t-han" style={{ fontSize: 36, color: "var(--cinnabar)", lineHeight: 1 }}>{hovered.han}</span>
            <div>
              <div className="t-display" style={{ fontSize: 22, lineHeight: 1.1 }}>{hovered.name}</div>
              <div className="faint" style={{ fontSize: 12 }}>Vùng cấp {hovered.tier}</div>
            </div>
          </div>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0, fontStyle: "italic" }}>
            {hovered.current
              ? "Ngươi đang đứng trong địa giới này. Linh khí an định, được môn phái che chở, thoang thoảng hương tùng núi."
              : hovered.locked
              ? "Một tầng cấm chế ngăn cản. Phải tiến cảnh giới hoặc mang theo môn phái lệnh mới có thể qua."
              : "Vùng đất có thể đến. Du hành sẽ tiêu hao thể lực và một số canh giờ."}
          </p>
          <div className="hr-soft" style={{ margin: "16px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", fontSize: 12 }}>
            <span className="faint">Phí di hành</span><span className="t-num">{hovered.current ? "—" : "2 canh giờ"}</span>
            <span className="faint">Nguy hiểm</span><span className="t-num" style={{ color: hovered.tier === "Trúc Cơ" || hovered.tier === "Kết Đan" ? "var(--cinnabar-deep)" : "var(--jade-deep)" }}>{dangerVi(hovered.tier)}</span>
            <span className="faint">Gặp gỡ</span><span className="t-num">linh thú · linh thảo</span>
            <span className="faint">Môn phái</span><span className="t-num">{hovered.current ? "Bích Vân" : "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button className="btn primary" disabled={hovered.current || hovered.locked} style={{ flex: 1, justifyContent: "center" }}>
              {hovered.current ? "Đang Ở Đây" : hovered.locked ? "Bị Khóa" : "Du Hành"}
            </button>
            <button className="btn ghost">Suy Bốc</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- SECT ----------
function SectScreen({ state }) {
  const { sect } = state;
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHead han="派" title={sect.name} subtitle={`${sect.rank} · Đệ tử của ${sect.elder}`} right={
        <Pill variant="cinnabar"><span className="dot" />{sect.repRank} · {sect.rep} thanh vọng</Pill>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card padding={28} style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
            <span className="han-bg" style={{ fontSize: 240, left: -20, top: -50, lineHeight: 0.85 }}>派</span>
            <div style={{ position: "relative" }}>
              <span className="t-han" style={{ fontSize: 64, color: "var(--cinnabar)", lineHeight: 1, fontWeight: 600 }}>{sect.han}</span>
              <div className="t-display" style={{ fontSize: 22, marginTop: 6 }}>{sect.name}</div>
              <div className="brush-rule" style={{ margin: "16px auto", maxWidth: 160 }} />
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-soft)", margin: "8px 0 0", fontStyle: "italic" }}>
                "Từ ao lặng, hạc bay lên. Từ cung uốn, tên rời dây. Từ tu sĩ kiên trì, đại đạo hiện hình."
              </p>
              <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>— Khắc Văn Của Khai Tổ</div>
            </div>
          </Card>

          <Card padding={20}>
            <SmallHead right={<button className="btn ghost sm">Tiêu Cống Hiến</button>}>Thân Phận Đệ Tử</SmallHead>
            <div style={{ marginTop: 8 }}>
              <Stat label="Cấp Bậc"        value={sect.rank} />
              <Stat label="Thanh Vọng"     value={`+${sect.rep}`} />
              <Stat label="Cống Hiến"      value={state.resources.contribution} />
              <Stat label="Môn Phái Chiến" value="Thắng 3" />
            </div>
            <div className="hr-soft" style={{ margin: "14px 0 10px" }} />
            <div className="label" style={{ marginBottom: 6 }}>Tiến độ thăng cấp</div>
            <div className="bar exp"><div className="fill" style={{ width: `${sect.rankProgress}%` }} /></div>
            <div className="faint" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Khảo nghiệm Nội Môn mở khi đạt 100%</div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card padding={20}>
            <SmallHead right={<Pill variant="cinnabar">3 nhiệm vụ</Pill>}>Nhiệm Vụ Đang Mở</SmallHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {sect.missions.map((m) => (
                <div key={m.id} style={{
                  padding: "14px 16px",
                  border: "1px solid var(--line)",
                  background: "var(--paper-deep)",
                  borderRadius: 3,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div className="t-display" style={{ fontSize: 17 }}>{m.name}</div>
                    <Pill variant={m.diff === "Đệ Tử" ? "cinnabar" : "jade"}>{m.diff}</Pill>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4, fontStyle: "italic" }}>{m.desc}</div>
                  <div className="hr-soft" style={{ margin: "10px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--gold-deep)" }}>賞 — {m.reward}</span>
                    <button className="btn primary sm">Nhận</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={20}>
            <SmallHead right={<button className="btn ghost sm">Toàn Danh Sách</button>}>Đồng Môn</SmallHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 12 }}>
              {sect.members.map((m, i) => (
                <div key={i} style={{
                  padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 12,
                  border: "1px solid var(--line)",
                  background: "var(--paper-deep)",
                  borderRadius: 3,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--paper)", border: "1px solid var(--ink-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="t-han" style={{ fontSize: 17, color: "var(--ink)" }}>{m.han[0]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{m.realm} · {m.rank}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- COMBAT (modal overlay) ----------
function CombatOverlay({ state, onClose }) {
  const { combat, character: ch } = state;
  const [log, setLog] = useState(combat.log);
  const [enemyHp, setEnemyHp] = useState(combat.enemy.hp);
  const [playerHp, setPlayerHp] = useState(ch.stats.hp);

  const act = (ability) => {
    const dmg = Math.round(20 + Math.random() * 30 + (ability.qi / 2));
    const taken = Math.round(8 + Math.random() * 18);
    setEnemyHp((h) => Math.max(0, h - dmg));
    setPlayerHp((h) => Math.max(0, h - taken));
    setLog((l) => [
      { side: "you",   text: `${ability.name} — ${ability.han} đâm trúng.`, dmg: dmg },
      { side: "enemy", text: `Yêu vật vung trúc rỗng phản kích.`, dmg: -taken },
      ...l,
    ].slice(0, 10));
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(20, 24, 32, 0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "var(--paper)",
        border: "1px solid var(--ink)",
        borderRadius: 4,
        maxWidth: 920, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ padding: "20px 28px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Seal size="lg" variant="cinnabar">戰</Seal>
            <div>
              <div className="label">Chiến Đấu</div>
              <div className="t-display" style={{ fontSize: 22, lineHeight: 1.1 }}>Trúc Yêu ra đòn tấn công</div>
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>Rút Lui ✕</button>
        </div>

        <div className="combat-stage" style={{ border: 0, borderRadius: 0, minHeight: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 36px", position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="portrait">李</div>
                <div>
                  <div className="t-display" style={{ fontSize: 18, lineHeight: 1.1 }}>{ch.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{ch.realm.name} · tầng {ch.realm.stage}</div>
                </div>
              </div>
              <div style={{ width: "100%", maxWidth: 240 }}>
                <Bar kind="hp" label="Khí Huyết"  value={playerHp}    max={ch.stats.hpMax} />
                <Bar kind="qi" label="Linh Lực"   value={ch.stats.qi} max={ch.stats.qiMax} />
              </div>
            </div>

            <div className="t-han" style={{ fontSize: 60, color: "var(--cinnabar)", opacity: 0.6, alignSelf: "center" }}>戰</div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: "row-reverse" }}>
                <div className="portrait enemy">魘</div>
                <div style={{ textAlign: "right" }}>
                  <div className="t-display" style={{ fontSize: 18, lineHeight: 1.1 }}>{combat.enemy.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{combat.enemy.tier}</div>
                </div>
              </div>
              <div style={{ width: "100%", maxWidth: 240 }}>
                <Bar kind="hp" label={combat.enemy.name + " Khí Huyết"} value={enemyHp} max={combat.enemy.hpMax} />
                <div className="label" style={{ marginTop: 6, color: "var(--cinnabar-deep)", letterSpacing: "0.12em" }}>Ý Đồ — {combat.enemy.intent}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 0 }}>
          <div style={{ padding: "20px 28px", borderRight: "1px solid var(--line)" }}>
            <SmallHead right={<span className="faint" style={{ fontSize: 11 }}>Lượt của ngươi</span>}>Công Pháp</SmallHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 10 }}>
              {ch.abilities.map((a, i) => (
                <button key={a.id}
                  className="choice"
                  style={{ padding: "12px 14px 12px 50px", fontSize: 14 }}
                  onClick={() => act(a)}>
                  <span className="ord">{a.han[0]}</span>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{a.name}</div>
                  <div className="cost">
                    <span className="c-item">氣 {a.qi}</span>
                    <span className="c-item">Hồi {a.cd}</span>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn ghost">Đánh Thường</button>
              <button className="btn ghost">Phòng Thủ</button>
              <button className="btn cinnabar">Chạy Trốn</button>
            </div>
          </div>

          <div style={{ padding: "20px 24px", background: "var(--paper-deep)" }}>
            <SmallHead>Nhật Ký Chiến Đấu</SmallHead>
            <div className="scroll-pad" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, maxHeight: 260, overflowY: "auto" }}>
              {log.map((l, i) => (
                <div key={i} style={{
                  borderLeft: "2px solid " + (l.side === "you" ? "var(--jade)" : "var(--cinnabar)"),
                  paddingLeft: 10,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  fontStyle: "italic",
                }}>
                  <div>{l.text}</div>
                  {l.dmg != null && (
                    <div className="t-num" style={{ fontSize: 12, color: l.dmg > 0 ? "var(--jade-deep)" : "var(--cinnabar-deep)", marginTop: 2, fontStyle: "normal" }}>
                      {l.dmg > 0 ? `+${l.dmg} sát thương` : `${l.dmg} khí huyết`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.InventoryScreen = InventoryScreen;
window.MarketScreen = MarketScreen;
window.WorldScreen = WorldScreen;
window.SectScreen = SectScreen;
window.CombatOverlay = CombatOverlay;
