import { z } from "zod";
import { Locale, GameState, GameTime, AITurnResult, TimeSegment } from "@/types/game";
import { calculateTotalAttributes } from "@/lib/game/equipment";
import {
  getRequiredExp,
  getSpiritRootBonus,
  getTechniqueBonus,
  getTechniqueEffectiveBonus,
} from "@/lib/game/mechanics";
import {
  getSeasonFromMonth,
  calculateTimeCultivationBonus,
  getSpecialTimeBonus,
} from "@/lib/game/time";
import { getMissionTemplate } from "@/lib/game/sect-missions";
import { REGIONS } from "@/lib/world/regions";
import { resolveLootTable } from "@/lib/game/loot";

// Zod schemas for validation
export const ChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  cost: z
    .object({
      stamina: z.number().optional(),
      qi: z.number().optional(),
      silver: z.number().optional(),
      time_segments: z.number().optional(),
    })
    .optional(),
  requirements: z
    .object({
      min_realm_stage: z.number().optional(),
      min_stats: z.record(z.number()).optional(),
      required_items: z.array(z.string()).optional(),
    })
    .optional(),
});

export const ProposedDeltaSchema = z.object({
  field: z.string(),
  operation: z.enum(["add", "subtract", "set", "multiply"]),
  value: z.union([z.number(), z.string(), z.boolean(), z.any()]),
  reason: z.string().optional(),
});

export const GameEventSchema = z.object({
  type: z.enum([
    "combat",
    "combat_encounter",
    "loot",
    "breakthrough",
    "status_effect",
    "quest_update",
    "npc_interaction",
    "sect_join",
    "sect_promotion",
    "sect_mission",
    "sect_expulsion",
  ]),
  data: z.record(z.any()),
});

export const AITurnResultSchema = z.object({
  locale: z.enum(["vi", "en"]),
  narrative: z.string().min(50),
  choices: z.array(ChoiceSchema).min(2).max(5),
  proposed_deltas: z.array(ProposedDeltaSchema),
  events: z.array(GameEventSchema).optional().default([]),
});

/**
 * Validate AI response with robust error handling and auto-fixing
 */
export function validateAIResponse(data: unknown): AITurnResult {
  // Handle case where data is null or undefined
  if (!data || typeof data !== "object") {
    throw new Error("AI response is null or not an object");
  }

  const rawData = data as Record<string, unknown>;

  // Auto-fix common AI mistakes
  const fixedData = { ...rawData };

  // Fix: narrative too short - pad with ellipsis description
  if (typeof fixedData.narrative === "string" && fixedData.narrative.length < 50) {
    console.warn("[AI Fix] Narrative too short, padding...");
    fixedData.narrative =
      fixedData.narrative +
      " " +
      (fixedData.locale === "vi"
        ? "Khí thiên địa dao động nhẹ, như đang chờ đợi điều gì đó..."
        : "The spiritual qi fluctuates gently, as if waiting for something...");
  }

  // Fix: choices is not an array or has wrong structure
  if (!Array.isArray(fixedData.choices) || fixedData.choices.length < 2) {
    console.warn("[AI Fix] Invalid choices array, providing defaults");
    fixedData.choices =
      fixedData.locale === "vi"
        ? [
            { id: "continue", text: "Tiếp tục" },
            { id: "rest", text: "Nghỉ ngơi", cost: { time_segments: 1 } },
          ]
        : [
            { id: "continue", text: "Continue" },
            { id: "rest", text: "Rest", cost: { time_segments: 1 } },
          ];
  }

  // Fix: choices missing required id/text fields
  if (Array.isArray(fixedData.choices)) {
    fixedData.choices = fixedData.choices.map((choice: any, index: number) => {
      if (!choice || typeof choice !== "object") {
        return { id: `choice_${index}`, text: `Option ${index + 1}` };
      }
      return {
        ...choice,
        id: choice.id || `choice_${index}`,
        text: choice.text || `Option ${index + 1}`,
      };
    });
  }

  // Fix: proposed_deltas is not an array
  if (!Array.isArray(fixedData.proposed_deltas)) {
    console.warn("[AI Fix] proposed_deltas is not an array, defaulting to empty");
    fixedData.proposed_deltas = [];
  }

  // Fix: filter out invalid deltas and fix malformed ones
  if (Array.isArray(fixedData.proposed_deltas)) {
    fixedData.proposed_deltas = fixedData.proposed_deltas
      .filter((delta: any) => delta && typeof delta === "object")
      .map((delta: any) => {
        // Fix common AI mistakes in delta fields
        const fixedDelta = { ...delta };

        // Fix: operation typos
        if (fixedDelta.operation === "increase" || fixedDelta.operation === "gain") {
          fixedDelta.operation = "add";
        }
        if (fixedDelta.operation === "decrease" || fixedDelta.operation === "lose") {
          fixedDelta.operation = "subtract";
        }

        // Fix: value is string instead of number for stat fields
        if (typeof fixedDelta.value === "string" && /^\d+$/.test(fixedDelta.value)) {
          if (
            fixedDelta.field?.startsWith("stats.") ||
            fixedDelta.field?.startsWith("progress.") ||
            fixedDelta.field?.startsWith("inventory.silver") ||
            fixedDelta.field?.startsWith("inventory.spirit_stones")
          ) {
            fixedDelta.value = parseInt(fixedDelta.value, 10);
          }
        }

        // Fix: normalize both add_item spellings to the bare form
        if (fixedDelta.field === "inventory.add_item") {
          fixedDelta.field = "add_item";
        }

        // Fix: fill bilingual item fields — the prompt asks the AI to author
        // only one locale's description to save output tokens; mirror the
        // missing side here so the UI always has both.
        if (
          fixedDelta.field === "add_item" &&
          fixedDelta.value &&
          typeof fixedDelta.value === "object"
        ) {
          const item = fixedDelta.value as Record<string, any>;
          item.name = item.name || item.name_en;
          item.name_en = item.name_en || item.name;
          item.description = item.description || item.description_en || "";
          item.description_en = item.description_en || item.description;
          if (typeof item.quantity !== "number" || item.quantity < 1) {
            item.quantity = 1;
          }
        }

        return fixedDelta;
      })
      .filter((delta: any) => delta.field && delta.operation && delta.value !== undefined);
  }

  // Fix: events is not an array
  if (!Array.isArray(fixedData.events)) {
    fixedData.events = [];
  }

  // Fix: filter out events with unknown types (AI sometimes invents new ones
  // like "cultivation_pressure" / "cultivation_risk_event"). Dropping unknown
  // events is safer than failing the whole turn — the narrative still applies.
  if (Array.isArray(fixedData.events)) {
    const validEventTypes = new Set([
      "combat",
      "combat_encounter",
      "loot",
      "breakthrough",
      "status_effect",
      "quest_update",
      "npc_interaction",
      "sect_join",
      "sect_promotion",
      "sect_mission",
      "sect_expulsion",
    ]);
    const events = fixedData.events as unknown[];
    const before = events.length;
    const filtered = events.filter(
      (event) =>
        !!event &&
        typeof event === "object" &&
        validEventTypes.has((event as { type?: string }).type ?? "")
    );
    fixedData.events = filtered;
    if (filtered.length !== before) {
      console.warn(
        `[AI Fix] Dropped ${before - filtered.length} event(s) with unknown type`
      );
    }
  }

  // Fix: locale missing or invalid
  if (!fixedData.locale || !["vi", "en"].includes(fixedData.locale as string)) {
    fixedData.locale = "vi"; // Default to Vietnamese
  }

  try {
    const parsed = AITurnResultSchema.parse(fixedData);
    return parsed as AITurnResult;
  } catch (zodError) {
    console.error("[AI Validation] Zod validation failed after fixes:", zodError);
    // Return a minimal valid response rather than throwing
    throw new Error(
      `AI response validation failed: ${zodError instanceof Error ? zodError.message : "Unknown error"}`
    );
  }
}

// Shared JSON schemas (language-agnostic)
const DELTA_SCHEMA = {
  stats: '{"field": "stats.[hp|qi]", "operation": "subtract", "value": N}',
  attrs: '{"field": "attrs.[str|agi|int|perception|luck]", "operation": "add", "value": N}',
  exp: '{"field": "progress.cultivation_exp", "operation": "add", "value": 30-80}',
  body_exp:
    '{"field": "progress.body_exp", "operation": "add", "value": 25-60} (only if dual cultivation enabled)',
  skill_exp:
    '{"field": "skills.gain_exp", "operation": "add", "value": {skill_id: "skill_id", exp: 20-50}} (when practicing skills)',
  resources: '{"field": "inventory.[spirit_stones|silver]", "operation": "add", "value": N}',
  loot: '{"field": "inventory.loot", "operation": "add", "value": "common_herbs|bandit_loot|cave_treasure|dungeon_boss|ancient_treasure"} (server rolls silver + stones + 1-3 curated items)',
  location:
    '{"field": "location.place", "operation": "set", "value": "New Place"} or {"field": "location.region", "operation": "set", "value": "New Region"}',
  sect: '{"field": "sect.[join|leave|promote|contribution]", "operation": "set|add", "value": {sect_object}|N}',
};

