"use client";

import { useState, useEffect, useRef } from "react";
import { SpiritRoot, Character, Element, SpiritRootGrade } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import { Card, Seal, Pill } from "@/components/ui";

interface CharacterCreationProps {
  onGameStart: (characterId: string, runId: string, locale: Locale) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

type Step = "existing" | "form" | "reveal";

const ELEMENT_META: Record<
  Element,
  { han: string; vi: string; color: string; effect: string }
> = {
  Kim: { han: "金", vi: "Kim", color: "#a07a2e", effect: "Tinh nhuệ, sắc bén." },
  Mộc: { han: "木", vi: "Mộc", color: "#4e7f6c", effect: "Sinh trưởng, hồi phục." },
  Thủy: { han: "水", vi: "Thủy", color: "#3a6280", effect: "Mềm dẻo, biến hóa." },
  Hỏa: { han: "火", vi: "Hỏa", color: "#9b2a26", effect: "Mãnh liệt, công phá." },
  Thổ: { han: "土", vi: "Thổ", color: "#a16207", effect: "Vững chãi, bền bỉ." },
};

const ELEMENT_ORDER: Element[] = ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"];

const GRADE_HAN: Record<SpiritRootGrade, string> = {
  PhổThông: "下品",
  Khá: "中品",
  Hiếm: "上品",
  ThiênPhẩm: "天品",
};

const GRADE_FLAVOR: Record<SpiritRootGrade, { vi: string; en: string }> = {
  PhổThông: {
    vi: "Căn cơ phàm phẩm — đường tu xa thẳm, song lòng kiên trinh có thể bù lại.",
    en: "A common root — the path is long, but steadfast resolve can compensate.",
  },
  Khá: {
    vi: "Hạ phẩm linh căn — vừa đủ để bước vào tiên môn, chớ phụ thiên cơ.",
    en: "Modest spirit root — enough to step through the gate; do not waste it.",
  },
  Hiếm: {
    vi: "Thượng phẩm hi hữu — thiên tài hiếm có, môn phái sẽ tranh nhau thu nạp.",
    en: "A rare upper root — talent few possess; sects will vie to claim you.",
  },
  ThiênPhẩm: {
    vi: "Thiên phẩm tuyệt thế — trăm năm khó gặp, đại đạo tự ở phía trước.",
    en: "A heavenly root — once in a century; the great way lies open.",
  },
};

function ageHelper(age: number, locale: Locale): string {
  if (locale === "vi") {
    if (age <= 18) return "Tuổi thơ vừa qua — sức trẻ dồi dào, linh căn dễ khai mở.";
    if (age <= 25) return "Thân thể đang độ chín — bước vào tiên đạo còn kịp.";
    if (age <= 32) return "Đã quá tuổi đẹp nhất — phải dày công tu luyện hơn người.";
    return "Khai đạo muộn — đường lên tiên gập ghềnh, lòng tin càng phải vững.";
  }
  if (age <= 18) return "Just past childhood — abundant vitality, easily-opened roots.";
  if (age <= 25) return "Body at its prime — still in time for the immortal path.";
  if (age <= 32) return "Past the best age — must cultivate harder than most.";
  return "A late awakening — the path is rough; resolve must be unshakable.";
}

function ElementWheel({ elements }: { elements: Element[] }) {
  const active = new Set(elements);
  const cx = 110;
  const cy = 110;
  const ringR = 78;
  return (
    <svg viewBox="0 0 220 220" width={220} height={220} style={{ display: "block" }}>
      <circle
        cx={cx}
        cy={cy}
        r={ringR + 14}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="0.8"
        strokeDasharray="3 4"
        opacity="0.7"
      />
      {/* star-pattern skip-one connections */}
      {ELEMENT_ORDER.map((_, i) => {
        const j = (i + 2) % 5;
        const a1 = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const a2 = (j / 5) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={`s${i}`}
            x1={cx + Math.cos(a1) * ringR}
            y1={cy + Math.sin(a1) * ringR}
            x2={cx + Math.cos(a2) * ringR}
            y2={cy + Math.sin(a2) * ringR}
            stroke="var(--line)"
            strokeWidth="0.8"
            opacity="0.6"
          />
        );
      })}
      <defs>
        <radialGradient id="ew-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--jade-glow)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--paper)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={48} fill="url(#ew-glow)" />
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        fontFamily='"Noto Serif SC", serif'
        fontSize="52"
        fill="var(--ink)"
        opacity="0.06"
      >
        根
      </text>
      {ELEMENT_ORDER.map((el, i) => {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        const x = cx + Math.cos(a) * ringR;
        const y = cy + Math.sin(a) * ringR;
        const isActive = active.has(el);
        const meta = ELEMENT_META[el];
        return (
          <g key={el} className={isActive ? "breathe" : undefined}>
            <circle
              cx={x}
              cy={y}
              r={22}
              fill={isActive ? meta.color : "var(--paper)"}
              stroke={isActive ? meta.color : "var(--line-strong)"}
              strokeWidth={isActive ? 1.5 : 1}
            />
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              fontFamily='"Noto Serif SC", serif'
              fontSize="18"
              fill={isActive ? "var(--paper)" : "var(--ink-faint)"}
              fontWeight={600}
            >
              {meta.han}
            </text>
            <text
              x={x}
              y={y + 36}
              textAnchor="middle"
              fontFamily="var(--font-ui), Inter, sans-serif"
              fontSize="9"
              letterSpacing="2"
              fill={isActive ? "var(--ink)" : "var(--ink-faint)"}
              style={{ textTransform: "uppercase" }}
            >
              {el}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; han: string; label: string }[] = [
    { id: "form", han: "名", label: "Lập Danh" },
    { id: "form", han: "根", label: "Cầu Linh Căn" },
    { id: "reveal", han: "啟", label: "Khai Hành" },
  ];
  const stepIdx = step === "form" ? 0 : step === "reveal" ? 2 : 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 36,
        margin: "22px 0 30px",
      }}
    >
      {steps.map((s, i) => {
        const state =
          i === stepIdx ? "current" : i < stepIdx ? "done" : "future";
        const bg =
          state === "current"
            ? "var(--cinnabar)"
            : state === "done"
              ? "var(--ink)"
              : "var(--paper)";
        const color =
          state === "future" ? "var(--ink-mute)" : "var(--paper)";
        return (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              className="t-han"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: bg,
                color,
                border:
                  state === "future"
                    ? "1px solid var(--line-strong)"
                    : "1px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                margin: "0 auto",
              }}
            >
              {s.han}
            </div>
            <div
              className="label"
              style={{
                marginTop: 6,
                fontSize: 10,
                color: state === "future" ? "var(--ink-faint)" : "var(--ink-mute)",
              }}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CharacterCreation({
  onGameStart,
  locale,
  onLocaleChange,
}: CharacterCreationProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState(20);
  const [loading, setLoading] = useState(true);
  const [spiritRoot, setSpiritRoot] = useState<SpiritRoot | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [existingRunId, setExistingRunId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [existingCharacter, setExistingCharacter] = useState<Character | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const checkExistingCharacter = async () => {
      try {
        const response = await fetch("/api/get-character", { credentials: "same-origin" });
        if (!response.ok) {
          setLoading(false);
          return;
        }
        const data = await response.json();
        if (data.character && data.run) {
          setExistingCharacter(data.character);
          setCharacterId(data.character.id);
          setExistingRunId(data.run.id);
          setName(data.character.name);
          setAge(data.character.age);
        }
      } catch (err) {
        console.error("Error checking existing character:", err);
      } finally {
        setLoading(false);
      }
    };

    checkExistingCharacter();
  }, []);

  const step: Step = existingCharacter && !spiritRoot && !showCreateForm
    ? "existing"
    : spiritRoot
      ? "reveal"
      : "form";

  const handleCreateCharacter = async () => {
    if (existingCharacter || characterId) {
      setError(locale === "vi" ? "Nhân vật đã được tạo" : "Character already exists");
      return;
    }
    if (name.length < 2) {
      setError(
        locale === "vi" ? "Tên phải có ít nhất 2 ký tự" : "Name must be at least 2 characters"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, age, locale }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create character");
      }

      const data = await response.json();
      // 800ms reveal delay
      await new Promise((r) => setTimeout(r, 800));
      setSpiritRoot(data.spirit_root);
      setCharacterId(data.character.id);
    } catch (err: any) {
      setError(
        locale === "vi"
          ? `Lỗi tạo nhân vật: ${err.message}`
          : `Error creating character: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSpiritRoot = async () => {
    if (existingCharacter) {
      setError(
        locale === "vi"
          ? "Không thể tái tạo linh căn cho nhân vật đã lưu"
          : "Cannot regenerate spirit root for existing character"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, age, locale }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to regenerate spirit root");
      }
      const data = await response.json();
      await new Promise((r) => setTimeout(r, 800));
      setSpiritRoot(data.spirit_root);
      setCharacterId(data.character.id);
    } catch (err: any) {
      setError(
        locale === "vi"
          ? `Lỗi tái tạo linh căn: ${err.message}`
          : `Error regenerating spirit root: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!characterId || !spiritRoot) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/start-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ characterId, spiritRoot, locale }),
      });
      if (!response.ok) throw new Error("Failed to start run");
      const data = await response.json();
      onGameStart(characterId, data.run.id, locale);
    } catch {
      setError(locale === "vi" ? "Lỗi bắt đầu trò chơi" : "Error starting game");
      setLoading(false);
    }
  };

