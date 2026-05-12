// ============================================================
// XIANXIA — Pre-game screens (Login + Character Creation)
// ============================================================

// ---------- LOGIN ----------
function LoginScreen({ onEnter }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="paper-bg" style={{ minHeight: "100vh", position: "relative", padding: "40px 24px" }}>
      {/* Decorative han pillars */}
      <span className="han-bg" style={{ left: "4%", top: "8%", fontSize: 180, lineHeight: 0.85 }}>道</span>
      <span className="han-bg" style={{ right: "5%", bottom: "8%", fontSize: 220, lineHeight: 0.85 }}>仙</span>
      <span className="han-bg" style={{ left: "10%", bottom: "20%", fontSize: 110, lineHeight: 0.85 }}>修</span>
      <span className="han-bg" style={{ right: "12%", top: "16%", fontSize: 90, lineHeight: 0.85 }}>緣</span>

      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 40, alignItems: "center", minHeight: "80vh" }}>
        {/* Left — Title & poetic intro */}
        <div style={{ position: "relative", paddingTop: 30 }}>
          <Seal size="lg">仙</Seal>
          <div className="label" style={{ marginTop: 20, letterSpacing: "0.32em" }}>Hành trình tu đạo</div>
          <h1 className="t-display" style={{ fontSize: 78, lineHeight: 0.95, margin: "10px 0 4px", fontWeight: 500 }}>
            <span className="t-han" style={{ display: "block", fontSize: 68, color: "var(--cinnabar)", marginBottom: 10, letterSpacing: "0.04em" }}>修仙錄</span>
            Tu Tiên Lục
          </h1>
          <div className="brush-rule" style={{ margin: "20px 0", maxWidth: 280 }} />
          <p className="t-body" style={{ fontSize: 16, lineHeight: 1.75, color: "var(--ink-soft)", margin: 0, maxWidth: 420, fontStyle: "italic", textWrap: "pretty" }}>
            "Đại đạo xa thẳm, một bước một bước mà nên. Ai gieo căn cơ, người sẽ gặt được tiên quả."
          </p>
          <div style={{ display: "flex", gap: 18, marginTop: 28, fontSize: 12, color: "var(--ink-mute)", letterSpacing: "0.06em", fontFamily: "var(--font-ui)", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-han" style={{ fontSize: 16, color: "var(--cinnabar-deep)" }}>存</span>
              Tự động lưu hành trình
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-han" style={{ fontSize: 16, color: "var(--cinnabar-deep)" }}>機</span>
              Trí huệ AI dẫn truyện
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-han" style={{ fontSize: 16, color: "var(--cinnabar-deep)" }}>器</span>
              Mọi thiết bị
            </span>
          </div>
        </div>

        {/* Right — Login form card */}
        <Card padding={36} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
          <span className="han-bg" style={{ fontSize: 180, right: -20, top: -40, lineHeight: 0.85 }}>{mode === "signin" ? "入" : "新"}</span>

          {/* Top row: language + seal */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <Seal variant="ink">{mode === "signin" ? "入" : "新"}</Seal>
            <button className="btn ghost sm">🌐 EN</button>
          </div>

          <div className="label" style={{ marginBottom: 4 }}>{mode === "signin" ? "Đăng Nhập" : "Tạo Tài Khoản"}</div>
          <div className="t-display" style={{ fontSize: 28, lineHeight: 1.05, marginBottom: 6 }}>
            {mode === "signin" ? "Tiếp Tục Tu Luyện" : "Khởi Hành Tu Đạo"}
          </div>
          <div className="faint" style={{ fontSize: 13, fontStyle: "italic", marginBottom: 24 }}>
            {mode === "signin"
              ? "Nhập danh hiệu cũ để nối lại con đường."
              : "Lập danh hiệu mới và bước chân lên tiên lộ."}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Linh Đài (Email)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dao.huu@thien.gioi"
              style={{
                width: "100%", padding: "12px 14px",
                background: "var(--paper)",
                border: "1px solid var(--line-strong)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                borderRadius: 2,
                outline: "none",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 18 }}>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Mật Quyết</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signin" ? "Khẩu quyết bí truyền" : "Tối thiểu 6 ký tự"}
                style={{
                  width: "100%", padding: "12px 44px 12px 14px",
                  background: "var(--paper)",
                  border: "1px solid var(--line-strong)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  borderRadius: 2,
                  outline: "none",
                  letterSpacing: showPw ? "normal" : "0.2em",
                }}
              />
              <button
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: 0, cursor: "pointer",
                  padding: 6, color: "var(--ink-mute)",
                  fontFamily: "var(--font-han)", fontSize: 16,
                }}
                title={showPw ? "Ẩn" : "Hiện"}
              >
                {showPw ? "閉" : "視"}
              </button>
            </div>
          </div>

          <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "12px 20px", fontSize: 14, marginBottom: 14 }} onClick={onEnter}>
            <span className="t-han" style={{ color: "currentColor", marginRight: 6 }}>{mode === "signin" ? "入" : "立"}</span>
            {mode === "signin" ? "Bước Vào Tiên Lộ" : "Lập Danh — Đăng Ký"}
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--ink-soft)", fontSize: 13, fontStyle: "italic", textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--line-strong)" }}>
              {mode === "signin"
                ? "Chưa có danh hiệu? Lập tài khoản mới"
                : "Đã có danh hiệu? Quay về đăng nhập"}
            </button>
          </div>

          <div className="hr-soft" style={{ margin: "20px 0 14px" }} />
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
            <span className="faint" style={{ fontSize: 11, fontStyle: "italic" }}>Hoặc tiếp tục bằng</span>
            <button className="btn ghost sm">Khách Lữ Hành</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- CHARACTER CREATION ----------