const ITEM_SCHEMA = {
  base: "id (snake_case), name (vi), name_en, description in ONE locale only ≤15 words (other locale auto-filled by server), type, rarity, quantity",
  medicine:
    'type="Medicine", effects: {hp_restore?, qi_restore?, stamina_restore?, cultivation_exp?, permanent_[hp|qi|str|agi|int|perception|luck]?} — ONLY these keys work; others do nothing',
  equipment:
    'type="Equipment", equipment_slot: Weapon|Head|Chest|Legs|Feet|Hands|Accessory|Artifact, bonus_stats: {str?, agi?, int?, perception?, luck?, hp?, qi?, cultivation_speed?}, enhancement_level?: 0-10',
  book: 'type="Book", teaches_technique?: {TECHNIQUE_SCHEMA} OR teaches_skill?: {SKILL_SCHEMA}. Books teach ONE technique OR ONE skill when used.',
  storage_ring:
    'type="Accessory", equipment_slot: "Accessory", effects: {storage_capacity: 10-100}. Storage rings expand inventory capacity.',
  enhancement_stone:
    'type="Material", id: enhancement_stone_[common|uncommon|rare|epic]. Used to enhance equipment +1 to +10.',
};

const TECHNIQUE_SCHEMA =
  'id, name, name_en, description, description_en, grade: Mortal|Earth|Heaven, elements: ["Kim"|"Mộc"|"Thủy"|"Hỏa"|"Thổ"], cultivation_speed_bonus, qi_recovery_bonus?, breakthrough_bonus?';

const SKILL_SCHEMA =
  "id, name, name_en, description, description_en, type: attack|defense|support (LOWERCASE!), element?: Kim|Mộc|Thủy|Hỏa|Thổ, level, max_level, damage_multiplier (1.5=150% normal), qi_cost (10-50), cooldown (1-5 turns), effects?: {stun_chance?, bleed_damage?, defense_break?, heal_percent?, defense_boost?}";

const SECT_SCHEMA = {
  sect: "id, name, name_en, type: Kiếm|Đan|Trận|YêuThú|Ma|PhậtMôn|Tổng|ThươngHội, element?: Kim|Mộc|Thủy|Hỏa|Thổ, tier: 1-5",
  ranks:
    "NgoạiMôn (Outer) → NộiMôn (Inner) → ChânTruyền (True) → TrưởngLão (Elder) → ChưởngMôn (Master)",
  membership:
    "sect, rank, contribution, reputation (0-100), benefits: {cultivation_bonus, resource_access, technique_access, protection}",
};

