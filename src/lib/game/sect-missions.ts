import {
  ActiveSectMission,
  GameEvent,
  GameState,
  ProposedDelta,
  SectMissionDifficulty,
  SectMissionObjective,
  SectMissionTemplate,
  SectType,
} from "@/types/game";
import { getSectById, NAMED_SECTS, type NamedSect } from "./sects";

// Static template pool. Each template tags which sect types offer it; the
// generator filters by the player's sect type. Keep this hand-authored —
// variety comes from which sect types see which pools, plus randomized
// count/rival overlays at accept time.
export const MISSION_TEMPLATES: SectMissionTemplate[] = [
  // ——— Gathering ———
  {
    id: "gather_herbs_easy",
    sect_types: ["Đan", "PhậtMôn", "Tổng"],
    name: "Thu thập dược liệu",
    name_en: "Gather Spirit Herbs",
    description: "Tạp vụ đường thiếu linh thảo — hái đủ 3 loại dược liệu cấp thấp.",
    description_en: "The chore hall is short on herbs — gather any 3 low-grade medicinal items.",
    difficulty: "easy",
    objective: { kind: "gather_items", count: 3, item_type: "Medicine" },
    reward: { contribution: 20, silver: 50 },
    deadline_turns: 15,
  },
  {
    id: "gather_materials_medium",
    sect_types: ["Kiếm", "Trận", "Tổng", "ThươngHội"],
    name: "Thu thập vật liệu luyện khí",
    name_en: "Gather Forging Materials",
    description: "Phòng luyện khí thiếu vật liệu — thu đủ 4 vật liệu luyện khí hoặc khoáng thạch.",
    description_en:
      "The forge is short on materials — gather 4 forging materials or ores.",
    difficulty: "medium",
    objective: { kind: "gather_items", count: 4, item_type: "Material" },
    reward: { contribution: 50, silver: 120 },
    deadline_turns: 20,
  },
  {
    id: "gather_rare_herb_hard",
    sect_types: ["Đan", "PhậtMôn"],
    name: "Tầm linh dược hiếm",
    name_en: "Seek Rare Spirit Medicine",
    description: "Trưởng lão cần một vị linh dược Trung phẩm trở lên cho luyện đan.",
    description_en:
      "An elder requests an Uncommon-or-higher spirit medicine for pill refinement.",
    difficulty: "hard",
    objective: { kind: "gather_items", count: 1, item_type: "Medicine", min_rarity: "Uncommon" },
    reward: { contribution: 100, silver: 200, spirit_stones: 5 },
    deadline_turns: 25,
  },

  // ——— Combat / patrol ———
  {
    id: "patrol_bandits_easy",
    sect_types: ["Kiếm", "Tổng", "YêuThú"],
    name: "Tuần tra trừ phỉ",
    name_en: "Patrol and Clear Bandits",
    description: "Bạch đạo quan sát thấy phỉ xuất hiện — dẹp 2 trận chiến cho tông môn.",
    description_en: "Bandits stirring near the road — win 2 combat encounters for the sect.",
    difficulty: "easy",
    objective: { kind: "win_combats", count: 2 },
    reward: { contribution: 30, silver: 80 },
    deadline_turns: 15,
  },
  {
    id: "subdue_beasts_medium",
    sect_types: ["YêuThú", "Kiếm", "Tổng"],
    name: "Hàng phục yêu thú",
    name_en: "Subdue Spirit Beasts",
    description: "Yêu thú hoành hành trong rừng — đánh bại 3 mục tiêu.",
    description_en: "Spirit beasts are rampaging — defeat 3 targets.",
    difficulty: "medium",
    objective: { kind: "win_combats", count: 3 },
    reward: { contribution: 60, silver: 130 },
    deadline_turns: 20,
  },
  {
    id: "hunt_demonic_hard",
    sect_types: ["Kiếm", "PhậtMôn"],
    name: "Truy sát ma tu",
    name_en: "Hunt Demonic Cultivators",
    description: "Ma tu quấy nhiễu phàm nhân — đánh bại 2 đệ tử của Ma Tông.",
    description_en:
      "Demonic cultivators harass mortals — defeat 2 disciples of the Demonic Sect.",
    difficulty: "hard",
    objective: { kind: "defeat_rival_member", count: 2, rival_sect_id: "huyet_sat_ma_tong" },
    reward: { contribution: 130, silver: 280, spirit_stones: 8 },
    deadline_turns: 25,
  },
  {
    id: "tame_rare_beast_hard",
    sect_types: ["YêuThú", "Tổng"],
    name: "Thuần phục yêu thú hiếm",
    name_en: "Subdue a Rare Spirit Beast",
    description:
      "Một yêu thú cổ đại xuất hiện trong núi sâu — đánh bại 4 yêu thú để chứng tỏ bản lĩnh.",
    description_en:
      "An ancient spirit beast stirs deep in the mountains — defeat 4 beasts to prove your mettle.",
    difficulty: "hard",
    objective: { kind: "win_combats", count: 4 },
    reward: { contribution: 120, silver: 260, spirit_stones: 6 },
    deadline_turns: 25,
  },
  {
    id: "merchant_escort_hard",
    sect_types: ["ThươngHội", "Tổng"],
    name: "Hộ tống đoàn thương",
    name_en: "Escort the Merchant Caravan",
    description:
      "Thương hội nhờ hộ tống một đoàn hàng quý — thắng 3 trận chiến trên đường đi.",
    description_en:
      "The merchant guild needs a caravan escort — win 3 combat encounters on the road.",
    difficulty: "hard",
    objective: { kind: "win_combats", count: 3 },
    reward: { contribution: 110, silver: 400 },
    deadline_turns: 22,
  },
  {
    id: "formation_trial_hard",
    sect_types: ["Trận"],
    name: "Khảo nghiệm trận pháp",
    name_en: "Formation Trial",
    description: "Trưởng lão yêu cầu tích đủ 500 exp tu vi để chứng minh đạo tâm.",
    description_en:
      "An elder demands you accumulate 500 cultivation exp to prove your dao heart.",
    difficulty: "hard",
    objective: { kind: "cultivate_exp", amount: 500 },
    reward: { contribution: 120, silver: 250, spirit_stones: 5 },
    deadline_turns: 25,
  },

  // ——— Demonic / rogue side ———
  {
    id: "raid_righteous_medium",
    sect_types: ["Ma"],
    name: "Cướp phá chính đạo",
    name_en: "Raid the Righteous",
    description: "Trưởng lão ra lệnh hạ 2 đệ tử chính đạo để thu linh khí.",
    description_en:
      "An elder orders you to bring down 2 righteous disciples for their essence.",
    difficulty: "medium",
    objective: { kind: "defeat_rival_member", count: 2, rival_sect_id: "thanh_van_kiem" },
    reward: { contribution: 100, silver: 200, spirit_stones: 6 },
    deadline_turns: 20,
  },

  // ——— Cultivation / self ———
  {
    id: "cultivate_basic_easy",
    sect_types: ["Kiếm", "Đan", "Trận", "YêuThú", "Ma", "PhậtMôn", "Tổng", "ThươngHội"],
    name: "Khổ luyện tông môn",
    name_en: "Sect Cultivation Quota",
    description: "Hoàn thành hạn mức tu luyện — tích đủ 120 điểm kinh nghiệm tu vi.",
    description_en: "Meet the cultivation quota — accumulate 120 cultivation exp.",
    difficulty: "easy",
    objective: { kind: "cultivate_exp", amount: 120 },
    reward: { contribution: 25, silver: 40 },
    deadline_turns: 12,
  },
  {
    id: "cultivate_advanced_medium",
    sect_types: ["Kiếm", "Đan", "Trận", "YêuThú", "Ma", "PhậtMôn", "Tổng"],
    name: "Thử thách bế quan",
    name_en: "Seclusion Trial",
    description: "Chứng minh đạo tâm — tích đủ 300 điểm kinh nghiệm tu vi trong hạn.",
    description_en: "Prove your dao heart — accumulate 300 cultivation exp within the deadline.",
    difficulty: "medium",
    objective: { kind: "cultivate_exp", amount: 300 },
    reward: { contribution: 55, silver: 100, spirit_stones: 3 },
    deadline_turns: 18,
  },

  // ——— Travel / scouting ———
  {
    id: "scout_region_easy",
    sect_types: ["Kiếm", "YêuThú", "Tổng", "ThươngHội"],
    name: "Trinh sát Hỏa Sơn",
    name_en: "Scout Fire Mountain",
    description: "Đưa tin về tình hình Hỏa Sơn — tới được khu vực.",
    description_en: "Bring intel on Fire Mountain — travel there.",
    difficulty: "easy",
    objective: { kind: "visit_region", region_id: "hoa_son" },
    reward: { contribution: 30, silver: 60 },
    deadline_turns: 18,
  },
  {
    id: "scout_region_medium",
    sect_types: ["Kiếm", "Tổng", "ThươngHội"],
    name: "Trinh sát Trầm Lôi",
    name_en: "Scout Silent Thunder",
    description: "Tuần tra vùng Trầm Lôi xem có dị thường.",
    description_en: "Patrol the Silent Thunder region for anomalies.",
    difficulty: "medium",
    objective: { kind: "visit_region", region_id: "tram_loi" },
    reward: { contribution: 60, silver: 120, spirit_stones: 2 },
    deadline_turns: 22,
  },
];