const ELEMENT_DATA = [
  { id: "Kim",   han: "金", color: "var(--gold-deep)",     desc: "Sắc bén, cứng cỏi — vũ khí và phòng thủ" },
  { id: "Mộc",   han: "木", color: "#3a7a3a",              desc: "Sinh trưởng, hồi phục — dược pháp và linh thảo" },
  { id: "Thủy",  han: "水", color: "#3a6280",              desc: "Mềm dẻo, biến hóa — thân pháp và trận pháp" },
  { id: "Hỏa",   han: "火", color: "var(--cinnabar)",      desc: "Cuồng nhiệt, sát thương — công kích và đan lư" },
  { id: "Thổ",   han: "土", color: "#a16207",              desc: "Bền vững, tích trữ — phòng ngự và luyện thể" },
];

const SAMPLE_SPIRIT_ROOTS = [
  { elements: ["Thủy", "Mộc", "Phong"], grade: "Trung Phẩm", gradeHan: "中品" },
  { elements: ["Hỏa"],                   grade: "Thiên Phẩm", gradeHan: "天品" },
  { elements: ["Kim", "Thổ"],            grade: "Thượng Phẩm", gradeHan: "上品" },
  { elements: ["Mộc", "Thủy", "Hỏa", "Thổ"], grade: "Hạ Phẩm", gradeHan: "下品" },
];