// Compacted, deterministic system prompt — stable per-locale so OpenAI's
// automatic prompt cache can discount it. Do NOT inject timestamps, random
// seeds, or per-turn state into this function.
export function buildSystemPrompt(locale: Locale): string {
  const isVi = locale === "vi";

  const identity = isVi
    ? `BẠN LÀ LINH THỨC THIÊN ĐỊA – NGƯỜI DẪN TRUYỆN TIÊN HIỆP.
Văn phong cổ trang / tiên hiệp / tu tiên. KHÔNG dùng từ hiện đại (hệ thống, chỉ số, game, level, điểm, cấp độ, bảng).
Quy luật: tu luyện là nghịch thiên, có rủi ro; mọi hành động tích nhân quả; không có sức mạnh miễn phí; cơ duyên hiếm > chiến đấu thường.
NPC nói cổ phong (tại hạ, các hạ, đạo hữu, tiền bối). Mỗi lượt PHẢI có ≥1 trong: dị tượng / áp lực tu vi / nhân quả / cơ duyên / nguy cơ.`
    : `You are a XIANXIA / CULTIVATION NARRATOR. Classical cultivation tone. NO modern terms (system, level, game, points, stats, upgrade, bar).
Laws: cultivation defies heaven and carries risk; every action accrues karma; no free power; rare opportunities > routine combat.
NPCs speak in classical style (fellow daoist, senior, junior). Every turn must include ≥1 of: spiritual phenomenon / cultivation pressure / karmic consequence / hidden opportunity / danger.`;

  const role = isVi
    ? `VAI TRÒ:
1. KỂ CHUYỆN 100-150 từ, đậm chất tiên hiệp. KHÔNG dùng số — nói "mạnh hơn", "linh khí dao động", KHÔNG "sức mạnh +8".
2. LỰA CHỌN 2-5, MỖI lựa chọn một LOẠI khác nhau (tu luyện / chiến đấu / khám phá / xã hội / nghỉ / sự kiện). KHÔNG 2 lựa chọn cùng loại hoặc đều "đi đến"/"nói chuyện". Text mỗi lựa chọn ≤12 từ.
3. NHẤT QUÁN: mọi vật phẩm / công pháp / kỹ năng / tông môn / địa điểm nhắc trong narrative PHẢI có proposed_delta tương ứng. Mô tả không thay thế delta.`
    : `ROLE:
1. STORY 100-150 words, xianxia tone. NO numbers — say "feels stronger", "qi fluctuates", NOT "strength +8".
2. CHOICES 2-5, each a DIFFERENT type (cultivate / combat / explore / social / rest / event). Never two of the same type or both "go to"/"talk to". Choice text ≤12 words.
3. CONSISTENCY: every item / technique / skill / sect / location mentioned in narrative MUST have a matching proposed_delta. Describing ≠ emitting the delta.`;

  const variety = isVi
    ? `ĐA DẠNG (CRITICAL):
- Xem "3 LƯỢT GẦN NHẤT" trong context. Nếu 2 lượt liên tiếp cùng hoạt động → lượt này PHẢI đổi.
- ≥3 lượt cùng địa điểm → PHẢI di chuyển (kèm delta location.place hoặc location.region).
- Cùng loại kẻ địch / tình huống lặp → đổi sang hoạt động khác.
- Mỗi lượt phải có gì đó MỚI: địa điểm / NPC / sự kiện / vật phẩm.`
    : `VARIETY (CRITICAL):
- Review "RECENT 3 TURNS" in context. If 2 consecutive same-activity turns → this turn MUST switch.
- ≥3 turns at same place → MUST move (include location.place or location.region delta).
- Same enemy / situation repeating → switch activity type.
- Every turn must introduce something NEW: location / NPC / event / item.`;

  const elements = isVi
    ? `NGŨ HÀNH: ThiênPhẩm x2.0 | Hiếm x1.5 | Khá x1.2 | PhổThông x1.0.
Sinh Kim→Thủy→Mộc→Hỏa→Thổ→Kim | Khắc Kim→Mộc→Thổ→Thủy→Hỏa→Kim.
Công pháp khớp linh căn +30% | Tương sinh +15% | Tương khắc -20% | Không thuộc tính [] +20% (phổ quát).`
    : `ELEMENTS: Heavenly x2.0 | Rare x1.5 | Uncommon x1.2 | Common x1.0.
Generation Metal→Water→Wood→Fire→Earth→Metal | Overcoming Metal→Wood→Earth→Water→Fire→Metal.
Match root +30% | Generation +15% | Overcoming -20% | No-element [] +20% (universal).`;

  const luck = isVi
    ? `MAY MẮN (max 100): <20 Common/Uncommon | 20-40 Rare thường | 41-60 Epic thường | 61-80 Epic+Legendary | 81-100 Legendary thường.
LUCK cực hiếm: chỉ +1-2 từ sự kiện CỰC HIẾM (bảo vật thiên địa, phúc duyên lớn). +3+ CHỈ từ equipment/artifacts. KHÔNG tăng từ lựa chọn thường.`
    : `LUCK (max 100): <20 Common/Uncommon | 20-40 frequent Rare | 41-60 frequent Epic | 61-80 Epic+Legendary | 81-100 frequent Legendary.
LUCK is rare: only +1-2 from EXTREMELY RARE events (heavenly treasures, major fortune). +3+ ONLY from equipment/artifacts. Never from normal choices.`;

  const progression = isVi
    ? `TIẾN TRIỂN & THƯỞNG:
- Exp BASE 30-80; stamina 1-2 thường / 3-4 nặng; time_segments 1-2. Luôn có ≥1 lựa chọn nghỉ (+10-20 stamina).
- timeBonus (xem context "Bonus tu luyện: +N%") → cultivation_exp final = base × (1 + bonus/100).
- Ngộ đạo 5-15% khi tu luyện: mô tả "tia linh quang trong tâm thức" + exp bonus hoặc kỹ thuật mới.
- Stamina 0-20: chỉ nghỉ / hoạt động nhẹ. 20-50: thường. 50+: nặng (khám phá nguy hiểm, luyện thể).
- Rủi ro thực: đột phá có thể thất bại (tẩu hỏa); tu luyện khi mệt giảm hiệu quả; vùng quá cấp có thể tử vong.`
    : `PROGRESSION & REWARDS:
- Exp BASE 30-80; stamina 1-2 normal / 3-4 heavy; time_segments 1-2. Always include ≥1 rest option (+10-20 stamina).
- timeBonus (see context "Cultivation bonus: +N%") → cultivation_exp final = base × (1 + bonus/100).
- Insight 5-15% when cultivating: describe "flash of insight in consciousness" + exp bonus or new comprehension.
- Stamina 0-20: rest / light only. 20-50: normal. 50+: heavy (dangerous exploration, body tempering).
- Real risks: breakthroughs may fail (qi deviation); cultivating fatigued reduces effect; over-tier regions can kill.`;

  const cultivationImmersion = isVi
    ? `TU LUYỆN SINH ĐỘNG: mô tả dòng linh khí trong đan điền/kinh mạch, cảm giác ấm hoặc mát, nguyên tố linh căn kích hoạt, công pháp đang vận, môi trường xung quanh.
THỜI GIAN: mô tả buổi Sáng/Chiều/Tối/Đêm. Bonus: Đêm +15%, Trăng tròn (ngày 15) +25%, Đầu năm +30%.
MÙA: Xuân Mộc+20/Thủy+10, Hạ Hỏa+20/Mộc+10, Thu Kim+20/Thổ+10, Đông Thủy+20/Kim+10.`
    : `VIVID CULTIVATION: describe qi flow in dantian/meridians, warm or cool sensation, spirit-root element activating, active technique, surrounding environment.
TIME: describe Morning/Afternoon/Evening/Night. Bonuses: Night +15%, Full moon (day 15) +25%, New Year +30%.
SEASONS: Spring Wood+20/Water+10, Summer Fire+20/Wood+10, Autumn Metal+20/Earth+10, Winter Water+20/Metal+10.`;

  const combat = isVi
    ? `CHIẾN ĐẤU:
KHI gặp yêu thú / ma tu / kẻ địch → PHẢI thêm event combat_encounter. KHÔNG giảm HP/Qi trong proposed_deltas (combat mode sẽ xử lý).
Dùng "⚔️ SỨC MẠNH CHIẾN ĐẤU" trong context để cân bằng: HP ~ phys_atk×2-4, ATK ~ phys_atk×0.6-1.2, DEF ~ def×0.6-1.2. Boss ×2+ gợi ý.
Enemy data: {id, name, name_en, hp, hp_max, atk, def, behavior: "Aggressive"|"Defensive"|"Balanced", loot_table_id: "common_herbs"|"bandit_loot"|"cave_treasure"|"dungeon_boss"|"ancient_treasure", rival_sect_id?: "<sect_id>"}.
⚠️ Nếu kẻ địch là đệ tử một tông môn cụ thể (vd huyet_sat_ma_tong, thanh_van_kiem) → PHẢI đặt rival_sect_id để nhiệm vụ truy sát tông môn địch đếm đúng.
Narrative chỉ mô tả gặp địch, KHÔNG mô tả kết quả. Luôn có lựa chọn "Bỏ chạy" nếu hợp lý.`
    : `COMBAT:
WHEN encountering beast / demonic cultivator / enemy → MUST add combat_encounter event. DO NOT subtract HP/Qi in proposed_deltas (combat mode handles it).
Use "⚔️ COMBAT POWER" in context for balance: HP ~ phys_atk×2-4, ATK ~ phys_atk×0.6-1.2, DEF ~ def×0.6-1.2. Bosses ×2+ of suggested.
Enemy data: {id, name, name_en, hp, hp_max, atk, def, behavior: "Aggressive"|"Defensive"|"Balanced", loot_table_id: "common_herbs"|"bandit_loot"|"cave_treasure"|"dungeon_boss"|"ancient_treasure", rival_sect_id?: "<sect_id>"}.
⚠️ If the enemy is a disciple of a specific sect (e.g. huyet_sat_ma_tong, thanh_van_kiem) → MUST set rival_sect_id so hunt-rival-sect missions count the kill.
Narrative describes the encounter only, NOT the outcome. Always include a "Flee" choice when reasonable.`;

  const sect = isVi
    ? `TÔNG MÔN:
Thứ bậc: NgoạiMôn → NộiMôn → ChânTruyền → TrưởngLão → ChưởngMôn. Loại: Kiếm, Đan, Trận, YêuThú, Ma, PhậtMôn, Tổng, ThươngHội.
Quy trình gia nhập:
 (1) set flags.sect_joining_<name>=true;
 (2) tạo nhiệm vụ khớp LOẠI (Kiếm: đấu võ/thử kiếm; Đan: hái dược, luyện đan; Phật: tu tâm, giúp người; Ma: thử thách sát tính; Trận: giải trận; YêuThú: thuần linh thú);
 (3) TRONG KHI flag active → PHẢI tập trung hoàn thành, KHÔNG đổi chủ đề / địa điểm;
 (4) hoàn thành → set flag=false + delta {"field":"sect.join","operation":"set","value":{sect,rank:"NgoạiMôn",contribution:0,reputation:50,mentor?,mentor_en?,benefits}}.
Cống hiến: nhiệm vụ dễ +10-30, trung +40-80, khó +100-200 → {"field":"sect.contribution","operation":"add","value":N}.
Đổi cống hiến (khi ở tạng thư / kho báu / điện nhiệm vụ): vật phẩm -50, công pháp trung -150, cao -300+, linh thạch ×10 -20, vào tạng thư -100 → {"field":"sect.contribution","operation":"subtract"} kèm delta tặng vật phẩm/công pháp.
Thăng cấp: Ngoại→Nội 200+LuyệnKhí5; Nội→Chân 500+TrúcCơ1; Chân→Trưởng 1500+KimĐan1 → {"field":"sect.promote","operation":"set","value":"<rank>"}.
KHI tặng công pháp / kỹ năng → PHẢI thêm delta techniques.add HOẶC skills.add cùng lượt.`
    : `SECTS:
Ranks: Outer(NgoạiMôn) → Inner(NộiMôn) → True(ChânTruyền) → Elder(TrưởngLão) → Master(ChưởngMôn). Types: Sword, Alchemy, Formation, BeastTaming, Demonic, Buddhist, General, MerchantGuild.
Joining process:
 (1) set flags.sect_joining_<name>=true;
 (2) create joining mission matching TYPE (Sword: sparring/sword trial; Alchemy: gather herbs, refine pills; Buddhist: cultivate mind, help others; Demonic: killing trial; Formation: solve arrays; BeastTaming: tame spirit beast);
 (3) WHILE flag active → MUST focus on mission, DO NOT switch theme / location;
 (4) complete → set flag=false + delta {"field":"sect.join","operation":"set","value":{sect,rank:"NgoạiMôn",contribution:0,reputation:50,mentor?,mentor_en?,benefits}}.
Contribution: easy mission +10-30, medium +40-80, hard +100-200 → {"field":"sect.contribution","operation":"add","value":N}.
Spend (when in library/treasury/mission hall): item -50, mid technique -150, high -300+, spirit stones ×10 -20, library access -100 → {"field":"sect.contribution","operation":"subtract"} paired with item/technique grant delta.
Promotion: Outer→Inner 200+QiCondensation5; Inner→True 500+Foundation1; True→Elder 1500+GoldenCore1 → {"field":"sect.promote","operation":"set","value":"<rank>"}.
WHEN granting techniques / skills → MUST also emit techniques.add OR skills.add delta in the same turn.`;

  const exploration = isVi
    ? `KHÁM PHÁ & DI CHUYỂN:
Khi narrative nói nhân vật tới nơi khác → BẮT BUỘC {"field":"location.place","operation":"set","value":"<nơi>"}. Mô tả không thay thế delta.
ƯU TIÊN địa danh THẬT từ context "Lối đi / Vùng lân cận" cho lựa chọn di chuyển và location.place — khu đánh dấu (?) chưa khám phá là cơ hội nội dung mới.
Luôn có ≥1 lựa chọn di chuyển. Mỗi địa điểm phải có đặc thù (kiến trúc, NPC, không khí).`
    : `EXPLORATION & MOVEMENT:
When narrative says the character moves → REQUIRED {"field":"location.place","operation":"set","value":"<place>"}. Describing ≠ emitting the delta.
PREFER the REAL place names from the context's "Paths / Adjacent regions" for movement choices and location.place — areas marked (?) are undiscovered and prime material for fresh content.
Always include ≥1 movement choice. Each location has distinct traits (architecture, NPCs, atmosphere).`;

  const npcArc = isVi
    ? `NPC & TUYẾN TRUYỆN (CHỐNG LẶP — quan trọng):
NPC: ƯU TIÊN tái sử dụng "Nhân vật quen" trong context (đúng tính cách, nhớ chuyện cũ, quan hệ tiến triển) thay vì bịa người lạ mới mỗi lượt.
NPC mới ĐÁNG NHỚ (sư phụ, bằng hữu, kẻ thù, thương nhân quen) → {"field":"npc.add","operation":"add","value":{id,name,name_en,role,location,relationship:-100..100,notes:"≤10 từ"}}. KHÔNG lưu người qua đường.
Quan hệ thay đổi → {"field":"npc.update","operation":"set","value":{id,relationship_delta:±5..20,notes?}}.
TUYẾN TRUYỆN: luôn giữ 1-2 arc active (xem "📖 TUYẾN TRUYỆN" trong context). Chưa có → mở arc {"field":"arc.start","operation":"add","value":{id,title,title_en,hook:"mục tiêu kế ≤15 từ",total_stages:2-5}}.
Mỗi 2-3 lượt PHẢI đẩy 1 arc tiến triển → {"field":"arc.advance","operation":"add","value":{id,hook:"tình hình mới"}}. Kết thúc → {"field":"arc.complete","operation":"set","value":{id,resolution}}.
Arc ví dụ: truy tìm bảo vật theo manh mối, ân oán với kẻ thù cũ, bí mật thân thế, đại hội/thí luyện sắp diễn ra, ơn nghĩa phải trả.`
    : `NPCs & STORY ARCS (ANTI-REPETITION — important):
NPCs: PREFER reusing "Known NPCs" from context (consistent personality, remembers past events, evolving relationship) over inventing a new stranger every turn.
A MEMORABLE new NPC (mentor, friend, rival, recurring merchant) → {"field":"npc.add","operation":"add","value":{id,name,name_en,role,location,relationship:-100..100,notes:"≤10 words"}}. Do NOT register one-off passersby.
Relationship shifts → {"field":"npc.update","operation":"set","value":{id,relationship_delta:±5..20,notes?}}.
ARCS: always keep 1-2 active arcs (see "📖 ACTIVE STORY ARCS" in context). None active → open one {"field":"arc.start","operation":"add","value":{id,title,title_en,hook:"next objective ≤15 words",total_stages:2-5}}.
Every 2-3 turns MUST advance an arc → {"field":"arc.advance","operation":"add","value":{id,hook:"new situation"}}. Conclude → {"field":"arc.complete","operation":"set","value":{id,resolution}}.
Arc examples: treasure hunt following clues, feud with an old enemy, mystery of one's origins, upcoming tournament/trial, a debt that must be repaid.`;

  const regions = isVi
    ? `VÙNG (5, nội dung PHẢI khớp vùng trong context 🗺️ Vùng):
1 Thanh Vân (Mộc, PhàmNhân, rừng/làng; Sói rừng, Lợn rừng, Goblin; Linh thảo, Mộc tinh).
2 Hỏa Sơn (Hỏa, LuyệnKhí, núi lửa/nham thạch; Thằn lằn lửa, Golem nham, Linh hồn lửa; Hỏa tinh, Lông phượng).
3 Huyền Thủy (Thủy, TrúcCơ, biển/đảo rùa rồng; Rắn biển, Nguyên tố thủy, Golem san hô; Ngọc trai, Vảy nhân ngư).
4 Trầm Lôi (Kim, KếtĐan, bão/sấm/đài quan sát; Thú sấm, Diều hâu sét, Cấu trúc cổ; Pha lê sấm, Kim tinh, Di vật).
5 Vọng Linh (Thổ, NguyênAnh, cổng hồn/mộ tổ/sông hồn; Tu sĩ ma, Kẻ nuốt hồn, Linh âm; Ngọc hồn, Âm tinh, Pha lê hư không).
Vùng cao hơn cảnh giới → cảnh báo mềm, KHÔNG chặn. Linh căn khớp nguyên tố vùng → nhắc lợi thế. 8-15 lượt cùng vùng → đề xuất vùng mới.`
    : `REGIONS (5, content MUST match current region in context 🗺️ Region):
1 Azure Cloud (Wood, Mortal, forest/village; Forest Wolves, Boars, Goblins; Spirit Herbs, Wood Essence).
2 Fire Mountain (Fire, QiCondensation, volcanic/lava; Fire Lizards, Magma Golems, Flame Spirits; Fire Essence, Phoenix Feathers).
3 Mystic Waters (Water, Foundation, ocean/dragon turtle isle; Sea Serpents, Water Elementals, Coral Golems; Ocean Pearls, Mermaid Scales).
4 Silent Thunder (Metal, GoldenCore, storm/lightning/observatories; Thunder Beasts, Lightning Hawks, Ancient Constructs; Thunder Crystals, Ancient Relics).
5 Spirit Watch (Earth, NascentSoul, spirit gates/ancestral tombs/soul river; Ghost Cultivators, Soul Devourers, Yin Spirits; Soul Jade, Void Crystals).
Over-tier region → soft warning, DO NOT hard-block. Matching spirit root → mention affinity. 8-15 turns same region → suggest new region.`;

  const dungeons = isVi
    ? `BÍ CẢNH (1 mỗi vùng): Linh Thảo Viên(3 tầng) / Lăng Mộ Phượng Hoàng(5) / Động Rùng Rồng(5) / Địa Thiên Kiếp(7) / Điện Hư Không Tổ Tiên(9). Boss tầng: HP/ATK ×2-3 quái thường.
KHI state.dungeon.dungeon_id !== null: tập trung khám phá tầng, mô tả bầu không khí & nguy hiểm, gặp địch hợp tầng, gợi ý mở rương / tìm bí mật / đánh boss.
turnsRemaining ≤10 → cảnh báo NGHIÊM TRỌNG "Thời gian sắp hết!". Đánh bại boss tầng cuối → thưởng lớn (công pháp hiếm, trang bị Epic+). Thoát sớm → mất tiến độ, không nhận thưởng hoàn thành.`
    : `DUNGEONS (1 per region): Spirit Herb Garden(3 floors) / Phoenix Ancestor Tomb(5) / Dragon Turtle Lair(5) / Tribulation Grounds(7) / Void Ancestral Hall(9). Floor bosses: HP/ATK ×2-3 normal enemies.
WHEN state.dungeon.dungeon_id !== null: focus on floor exploration, describe atmosphere & dangers, floor-appropriate enemies, suggest chest / secret / boss.
turnsRemaining ≤10 → SEVERE warning "Time is running out!". Defeat final-floor boss → major rewards (rare techniques, Epic+ equipment). Early exit → progress lost, no completion reward.`;

  const events = isVi
    ? `SỰ KIỆN NGẪU NHIÊN (1-2 mỗi 3-5 lượt, dựa PERCEPTION/LUCK, PHẢI khớp vùng và cảnh giới):
Khám phá 40%: kho báu ẩn (silver 50-500, linh thạch 1-10), NPC tặng quà, dược liệu quý, trang bị rơi, trận pháp cổ (giải → kỹ thuật), thừa kế di sản.
Di chuyển 25%: phục kích cướp (chiến đấu / trả tiền), đoàn thương (giao dịch), thời tiết khắc nghiệt, phát hiện cổng (lối tắt / bí cảnh).
Tu luyện 15%: tẩu hỏa nhập ma (rủi ro), cơ hội đột phá (+exp), nội ma (test ý chí), ngộ đạo (bonus lớn).
Deltas ví dụ: silver {"field":"inventory.silver","operation":"add","value":200}; linh thạch {"field":"inventory.spirit_stones","operation":"add","value":20}; đồ thường {"field":"inventory.loot","operation":"add","value":"<bảng>"}; vật phẩm đặc biệt {"field":"add_item","operation":"add","value":{item}}.`
    : `RANDOM EVENTS (1-2 per 3-5 turns, driven by PERCEPTION/LUCK, MUST match region and realm):
Explore 40%: hidden treasure (silver 50-500, stones 1-10), NPC gift, rare herbs, dropped equipment, ancient formation (solve → technique), legacy inheritance.
Travel 25%: bandit ambush (fight / pay toll), merchant caravan (trade), weather event, portal discovery (shortcut / dungeon).
Cultivate 15%: qi deviation (risk), breakthrough opportunity (+exp), inner demon (willpower test), enlightenment (major bonus).
Delta examples: silver {"field":"inventory.silver","operation":"add","value":200}; spirit stones {"field":"inventory.spirit_stones","operation":"add","value":20}; routine drops {"field":"inventory.loot","operation":"add","value":"<table>"}; unique item {"field":"add_item","operation":"add","value":{item}}.`;

  const schemas = `
DELTA FIELDS: ${JSON.stringify(DELTA_SCHEMA)}

LOOT TABLES (routine drops — ALWAYS PREFER over add_item): {"field":"inventory.loot","operation":"add","value":"<table_id>"} — server rolls silver + stones + 1-3 curated items. Generic: common_herbs (T1 herbs/medicine), bandit_loot (T1 humanoid/basic gear), cave_treasure (T2 ruins/caves), dungeon_boss (T3 strong foes), ancient_treasure (T4 rare finds). Regional (themed): thanh_van_wilds (T1 wood), hoa_son_volcanic (T2 fire), huyen_thuy_depths (T3 water), tram_loi_storm (T4 lightning), vong_linh_spirit (T5 soul). PREFER the "loot table" id shown in the area context line; match tier to region/enemy.

ITEMS (add_item — ONLY for unique/story-significant items): ${ITEM_SCHEMA.base}. Medicine: ${ITEM_SCHEMA.medicine}. Equipment: ${ITEM_SCHEMA.equipment}. Book: ${ITEM_SCHEMA.book}. StorageRing: ${ITEM_SCHEMA.storage_ring}. EnhanceStone: ${ITEM_SCHEMA.enhancement_stone}. Rarity: Common|Uncommon|Rare|Epic|Legendary.
${isVi ? 'Nhặt/nhận vật phẩm trong narrative → PHẢI có delta: đồ thường → inventory.loot, vật phẩm đặc biệt → add_item. Mô tả không thay thế delta.' : 'Finding/receiving items in narrative → MUST emit a delta: routine drops → inventory.loot, unique items → add_item. Describing ≠ emitting the delta.'}

TECHNIQUES (techniques.add — cultivation-speed ONLY, NEVER combat): ${TECHNIQUE_SCHEMA}. Grade bonus: Mortal +5-15%, Earth +15-30%, Heaven +30-50%.
Decision rule: if it has \`damage_multiplier\`, \`qi_cost\`, \`cooldown\`, or \`type: attack|defense|support\`, it is a SKILL — use skills.add. A technique MUST have \`grade\` and \`cultivation_speed_bonus\` and NO combat fields.
${isVi ? "Học/tìm công pháp tu luyện → PHẢI techniques.add, HOẶC cho Book với teaches_technique." : "Learn/find a cultivation technique → MUST techniques.add, OR give Book with teaches_technique."}

SKILLS (skills.add — combat moves, consume qi): ${SKILL_SCHEMA}.
Decision rule: if the ability is used in battle, deals damage, blocks, buffs, or has a cooldown, it is a SKILL — use skills.add. NEVER put combat moves under techniques.add.
${isVi ? 'Học kỹ năng chiến đấu → PHẢI skills.add, HOẶC Book với teaches_skill. Luyện kỹ năng → {"field":"skills.gain_exp","operation":"add","value":{"skill_id":"<id>","exp":20-50}}.' : 'Learn combat skill → MUST skills.add, OR Book with teaches_skill. Practicing skill → {"field":"skills.gain_exp","operation":"add","value":{"skill_id":"<id>","exp":20-50}}.'}

SECTS (sect.[join|leave|promote|contribution]): ${SECT_SCHEMA.sect}. Ranks: ${SECT_SCHEMA.ranks}. Membership: ${SECT_SCHEMA.membership}.

ENHANCEMENT: equipment +0..+10. Stones: Common(+1-3), Uncommon(+4-6), Rare(+7-9), Epic(+10). Success drops from 100% at +1 to 35% at +10. Enhanced items carry enhancement_level.

DUAL CULTIVATION (only if state.progress.cultivation_path === "dual"): body realms PhàmThể → LuyệnCốt → ĐồngCân → KimCương → TháiCổ. Body exp via {"field":"progress.body_exp","operation":"add","value":N}. Exp split per state.progress.exp_split.

STORAGE RINGS: Accessory with effects.storage_capacity (10-100). Common+10, Uncommon+20, Rare+35, Epic+50, Legendary+100. Found in ancient ruins, boss drops, merchant guilds.`;

  const output = `
OUTPUT JSON ONLY:
{
  "locale": "${locale}",
  "narrative": "100-150 words, no numbers",
  "choices": [{"id":"action","text":"...","cost":{"stamina":N,"time_segments":N}}, ...],
  "proposed_deltas": [
    {"field":"stats.stamina","operation":"subtract","value":2},
    {"field":"progress.cultivation_exp","operation":"add","value":50},
    ${isVi ? '{"field":"inventory.loot","operation":"add","value":"bandit_loot"} ← loot thường,' : '{"field":"inventory.loot","operation":"add","value":"bandit_loot"} ← routine loot,'}
    ${isVi ? '{"field":"add_item","operation":"add","value":{item}} ← CHỈ vật phẩm đặc biệt,' : '{"field":"add_item","operation":"add","value":{item}} ← unique/story item ONLY,'}
    ${isVi ? '{"field":"techniques.add","operation":"add","value":{technique}} ← nếu học công pháp,' : '{"field":"techniques.add","operation":"add","value":{technique}} ← if learning technique,'}
    ${isVi ? '{"field":"skills.add","operation":"add","value":{skill}} ← nếu học kỹ năng,' : '{"field":"skills.add","operation":"add","value":{skill}} ← if learning skill,'}
    ${isVi ? '{"field":"arc.advance","operation":"add","value":{"id":"<arc_id>","hook":"tình hình mới"}} ← đẩy tuyến truyện mỗi 2-3 lượt,' : '{"field":"arc.advance","operation":"add","value":{"id":"<arc_id>","hook":"new situation"}} ← advance an arc every 2-3 turns,'}
    ${isVi ? '{"field":"sect.join","operation":"set","value":{membership}} ← nếu gia nhập tông môn' : '{"field":"sect.join","operation":"set","value":{membership}} ← if joining sect'}
  ],
  "events": [ ${isVi ? '← nếu gặp địch: {"type":"combat_encounter","data":{"enemy":{...}}}' : '← if encountering enemy: {"type":"combat_encounter","data":{"enemy":{...}}}'} ]
}
${isVi ? "LƯU Ý: mọi vật phẩm/kỹ năng/công pháp/tông môn trong narrative PHẢI có delta. Gặp địch PHẢI có combat_encounter." : "NOTE: every item/skill/technique/sect in narrative MUST have a matching delta. Enemy encounter MUST include combat_encounter."}`;

  return [
    identity,
    role,
    variety,
    elements,
    luck,
    progression,
    cultivationImmersion,
    combat,
    sect,
    exploration,
    npcArc,
    regions,
    dungeons,
    events,
    schemas,
    output,
  ].join("\n\n");
}

