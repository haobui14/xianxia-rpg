"use client";

import React from "react";
import { GameState, KnownNPC, StoryArc, Locale } from "@/types/game";
import { Card, Pill, SectionHead, SmallHead } from "@/components/ui";

interface JournalViewProps {
  state: GameState;
  locale: Locale;
}

/** Relationship tier label + accent color for the bond gauge */
function bondTier(rel: number, locale: Locale): { label: string; color: string } {
  if (rel <= -60)
    return { label: locale === "vi" ? "Tử địch" : "Nemesis", color: "var(--cinnabar-deep)" };
  if (rel <= -20)
    return { label: locale === "vi" ? "Thù địch" : "Hostile", color: "var(--cinnabar)" };
  if (rel < 20)
    return { label: locale === "vi" ? "Sơ giao" : "Acquaintance", color: "var(--ink-soft)" };
  if (rel < 60)
    return { label: locale === "vi" ? "Thân hữu" : "Friendly", color: "var(--jade)" };
  return { label: locale === "vi" ? "Tri kỷ" : "Sworn", color: "var(--jade-deep)" };
}

/** Diverging gauge: −100 (cinnabar, leftward) … 0 … +100 (jade, rightward) */
function BondGauge({ rel }: { rel: number }) {
  const half = Math.min(100, Math.abs(rel)) / 2; // % of full track
  const positive = rel >= 0;
  return (
    <div
      style={{
        position: "relative",
        height: 6,
        borderRadius: 3,
        background: "var(--paper-deep)",
        overflow: "hidden",
      }}
    >
      {/* center tick */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "var(--ink-soft)",
          opacity: 0.45,
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: positive ? "50%" : `${50 - half}%`,
          width: `${half}%`,
          background: positive
            ? "linear-gradient(90deg, var(--jade-soft), var(--jade))"
            : "linear-gradient(90deg, var(--cinnabar), var(--cinnabar-soft))",
          borderRadius: 3,
          transition: "all 420ms ease",
        }}
      />
    </div>
  );
}

