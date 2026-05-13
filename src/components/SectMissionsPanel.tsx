"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActiveSectMission,
  GameState,
  SectMissionObjective,
  SectMissionTemplate,
} from "@/types/game";
import { Locale } from "@/lib/i18n/translations";
import Modal from "./Modal";
import { useToast } from "./Toast";
import { getSectById } from "@/lib/game/sects";
import { getMissionTemplate } from "@/lib/game/sect-missions";

interface SectMissionsPanelProps {
  state: GameState;
  locale: Locale;
  onMutated?: () => void; // Called after accept/abandon to refresh parent state
  /** When true, mutation buttons are disabled to avoid clobbering the turn save. */
  processing?: boolean;
}

export default function SectMissionsPanel({
  state,
  locale,
  onMutated,
  processing,
}: SectMissionsPanelProps) {
  const { toast } = useToast();
  const [available, setAvailable] = useState<SectMissionTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState<string | null>(null);
  const [busyInstance, setBusyInstance] = useState<string | null>(null);
  const [showBrowse, setShowBrowse] = useState(false);
  const [rerollCooldown, setRerollCooldown] = useState(0);

  const active: ActiveSectMission[] = state.sect_missions ?? [];

  const listMissions = useCallback(
    async (reroll = false) => {
      setLoading(true);
      try {
        const res = await fetch("/api/sect-mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", reroll }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(
            data.error || (locale === "vi" ? "Lỗi tải nhiệm vụ" : "Failed to load missions")
          );
          return;
        }
        setAvailable(data.available ?? []);
        setRerollCooldown(data.reroll_available_in ?? 0);
      } catch (err) {
        toast.error(locale === "vi" ? "Mất kết nối" : "Network error");
      } finally {
        setLoading(false);
      }
    },
    [locale, toast]
  );

  const openBrowse = useCallback(async () => {
    setShowBrowse(true);
    if (!available) await listMissions(false);
  }, [available, listMissions]);

  const accept = useCallback(
    async (templateId: string) => {
      if (processing) {
        toast.warning(
          locale === "vi"
            ? "Đợi lượt xử lý xong rồi nhận nhiệm vụ"
            : "Wait for the current turn to finish before accepting"
        );
        return;
      }
      setBusyTemplate(templateId);
      try {
        const res = await fetch("/api/sect-mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", template_id: templateId }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || (locale === "vi" ? "Lỗi nhận nhiệm vụ" : "Failed to accept"));
          return;
        }
        toast.success(locale === "vi" ? "Đã nhận nhiệm vụ" : "Mission accepted");
        setShowBrowse(false);
        // Remove the accepted template from the currently-displayed list;
        // the server also drops it from its cache so next `list` won't re-offer.
        setAvailable((prev) => prev?.filter((t) => t.id !== templateId) ?? null);
        onMutated?.();
      } finally {
        setBusyTemplate(null);
      }
    },
    [locale, onMutated, processing, toast]
  );

  const abandon = useCallback(
    async (instanceId: string) => {
      if (processing) {
        toast.warning(
          locale === "vi"
            ? "Đợi lượt xử lý xong rồi bỏ nhiệm vụ"
            : "Wait for the current turn to finish before abandoning"
        );
        return;
      }
      setBusyInstance(instanceId);
      try {
        const res = await fetch("/api/sect-mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "abandon", instance_id: instanceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || (locale === "vi" ? "Lỗi bỏ nhiệm vụ" : "Failed to abandon"));
          return;
        }
        toast.warning(
          locale === "vi" ? "Bỏ nhiệm vụ (-3 danh tiếng)" : "Mission abandoned (-3 reputation)"
        );
        onMutated?.();
      } finally {
        setBusyInstance(null);
      }
    },
    [locale, onMutated, processing, toast]
  );

  return (
    <>
      <div className="ink-card" style={{ padding: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 14,
          }}
        >
          <h2
            className="t-display"
            style={{
              fontSize: 20,
              color: "var(--ink)",
              margin: 0,
              display: "flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <span className="t-han" style={{ fontSize: 22, color: "var(--cinnabar)" }}>
              任
            </span>
            {locale === "vi" ? "Bảng Nhiệm Vụ" : "Mission Board"}
          </h2>
          <button
            type="button"
            onClick={openBrowse}
            className="ink-btn ghost sm"
          >
            <span className="t-han">覽</span>
            {locale === "vi" ? "Xem Nhiệm Vụ" : "Browse"}
          </button>
        </div>

        {active.length === 0 ? (
          <p
            className="t-body"
            style={{
              fontStyle: "italic",
              color: "var(--ink-mute)",
              fontSize: 13,
              margin: 0,
            }}
          >
            {locale === "vi"
              ? "Chưa nhận nhiệm vụ nào. Bấm \"Xem Nhiệm Vụ\" để xem các nhiệm vụ khả dụng."
              : 'No missions active. Click "Browse" to view available missions.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((m) => (
              <ActiveMissionRow
                key={m.instance_id}
                mission={m}
                turnCount={state.turn_count}
                locale={locale}
                abandoning={busyInstance === m.instance_id}
                disabled={!!processing}
                onAbandon={() => abandon(m.instance_id)}
              />
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={showBrowse} onClose={() => setShowBrowse(false)} zLevel="high">
        <div
          className="ink-card"
          style={{
            padding: 24,
            maxWidth: 640,
            width: "100%",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h3
              className="t-display"
              style={{
                fontSize: 22,
                color: "var(--ink)",
                margin: 0,
                display: "flex",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <span className="t-han" style={{ color: "var(--cinnabar)" }}>
                榜
              </span>
              {locale === "vi" ? "Nhiệm Vụ Khả Dụng" : "Available Missions"}
            </h3>
            <button
              type="button"
              onClick={() => setShowBrowse(false)}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--ink-mute)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
              }}
              aria-label={locale === "vi" ? "Đóng" : "Close"}
            >
              ×
            </button>
          </div>

          {loading && (
            <p
              className="t-body"
              style={{
                textAlign: "center",
                fontStyle: "italic",
                color: "var(--ink-mute)",
                padding: "30px 0",
              }}
            >
              {locale === "vi" ? "Đang tải…" : "Loading…"}
            </p>
          )}

          {!loading && available && available.length === 0 && (
            <p
              className="t-body"
              style={{
                textAlign: "center",
                fontStyle: "italic",
                color: "var(--ink-mute)",
                padding: "30px 0",
                fontSize: 14,
              }}
            >
              {locale === "vi"
                ? "Không có nhiệm vụ phù hợp cho tông môn này."
                : "No missions available for your sect type."}
            </p>
          )}

          {!loading && available && available.length > 0 && (
            <ul className="space-y-3">
              {available.map((t) => (
                <AvailableMissionRow
                  key={t.id}
                  template={t}
                  locale={locale}
                  disabled={active.some((m) => m.template_id === t.id) || !!processing}
                  accepting={busyTemplate === t.id}
                  processing={!!processing}
                  onAccept={() => accept(t.id)}
                />
              ))}
            </ul>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            {rerollCooldown > 0 && (
              <span
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                }}
              >
                {locale === "vi"
                  ? `Còn ${rerollCooldown} lượt mới đổi được`
                  : `Reroll in ${rerollCooldown} turns`}
              </span>
            )}
            <button
              type="button"
              onClick={() => listMissions(true)}
              disabled={loading || rerollCooldown > 0}
              className="ink-btn ghost sm"
            >
              <span className="t-han">換</span>
              {locale === "vi" ? "Đổi Bảng" : "Reroll"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function objectiveLabel(obj: SectMissionObjective, locale: Locale, progress?: number): string {
  switch (obj.kind) {
    case "gather_items":
      return locale === "vi"
        ? `Thu ${progress ?? 0}/${obj.count} ${obj.item_type ?? "vật phẩm"}${
            obj.min_rarity ? ` (≥${obj.min_rarity})` : ""
          }`
        : `Gather ${progress ?? 0}/${obj.count} ${obj.item_type ?? "items"}${
            obj.min_rarity ? ` (≥${obj.min_rarity})` : ""
          }`;
    case "win_combats":
      return locale === "vi"
        ? `Thắng ${progress ?? 0}/${obj.count} trận`
        : `Win ${progress ?? 0}/${obj.count} combats`;
    case "defeat_rival_member": {
      const rival = obj.rival_sect_id ? getSectById(obj.rival_sect_id) : undefined;
      const rivalName = rival ? (locale === "vi" ? rival.name : rival.name_en) : obj.rival_sect_id ?? "";
      return locale === "vi"
        ? `Hạ ${progress ?? 0}/${obj.count} đệ tử ${rivalName}`
        : `Defeat ${progress ?? 0}/${obj.count} ${rivalName} disciples`;
    }
    case "cultivate_exp":
      return locale === "vi"
        ? `Tích ${progress ?? 0}/${obj.amount} exp tu vi`
        : `Accumulate ${progress ?? 0}/${obj.amount} cultivation exp`;
    case "visit_region":
      return locale === "vi" ? `Tới vùng ${obj.region_id}` : `Reach region ${obj.region_id}`;
  }
}

function difficultyBadge(diff: "easy" | "medium" | "hard", locale: Locale) {
  const variant =
    diff === "easy" ? "jade" : diff === "medium" ? "gold" : "cinnabar";
  const label =
    locale === "vi"
      ? diff === "easy"
        ? "Dễ"
        : diff === "medium"
          ? "Trung"
          : "Khó"
      : diff.charAt(0).toUpperCase() + diff.slice(1);
  return (
    <span
      className={`pill ${variant}`}
      style={{ fontSize: 10, padding: "1px 8px" }}
    >
      {label}
    </span>
  );
}

function rewardSummary(
  reward: { contribution: number; silver?: number; spirit_stones?: number },
  locale: Locale
) {
  const parts: string[] = [
    `+${reward.contribution} ${locale === "vi" ? "cống hiến" : "contrib"}`,
  ];
  if (reward.silver) parts.push(`+${reward.silver} ${locale === "vi" ? "bạc" : "silver"}`);
  if (reward.spirit_stones)
    parts.push(`+${reward.spirit_stones} ${locale === "vi" ? "linh thạch" : "stones"}`);
  return parts.join(" · ");
}

function ActiveMissionRow({
  mission,
  turnCount,
  locale,
  abandoning,
  disabled,
  onAbandon,
}: {
  mission: ActiveSectMission;
  turnCount: number;
  locale: Locale;
  abandoning: boolean;
  disabled: boolean;
  onAbandon: () => void;
}) {
  const template = getMissionTemplate(mission.template_id);
  const title = template
    ? locale === "vi"
      ? template.name
      : template.name_en
    : mission.template_id;
  const turnsLeft = mission.deadline_turn - turnCount;
  const urgent = turnsLeft <= 5;
  const goalCount =
    mission.objective.kind === "cultivate_exp"
      ? mission.objective.amount
      : mission.objective.kind === "visit_region"
        ? 1
        : mission.objective.count;
  const pct = Math.min(100, (mission.progress / Math.max(1, goalCount)) * 100);

  return (
    <li
      className="card-inset"
      style={{ padding: 14, borderRadius: 3, listStyle: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className="t-display"
            style={{ fontSize: 16, color: "var(--ink)" }}
          >
            {title}
          </span>
          {template && difficultyBadge(template.difficulty, locale)}
        </div>
        <span
          className="t-num"
          style={{
            fontSize: 11,
            color: urgent ? "var(--cinnabar-deep)" : "var(--ink-mute)",
          }}
        >
          {locale === "vi" ? `còn ${turnsLeft} lượt` : `${turnsLeft} turns left`}
        </span>
      </div>
      <div
        className="t-body"
        style={{
          fontStyle: "italic",
          color: "var(--ink-soft)",
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {objectiveLabel(mission.objective, locale, mission.progress)}
      </div>
      <div
        style={{
          height: 6,
          background: "var(--paper-darker)",
          border: "1px solid var(--line)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--jade-deep), var(--jade-soft))",
            transition: "width 0.4s",
          }}
        />
      </div>
      {template && (
        <div
          className="label"
          style={{
            marginBottom: 8,
            color: "var(--gold-deep)",
            fontSize: 10,
            letterSpacing: "0.1em",
          }}
        >
          <span className="t-han" style={{ marginRight: 4 }}>
            賞
          </span>
          {rewardSummary(template.reward, locale)}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onAbandon}
          disabled={abandoning || disabled}
          className="ink-btn cinnabar sm"
          title={
            disabled && !abandoning
              ? locale === "vi"
                ? "Đợi lượt xử lý xong"
                : "Wait for turn to finish"
              : undefined
          }
        >
          <span className="t-han">棄</span>
          {abandoning
            ? locale === "vi"
              ? "Đang bỏ…"
              : "Abandoning…"
            : locale === "vi"
              ? "Bỏ Nhiệm Vụ"
              : "Abandon"}
        </button>
      </div>
    </li>
  );
}

function AvailableMissionRow({
  template,
  locale,
  disabled,
  accepting,
  processing,
  onAccept,
}: {
  template: SectMissionTemplate;
  locale: Locale;
  disabled: boolean;
  accepting: boolean;
  processing: boolean;
  onAccept: () => void;
}) {
  const title = locale === "vi" ? template.name : template.name_en;
  const desc = locale === "vi" ? template.description : template.description_en;
  return (
    <li
      className="card-inset"
      style={{ padding: 14, borderRadius: 3, listStyle: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="t-display"
            style={{ fontSize: 16, color: "var(--ink)" }}
          >
            {title}
          </span>
          {difficultyBadge(template.difficulty, locale)}
        </div>
        <span
          className="t-num"
          style={{ fontSize: 11, color: "var(--ink-mute)" }}
        >
          {locale === "vi"
            ? `Hạn ${template.deadline_turns} lượt`
            : `Deadline ${template.deadline_turns} turns`}
        </span>
      </div>
      <p
        className="t-body"
        style={{
          fontStyle: "italic",
          color: "var(--ink-soft)",
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        {desc}
      </p>
      <div
        className="label"
        style={{
          marginBottom: 10,
          color: "var(--ink-mute)",
          fontSize: 10,
          letterSpacing: "0.1em",
        }}
      >
        <span className="t-han" style={{ marginRight: 4 }}>
          的
        </span>
        {objectiveLabel(template.objective, locale)} ·{" "}
        <span style={{ color: "var(--gold-deep)" }}>
          {rewardSummary(template.reward, locale)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled || accepting}
          className="ink-btn primary sm"
        >
          {accepting
            ? locale === "vi"
              ? "Đang nhận..."
              : "Accepting..."
            : processing
              ? locale === "vi"
                ? "Đợi lượt..."
                : "Waiting turn..."
              : disabled
                ? locale === "vi"
                  ? "Đã nhận"
                  : "Already active"
                : locale === "vi"
                  ? "Nhận nhiệm vụ"
                  : "Accept"}
        </button>
      </div>
    </li>
  );
}

// ——— Relations sub-panel ———

export function SectRelationsPanel({ state, locale }: { state: GameState; locale: Locale }) {
  const relations = state.sect_relations;
  const entries = useMemo(() => {
    if (!relations) return [];
    return Object.values(relations)
      .filter((r) => r.sect_id !== state.sect_membership?.sect.id)
      .sort((a, b) => a.relation - b.relation);
  }, [relations, state.sect_membership?.sect.id]);

  if (!state.sect_membership) return null;
  if (entries.length === 0) {
    return (
      <div className="ink-card" style={{ padding: 22 }}>
        <h2
          className="t-display"
          style={{
            fontSize: 18,
            color: "var(--ink)",
            margin: "0 0 6px",
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span className="t-han" style={{ color: "var(--cinnabar)" }}>
            交
          </span>
          {locale === "vi" ? "Quan Hệ Tông Môn" : "Sect Relations"}
        </h2>
        <p
          className="t-body"
          style={{ fontStyle: "italic", color: "var(--ink-mute)", fontSize: 13, margin: 0 }}
        >
          {locale === "vi" ? "Chưa có dữ liệu quan hệ." : "No relation data yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="ink-card" style={{ padding: 22 }}>
      <h2
        className="t-display"
        style={{
          fontSize: 18,
          color: "var(--ink)",
          margin: "0 0 14px",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span className="t-han" style={{ color: "var(--cinnabar)" }}>
          交
        </span>
        {locale === "vi" ? "Quan Hệ Tông Môn" : "Sect Relations"}
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((rel) => {
          const sect = getSectById(rel.sect_id);
          const name = sect ? (locale === "vi" ? sect.name : sect.name_en) : rel.sect_id;
          const tier =
            rel.relation <= -50
              ? { vi: "Địch", en: "Hostile", color: "var(--cinnabar-deep)" }
              : rel.relation < 0
                ? { vi: "Lạnh Nhạt", en: "Cool", color: "var(--gold-deep)" }
                : rel.relation === 0
                  ? { vi: "Trung Lập", en: "Neutral", color: "var(--ink-mute)" }
                  : rel.relation < 50
                    ? { vi: "Thân Thiện", en: "Friendly", color: "var(--jade-deep)" }
                    : { vi: "Đồng Minh", en: "Ally", color: "#3a6280" };
          const pct = Math.round(((rel.relation + 100) / 200) * 100);
          const barColor =
            rel.relation < 0
              ? "var(--cinnabar)"
              : rel.relation === 0
                ? "var(--ink-mute)"
                : "var(--jade)";
          return (
            <li key={rel.sect_id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span
                  className="t-display"
                  style={{ fontSize: 14, color: "var(--ink)" }}
                >
                  {name}
                </span>
                <span
                  className="label"
                  style={{
                    color: tier.color,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                  }}
                >
                  {locale === "vi" ? tier.vi : tier.en} (
                  {rel.relation > 0 ? "+" : ""}
                  {rel.relation})
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: "var(--paper-darker)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: barColor,
                    transition: "width 0.4s",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