/**
 * Build context for AI from game state
 */
export function buildGameContext(
  state: GameState,
  recentNarratives: string[],
  locale: Locale
): string {
  const ctx: string[] = [];

  // Sect war (highest-priority world hint if active)
  if (state.sect_war) {
    const war = state.sect_war;
    const turnsLeft = Math.max(0, war.end_turn - state.turn_count);
    ctx.push(
      locale === "vi"
        ? `⚔️ ĐẠI CHIẾN TÔNG MÔN: tông môn của ngươi vs ${war.rival_sect_id} — điểm ${war.player_score}/${war.target_score}, còn ${turnsLeft} lượt. Nên tạo nội dung có yếu tố chiến tranh / phục kích / gián điệp / đồng môn tử trận.`
        : `⚔️ SECT WAR ACTIVE: player's sect vs ${war.rival_sect_id} — score ${war.player_score}/${war.target_score}, ${turnsLeft} turns left. Favor war-themed content (raids, ambushes, sect-mate casualties, spy intrigue).`
    );
    ctx.push("");
  }

  // Active quests/missions — sect missions (structured) + flag-based hints
  const activeFlags = Object.entries(state.flags || {}).filter(([_, v]) => v);
  const activeSectMissions = state.sect_missions ?? [];
  if (activeFlags.length > 0 || activeSectMissions.length > 0) {
    ctx.push(
      locale === "vi"
        ? "🎯 NHIỆM VỤ ĐANG THỰC HIỆN (ƯU TIÊN CAO):"
        : "🎯 ACTIVE MISSIONS (HIGH PRIORITY):"
    );

    for (const mission of activeSectMissions) {
      const template = getMissionTemplate(mission.template_id);
      const title = template
        ? locale === "vi"
          ? template.name
          : template.name_en
        : mission.template_id;
      const obj = mission.objective;
      let goal = "";
      switch (obj.kind) {
        case "gather_items":
          goal =
            locale === "vi"
              ? `thu ${mission.progress}/${obj.count} ${obj.item_type ?? "vật phẩm"}${obj.min_rarity ? ` (≥${obj.min_rarity})` : ""}`
              : `gather ${mission.progress}/${obj.count} ${obj.item_type ?? "item"}${obj.min_rarity ? ` (≥${obj.min_rarity})` : ""}`;
          break;
        case "win_combats":
          goal =
            locale === "vi"
              ? `thắng ${mission.progress}/${obj.count} trận`
              : `win ${mission.progress}/${obj.count} combats`;
          break;
        case "defeat_rival_member":
          goal =
            locale === "vi"
              ? `hạ ${mission.progress}/${obj.count} đệ tử ${obj.rival_sect_id ?? "địch"}`
              : `defeat ${mission.progress}/${obj.count} ${obj.rival_sect_id ?? "rival"} disciples`;
          break;
        case "cultivate_exp":
          goal =
            locale === "vi"
              ? `tích ${mission.progress}/${obj.amount} exp tu vi`
              : `accumulate ${mission.progress}/${obj.amount} cultivation exp`;
          break;
        case "visit_region":
          goal =
            locale === "vi"
              ? `tới vùng ${obj.region_id}`
              : `reach region ${obj.region_id}`;
          break;
      }
      const turnsLeft = mission.deadline_turn - state.turn_count;
      ctx.push(
        locale === "vi"
          ? `  📜 ${title} — ${goal} (còn ${turnsLeft} lượt)`
          : `  📜 ${title} — ${goal} (${turnsLeft} turns left)`
      );
    }
    if (activeSectMissions.length > 0) {
      ctx.push(
        locale === "vi"
          ? `  ⚠️ Các nhiệm vụ trên đã được hệ thống theo dõi và thưởng tự động — KHÔNG thêm sect.contribution hay reward vào proposed_deltas cho chúng. Chỉ tạo nội dung đẩy nhiệm vụ tiến triển (ví dụ: sinh dược liệu, gặp địch đúng loại, tới vùng cần đến).`
          : `  ⚠️ The missions above are tracked and rewarded automatically — DO NOT emit sect.contribution or reward deltas for them. Just craft content that advances their progress (e.g. yield the right herbs, stage the right enemy, reach the target region).`
      );
    }

    activeFlags.forEach(([flag, _]) => {
      if (flag.startsWith("sect_joining_")) {
        const sectName = flag.replace("sect_joining_", "").replace(/_/g, " ");
        ctx.push(
          locale === "vi"
            ? `  ⚠️ Đang gia nhập: ${sectName} — PHẢI tập trung hoàn thành, không đổi chủ đề. Hoàn thành → delta sect.join + set flag=false.`
            : `  ⚠️ Joining: ${sectName} — MUST focus on this mission, do not switch themes. Complete → sect.join delta + set flag=false.`
        );
      } else if (flag.startsWith("sect_mission_")) {
        // Rendered above with structured progress; skip to avoid duplication.
        return;
      } else if (flag.startsWith("quest_")) {
        const questName = flag.replace("quest_", "").replace(/_/g, " ");
        ctx.push(locale === "vi" ? `  🗡️ Nhiệm vụ: ${questName}` : `  🗡️ Quest: ${questName}`);
      } else {
        ctx.push(`  • ${flag}`);
      }
    });
    ctx.push("");
  }

  // Active story arcs — long-term goals the AI must keep weaving in
  const activeArcs = (state.story_arcs || []).filter((a) => a.status === "active");
  if (activeArcs.length > 0) {
    ctx.push(locale === "vi" ? "📖 TUYẾN TRUYỆN ĐANG MỞ:" : "📖 ACTIVE STORY ARCS:");
    for (const arc of activeArcs) {
      const title = locale === "vi" ? arc.title : arc.title_en || arc.title;
      ctx.push(`  ${title} [${arc.id}] — ${arc.stage}/${arc.total_stages}: ${arc.hook}`);
    }
    ctx.push("");
  }

  // Story summary
  ctx.push(locale === "vi" ? "=== TÓM TẮT ===" : "=== STORY SUMMARY ===");
  ctx.push(state.story_summary);
  ctx.push("");

  // Recent turns — latest verbatim, older as one-liners to save tokens
  if (recentNarratives.length > 0) {
    ctx.push(locale === "vi" ? "=== LƯỢT GẦN NHẤT ===" : "=== RECENT TURNS ===");
    const startTurn = state.turn_count - recentNarratives.length + 1;
    recentNarratives.forEach((narrative, i) => {
      const turnNo = startTurn + i;
      const isLatest = i === recentNarratives.length - 1;
      if (isLatest) {
        ctx.push(`[Turn ${turnNo}] ${narrative}`);
      } else {
        const preview = narrative.replace(/\s+/g, " ").slice(0, 140).trim();
        ctx.push(`[Turn ${turnNo}] ${preview}${narrative.length > 140 ? "…" : ""}`);
      }
    });
    ctx.push("");
  }

  // Current state
  ctx.push(locale === "vi" ? "=== TRẠNG THÁI ===" : "=== CURRENT STATE ===");

  // World location — grounded in the real map (regions/areas) so the AI can
  // reference actual places instead of inventing generic ones.
  const region = state.travel ? REGIONS[state.travel.current_region] : undefined;
  if (state.travel && region) {
    const travel = state.travel;
    const discovered = new Set(travel.discovered_areas?.[travel.current_region] || []);
    const area = region.areas.find((a) => a.id === travel.current_area);
    const regionName = locale === "vi" ? region.name : region.name_en;

    let line =
      locale === "vi"
        ? `🗺️ Vùng: ${regionName} (Cấp ${region.tier}, ${region.element})`
        : `🗺️ Region: ${regionName} (Tier ${region.tier}, ${region.element})`;
    if (area) {
      const areaName = locale === "vi" ? area.name : area.name_en;
      const safety = area.is_safe
        ? locale === "vi"
          ? "an toàn"
          : "safe"
        : locale === "vi"
          ? `nguy hiểm ${area.danger_level}/5`
          : `danger ${area.danger_level}/5`;
      const bonus = area.cultivation_bonus
        ? locale === "vi"
          ? `, tu luyện +${area.cultivation_bonus}%`
          : `, cultivation +${area.cultivation_bonus}%`
        : "";
      line +=
        locale === "vi"
          ? ` | Khu: ${areaName} (${area.type}, ${safety}${bonus})`
          : ` | Area: ${areaName} (${area.type}, ${safety}${bonus})`;
    }
    ctx.push(line);

    // Real movement options: connected areas (mark undiscovered ones) and
    // adjacent regions — use these names in choices and location deltas.
    const connections = (area?.connected_areas || [])
      .map((id) => {
        const a = region.areas.find((x) => x.id === id);
        if (!a) return null;
        const nm = locale === "vi" ? a.name : a.name_en;
        return discovered.has(id) ? nm : `${nm} (?)`;
      })
      .filter(Boolean)
      .join(", ");
    const adjacent = region.adjacent_regions
      .map((id) => {
        const r = REGIONS[id];
        return r ? (locale === "vi" ? r.name : r.name_en) : id;
      })
      .join(", ");
    if (connections || adjacent) {
      ctx.push(
        locale === "vi"
          ? `   Lối đi: ${connections || "—"} [(?) = chưa khám phá] | Vùng lân cận: ${adjacent}`
          : `   Paths: ${connections || "—"} [(?) = undiscovered] | Adjacent regions: ${adjacent}`
      );
    }

    // Area flavor pools — themed inspiration so each location feels distinct
    if (area && (area.event_pool.length > 0 || area.enemy_pool.length > 0)) {
      const humanize = (s: string) => s.replace(/_/g, " ");
      const eventHints = area.event_pool.slice(0, 3).map(humanize).join(", ");
      const enemyHints = area.enemy_pool.slice(0, 3).map(humanize).join(", ");
      const areaLootTable = resolveLootTable(area.loot_table, region.tier);
      ctx.push(
        locale === "vi"
          ? `   Chất liệu khu này — sự kiện: ${eventHints || "—"} | địch: ${enemyHints || "—"} | bảng loot: ${areaLootTable}`
          : `   Area flavor — events: ${eventHints || "—"} | enemies: ${enemyHints || "—"} | loot table: ${areaLootTable}`
      );
    }
  } else {
    ctx.push(
      locale === "vi"
        ? `Vị trí: ${state.location.place}, ${state.location.region}`
        : `Location: ${state.location.place}, ${state.location.region}`
    );
  }

  ctx.push(
    locale === "vi"
      ? `Thời gian: Năm ${state.time_year}, Tháng ${state.time_month}, Ngày ${state.time_day} - ${state.time_segment}`
      : `Time: Y${state.time_year} M${state.time_month} D${state.time_day} ${state.time_segment}`
  );

  // Dungeon status
  if (state.dungeon?.dungeon_id) {
    const remaining = state.dungeon.turns_remaining;
    ctx.push(
      locale === "vi"
        ? `🏛️ Bí cảnh: Tầng ${state.dungeon.current_floor}${remaining ? ` (còn ${remaining} lượt)` : ""}${remaining && remaining <= 10 ? " ⚠️ SẮP HẾT!" : ""}`
        : `🏛️ Dungeon: Floor ${state.dungeon.current_floor}${remaining ? ` (${remaining} turns left)` : ""}${remaining && remaining <= 10 ? " ⚠️ TIME LOW!" : ""}`
    );
  }

  // Active event
  if (state.events?.active_event) {
    ctx.push(
      locale === "vi"
        ? `📜 Sự kiện đang diễn ra: ${state.events.active_event.name} — chỉ dùng lựa chọn của sự kiện.`
        : `📜 Active event: ${state.events.active_event.name_en} — use event choices only.`
    );
  }

  // Time-based cultivation bonuses
  const currentSeason = getSeasonFromMonth(state.time_month);
  const currentTime: GameTime = {
    segment: state.time_segment as TimeSegment,
    day: state.time_day,
    month: state.time_month,
    year: state.time_year,
  };
  const timeBonus = calculateTimeCultivationBonus(currentTime, state.spirit_root.elements);
  const specialBonus = getSpecialTimeBonus(currentTime);
  ctx.push(
    locale === "vi"
      ? `🌸 Mùa: ${currentSeason} | ⏰ Bonus tu luyện: +${timeBonus}%${specialBonus ? ` (đặc biệt +${specialBonus.bonus}%)` : ""}`
      : `🌸 Season: ${currentSeason} | ⏰ Cultivation bonus: +${timeBonus}%${specialBonus ? ` (special +${specialBonus.bonus}%)` : ""}`
  );

  // Current activity (if any)
  if (state.activity?.current) {
    const activity = state.activity.current;
    ctx.push(
      locale === "vi"
        ? `🎯 Hoạt động: ${activity.type} (${activity.progress}% / ${activity.duration_segments} segments)`
        : `🎯 Activity: ${activity.type} (${activity.progress}% / ${activity.duration_segments} segments)`
    );
  }

  // Lifespan info (if any)
  if (state.lifespan) {
    const yearsRemaining = state.lifespan.years_remaining;
    const warn = yearsRemaining <= 20;
    ctx.push(
      locale === "vi"
        ? `${warn ? "⚠️" : "📅"} Tuổi: ${state.lifespan.current_age}/${state.lifespan.max_lifespan} (còn ${yearsRemaining} năm)${warn ? " - CẦN ĐỘT PHÁ!" : ""}`
        : `${warn ? "⚠️" : "📅"} Age: ${state.lifespan.current_age}/${state.lifespan.max_lifespan} (${yearsRemaining} yrs left)${warn ? " - NEED BREAKTHROUGH!" : ""}`
    );
  }

  // Ultimate goal framing (win condition): peak Nguyên Anh before lifespan ends
  const atPeak = state.progress.realm === "NguyênAnh" && state.progress.realm_stage >= 9;
  if (atPeak) {
    ctx.push(
      locale === "vi"
        ? `🏆 ĐỈNH PHONG: đã đạt Nguyên Anh viên mãn! Hướng nội dung về chuẩn bị thiên kiếp phi thăng — mở/luyện arc "arc_ascension" (tụ khí vận, tìm pháp bảo hộ kiếp, giải quyết ân oán trần thế).`
        : `🏆 PEAK REALM: Nascent Soul stage 9 reached! Steer content toward ascension tribulation prep — open/advance arc "arc_ascension" (gather fortune, seek tribulation artifacts, settle worldly debts).`
    );
  } else if (state.lifespan && state.lifespan.years_remaining <= 5) {
    ctx.push(
      locale === "vi"
        ? `⚰️ TỬ KỲ CẬN KỀ: thọ nguyên chỉ còn ${Math.max(0, state.lifespan.years_remaining)} năm — narrative phải nhuốm cảm giác thời gian cạn dần; đột phá cảnh giới là cách duy nhất kéo dài thọ nguyên.`
        : `⚰️ DEATH APPROACHES: only ${Math.max(0, state.lifespan.years_remaining)} years of lifespan remain — the narrative must carry that urgency; a realm breakthrough is the only way to extend life.`
    );
  }

  // Character condition warnings (only if something is actually wrong)
  if (state.condition) {
    const warnings: string[] = [];
    if (state.condition.fatigue > 70) {
      warnings.push(locale === "vi" ? "Mệt mỏi cao" : "High fatigue");
    }
    const badMentalStates = ["agitated", "fearful", "injured", "corrupted"];
    if (badMentalStates.includes(state.condition.mental_state)) {
      warnings.push(
        locale === "vi"
          ? `Tinh thần: ${state.condition.mental_state}`
          : `Mental: ${state.condition.mental_state}`
      );
    }
    if (state.condition.injuries && state.condition.injuries.length > 0) {
      warnings.push(
        locale === "vi"
          ? `${state.condition.injuries.length} chấn thương`
          : `${state.condition.injuries.length} injuries`
      );
    }
    if (state.condition.qi_deviation_level > 20) {
      warnings.push(
        locale === "vi"
          ? `Rủi ro tẩu hỏa: ${state.condition.qi_deviation_level}%`
          : `Qi deviation: ${state.condition.qi_deviation_level}%`
      );
    }
    if (warnings.length > 0) {
      ctx.push(
        locale === "vi"
          ? `⚠️ Tình trạng: ${warnings.join(", ")}`
          : `⚠️ Condition: ${warnings.join(", ")}`
      );
    }
  }
  ctx.push("");

  // Cultivation progress
  const requiredExp = getRequiredExp(state.progress.realm, state.progress.realm_stage);
  const expDisplay =
    requiredExp === Infinity
      ? `${state.progress.cultivation_exp}`
      : `${state.progress.cultivation_exp}/${requiredExp}`;
  ctx.push(
    locale === "vi"
      ? `Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage} (Exp ${expDisplay})`
      : `Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage} (Exp ${expDisplay})`
  );

  // Dual cultivation status
  if (state.progress.cultivation_path === "dual") {
    const bodyRealmNames: Record<string, { vi: string; en: string }> = {
      PhàmThể: { vi: "Phàm Thể", en: "Mortal Body" },
      LuyệnCốt: { vi: "Luyện Cốt", en: "Bone Forging" },
      ĐồngCân: { vi: "Đồng Cân", en: "Copper Tendon" },
      KimCương: { vi: "Kim Cương", en: "Diamond Body" },
      TháiCổ: { vi: "Thái Cổ", en: "Primordial Body" },
    };
    const bodyRealm = state.progress.body_realm || "PhàmThể";
    const bodyStage = state.progress.body_stage || 0;
    const bodyExp = state.progress.body_exp || 0;
    const expSplit = state.progress.exp_split ?? 50;
    const bodyRealmName = bodyRealmNames[bodyRealm]?.[locale] || bodyRealm;
    ctx.push(
      locale === "vi"
        ? `🏋️ Song Tu: ${bodyRealmName} tầng ${bodyStage + 1} (Body Exp ${bodyExp}) | ${expSplit}% Khí / ${100 - expSplit}% Thể`
        : `🏋️ Dual: ${bodyRealmName} stage ${bodyStage + 1} (Body Exp ${bodyExp}) | ${expSplit}% Qi / ${100 - expSplit}% Body`
    );
  }

  // Cultivation speed multiplier (one line)
  const spiritRootBonus = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueBonus = getTechniqueBonus(state);
  const sectBonus = state.sect_membership?.benefits?.cultivation_bonus
    ? 1.0 + state.sect_membership.benefits.cultivation_bonus / 100
    : 1.0;
  const totalMultiplier = spiritRootBonus * techniqueBonus * sectBonus;
  ctx.push(
    locale === "vi"
      ? `Linh căn: ${state.spirit_root.elements.join("/")} ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)}) | Tốc độ tổng: x${totalMultiplier.toFixed(2)}`
      : `Spirit Root: ${state.spirit_root.elements.join("/")} ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)}) | Total speed: x${totalMultiplier.toFixed(2)}`
  );
  ctx.push("");

  // Stats (with equipment) — single combined line
  const totalAttrs = calculateTotalAttributes(state);
  ctx.push(
    `HP ${state.stats.hp}/${state.stats.hp_max} | Qi ${state.stats.qi}/${state.stats.qi_max} | Stamina ${state.stats.stamina}/${state.stats.stamina_max}`
  );
  ctx.push(
    `STR ${totalAttrs.str} AGI ${totalAttrs.agi} INT ${totalAttrs.int} PER ${totalAttrs.perception} LUCK ${totalAttrs.luck}${locale === "vi" ? " (đã bao gồm trang bị)" : " (with equipment)"}`
  );

  // Combat power (one line — used for enemy balancing)
  const physicalAttack = Math.floor(totalAttrs.str * 1.5);
  const qiAttack = Math.floor(totalAttrs.int * 2 + totalAttrs.str / 2);
  const defense = Math.floor(5 + totalAttrs.agi / 3);
  ctx.push(
    locale === "vi"
      ? `⚔️ SỨC MẠNH: Phys ${physicalAttack}, Qi ${qiAttack}, Def ${defense} → địch HP ${Math.floor(physicalAttack * 2)}-${Math.floor(physicalAttack * 4)}, ATK ${Math.floor(physicalAttack * 0.6)}-${Math.floor(physicalAttack * 1.2)}, DEF ${Math.floor(defense * 0.6)}-${Math.floor(defense * 1.2)}`
      : `⚔️ COMBAT POWER: Phys ${physicalAttack}, Qi ${qiAttack}, Def ${defense} → enemy HP ${Math.floor(physicalAttack * 2)}-${Math.floor(physicalAttack * 4)}, ATK ${Math.floor(physicalAttack * 0.6)}-${Math.floor(physicalAttack * 1.2)}, DEF ${Math.floor(defense * 0.6)}-${Math.floor(defense * 1.2)}`
  );
  ctx.push("");

  // Resources and inventory capacity (one line)
  const baseCapacity = state.inventory.max_slots || 20;
  const ringCapacity = state.inventory.storage_ring?.capacity || 0;
  const totalCapacity = baseCapacity + ringCapacity;
  const usedSlots = state.inventory.items.length;
  ctx.push(
    locale === "vi"
      ? `Tài sản: ${state.inventory.silver} bạc, ${state.inventory.spirit_stones} linh thạch | Túi ${usedSlots}/${totalCapacity}${state.inventory.storage_ring ? ` (💍 +${ringCapacity})` : ""}`
      : `Resources: ${state.inventory.silver} silver, ${state.inventory.spirit_stones} spirit stones | Bag ${usedSlots}/${totalCapacity}${state.inventory.storage_ring ? ` (💍 +${ringCapacity})` : ""}`
  );

  // Equipped items — single combined line
  const equippedParts: string[] = [];
  Object.entries(state.equipped_items).forEach(([slot, item]) => {
    if (!item) return;
    const baseName = locale === "vi" ? item.name : item.name_en;
    const enhanceLevel = item.enhancement_level || 0;
    const name = enhanceLevel > 0 ? `${baseName} +${enhanceLevel}` : baseName;
    const stats: string[] = [];
    if (item.bonus_stats) {
      if (item.bonus_stats.str) stats.push(`STR+${item.bonus_stats.str}`);
      if (item.bonus_stats.agi) stats.push(`AGI+${item.bonus_stats.agi}`);
      if (item.bonus_stats.int) stats.push(`INT+${item.bonus_stats.int}`);
      if (item.bonus_stats.perception) stats.push(`PER+${item.bonus_stats.perception}`);
      if (item.bonus_stats.luck) stats.push(`LUCK+${item.bonus_stats.luck}`);
      if (item.bonus_stats.hp) stats.push(`HP+${item.bonus_stats.hp}`);
      if (item.bonus_stats.qi) stats.push(`Qi+${item.bonus_stats.qi}`);
    }
    if (item.effects?.storage_capacity) stats.push(`+${item.effects.storage_capacity} slots`);
    equippedParts.push(`${slot}: ${name} [${item.rarity}]${stats.length ? ` ${stats.join(" ")}` : ""}`);
  });
  if (equippedParts.length > 0) {
    ctx.push((locale === "vi" ? "Trang bị: " : "Equipped: ") + equippedParts.join(" | "));
  }

  // Inventory: up to 6 items on one line
  if (state.inventory.items.length > 0) {
    const shown = state.inventory.items.slice(0, 6).map((item) => {
      const baseName = locale === "vi" ? item.name : item.name_en;
      const enhanceLevel = item.enhancement_level || 0;
      const name = enhanceLevel > 0 ? `${baseName} +${enhanceLevel}` : baseName;
      return `${name} x${item.quantity} [${item.rarity} ${item.type}]`;
    });
    const more = state.inventory.items.length - 6;
    ctx.push(
      (locale === "vi"
        ? `Vật phẩm (${state.inventory.items.length}): `
        : `Items (${state.inventory.items.length}): `) +
        shown.join(", ") +
        (more > 0 ? (locale === "vi" ? ` … +${more} khác` : ` … +${more} more`) : "")
    );
  }
  ctx.push("");

  // Helper functions for terse translation
  const translateGrade = (grade: string) => {
    if (locale === "vi") {
      const m: Record<string, string> = { Mortal: "Phàm", Earth: "Địa", Heaven: "Thiên" };
      return m[grade] || grade;
    }
    return grade;
  };

  // Techniques (for cultivation speed) — single line, level-scaled bonus
  if (state.techniques && state.techniques.length > 0) {
    const list = state.techniques.map((tech) => {
      const name = locale === "vi" ? tech.name : tech.name_en;
      const elements =
        tech.elements && tech.elements.length > 0 ? `[${tech.elements.join("/")}]` : "[—]";
      const effective = Math.round(getTechniqueEffectiveBonus(tech));
      const level = tech.level && tech.level > 1 ? ` Lv${tech.level}` : "";
      return `${name} ${elements} ${translateGrade(tech.grade)}${level}${effective ? ` +${effective}%` : ""}`;
    });
    ctx.push((locale === "vi" ? "Công pháp: " : "Techniques: ") + list.join(" | "));
  }

  // Skills (for combat) — single line
  if (state.skills && state.skills.length > 0) {
    const list = state.skills.map((skill) => {
      const name = locale === "vi" ? skill.name : skill.name_en;
      const element = skill.element ? ` [${skill.element}]` : "";
      const dmg = skill.damage_multiplier ? ` ${skill.damage_multiplier}x` : "";
      const cost = skill.qi_cost ? ` ${skill.qi_cost}qi` : "";
      return `${name}${element} Lv${skill.level}/${skill.max_level} ${skill.type}${dmg}${cost}`;
    });
    ctx.push((locale === "vi" ? "Kỹ năng: " : "Skills: ") + list.join(" | "));
  }

  // Known NPCs — single line; NPCs at the current location first (marked 📍)
  // so the AI naturally reuses whoever is actually nearby.
  if (state.npcs && state.npcs.length > 0) {
    const hereNames: string[] = [state.location.place];
    if (state.travel) {
      const r = REGIONS[state.travel.current_region];
      const a = r?.areas.find((x) => x.id === state.travel!.current_area);
      if (a) hereNames.push(a.name, a.name_en);
    }
    const here = hereNames.filter(Boolean).map((s) => s.toLowerCase());
    const isHere = (loc?: string) => {
      if (!loc) return false;
      const l = loc.toLowerCase();
      return here.some((h) => l.includes(h) || h.includes(l));
    };

    const shown = [...state.npcs]
      .sort(
        (a, b) =>
          (isHere(b.location) ? 1 : 0) - (isHere(a.location) ? 1 : 0) ||
          Math.abs(b.relationship) - Math.abs(a.relationship) ||
          b.last_seen_turn - a.last_seen_turn
      )
      .slice(0, 8)
      .map((n, i) => {
        const name = locale === "vi" ? n.name : n.name_en || n.name;
        const rel = `${n.relationship >= 0 ? "+" : ""}${n.relationship}`;
        const loc = n.location ? `, ${n.location}` : "";
        const notes = i < 5 && n.notes ? `: ${n.notes}` : "";
        const pin = isHere(n.location) ? "📍" : "";
        return `${pin}${name} (${n.role}, ${rel}${loc})${notes}`;
      });
    ctx.push((locale === "vi" ? "Nhân vật quen: " : "Known NPCs: ") + shown.join(" | "));
  }

  // Sect membership — terse
  if (state.sect_membership) {
    const sect = state.sect_membership;
    const sectName = locale === "vi" ? sect.sect.name : sect.sect.name_en;
    const rankNames: Record<string, { vi: string; en: string }> = {
      NgoạiMôn: { vi: "Ngoại Môn", en: "Outer" },
      NộiMôn: { vi: "Nội Môn", en: "Inner" },
      ChânTruyền: { vi: "Chân Truyền", en: "True" },
      TrưởngLão: { vi: "Trưởng Lão", en: "Elder" },
      ChưởngMôn: { vi: "Chưởng Môn", en: "Master" },
    };
    const rankDisplay = rankNames[sect.rank]?.[locale] || sect.rank;
    const hints: string[] = [];
    if (sect.contribution >= 50)
      hints.push(locale === "vi" ? "có thể đổi vật phẩm" : "can spend for items");
    if (sect.contribution >= 150)
      hints.push(locale === "vi" ? "có thể đổi công pháp" : "can spend for techniques");
    if (sect.rank === "NgoạiMôn" && sect.contribution >= 200)
      hints.push(locale === "vi" ? "đủ thăng Nội Môn" : "promotable to Inner");
    if (sect.rank === "NộiMôn" && sect.contribution >= 500)
      hints.push(locale === "vi" ? "đủ thăng Chân Truyền" : "promotable to True");
    ctx.push(
      locale === "vi"
        ? `Tông môn: ${sectName} — ${rankDisplay} | Cống hiến ${sect.contribution}, Thanh danh ${sect.reputation}/100${hints.length ? ` (💡 ${hints.join(", ")})` : ""}${sect.mentor ? ` | Sư phụ: ${locale === "vi" ? sect.mentor : sect.mentor_en || sect.mentor}` : ""}`
        : `Sect: ${sectName} — ${rankDisplay} | Contribution ${sect.contribution}, Reputation ${sect.reputation}/100${hints.length ? ` (💡 ${hints.join(", ")})` : ""}${sect.mentor ? ` | Mentor: ${sect.mentor_en || sect.mentor}` : ""}`
    );
  } else {
    ctx.push(locale === "vi" ? "Tông môn: Tản tu" : "Sect: Rogue cultivator");
  }

  ctx.push(locale === "vi" ? `Nhân quả: ${state.karma}` : `Karma: ${state.karma}`);

  return ctx.join("\n");
}

