"use client";

import React from "react";
import { GameState, Realm, Locale } from "@/types/game";
import { t } from "@/lib/i18n/translations";
import { Card, Bar, Pill, RealmOrb, Resource } from "@/components/ui";

interface CultivatorRailProps {
  state: GameState;
  locale: Locale;
  characterName?: string | null;
}

const REALM_HAN: Record<Realm, string> = {
  PhàmNhân: "凡人",
  LuyệnKhí: "練氣",
  TrúcCơ: "築基",
  KếtĐan: "結丹",
  NguyênAnh: "元嬰",
};

const REALM_ORDER: Realm[] = [
  "PhàmNhân",
  "LuyệnKhí",
  "TrúcCơ",
  "KếtĐan",
  "NguyênAnh",
];

const REALM_KEY: Record<Realm, string> = {
  PhàmNhân: "realmMortal",
  LuyệnKhí: "realmQi",
  TrúcCơ: "realmFoundation",
  KếtĐan: "realmCore",
  NguyênAnh: "realmNascent",
};

function nextRealm(r: Realm): Realm | null {
  const i = REALM_ORDER.indexOf(r);
  if (i < 0 || i >= REALM_ORDER.length - 1) return null;
  return REALM_ORDER[i + 1];
}

function realmProgress(state: GameState): number {
  // Thresholds from game data (approx) — fall back to stage-based estimate
  const stage = state.progress.realm_stage ?? 0;
  const stageMax = 9;
  return Math.min(100, Math.round((stage / stageMax) * 100));
}

function nameInitials(name: string): string[] {
  return name.slice(0, 3).split("");
}

export default function CultivatorRail({
  state,
  locale,
  characterName,
}: CultivatorRailProps) {
  const realm = state.progress.realm;
  const realmHan = REALM_HAN[realm] ?? "凡";
  const realmName = t(locale, REALM_KEY[realm]);
  const next = nextRealm(realm);
  const pct = realmProgress(state);
  const stage = state.progress.realm_stage ?? 0;
  const stageMax = 9;

  const activity = state.activity?.current;
  const displayName = characterName || (locale === "vi" ? "Tu Sĩ" : "Cultivator");

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        position: "sticky",
        top: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* 1. Nameplate */}
      <Card padding={20}>
        <div style={{ display: "flex", gap: 16 }}>
          <div
            className="t-han"
            style={{
              fontSize: 26,
              color: "var(--ink)",
              lineHeight: 1.1,
              borderRight: "1px solid var(--line)",
              paddingRight: 14,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {nameInitials(displayName).map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div
              className="t-display"
              style={{ fontSize: 20, lineHeight: 1.1, color: "var(--ink)" }}
            >
              {displayName}
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
              {state.spirit_root.elements.map((e) => t(locale, e)).join(" · ")}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Pill variant="cinnabar" withDot>
                {realmHan}
              </Pill>
              <Pill variant="jade">
                {locale === "vi" ? "Tuổi" : "Age"} {state.age}
              </Pill>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Realm orb */}
      <Card padding={20}>
        <RealmOrb
          han={realmHan}
          name={realmName}
          stage={stage}
          stageMax={stageMax}
          progress={pct}
        />
        <div className="hr-soft" style={{ margin: "16px 0 10px" }} />
        <div className="label" style={{ marginBottom: 6 }}>
          {locale === "vi" ? "Cảnh Giới Kế Tiếp" : "Next Realm"}
        </div>
        {next ? (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                className="t-han"
                style={{ fontSize: 22, color: "var(--cinnabar)" }}
              >
                {REALM_HAN[next]}
              </span>
              <span
                className="t-display"
                style={{ fontSize: 16, color: "var(--ink)" }}
              >
                {t(locale, REALM_KEY[next])}
              </span>
            </div>
            <div
              className="t-body"
              style={{
                fontStyle: "italic",
                color: "var(--ink-mute)",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {locale === "vi"
                ? `Còn ${100 - pct}% nữa là có thể đột phá.`
                : `${100 - pct}% to breakthrough.`}
            </div>
          </div>
        ) : (
          <div
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 12,
            }}
          >
            {locale === "vi" ? "Đã đạt đỉnh phong." : "Pinnacle reached."}
          </div>
        )}
      </Card>

      {/* 3. Vitality */}
      <Card padding={20}>
        <div className="label" style={{ marginBottom: 10 }}>
          {locale === "vi" ? "Sinh Khí" : "Vitality"}
        </div>
        <Bar
          kind="hp"
          label={t(locale, "statsHp")}
          value={state.stats.hp}
          max={state.stats.hp_max}
        />
        <Bar
          kind="qi"
          label={t(locale, "statsQi")}
          value={state.stats.qi}
          max={state.stats.qi_max}
        />
        <Bar
          kind="stam"
          label={t(locale, "statsStamina")}
          value={state.stats.stamina}
          max={state.stats.stamina_max}
        />
        {state.progress.body_realm && (
          <>
            <div className="hr-soft" style={{ margin: "12px 0 8px" }} />
            <div className="label" style={{ marginBottom: 4 }}>
              {locale === "vi" ? "Thân Cảnh" : "Body"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                className="t-display"
                style={{ fontSize: 14, color: "var(--ink)" }}
              >
                {state.progress.body_realm}
              </span>
              <span className="t-num" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                {(state.progress.body_stage ?? 0)}/9
              </span>
            </div>
            <Bar
              kind="exp"
              value={state.progress.body_exp ?? 0}
              max={Math.max(state.progress.body_exp ?? 0, 100)}
              showNums={false}
            />
          </>
        )}
      </Card>

      {/* 4. Current activity */}
      {activity && (
        <Card padding={20} className="breathe" style={{ position: "relative" }}>
          <span
            className="han-bg"
            style={{ position: "absolute", top: -10, right: -10, fontSize: 96 }}
            aria-hidden
          >
            修
          </span>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              {locale === "vi" ? "Đang Tiến Hành" : "In Progress"}
            </div>
            <div
              className="t-display"
              style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1.2 }}
            >
              {(activity as any).name ||
                (activity as any).type ||
                (locale === "vi" ? "Hoạt động" : "Activity")}
            </div>
            {typeof (activity as any).segments_remaining === "number" && (
              <div
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {(activity as any).segments_remaining}{" "}
                {locale === "vi" ? "canh giờ còn lại" : "segments remaining"}
              </div>
            )}
            {typeof (activity as any).progress === "number" && (
              <Bar
                kind="qi"
                value={(activity as any).progress}
                max={100}
                showNums={false}
              />
            )}
          </div>
        </Card>
      )}

      {/* 5. Resources */}
      <Card padding={20}>
        <div className="label" style={{ marginBottom: 12 }}>
          {locale === "vi" ? "Vật Tài" : "Resources"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <Resource
            glyph="銀"
            amount={state.inventory.silver}
            label={t(locale, "silver")}
            variant="silver"
          />
          <Resource
            glyph="靈"
            amount={state.inventory.spirit_stones}
            label={t(locale, "spiritStones")}
            variant="stone"
          />
          {state.sect_membership && (
            <Resource
              glyph="功"
              amount={state.sect_membership.contribution}
              label={locale === "vi" ? "Cống" : "Merit"}
            />
          )}
        </div>
      </Card>
    </aside>
  );
}