const TEMPLATES_BY_ID: Record<string, SectMissionTemplate> = Object.fromEntries(
  MISSION_TEMPLATES.map((t) => [t.id, t])
);

export function getMissionTemplate(id: string): SectMissionTemplate | undefined {
  return TEMPLATES_BY_ID[id];
}

/**
 * Return up to `count` distinct mission templates that fit the sect's type.
 * Picks with a simple weighted sample: easy 50%, medium 35%, hard 15%.
 */
export function rollOpenMissions(
  sectType: SectType,
  count: number,
  rand: () => number = Math.random
): SectMissionTemplate[] {
  const pool = MISSION_TEMPLATES.filter((t) => t.sect_types.includes(sectType));
  if (pool.length === 0) return [];
  const weighted = pool.map((t) => ({
    t,
    w: t.difficulty === "easy" ? 50 : t.difficulty === "medium" ? 35 : 15,
  }));
  const picked: SectMissionTemplate[] = [];
  const remaining = [...weighted];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalW = remaining.reduce((s, x) => s + x.w, 0);
    let r = rand() * totalW;
    let idx = 0;
    for (let k = 0; k < remaining.length; k++) {
      r -= remaining[k].w;
      if (r <= 0) {
        idx = k;
        break;
      }
    }
    picked.push(remaining[idx].t);
    remaining.splice(idx, 1);
  }
  return picked;
}