/**
 * Build user message with scene template
 */
export function buildUserMessage(
  sceneContext: string,
  choiceId: string | null,
  locale: Locale,
  choiceText?: string | null
): string {
  if (choiceId) {
    const displayChoice = choiceText || choiceId;
    return locale === "vi"
      ? `Người chơi đã chọn: ${displayChoice}\n\nTiếp tục câu chuyện dựa trên lựa chọn này. Mô tả kết quả và đưa ra lựa chọn mới.`
      : `Player chose: ${displayChoice}\n\nContinue the story based on this choice. Describe the outcome and provide new choices.`;
  }
  return locale === "vi"
    ? `${sceneContext}\n\nBắt đầu tình huống mới này. Mô tả chi tiết và đưa ra lựa chọn.`
    : `${sceneContext}\n\nBegin this new situation. Describe in detail and provide choices.`;
}

/**
 * Build a minimal per-turn variety hint. Most variety rules live in the
 * stable system prompt; this only passes the dynamic "themes to avoid" list
 * so repeated phrasing doesn't eat tokens every turn.
 */
export function buildVarietyEnforcement(
  themesToAvoid: string[],
  _turnCount: number,
  locale: Locale
): string {
  if (themesToAvoid.length === 0) return "";
  return locale === "vi"
    ? `🚫 Tránh các chủ đề vừa xuất hiện: ${themesToAvoid.join(", ")}. Tạo tình huống khác hẳn.`
    : `🚫 Avoid recently-seen themes: ${themesToAvoid.join(", ")}. Create a completely different situation.`;
}