/** Brush-dot stepper showing arc stage progress */
function StageDots({ stage, total }: { stage: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < stage;
        const current = i === stage - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div
                style={{
                  width: 14,
                  height: 1,
                  background: filled ? "var(--ink-soft)" : "var(--paper-darker)",
                }}
              />
            )}
            <div
              style={{
                width: current ? 11 : 8,
                height: current ? 11 : 8,
                borderRadius: "50%",
                background: filled
                  ? current
                    ? "var(--cinnabar)"
                    : "var(--ink-soft)"
                  : "transparent",
                border: filled ? "none" : "1px solid var(--paper-darker)",
                boxShadow: current ? "0 0 0 3px var(--jade-glow)" : "none",
                transition: "all 300ms ease",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Rotated vermillion seal stamped on concluded arcs */
function ArcSeal({ kind, locale }: { kind: "completed" | "abandoned"; locale: Locale }) {
  const completed = kind === "completed";
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 44,
        height: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${completed ? "var(--cinnabar)" : "var(--ink-soft)"}`,
        borderRadius: 4,
        transform: "rotate(-8deg)",
        color: completed ? "var(--cinnabar)" : "var(--ink-soft)",
        opacity: completed ? 0.9 : 0.45,
      }}
    >
      <span className="t-han" style={{ fontSize: 16, lineHeight: 1 }}>
        {completed ? "圓滿" : "棄"}
      </span>
      <span style={{ fontSize: 7, letterSpacing: 1, marginTop: 2 }}>
        {completed ? (locale === "vi" ? "VIÊN MÃN" : "DONE") : locale === "vi" ? "BỎ DỞ" : "DROPPED"}
      </span>
    </div>
  );
}

function ArcEntry({ arc, locale }: { arc: StoryArc; locale: Locale }) {
  const active = arc.status === "active";
  const title = locale === "vi" ? arc.title : arc.title_en || arc.title;
  return (
    <Card
      padding={16}
      style={{
        opacity: active ? 1 : 0.72,
        borderLeft: active ? "3px solid var(--cinnabar)" : "3px solid var(--paper-darker)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span className="t-display" style={{ fontSize: 17, fontWeight: 500 }}>
              {title}
            </span>
            {active && (
              <Pill variant="gold" withDot>
                {locale === "vi"
                  ? `Hồi ${arc.stage}/${arc.total_stages}`
                  : `Act ${arc.stage}/${arc.total_stages}`}
              </Pill>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <StageDots stage={arc.stage} total={arc.total_stages} />
          </div>

          {arc.hook && (
            <div
              style={{
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--ink-soft)",
                paddingLeft: 10,
                borderLeft: "2px solid var(--paper-darker)",
                lineHeight: 1.5,
              }}
            >
              {arc.hook}
            </div>
          )}

          <div className="faint" style={{ fontSize: 10, marginTop: 8, letterSpacing: 0.5 }}>
            {locale === "vi"
              ? `Khởi: lượt ${arc.started_turn} · Mới nhất: lượt ${arc.updated_turn}`
              : `Began: turn ${arc.started_turn} · Latest: turn ${arc.updated_turn}`}
          </div>
        </div>

        {!active && <ArcSeal kind={arc.status as "completed" | "abandoned"} locale={locale} />}
      </div>
    </Card>
  );
}

function NpcEntry({ npc, locale }: { npc: KnownNPC; locale: Locale }) {
  const name = locale === "vi" ? npc.name : npc.name_en || npc.name;
  const tier = bondTier(npc.relationship, locale);
  return (
    <Card padding={14}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span className="t-display" style={{ fontSize: 15, fontWeight: 500 }}>
          {name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            color: tier.color,
            whiteSpace: "nowrap",
          }}
        >
          {tier.label}{" "}
          <span className="t-num" style={{ opacity: 0.7 }}>
            {npc.relationship >= 0 ? "+" : ""}
            {npc.relationship}
          </span>
        </span>
      </div>

      <BondGauge rel={npc.relationship} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        {npc.role && <Pill>{npc.role}</Pill>}
        {npc.location && <Pill variant="jade">{npc.location}</Pill>}
        <span className="faint" style={{ fontSize: 10, marginLeft: "auto" }}>
          {locale === "vi" ? `Gặp lần cuối: lượt ${npc.last_seen_turn}` : `Last seen: turn ${npc.last_seen_turn}`}
        </span>
      </div>

      {npc.notes && (
        <div
          style={{
            fontStyle: "italic",
            fontSize: 12,
            color: "var(--ink-soft)",
            marginTop: 6,
            lineHeight: 1.45,
          }}
        >
          “{npc.notes}”
        </div>
      )}
    </Card>
  );
}

function EmptyScroll({ han, text }: { han: string; text: string }) {
  return (
    <Card padding={28} style={{ textAlign: "center" }}>
      <div
        className="t-han"
        style={{ fontSize: 34, color: "var(--paper-darker)", marginBottom: 8, letterSpacing: 4 }}
      >
        {han}
      </div>
      <div style={{ fontStyle: "italic", fontSize: 13, color: "var(--ink-soft)" }}>{text}</div>
    </Card>
  );
}

export default function JournalView({ state, locale }: JournalViewProps) {
  const arcs = state.story_arcs || [];
  const activeArcs = arcs
    .filter((a) => a.status === "active")
    .sort((a, b) => b.updated_turn - a.updated_turn);
  const closedArcs = arcs
    .filter((a) => a.status !== "active")
    .sort((a, b) => b.updated_turn - a.updated_turn);

  const npcs = [...(state.npcs || [])].sort(
    (a, b) =>
      Math.abs(b.relationship) - Math.abs(a.relationship) || b.last_seen_turn - a.last_seen_turn
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <SectionHead
        han="録"
        title={locale === "vi" ? "Đạo Tâm Lục" : "Dao Journal"}
        subtitle={
          locale === "vi"
            ? "Nhân quả đã kết, cơ duyên đang mở"
            : "Karma woven, destinies unfolding"
        }
        right={
          <Pill variant="gold">
            {locale === "vi"
              ? `${activeArcs.length} tuyến truyện · ${npcs.length} nhân duyên`
              : `${activeArcs.length} arcs · ${npcs.length} bonds`}
          </Pill>
        }
      />

      {/* ===== Story arcs ===== */}
      <section>
        <SmallHead>
          {locale === "vi" ? "因果 · TUYẾN TRUYỆN" : "因果 · STORY ARCS"}
        </SmallHead>
        {activeArcs.length === 0 && closedArcs.length === 0 ? (
          <EmptyScroll
            han="白紙"
            text={
              locale === "vi"
                ? "Trang giấy còn trắng — bước ra giang hồ, nhân quả sẽ tự tìm đến."
                : "The page is still blank — walk the jianghu, and karma will find you."
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeArcs.map((arc) => (
              <ArcEntry key={arc.id} arc={arc} locale={locale} />
            ))}
            {closedArcs.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 6, fontSize: 10 }}>
                  {locale === "vi" ? "Đã khép lại" : "Concluded"}
                </div>
                {closedArcs.map((arc) => (
                  <ArcEntry key={arc.id} arc={arc} locale={locale} />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* ===== Known NPCs ===== */}
      <section>
        <SmallHead>{locale === "vi" ? "人緣 · NHÂN DUYÊN" : "人緣 · BONDS"}</SmallHead>
        {npcs.length === 0 ? (
          <EmptyScroll
            han="獨行"
            text={
              locale === "vi"
                ? "Đường tu còn độc hành — những gương mặt đáng nhớ sẽ được khắc lại nơi đây."
                : "The path is still walked alone — memorable faces will be inscribed here."
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {npcs.map((npc) => (
              <NpcEntry key={npc.id} npc={npc} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