/**
 * Turn a template into an active instance. If the objective references a
 * rival sect dynamically, resolve it against the player's current sect.
 */
export function instantiateMission(
  template: SectMissionTemplate,
  currentTurn: number,
  playerSectId?: string,
  fallbackRivalId?: string
): ActiveSectMission {
  let objective: SectMissionObjective = template.objective;
  // If defeat_rival_member has no rival_sect_id, try to resolve one: first
  // the named-sect rival list, then any caller-supplied fallback (typically
  // the most-hostile sect from state.sect_relations for ad-hoc sects).
  if (objective.kind === "defeat_rival_member" && !objective.rival_sect_id) {
    let rival: string | undefined;
    if (playerSectId) {
      rival = getSectById(playerSectId)?.rivals[0];
    }
    if (!rival && fallbackRivalId) rival = fallbackRivalId;
    if (rival) objective = { ...objective, rival_sect_id: rival };
  }

  // Prefer crypto.randomUUID for collision-free instance ids; fall back to a
  // turn+random+time composite for environments where it's unavailable.
  let unique: string;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    unique = globalThis.crypto.randomUUID();
  } else {
    unique = `${currentTurn}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
  }

  return {
    instance_id: `${template.id}_${unique}`,
    template_id: template.id,
    accepted_turn: currentTurn,
    deadline_turn: currentTurn + template.deadline_turns,
    progress: 0,
    objective,
  };
}

// ——— Resolution ———

/**
 * Inspect this turn's deltas & events and advance progress on every active
 * mission. Returns completion events that the turn route should push
 * (rewards are applied in place to `state`).
 */
export function resolveSectMissions(
  state: GameState,
  deltas: ProposedDelta[],
  events: GameEvent[]
): GameEvent[] {
  if (!state.sect_missions || state.sect_missions.length === 0) return [];

  const produced: GameEvent[] = [];
  const stillActive: ActiveSectMission[] = [];
  const currentTurn = state.turn_count;

  for (const mission of state.sect_missions) {
    const delta = progressDeltaForMission(mission, state, deltas, events);
    const goalCount = goalCountFor(mission.objective);
    if (delta > 0) mission.progress = Math.min(goalCount, mission.progress + delta);

    const isComplete = mission.progress >= goalCount;
    const isExpired = !isComplete && currentTurn >= mission.deadline_turn;

    if (isComplete) {
      applyMissionReward(state, mission);
      const template = getMissionTemplate(mission.template_id);
      produced.push({
        type: "sect_mission",
        data: {
          status: "completed",
          instance_id: mission.instance_id,
          template_id: mission.template_id,
          name: template?.name,
          name_en: template?.name_en,
          reward: template?.reward,
        },
      });
      // Remove its tracking flag
      if (state.flags) delete state.flags[`sect_mission_${mission.instance_id}`];
    } else if (isExpired) {
      applyMissionFailurePenalty(state, mission);
      produced.push({
        type: "sect_mission",
        data: {
          status: "failed",
          instance_id: mission.instance_id,
          template_id: mission.template_id,
        },
      });
      if (state.flags) delete state.flags[`sect_mission_${mission.instance_id}`];
    } else {
      stillActive.push(mission);
    }
  }

  state.sect_missions = stillActive;
  return produced;
}

function goalCountFor(obj: SectMissionObjective): number {
  switch (obj.kind) {
    case "gather_items":
    case "win_combats":
    case "defeat_rival_member":
      return obj.count;
    case "cultivate_exp":
      return obj.amount;
    case "visit_region":
      return 1;
  }
}

function progressDeltaForMission(
  mission: ActiveSectMission,
  state: GameState,
  deltas: ProposedDelta[],
  events: GameEvent[]
): number {
  const obj = mission.objective;

  switch (obj.kind) {
    case "gather_items": {
      // Count add_item deltas that match type + rarity filter.
      let gained = 0;
      for (const d of deltas) {
        if (d.field !== "add_item" && d.field !== "inventory.add_item") continue;
        if (d.operation !== "add") continue;
        const item = d.value as { type?: string; rarity?: string; quantity?: number };
        if (!item) continue;
        if (obj.item_type && item.type !== obj.item_type) continue;
        if (obj.min_rarity && !rarityAtLeast(item.rarity, obj.min_rarity)) continue;
        gained += Math.max(1, item.quantity ?? 1);
      }
      return gained;
    }
    case "win_combats": {
      // Count combat events this turn where player won. Combat events from
      // combat.ts use `data.victory === true`; also accept `data.outcome === "victory"`.
      return events.filter((e) => {
        if (e.type !== "combat") return false;
        const d = e.data as { outcome?: string; victory?: boolean; result?: string };
        return d.victory === true || d.outcome === "victory" || d.result === "victory";
      }).length;
    }
    case "defeat_rival_member": {
      return events.filter((e) => {
        if (e.type !== "combat") return false;
        const d = e.data as {
          outcome?: string;
          victory?: boolean;
          result?: string;
          rival_sect_id?: string;
          enemy_sect_id?: string;
        };
        const won = d.victory === true || d.outcome === "victory" || d.result === "victory";
        if (!won) return false;
        if (!obj.rival_sect_id) return true;
        const tag = d.rival_sect_id ?? d.enemy_sect_id;
        return tag === obj.rival_sect_id;
      }).length;
    }
    case "cultivate_exp": {
      let gained = 0;
      for (const d of deltas) {
        if (d.field === "progress.cultivation_exp" && d.operation === "add") {
          gained += Number(d.value) || 0;
        }
      }
      return gained;
    }
    case "visit_region": {
      const currentRegion =
        state.travel?.current_region ?? state.location?.region ?? undefined;
      // Return 1 the first time we detect arrival; 0 after (never negative,
      // so a clamped progress can't decrement on subsequent turns at the
      // same region).
      return currentRegion === obj.region_id && mission.progress < 1 ? 1 : 0;
    }
  }
}

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
function rarityAtLeast(rarity: string | undefined, min: string): boolean {
  if (!rarity) return false;
  return RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number]) >= RARITY_ORDER.indexOf(
    min as (typeof RARITY_ORDER)[number]
  );
}

function applyMissionReward(state: GameState, mission: ActiveSectMission): void {
  const template = getMissionTemplate(mission.template_id);
  if (!template) return;
  if (state.sect_membership) {
    state.sect_membership.contribution += template.reward.contribution;
    state.sect_membership.missions_completed += 1;
  }
  if (template.reward.silver) state.inventory.silver += template.reward.silver;
  if (template.reward.spirit_stones)
    state.inventory.spirit_stones += template.reward.spirit_stones;

  // If this was a rival-targeted mission, hostility with that rival
  // increases. If a war is active against that rival, credit war score too.
  if (mission.objective.kind === "defeat_rival_member" && mission.objective.rival_sect_id) {
    const rivalId = mission.objective.rival_sect_id;
    shiftRelation(state, rivalId, -5);
    if (state.sect_war && state.sect_war.rival_sect_id === rivalId) {
      state.sect_war.player_score += 20; // WAR_SCORE_PER_RIVAL_MISSION
    }
  }
}

function applyMissionFailurePenalty(state: GameState, _mission: ActiveSectMission): void {
  if (state.sect_membership) {
    state.sect_membership.reputation = Math.max(
      0,
      state.sect_membership.reputation - 5
    );
  }
}

/**
 * Shift a sect relation by delta, clamped to [-100, 100].
 */
export function shiftRelation(state: GameState, sectId: string, delta: number): void {
  if (!state.sect_relations) state.sect_relations = {};
  const existing = state.sect_relations[sectId];
  const next = Math.max(-100, Math.min(100, (existing?.relation ?? 0) + delta));
  state.sect_relations[sectId] = {
    sect_id: sectId,
    relation: next,
    last_changed_turn: state.turn_count,
  };
}

/**
 * Find the most-hostile rival currently (relation ≤ -50). Used to trigger
 * ambush encounters during travel.
 */
export function mostHostileRival(state: GameState): { sect_id: string; relation: number } | null {
  if (!state.sect_relations) return null;
  let worst: { sect_id: string; relation: number } | null = null;
  for (const [id, rel] of Object.entries(state.sect_relations)) {
    if (rel.relation <= -50 && (!worst || rel.relation < worst.relation)) {
      worst = { sect_id: id, relation: rel.relation };
    }
  }
  return worst;
}