  const handleContinueExisting = () => {
    if (!characterId || !existingRunId) return;
    onGameStart(characterId, existingRunId, locale);
  };

  const handleResetGame = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reset-game", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reset game");
      }
      setExistingCharacter(null);
      setExistingRunId(null);
      setCharacterId(null);
      setSpiritRoot(null);
      setName("");
      setAge(20);
      setShowCreateForm(true);
    } catch (err: any) {
      setError(
        locale === "vi"
          ? `Lỗi đặt lại trò chơi: ${err.message}`
          : `Error resetting game: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const stillCheckingExistence = loading && !existingCharacter && !spiritRoot;

  return (
    <div
      className="paper-bg"
      style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}
    >
      <span className="han-bg" style={{ fontSize: 280, top: -40, left: -30 }} aria-hidden>
        緣
      </span>
      <span
        className="han-bg"
        style={{ fontSize: 280, bottom: -40, right: -30 }}
        aria-hidden
      >
        命
      </span>

      <div
        className="ink-fade-in"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 980,
          margin: "0 auto",
          padding: "40px 24px",
        }}
      >
        {/* Lang toggle */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={() => onLocaleChange(locale === "vi" ? "en" : "vi")}
            className="ink-btn ghost sm"
            type="button"
          >
            🌐 {locale === "vi" ? "EN" : "VN"}
          </button>
        </div>

        {/* Shared header */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Seal size="lg">命</Seal>
          </div>
          <div className="label" style={{ marginTop: 14 }}>
            {t(locale, "creationKicker")}
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <span
              className="t-han"
              style={{
                fontSize: 56,
                color: "var(--cinnabar)",
                lineHeight: 1,
                letterSpacing: "0.04em",
              }}
            >
              立命
            </span>
            <span
              className="t-display"
              style={{ fontSize: 38, lineHeight: 1, color: "var(--ink)" }}
            >
              {t(locale, "creationTitle")}
            </span>
          </h1>
          <div
            className="brush-rule"
            style={{ maxWidth: 320, margin: "16px auto 0" }}
          />
          <StepIndicator step={step} />
        </div>

        {stillCheckingExistence ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <span className="label">{t(locale, "loading")}</span>
          </div>
        ) : step === "existing" && existingCharacter ? (
          <Card padding={28} style={{ maxWidth: 540, margin: "0 auto" }}>
            <div
              className="card-inset"
              style={{
                padding: 22,
                borderRadius: 3,
                marginBottom: 18,
                display: "flex",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div
                className="t-han"
                style={{
                  fontSize: 28,
                  color: "var(--ink)",
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.1,
                  borderRight: "1px solid var(--line)",
                  paddingRight: 18,
                }}
              >
                {existingCharacter.name
                  .slice(0, 3)
                  .split("")
                  .map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
              </div>
              <div>
                <div
                  className="t-display"
                  style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1.1 }}
                >
                  {existingCharacter.name}
                </div>
                <div
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {locale === "vi" ? "Tuổi khai đạo" : "Age"} · {existingCharacter.age}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <Pill variant="cinnabar" withDot>
                    練氣
                  </Pill>
                  <Pill variant="jade">
                    {locale === "vi" ? "Tu sĩ" : "Cultivator"}
                  </Pill>
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  background: "var(--paper-deep)",
                  borderLeft: "3px solid var(--cinnabar)",
                  color: "var(--cinnabar-deep)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handleContinueExisting}
                disabled={loading}
                className="ink-btn primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
              >
                <span className="t-han">續</span>
                {t(locale, "creationCtaContinue")}
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={loading}
                className="ink-btn ghost"
                style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
              >
                {t(locale, "creationCtaNew")}
              </button>
              <button
                onClick={handleResetGame}
                disabled={loading}
                className="ink-btn cinnabar"
                style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}
              >
                {t(locale, "creationCtaDelete")}
              </button>
            </div>
          </Card>
        ) : step === "form" ? (
          <div className="creation-grid">
            <Card padding={28} className="card-corner" style={{ position: "relative" }}>
              <span
                className="han-bg"
                style={{
                  fontSize: 200,
                  top: -20,
                  right: -20,
                  position: "absolute",
                }}
                aria-hidden
              >
                名
              </span>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div className="label" style={{ marginBottom: 8 }}>
                  Lập Danh — Khắc Tên Vào Trời
                </div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 6, marginTop: 18 }}
                >
                  {t(locale, "creationNameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="t-display"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--paper)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 2,
                    color: "var(--ink)",
                    fontSize: 18,
                    outline: "none",
                  }}
                  placeholder={t(locale, "enterName")}
                  disabled={loading}
                />
                <p
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  {t(locale, "creationNameHelp")}
                </p>

                <label
                  className="label"
                  style={{ display: "block", marginTop: 20, marginBottom: 6 }}
                >
                  {t(locale, "creationAgeLabel")}
                </label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    type="range"
                    min={15}
                    max={40}
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value, 10) || 20)}
                    disabled={loading}
                    style={{ flex: 1, accentColor: "var(--cinnabar)" }}
                  />
                  <div
                    className="t-num"
                    style={{
                      minWidth: 50,
                      textAlign: "center",
                      padding: "6px 10px",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 2,
                      background: "var(--paper)",
                      fontSize: 15,
                    }}
                  >
                    {age}
                  </div>
                </div>
                <p
                  className="t-body"
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  {ageHelper(age, locale)}
                </p>

                {error && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 10,
                      background: "var(--paper-deep)",
                      borderLeft: "3px solid var(--cinnabar)",
                      color: "var(--cinnabar-deep)",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="hr-soft" style={{ margin: "20px 0 16px" }} />

                <button
                  onClick={handleCreateCharacter}
                  disabled={loading || name.length < 2}
                  className="ink-btn primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "12px 16px",
                  }}
                >
                  <span className="t-han">{loading ? "卜" : "求"}</span>
                  {loading
                    ? t(locale, "creationCtaFinding")
                    : t(locale, "creationCtaFind")}
                </button>
              </div>
            </Card>

            <Card padding={26} deep>
              <div className="label" style={{ marginBottom: 8 }}>
                Linh căn là gì?
              </div>
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-soft)",
                  fontSize: 14,
                  margin: 0,
                }}
              >
                {locale === "vi"
                  ? "Linh căn là gốc rễ tu đạo, quyết định nguyên tố mà tu sĩ có thể dẫn dắt và phẩm chất của họ. Phẩm càng cao, đường tu càng thuận."
                  : "Spirit roots are the foundation of cultivation, determining which elements you channel and how easily qi flows through your meridians."}
              </p>

              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {ELEMENT_ORDER.map((el) => {
                  const m = ELEMENT_META[el];
                  return (
                    <div
                      key={el}
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <span
                        className="t-han"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: m.color,
                          color: "var(--paper)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {m.han}
                      </span>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: "var(--ink)", marginRight: 6 }}>
                          {m.vi}
                        </span>
                        <span
                          className="t-body"
                          style={{
                            fontStyle: "italic",
                            color: "var(--ink-mute)",
                            fontSize: 12,
                          }}
                        >
                          — {m.effect}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hr-soft" style={{ margin: "16px 0 12px" }} />
              <div className="label" style={{ marginBottom: 8 }}>
                Phẩm Chất
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Pill>Phàm</Pill>
                <Pill>Hạ</Pill>
                <Pill variant="jade">Trung</Pill>
                <Pill variant="gold">Thượng</Pill>
                <Pill variant="cinnabar">Thiên</Pill>
              </div>
            </Card>
          </div>
        ) : (
          // reveal
          spiritRoot && (
            <>
              <Card padding={32} className="card-corner" style={{ position: "relative" }}>
                <span
                  className="han-bg"
                  style={{
                    fontSize: 360,
                    top: -60,
                    right: -40,
                    position: "absolute",
                  }}
                  aria-hidden
                >
                  根
                </span>
                <div className="reveal-grid" style={{ position: "relative", zIndex: 1 }}>
                  <ElementWheel elements={spiritRoot.elements} />
                  <div>
                    <div className="label">{t(locale, "creationRevealTitle")}</div>
                    <h2
                      style={{
                        margin: "6px 0 0",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                      }}
                    >
                      <span
                        className="t-han"
                        style={{
                          fontSize: 42,
                          color: "var(--cinnabar)",
                          lineHeight: 1,
                        }}
                      >
                        {GRADE_HAN[spiritRoot.grade]}
                      </span>
                      <span
                        className="t-display"
                        style={{ fontSize: 30, lineHeight: 1, color: "var(--ink)" }}
                      >
                        {t(locale, spiritRoot.grade)}
                      </span>
                    </h2>
                    <div className="brush-rule" style={{ maxWidth: 220, marginTop: 12 }} />
                    <div className="label" style={{ marginTop: 14 }}>
                      Thuộc Tính
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {spiritRoot.elements.map((el) => {
                        const m = ELEMENT_META[el];
                        return (
                          <span
                            key={el}
                            className="pill"
                            style={{
                              borderColor: m.color,
                              color: m.color,
                            }}
                          >
                            <span className="t-han">{m.han}</span>
                            {m.vi}
                          </span>
                        );
                      })}
                    </div>
                    <p
                      className="t-body"
                      style={{
                        fontStyle: "italic",
                        color: "var(--ink-soft)",
                        fontSize: 15,
                        marginTop: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {GRADE_FLAVOR[spiritRoot.grade][locale]}
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      background: "var(--paper-deep)",
                      borderLeft: "3px solid var(--cinnabar)",
                      color: "var(--cinnabar-deep)",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 22,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <p
                    className="t-body"
                    style={{
                      fontStyle: "italic",
                      color: "var(--ink-mute)",
                      fontSize: 12,
                      margin: 0,
                      maxWidth: 380,
                    }}
                  >
                    {locale === "vi"
                      ? "Một khi danh đã lập, linh căn là vận mệnh. Suy nghĩ kỹ trước khi khởi hành."
                      : "Once your name is set, your root is your fate. Reflect before setting forth."}
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={handleRegenerateSpiritRoot}
                      disabled={loading || !!existingCharacter}
                      className="ink-btn ghost"
                    >
                      <span className="t-han">卜</span>
                      {t(locale, "creationCtaReroll")}
                    </button>
                    <button
                      onClick={handleStartGame}
                      disabled={loading}
                      className="ink-btn primary"
                    >
                      <span className="t-han">啟</span>
                      {loading ? t(locale, "loading") : t(locale, "creationCtaStart")}
                    </button>
                  </div>
                </div>
              </Card>

              <Card padding={20} deep style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 14,
                  }}
                >
                  <div>
                    <div className="label">Danh Hiệu</div>
                    <div
                      className="t-display"
                      style={{ fontSize: 20, marginTop: 4, color: "var(--ink)" }}
                    >
                      {name || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="label">{t(locale, "creationAgeLabel")}</div>
                    <div
                      className="t-num"
                      style={{ fontSize: 20, marginTop: 4, color: "var(--ink)" }}
                    >
                      {age}
                    </div>
                  </div>
                  <div>
                    <div className="label">
                      {locale === "vi" ? "Cảnh giới khởi đầu" : "Starting Realm"}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span
                        className="t-han"
                        style={{ fontSize: 22, color: "var(--cinnabar)" }}
                      >
                        凡人
                      </span>
                      <span
                        className="t-display"
                        style={{ fontSize: 16, color: "var(--ink)" }}
                      >
                        {t(locale, "realmMortal")} · Tầng 1
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )
        )}
      </div>
    </div>
  );
}