function ElementWheel({ activeElements = [] }) {
  const cx = 110, cy = 110;
  const r = 78;
  const els = ELEMENT_DATA;
  return (
    <svg viewBox="0 0 220 220" width="220" height="220">
      <defs>
        <radialGradient id="centerGlow">
          <stop offset="0%" stopColor="var(--jade-glow)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* outer ring */}
      <circle cx={cx} cy={cy} r={r + 14} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
      {/* base pentagon connecting lines */}
      {els.map((e, i) => {
        const a1 = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const a2 = (((i + 2) % 5) / 5) * 2 * Math.PI - Math.PI / 2;
        const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
        const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-soft)" strokeWidth="0.7" strokeDasharray="2 4" opacity="0.4" />;
      })}
      {/* center glow */}
      <circle cx={cx} cy={cy} r="46" fill="url(#centerGlow)" />
      <text x={cx} y={cy + 7} textAnchor="middle" fontFamily="var(--font-han)" fontSize="34" fill="var(--ink)" opacity="0.5">根</text>

      {/* element nodes */}
      {els.map((e, i) => {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const active = activeElements.includes(e.id);
        return (
          <g key={e.id} className={active ? "breathe" : ""}>
            <circle cx={x} cy={y} r="22" fill={active ? e.color : "var(--paper)"} stroke={active ? e.color : "var(--line-strong)"} strokeWidth={active ? 2.5 : 1.2} />
            <text x={x} y={y + 6} textAnchor="middle" fontFamily="var(--font-han)" fontSize="20" fill={active ? "var(--paper)" : "var(--ink-faint)"} fontWeight="500">{e.han}</text>
            <text x={x} y={y + 38} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="9" fill={active ? "var(--ink)" : "var(--ink-faint)"} letterSpacing="0.2em" style={{textTransform:"uppercase"}}>{e.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CharacterCreationScreen({ onEnter, existing }) {
  const [step, setStep] = useState(existing ? "existing" : "form"); // existing | form | reveal
  const [name, setName] = useState("Lý Vô Tâm");
  const [age, setAge] = useState(23);
  const [spiritRoot, setSpiritRoot] = useState(null);
  const [revealing, setRevealing] = useState(false);

  const generate = () => {
    setRevealing(true);
    setTimeout(() => {
      const s = SAMPLE_SPIRIT_ROOTS[Math.floor(Math.random() * SAMPLE_SPIRIT_ROOTS.length)];
      setSpiritRoot(s);
      setStep("reveal");
      setRevealing(false);
    }, 800);
  };

  return (
    <div className="paper-bg" style={{ minHeight: "100vh", padding: "40px 24px", position: "relative" }}>
      <span className="han-bg" style={{ left: "3%", top: "6%", fontSize: 220, lineHeight: 0.85 }}>緣</span>
      <span className="han-bg" style={{ right: "3%", bottom: "6%", fontSize: 200, lineHeight: 0.85 }}>命</span>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Seal size="lg">命</Seal>
          <div className="label" style={{ marginTop: 14, letterSpacing: "0.3em" }}>Tạo Nhân Vật</div>
          <h1 className="t-display" style={{ fontSize: 40, margin: "6px 0 4px", lineHeight: 1.1 }}>
            <span className="t-han" style={{ fontSize: 32, color: "var(--cinnabar)", marginRight: 14, letterSpacing: "0.04em" }}>立命</span>
            Lập Danh — Cầu Linh Căn
          </h1>
          <div className="brush-rule" style={{ margin: "14px auto 0", maxWidth: 360 }} />
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 24 }}>
          {[
            { id: "form",   han: "名", label: "Lập Danh" },
            { id: "reveal", han: "根", label: "Cầu Linh Căn" },
            { id: "enter",  han: "啟", label: "Khai Hành" },
          ].map((s, i) => {
            const active = s.id === step || (s.id === "form" && step === "reveal") || (s.id === "form" && step === "enter") || (s.id === "reveal" && step === "enter");
            const current = s.id === step;
            const done = (s.id === "form" && (step === "reveal" || step === "enter")) || (s.id === "reveal" && step === "enter");
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "1.5px solid " + (current ? "var(--cinnabar)" : done ? "var(--ink)" : "var(--line-strong)"),
                  background: current ? "var(--cinnabar)" : done ? "var(--ink)" : "var(--paper)",
                  color: (current || done) ? "var(--paper)" : "var(--ink-faint)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-han)", fontSize: 17,
                }}>{s.han}</div>
                <div>
                  <div className="label" style={{ fontSize: 10 }}>Bước {i + 1}</div>
                  <div style={{ fontSize: 13, color: current ? "var(--ink)" : "var(--ink-soft)", fontWeight: current ? 500 : 400 }}>{s.label}</div>
                </div>
                {i < 2 && <div style={{ width: 36, height: 1, background: "var(--line)", marginLeft: 10 }} />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === "existing" && (
          <Card padding={32} style={{ maxWidth: 540, margin: "0 auto" }}>
            <div className="label" style={{ textAlign: "center", marginBottom: 6 }}>Hành Trình Đang Chờ</div>
            <h2 className="t-display" style={{ fontSize: 28, textAlign: "center", margin: "0 0 18px" }}>Có một danh hiệu chưa hoàn thành</h2>
            <div className="card card-inset" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 56, height: 72, border: "1.5px solid var(--ink)", background: "var(--paper-deep)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span className="t-han" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1 }}>李</span>
                  <span className="t-han" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1, marginTop: 2 }}>無</span>
                  <span className="t-han" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1, marginTop: 2 }}>心</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="t-display" style={{ fontSize: 22 }}>Lý Vô Tâm</div>
                  <div className="faint" style={{ fontSize: 12, fontStyle: "italic" }}>23 tuổi · Tam Linh Căn (Thủy · Mộc · Phong)</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <Pill variant="cinnabar"><span className="t-han" style={{ fontSize: 11 }}>練氣</span> 4</Pill>
                    <Pill variant="jade">Bích Vân Các</Pill>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn primary" style={{ justifyContent: "center", padding: "12px 16px" }} onClick={onEnter}>
                <span className="t-han" style={{ marginRight: 6 }}>續</span> Tiếp Tục Hành Trình
              </button>
              <button className="btn ghost" style={{ justifyContent: "center", padding: "10px 16px" }} onClick={() => setStep("form")}>Tạo Nhân Vật Mới</button>
              <button className="btn ghost cinnabar" style={{ justifyContent: "center", padding: "10px 16px", borderColor: "var(--cinnabar)", color: "var(--cinnabar-deep)" }}>Xóa Dữ Liệu & Tạo Lại</button>
            </div>
          </Card>
        )}

        {step === "form" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 24, maxWidth: 880, margin: "0 auto" }}>
            {/* Form card */}
            <Card padding={32} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
              <span className="han-bg" style={{ fontSize: 180, right: -30, bottom: -50, lineHeight: 0.85 }}>名</span>
              <SmallHead>Lập Danh — Khắc Tên Vào Trời</SmallHead>

              <div style={{ marginTop: 16 }}>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>Danh Hiệu Của Ngươi</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lý Vô Tâm, Hàn Phong, …"
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "var(--paper)",
                    border: "1px solid var(--line-strong)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    borderRadius: 2,
                    outline: "none",
                  }}
                />
                <div className="faint" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>Danh hiệu phải có ít nhất 2 ký tự. Người tu tiên ít khi đổi tên — hãy chọn cẩn thận.</div>
              </div>

              <div style={{ marginTop: 22 }}>
                <label className="label" style={{ display: "block", marginBottom: 6 }}>Tuổi Khi Khai Đạo</label>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <input
                    type="range"
                    min="15"
                    max="40"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--cinnabar)" }}
                  />
                  <div style={{ minWidth: 64, padding: "8px 14px", border: "1px solid var(--line)", background: "var(--paper-deep)", textAlign: "center", borderRadius: 2 }}>
                    <span className="t-num" style={{ fontSize: 18, fontWeight: 500 }}>{age}</span>
                    <span className="faint" style={{ fontSize: 10, marginLeft: 4 }}>tuổi</span>
                  </div>
                </div>
                <div className="faint" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>
                  {age <= 18 ? "Tiên cốt vẫn còn mềm — luyện khí thuận lợi." :
                   age <= 25 ? "Thanh xuân chính thịnh — đa số tu sĩ khởi đạo trong giai đoạn này." :
                   age <= 32 ? "Hơi muộn, nhưng ngộ tính chín muồi sẽ bù lại." :
                   "Khai đạo muộn — đường đi gian nan, song cũng vô tận khả năng."}
                </div>
              </div>

              <div className="hr-soft" style={{ margin: "22px 0 14px" }} />

              <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }} onClick={generate} disabled={revealing || name.length < 2}>
                <span className="t-han" style={{ marginRight: 6 }}>{revealing ? "卜" : "求"}</span>
                {revealing ? "Thiên cơ đang hiện lộ…" : "Khẩn Cầu Linh Căn"}
              </button>
            </Card>

            {/* Right side — what is a spirit root */}
            <Card padding={32} className="card-inset">
              <SmallHead right={<Pill variant="jade">5 Hành</Pill>}>Linh Căn Là Gì?</SmallHead>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-soft)", margin: "12px 0 0", fontStyle: "italic", textWrap: "pretty" }}>
                Linh căn là gốc rễ thiên phú của tu sĩ — sự tương thông giữa thân thể và năm hành. Số lượng và phẩm chất linh căn quyết định tốc độ tu luyện và phù hợp với công pháp nào.
              </p>

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {ELEMENT_DATA.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px dotted var(--line)" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: e.color, color: "var(--paper)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-han)", fontSize: 18,
                      flexShrink: 0,
                    }}>{e.han}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.id} <span className="t-han" style={{ fontSize: 13, color: "var(--cinnabar-deep)", fontWeight: 400, marginLeft: 4 }}>{e.han}</span></div>
                      <div className="faint" style={{ fontSize: 11, fontStyle: "italic" }}>{e.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hr-soft" style={{ margin: "16px 0" }} />
              <div className="label" style={{ marginBottom: 6 }}>Phẩm Chất</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Pill>Phàm Phẩm</Pill>
                <Pill variant="jade">Hạ Phẩm</Pill>
                <Pill variant="jade">Trung Phẩm</Pill>
                <Pill variant="gold">Thượng Phẩm</Pill>
                <Pill variant="cinnabar">Thiên Phẩm</Pill>
              </div>
            </Card>
          </div>
        )}

        {step === "reveal" && spiritRoot && (
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <Card padding={40} className="card-corner" style={{ position: "relative", overflow: "hidden" }}>
              <span className="han-bg" style={{ fontSize: 280, right: -40, top: -80, lineHeight: 0.85 }}>根</span>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "center" }}>
                {/* Element wheel */}
                <div style={{ textAlign: "center" }}>
                  <ElementWheel activeElements={spiritRoot.elements.filter(e => ELEMENT_DATA.some(d => d.id === e))} />
                  <div className="label" style={{ marginTop: 6 }}>Linh Căn Đồ</div>
                </div>

                {/* Reveal text */}
                <div>
                  <div className="label">Thiên Cơ Phán Định</div>
                  <h2 className="t-display" style={{ fontSize: 36, lineHeight: 1.05, margin: "4px 0 14px" }}>
                    <span className="t-han" style={{ fontSize: 30, color: "var(--cinnabar)", marginRight: 12 }}>{spiritRoot.gradeHan}</span>
                    {spiritRoot.grade}
                  </h2>
                  <div className="brush-rule" style={{ marginBottom: 18, maxWidth: 220 }} />

                  <div className="label" style={{ marginBottom: 8 }}>Thuộc Tính</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {spiritRoot.elements.map((eName) => {
                      const el = ELEMENT_DATA.find((d) => d.id === eName) || { han: "風", color: "var(--ink-soft)", desc: "Phong — vô hình, tự tại" };
                      return (
                        <div key={eName} style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "8px 14px",
                          background: "var(--paper)",
                          border: "1.5px solid " + el.color,
                          borderRadius: 2,
                        }}>
                          <span className="t-han" style={{ fontSize: 18, color: el.color }}>{el.han}</span>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{eName}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--ink-soft)", margin: 0, fontStyle: "italic", textWrap: "pretty" }}>
                    {spiritRoot.grade === "Thiên Phẩm"
                      ? "Linh căn đơn nhất, thuần khiết tột bậc — chỉ một trong vạn người. Tu hành sẽ thuận lợi như nước theo dòng, song dễ kiêu, khó tránh tâm ma."
                      : spiritRoot.grade === "Thượng Phẩm"
                      ? "Linh căn ít, tinh, mỗi hành đều đậm. Công pháp tương ứng sẽ nhanh chóng nhập định. Hành trình chắc chắn nhưng cần cẩn trọng tâm cảnh."
                      : spiritRoot.grade === "Trung Phẩm"
                      ? "Linh căn vừa phải, đa hành thông suốt. Có thể học nhiều công pháp khác nhau — đa năng nhưng không xuất sắc bất kỳ một mặt."
                      : "Linh căn tạp loạn, mỗi hành đều nhạt. Tu luyện chậm rãi, song bù lại ngộ tính rộng — đại đạo dành cho người kiên trì."}
                  </p>
                </div>
              </div>

              <div className="hr-soft" style={{ margin: "26px 0 18px" }} />

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div className="faint" style={{ fontSize: 12, fontStyle: "italic" }}>
                  Cần lưu ý: linh căn không thể đổi sau khi khai đạo — song công pháp luôn có vạn đường.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost" onClick={generate}>
                    <span className="t-han" style={{ marginRight: 6 }}>卜</span> Bói Lại
                  </button>
                  <button className="btn primary" onClick={onEnter}>
                    <span className="t-han" style={{ marginRight: 6 }}>啟</span> Khởi Hành Tu Tiên
                  </button>
                </div>
              </div>
            </Card>

            {/* Summary card */}
            <Card padding={20} style={{ marginTop: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div>
                  <div className="label">Danh Hiệu</div>
                  <div className="t-display" style={{ fontSize: 17, marginTop: 4 }}>{name}</div>
                </div>
                <div>
                  <div className="label">Tuổi Khai Đạo</div>
                  <div className="t-display" style={{ fontSize: 17, marginTop: 4 }}>{age}</div>
                </div>
                <div>
                  <div className="label">Cảnh Giới Khởi Đầu</div>
                  <div className="t-display" style={{ fontSize: 17, marginTop: 4 }}>
                    <span className="t-han" style={{ fontSize: 17, color: "var(--cinnabar-deep)", marginRight: 6 }}>凡人</span>
                    Phàm Nhân · Tầng 1
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
window.CharacterCreationScreen = CharacterCreationScreen;
