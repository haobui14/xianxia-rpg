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
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-xianxia-gold">
            {locale === "vi" ? "📜 Bảng Nhiệm Vụ" : "📜 Mission Board"}
          </h2>
          <button
            type="button"
            onClick={openBrowse}
            className="px-3 py-1.5 text-sm bg-xianxia-accent/20 hover:bg-xianxia-accent/30 border border-xianxia-accent/40 rounded text-xianxia-accent transition"
          >
            {locale === "vi" ? "Xem nhiệm vụ mới" : "Browse available"}
          </button>
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-gray-500">
            {locale === "vi"
              ? "Chưa nhận nhiệm vụ nào. Bấm \"Xem nhiệm vụ mới\" để nhận."
              : 'No missions active. Click "Browse available" to accept one.'}
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
        <div className="bg-xianxia-dark border border-xianxia-accent/40 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-xianxia-gold">
              {locale === "vi" ? "Nhiệm vụ khả dụng" : "Available Missions"}
            </h3>
            <button
              type="button"
              onClick={() => setShowBrowse(false)}
              className="text-gray-400 hover:text-white text-2xl leading-none"
              aria-label={locale === "vi" ? "Đóng" : "Close"}
            >
              ×
            </button>
          </div>

          {loading && (
            <p className="text-center text-gray-400 py-8">
              {locale === "vi" ? "Đang tải..." : "Loading..."}
            </p>
          )}

          {!loading && available && available.length === 0 && (
            <p className="text-center text-gray-500 py-8">
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

          <div className="mt-4 flex items-center justify-end gap-3">
            {rerollCooldown > 0 && (
              <span className="text-[11px] text-gray-500">
                {locale === "vi"
                  ? `Còn ${rerollCooldown} lượt mới đổi được`
                  : `Reroll in ${rerollCooldown} turns`}
              </span>
            )}
            <button
              type="button"
              onClick={() => listMissions(true)}
              disabled={loading || rerollCooldown > 0}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-gray-200"
            >
              {locale === "vi" ? "Lấy nhiệm vụ khác" : "Reroll"}
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
  const color =
    diff === "easy"
      ? "bg-green-700/40 text-green-300 border-green-600/40"
      : diff === "medium"
        ? "bg-yellow-700/40 text-yellow-300 border-yellow-600/40"
        : "bg-red-700/40 text-red-300 border-red-600/40";
  const label =
    locale === "vi"
      ? diff === "easy"
        ? "Dễ"
        : diff === "medium"
          ? "Trung"
          : "Khó"
      : diff.charAt(0).toUpperCase() + diff.slice(1);
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color} uppercase tracking-wide`}>
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
    <li className="bg-gray-900/40 border border-gray-700/60 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-200">{title}</span>
          {template && difficultyBadge(template.difficulty, locale)}
        </div>
        <span className={`text-xs ${urgent ? "text-red-400" : "text-gray-400"}`}>
          {locale === "vi" ? `còn ${turnsLeft} lượt` : `${turnsLeft} turns left`}
        </span>
      </div>
      <div className="text-xs text-gray-400 mb-2">
        {objectiveLabel(mission.objective, locale, mission.progress)}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className="h-full bg-xianxia-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {template && (
        <div className="text-[11px] text-gray-500 mb-2">
          {locale === "vi" ? "Thưởng: " : "Reward: "}
          {rewardSummary(template.reward, locale)}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAbandon}
          disabled={abandoning || disabled}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            disabled && !abandoning
              ? locale === "vi"
                ? "Đợi lượt xử lý xong"
                : "Wait for turn to finish"
              : undefined
          }
        >
          {abandoning
            ? locale === "vi"
              ? "Đang bỏ..."
              : "Abandoning..."
            : locale === "vi"
              ? "Bỏ nhiệm vụ"
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
    <li className="bg-gray-900/40 border border-gray-700/60 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-200">{title}</span>
          {difficultyBadge(template.difficulty, locale)}
        </div>
        <span className="text-xs text-gray-500">
          {locale === "vi"
            ? `Hạn: ${template.deadline_turns} lượt`
            : `Deadline: ${template.deadline_turns} turns`}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{desc}</p>
      <div className="text-[11px] text-gray-500 mb-2">
        {locale === "vi" ? "Mục tiêu: " : "Goal: "}
        {objectiveLabel(template.objective, locale)} · {rewardSummary(template.reward, locale)}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled || accepting}
          className="text-xs px-3 py-1 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 disabled:opacity-50 disabled:cursor-not-allowed border border-xianxia-accent/40 rounded text-xianxia-accent"
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
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-2 text-xianxia-gold">
          {locale === "vi" ? "🌐 Quan hệ tông môn" : "🌐 Sect Relations"}
        </h2>
        <p className="text-sm text-gray-500">
          {locale === "vi" ? "Chưa có dữ liệu quan hệ." : "No relation data yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-xianxia-gold">
        {locale === "vi" ? "🌐 Quan hệ tông môn" : "🌐 Sect Relations"}
      </h2>
      <ul className="space-y-2">
        {entries.map((rel) => {
          const sect = getSectById(rel.sect_id);
          const name = sect ? (locale === "vi" ? sect.name : sect.name_en) : rel.sect_id;
          const label =
            rel.relation <= -50
              ? { vi: "Địch", en: "Hostile", color: "text-red-400" }
              : rel.relation < 0
                ? { vi: "Lạnh nhạt", en: "Cool", color: "text-orange-400" }
                : rel.relation === 0
                  ? { vi: "Trung lập", en: "Neutral", color: "text-gray-400" }
                  : rel.relation < 50
                    ? { vi: "Thân thiện", en: "Friendly", color: "text-green-400" }
                    : { vi: "Đồng minh", en: "Ally", color: "text-blue-400" };
          const pct = Math.round(((rel.relation + 100) / 200) * 100);
          return (
            <li key={rel.sect_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-200">{name}</span>
                <span className={`text-xs ${label.color}`}>
                  {locale === "vi" ? label.vi : label.en} ({rel.relation > 0 ? "+" : ""}
                  {rel.relation})
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${
                    rel.relation < 0
                      ? "bg-red-500"
                      : rel.relation === 0
                        ? "bg-gray-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
