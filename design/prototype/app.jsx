// ============================================================
// XIANXIA — App shell + Tweaks
// ============================================================

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "parchment",
  "displayFont": "cormorant",
  "bodyFont": "spectral",
  "density": "balanced",
  "layout": "two-pane",
  "showWatermarks": true,
  "stage": "login"
}/*EDITMODE-END*/;

const TABS = [
  { id: "game",      han: "事", label: "Hành Trình" },
  { id: "character", han: "身", label: "Tu Sĩ" },
  { id: "sect",      han: "派", label: "Môn Phái" },
  { id: "inventory", han: "物", label: "Túi Đồ" },
  { id: "market",    han: "市", label: "Chợ" },
  { id: "world",     han: "界", label: "Thiên Hạ" },
];

function TopBar({ active, onTab, onCombat, stage, onStageChange }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 24, padding: "20px 32px",
      borderBottom: "1px solid var(--line)",
      background: "var(--card)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Seal size="lg">仙</Seal>
        <div>
          <div className="t-display" style={{ fontSize: 24, lineHeight: 1, letterSpacing: "0.04em", display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="t-han" style={{ fontSize: 24, color: "var(--cinnabar)", fontWeight: 600 }}>修仙錄</span>
            Tu Tiên Lục
          </div>
          <div className="faint" style={{ fontSize: 12, fontStyle: "italic", marginTop: 4, letterSpacing: "0.02em" }}>Hành trình của một kẻ tu đạo</div>
        </div>
      </div>
      <nav className="tabs" style={{ border: 0, paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} className={"tab " + (active === t.id ? "active" : "")} onClick={() => onTab(t.id)}>
            <span className="han">{t.han}</span>{t.label}
          </button>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost sm" onClick={onCombat}><span className="t-han" style={{fontSize:12, color:"var(--cinnabar)"}}>戰</span> Thử Chiến</button>
        <span className="pill jade"><span className="dot" />Đã lưu · 11 giây trước</span>
      </div>
    </header>
  );
}

function FontLink() {
  return (
    <Fragment>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </Fragment>
  );
}

function App() {
  const [tab, setTab] = useState("game");
  const [combat, setCombat] = useState(false);
  const state = window.MOCK;

  // Tweaks
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme to root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme === "parchment" ? "" : t.theme);
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.theme, t.density]);

  // Font variables
  useEffect(() => {
    const fontMap = {
      cormorant: '"Cormorant Garamond", "Noto Serif SC", serif',
      eb: '"EB Garamond", "Noto Serif SC", serif',
      noto: '"Noto Serif SC", "Cormorant Garamond", serif',
    };
    const bodyMap = {
      spectral: '"Spectral", "Cormorant Garamond", Georgia, serif',
      crimson: '"Crimson Pro", Georgia, serif',
      lora:    '"Lora", Georgia, serif',
    };
    document.documentElement.style.setProperty("--font-display", fontMap[t.displayFont] || fontMap.cormorant);
    document.documentElement.style.setProperty("--font-body",    bodyMap[t.bodyFont]    || bodyMap.spectral);
  }, [t.displayFont, t.bodyFont]);

  const showRail = t.layout === "two-pane" && tab !== "world" && tab !== "inventory";
  const stage = t.stage || "game";

  // Render pre-game stages full-bleed (no top bar)
  if (stage === "login") {
    return (
      <div>
        <StageSwitcher stage={stage} setStage={(s) => setTweak("stage", s)} />
        <LoginScreen onEnter={() => setTweak("stage", "creation")} />
        {renderTweaks()}
      </div>
    );
  }
  if (stage === "creation") {
    return (
      <div>
        <StageSwitcher stage={stage} setStage={(s) => setTweak("stage", s)} />
        <CharacterCreationScreen onEnter={() => setTweak("stage", "game")} />
        {renderTweaks()}
      </div>
    );
  }

  function renderTweaks() {
    return (
      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Giai Đoạn">
          <TweakRadio
            label="Màn hình"
            value={stage}
            options={[
              { value: "login",    label: "Đăng nhập" },
              { value: "creation", label: "Tạo NV" },
              { value: "game",     label: "Trò Chơi" },
            ]}
            onChange={(v) => setTweak("stage", v)}
          />
        </TweakSection>
        <TweakSection title="Màu sắc">
          <TweakRadio
            label="Gam màu"
            value={t.theme}
            options={[
              { value: "parchment", label: "Giấy cổ" },
              { value: "night",     label: "Đêm Trúc" },
              { value: "cinnabar",  label: "Áng Chu Sa" },
            ]}
            onChange={(v) => setTweak("theme", v)}
          />
        </TweakSection>

        <TweakSection title="Chữ">
          <TweakSelect
            label="Phông tiêu đề"
            value={t.displayFont}
            options={[
              { value: "cormorant", label: "Cormorant Garamond" },
              { value: "eb",        label: "EB Garamond" },
              { value: "noto",      label: "Noto Serif SC" },
            ]}
            onChange={(v) => setTweak("displayFont", v)}
          />
          <TweakSelect
            label="Phông văn bản"
            value={t.bodyFont}
            options={[
              { value: "spectral", label: "Spectral" },
              { value: "crimson",  label: "Crimson Pro" },
              { value: "lora",     label: "Lora" },
            ]}
            onChange={(v) => setTweak("bodyFont", v)}
          />
        </TweakSection>

        <TweakSection title="Bố cục">
          <TweakRadio
            label="Khung chơi"
            value={t.layout}
            options={[
              { value: "two-pane", label: "Hai cột" },
              { value: "single",   label: "Một cột" },
            ]}
            onChange={(v) => setTweak("layout", v)}
          />
          <TweakToggle
            label="Hán tự trang trí"
            value={t.showWatermarks}
            onChange={(v) => setTweak("showWatermarks", v)}
          />
        </TweakSection>
      </TweaksPanel>
    );
  }

  return (
    <div>
      <StageSwitcher stage={stage} setStage={(s) => setTweak("stage", s)} />
      <TopBar active={tab} onTab={setTab} onCombat={() => setCombat(true)} stage={stage} onStageChange={(s) => setTweak("stage", s)} />

      <main className="paper-bg" style={{ position: "relative", minHeight: "calc(100vh - 77px)" }}>
        <div style={{
          maxWidth: 1400, margin: "0 auto",
          padding: "28px 32px 64px",
          display: showRail ? "grid" : "block",
          gridTemplateColumns: showRail ? `var(--rail-w) 1fr` : undefined,
          gap: 28,
          position: "relative",
        }}>
          {showRail && <CultivatorRail state={state} onTabChange={setTab} />}
          <section style={{ minWidth: 0 }}>
            {tab === "game"      && <GameScreen      state={state} onChoice={(id) => { if (id === "c1") setCombat(true); }} />}
            {tab === "character" && <CharacterScreen state={state} />}
            {tab === "sect"      && <SectScreen      state={state} />}
            {tab === "inventory" && <InventoryScreen state={state} />}
            {tab === "market"    && <MarketScreen    state={state} />}
            {tab === "world"     && <WorldScreen     state={state} />}
          </section>
        </div>
      </main>

      {combat && <CombatOverlay state={state} onClose={() => setCombat(false)} />}

      {renderTweaks()}
    </div>
  );
}

// Floating stage switcher — lets the reviewer hop between login / creation / game.
function StageSwitcher({ stage, setStage }) {
  const items = [
    { id: "login",    han: "入", label: "Đăng Nhập" },
    { id: "creation", han: "命", label: "Tạo NV" },
    { id: "game",     han: "仙", label: "Trò Chơi" },
  ];
  return (
    <div style={{
      position: "fixed", left: 16, bottom: 16, zIndex: 80,
      display: "flex", gap: 4, padding: 4,
      background: "var(--card)",
      border: "1px solid var(--ink)",
      borderRadius: 4,
      boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
    }}>
      {items.map((it) => (
        <button key={it.id} onClick={() => setStage(it.id)}
          style={{
            padding: "6px 12px",
            background: stage === it.id ? "var(--ink)" : "transparent",
            color: stage === it.id ? "var(--paper)" : "var(--ink-soft)",
            border: 0,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            letterSpacing: "0.06em",
            borderRadius: 2,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <span className="t-han" style={{ fontSize: 13, color: stage === it.id ? "var(--paper)" : "var(--cinnabar)" }}>{it.han}</span>
          {it.label}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
