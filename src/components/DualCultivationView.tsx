"use client";

import { useState } from "react";
import { GameState, BodyRealm } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import {
  BODY_REALM_NAMES,
  BODY_REALM_BONUSES,
  BODY_STAGE_BONUSES,
  getBodyCultivationProgress,
  getBodyExpToNext,
  getNextBodyRealm,
} from "@/lib/game/dual-cultivation";
import { Bar, Card, Pill, SmallHead, Stat } from "@/components/ui";

interface DualCultivationViewProps {
  state: GameState;
  locale: Locale;
  onToggleDualCultivation?: () => Promise<void>;
  onSetExpSplit?: (split: number) => Promise<void>;
}

const BODY_HAN: Record<BodyRealm, string> = {
  PhàmThể: "凡體",
  LuyệnCốt: "煉骨",
  ĐồngCân: "銅筋",
  KimCương: "金剛",
  TháiCổ: "太古",
};

const BODY_REALM_COLOR: Record<BodyRealm, string> = {
  PhàmThể: "var(--ink-mute)",
  LuyệnCốt: "var(--gold-deep)",
  ĐồngCân: "var(--cinnabar-deep)",
  KimCương: "#3a6280",
  TháiCổ: "var(--rarity-epic)",
};

export default function DualCultivationView({
  state,
  locale,
  onToggleDualCultivation,
}: DualCultivationViewProps) {
  const [isToggling, setIsToggling] = useState(false);

  const isDualMode = state.progress.cultivation_path === "dual";
  const bodyRealm = (state.progress.body_realm || "PhàmThể") as BodyRealm;
  const bodyStage = state.progress.body_stage || 0;
  const bodyExp = state.progress.body_exp || 0;
  const bodyProgress = getBodyCultivationProgress(state.progress);
  const bodyExpNeeded = getBodyExpToNext(state.progress);
  const nextBodyRealm = getNextBodyRealm(bodyRealm);

  const currentBonuses = {
    hp:
      bodyStage * BODY_STAGE_BONUSES.hp +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].hp : 0),
    str:
      Math.floor(bodyStage * BODY_STAGE_BONUSES.str) +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].str : 0),
    stamina:
      bodyStage * BODY_STAGE_BONUSES.stamina +
      (bodyRealm !== "PhàmThể" ? BODY_REALM_BONUSES[bodyRealm].stamina : 0),
  };

  const handleToggle = async () => {
    if (onToggleDualCultivation) {
      setIsToggling(true);
      await onToggleDualCultivation();
      setIsToggling(false);
    }
  };

  const isReadyForBodyBreakthrough =
    bodyStage >= 5 && bodyExp >= bodyExpNeeded && nextBodyRealm !== null;

  const hasAnyBodyProgress =
    isDualMode || bodyExp > 0 || bodyStage > 0 || bodyRealm !== "PhàmThể";

  return (
    <Card padding={22} style={{ marginBottom: 18, position: "relative" }}>
      <SmallHead
        right={
          <Pill variant={isDualMode ? "cinnabar" : "default"} withDot>
            {isDualMode
              ? locale === "vi"
                ? "Đang Song Tu"
                : "Dual Active"
              : locale === "vi"
                ? "Đơn Tu"
                : "Solo Path"}
          </Pill>
        }
      >
        {locale === "vi" ? "Tu Luyện Song Đạo" : "Dual Cultivation"}
      </SmallHead>

      {/* Toggle row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: 14,
          background: "var(--paper-deep)",
          border: "1px solid var(--line-soft)",
          borderRadius: 3,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="t-display"
            style={{ fontSize: 16, color: "var(--ink)" }}
          >
            {isDualMode
              ? locale === "vi"
                ? "Khí 70% · Thân 30%"
                : "Qi 70% · Body 30%"
              : locale === "vi"
                ? "Mọi tu vi đều quy về tu khí"
                : "All exp flows into Qi cultivation"}
          </div>
          <div
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {isDualMode
              ? locale === "vi"
                ? "Tu thể song hành — thân cường, khí mạnh."
                : "Body and qi advance together — flesh and spirit fortified."
              : locale === "vi"
                ? "Khai mở thân pháp để tăng HP, Lực, Thể."
                : "Unlock body cultivation to raise HP, STR and Stamina."}
          </div>
        </div>
        {onToggleDualCultivation && (
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={isDualMode ? "ink-btn cinnabar" : "ink-btn primary"}
          >
            <span className="t-han">{isDualMode ? "止" : "啟"}</span>
            {isToggling
              ? "…"
              : isDualMode
                ? locale === "vi"
                  ? "Dừng"
                  : "Disable"
                : locale === "vi"
                  ? "Khởi Tu Thể"
                  : "Activate"}
          </button>
        )}
      </div>

      {hasAnyBodyProgress && (
        <>
          <div
            className="card-inset"
            style={{
              padding: 16,
              borderRadius: 3,
              border: isReadyForBodyBreakthrough
                ? "1px solid var(--cinnabar)"
                : "1px solid var(--line-soft)",
              boxShadow: isReadyForBodyBreakthrough
                ? "0 0 16px var(--cinnabar-soft)"
                : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <div>
                <div className="label">
                  {locale === "vi" ? "Cảnh Giới Thân Pháp" : "Body Realm"}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <span
                    className="t-han"
                    style={{
                      fontSize: 26,
                      color: BODY_REALM_COLOR[bodyRealm],
                      lineHeight: 1,
                    }}
                  >
                    {BODY_HAN[bodyRealm]}
                  </span>
                  <span
                    className="t-display"
                    style={{
                      fontSize: 18,
                      color: "var(--ink)",
                      lineHeight: 1,
                    }}
                  >
                    {BODY_REALM_NAMES[bodyRealm][locale === "vi" ? "vi" : "en"]}
                  </span>
                  <span
                    className="t-num"
                    style={{ color: "var(--ink-mute)", fontSize: 12 }}
                  >
                    {locale === "vi" ? `Tầng ${bodyStage + 1}` : `Stage ${bodyStage + 1}`}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">{locale === "vi" ? "Tu Vi" : "Progress"}</div>
                <div
                  className="t-num"
                  style={{
                    fontSize: 14,
                    color: "var(--cinnabar-deep)",
                    marginTop: 2,
                  }}
                >
                  {bodyExp.toLocaleString()}
                  <span className="faint">
                    {" "}
                    /{" "}
                    {bodyExpNeeded === Infinity
                      ? "∞"
                      : bodyExpNeeded.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <Bar
              kind="stam"
              value={bodyProgress}
              max={100}
              showNums={false}
              label={`${bodyProgress}%`}
            />

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background:
                      i < bodyStage
                        ? BODY_REALM_COLOR[bodyRealm]
                        : i === bodyStage
                          ? "var(--cinnabar)"
                          : "var(--line-strong)",
                    border:
                      i === bodyStage
                        ? "1px solid var(--cinnabar-deep)"
                        : "none",
                  }}
                />
              ))}
            </div>

            <div className="hr-soft" style={{ margin: "14px 0 8px" }} />
            <SmallHead>
              {locale === "vi" ? "Bổ Trợ Hiện Tại" : "Current Bonuses"}
            </SmallHead>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <Stat
                icon="血"
                label="HP"
                value={`+${currentBonuses.hp}`}
              />
              <Stat
                icon="力"
                label={locale === "vi" ? "Lực" : "STR"}
                value={`+${currentBonuses.str}`}
              />
              <Stat
                icon="體"
                label={locale === "vi" ? "Thể" : "STA"}
                value={`+${currentBonuses.stamina}`}
              />
            </div>

            {isReadyForBodyBreakthrough && nextBodyRealm && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "var(--paper)",
                  borderLeft: "3px solid var(--cinnabar)",
                  fontSize: 13,
                  color: "var(--cinnabar-deep)",
                  fontStyle: "italic",
                }}
              >
                <span className="t-han" style={{ marginRight: 6 }}>
                  破
                </span>
                {locale === "vi" ? "Sẵn sàng đột phá đến" : "Ready for breakthrough to"}{" "}
                <strong>
                  {BODY_REALM_NAMES[nextBodyRealm][locale === "vi" ? "vi" : "en"]}
                </strong>
              </div>
            )}
          </div>

          {isDualMode && (
            <div style={{ marginTop: 14 }}>
              <SmallHead>
                {locale === "vi" ? "Phân Chia Tu Vi" : "Exp Split"}
              </SmallHead>
              <div
                style={{
                  display: "flex",
                  height: 24,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid var(--line-strong)",
                }}
              >
                <div
                  style={{
                    width: "70%",
                    background:
                      "linear-gradient(90deg, var(--jade-deep), var(--jade-soft))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "var(--paper)",
                    fontWeight: 600,
                    fontFamily: "var(--font-ui), Inter, sans-serif",
                  }}
                >
                  氣 70%
                </div>
                <div
                  style={{
                    width: "30%",
                    background:
                      "linear-gradient(90deg, var(--gold-deep), var(--gold-soft))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "var(--paper)",
                    fontWeight: 600,
                    fontFamily: "var(--font-ui), Inter, sans-serif",
                  }}
                >
                  體 30%
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
