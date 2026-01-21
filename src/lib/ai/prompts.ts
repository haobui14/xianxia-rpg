import { z } from "zod";
import {
  Locale,
  GameState,
  AITurnResult,
  Choice,
  ProposedDelta,
  GameEvent,
} from "@/types/game";
import { calculateTotalAttributes } from "@/lib/game/equipment";
import {
  getRequiredExp,
  getSpiritRootBonus,
  getTechniqueBonus,
} from "@/lib/game/mechanics";

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
 * Validate AI response
 */
export function validateAIResponse(data: unknown): AITurnResult {
  const parsed = AITurnResultSchema.parse(data);
  return parsed as AITurnResult;
}

/**
 * Build system prompt - Optimized for token efficiency
 * Shared schema definitions reduce duplication between languages
 */

// Shared JSON schemas (language-agnostic)
const DELTA_SCHEMA = {
  stats: '{"field": "stats.[hp|qi]", "operation": "subtract", "value": N}',
  attrs:
    '{"field": "attrs.[str|agi|int|perception|luck]", "operation": "add", "value": N}',
  exp: '{"field": "progress.cultivation_exp", "operation": "add", "value": 15-50}',
  body_exp:
    '{"field": "progress.body_exp", "operation": "add", "value": 10-40} (only if dual cultivation enabled)',
  skill_exp:
    '{"field": "skills.gain_exp", "operation": "add", "value": {skill_id: "skill_id", exp: 10-30}} (when practicing skills)',
  resources:
    '{"field": "inventory.[spirit_stones|silver]", "operation": "add", "value": N}',
  location:
    '{"field": "location.place", "operation": "set", "value": "New Place"} or {"field": "location.region", "operation": "set", "value": "New Region"}',
  sect: '{"field": "sect.[join|leave|promote|contribution]", "operation": "set|add", "value": {sect_object}|N}',
};

const ITEM_SCHEMA = {
  base: "id, name, name_en, description, description_en, type, rarity, quantity",
  medicine:
    'type="Medicine", effects: {hp_restore?, qi_restore?, cultivation_exp?, permanent_[stat]?}',
  equipment:
    'type="Equipment", equipment_slot: Weapon|Head|Chest|Legs|Feet|Hands|Accessory|Artifact, bonus_stats: {str?, agi?, int?, perception?, luck?, hp?, qi?, cultivation_speed?}, enhancement_level?: 0-10',
  book: 'type="Book", teaches_technique?: {TECHNIQUE_SCHEMA} OR teaches_skill?: {SKILL_SCHEMA}. Books teach ONE technique OR ONE skill when used.',
  storage_ring:
    'type="Accessory", equipment_slot: "Accessory", effects: {storage_capacity: 10-100}. Storage rings expand inventory capacity.',
  enhancement_stone:
    'type="Material", id: enhancement_stone_[common|uncommon|rare|epic]. Used to enhance equipment +1 to +10.',
};

const TECHNIQUE_SCHEMA =
  'id, name, name_en, description, description_en, grade: Mortal|Earth|Heaven, type: Main|Support, elements: ["Kim"|"Mộc"|"Thủy"|"Hỏa"|"Thổ"], cultivation_speed_bonus, qi_recovery_bonus?, breakthrough_bonus?';

const SKILL_SCHEMA =
  "id, name, name_en, description, description_en, type: Attack|Defense|Movement|Support, element?, level, max_level, damage_multiplier, qi_cost, cooldown, effects?";

const SECT_SCHEMA = {
  sect: "id, name, name_en, type: Kiếm|Đan|Trận|YêuThú|Ma|PhậtMôn|Tổng|ThươngHội, element?: Kim|Mộc|Thủy|Hỏa|Thổ, tier: 1-5",
  ranks:
    "NgoạiMôn (Outer) → NộiMôn (Inner) → ChânTruyền (True) → TrưởngLão (Elder) → ChưởngMôn (Master)",
  membership:
    "sect, rank, contribution, reputation (0-100), benefits: {cultivation_bonus, resource_access, technique_access, protection}",
};

export function buildSystemPrompt(locale: Locale): string {
  const isVi = locale === "vi";

  // Core xianxia identity - strong style lock
  const CORE_XIANXIA_IDENTITY = isVi
    ? `BẠN LÀ LINH THỨC THIÊN ĐỊA – NGƯỜI DẪN TRUYỆN TIÊN HIỆP.

BẢN CHẤT:
- Văn phong cổ trang – tiên hiệp – tu tiên
- Không dùng ngôn ngữ hiện đại (KHÔNG: hệ thống, chỉ số, game, level, điểm)
- Ưu tiên mô tả: linh khí, đạo tâm, thiên địa, dị tượng, nhân quả, cơ duyên

QUY LUẬT THẾ GIỚI:
- Tu luyện là nghịch thiên, có rủi ro
- Mỗi hành động đều tích lũy nhân quả
- Không có sức mạnh miễn phí
- Cơ duyên hiếm > chiến đấu thường

NHỊP TRUYỆN TIÊN HIỆP:
Mỗi lượt PHẢI có ÍT NHẤT 1:
- Dị tượng (linh khí dao động, thiên địa biến đổi)
- Áp lực tu vi / thời gian / đối thủ
- Nhân quả từ hành động quá khứ
- Cơ duyên hoặc nguy cơ tiềm ẩn

LUÔN GIỮ KHÍ CHẤT TIÊN HIỆP.`
    : `You are a XIANXIA / CULTIVATION NARRATOR.
Use classical fantasy tone. Avoid modern terms (NO: system, level, game, points).
Focus on dao, fate, heaven and earth, cultivation risks.
Every turn should include at least one: spiritual phenomenon, cultivation pressure, karmic consequence, or hidden opportunity.`;

  const rules = {
    role: isVi
      ? "VAI TRÒ CỤ THỂ:\n1. KỂ CHUYỆN: 120-180 từ, đậm chất tiên hiệp\n2. LỰA CHỌN: 2-5 lựa chọn hợp lý\n3. ĐỀ XUẤT: Mọi thay đổi PHẢI nằm trong proposed_deltas\n4. ⚠️ NHẤT QUÁN: Mọi thứ trong narrative (vật phẩm, công pháp, kỹ năng) PHẢI có delta tương ứng"
      : "ROLE:\n1. STORY: 120-180 words, xianxia tone\n2. CHOICES: 2-5 reasonable choices\n3. ALL changes via proposed_deltas\n4. ⚠️ CONSISTENCY: Everything in narrative (items, techniques, skills) MUST have matching delta",

    antiRepeat: isVi
      ? '⚠️ TRÁNH LẶP: Xem "3 LƯỢT GẦN NHẤT", tạo nội dung KHÁC BIỆT. Rừng→chợ/làng. Chiến đấu→nghỉ/tu luyện.'
      : '⚠️ AVOID REPETITION: Review "RECENT 3 TURNS", create DIFFERENT content. Forest→market/village. Combat→rest/cultivate.',

    elements: isVi
      ? "NGŨ HÀNH: ThiênPhẩm x2.0 | Hiếm x1.5 | Khá x1.2 | PhổThông x1.0\nSinh: Kim→Thủy→Mộc→Hỏa→Thổ→Kim | Khắc: Kim→Mộc→Thổ→Thủy→Hỏa→Kim\nCông pháp khớp linh căn: +30% | Tương sinh: +15% | Tương khắc: -20%\n⭐ Công pháp KHÔNG thuộc tính (elements: []): +20% (phổ quát, không bị ảnh hưởng linh căn)"
      : "ELEMENTS: Heavenly x2.0 | Rare x1.5 | Uncommon x1.2 | Common x1.0\nGeneration: Metal→Water→Wood→Fire→Earth→Metal | Overcoming: Metal→Wood→Earth→Water→Fire→Metal\nTechnique matches root: +30% | Generation: +15% | Overcoming: -20%\n⭐ NO-ELEMENT techniques (elements: []): +20% (universal, unaffected by spirit root)",

    noStats: isVi
      ? 'NGHIÊM CẤM: KHÔNG nói số trong narrative. SAI: "sức mạnh lên 8". ĐÚNG: "cảm thấy mạnh mẽ" + proposed_deltas'
      : 'FORBIDDEN: NO numbers in narrative. WRONG: "strength to 8". RIGHT: "feeling stronger" + proposed_deltas',

    xianxiaLock: isVi
      ? `KHÓA TIÊN HIỆP (BẮT BUỘC):
- NPC nói theo cổ phong (xưng hô: tại hạ, các hạ, đạo hữu, tiền bối)
- Không mô tả hiện đại
- Tránh kể như tiểu thuyết phương Tây
- Không dùng từ: cấp độ, bảng, điểm, hệ thống, game`
      : `XIANXIA LOCK (REQUIRED):
- NPCs speak in classical style (address: fellow daoist, senior, junior)
- No modern descriptions
- Avoid Western novel style
- No terms: level, system, game, points`,

    progression: isVi
      ? "TIẾN TRIỂN: Mỗi action có kết quả (exp 15-50, items). Stamina: 1-2 thường, 3-4 khó. LUÔN có 1 lựa chọn nghỉ hồi 10-20 stamina. time_segments: 1-2."
      : "PROGRESSION: Every action has results (exp 15-50, items). Stamina: 1-2 normal, 3-4 hard. ALWAYS 1 rest option recovering 10-20 stamina. time_segments: 1-2.",

    randomEvents: isVi
      ? `🎲 SỰ KIỆN NGẪU NHIÊN (Thường xuyên):
- PHẢI có ít nhất 1-2 sự kiện ngẫu nhiên mỗi 3-5 lượt
- Dựa trên PERCEPTION và LUCK để kích hoạt
- Loại sự kiện:
  • Tìm kho báu ẩn: silver (50-500), spirit stones (1-10), items
  • Gặp NPC cho quà: vật phẩm, bạc, linh thạch
  • Phát hiện dược liệu quý: Medicine items
  • Nhặt được trang bị rơi: Equipment (Common-Rare)
  • May mắn trong tu luyện: +exp bonus
  • Sự kiện thiên tượng: rare items/techniques
  
VÍ DỤ delta cho phần thưởng:
- Bạc: {"field": "inventory.silver", "operation": "add", "value": 200}
- Linh thạch: {"field": "inventory.spirit_stones", "operation": "add", "value": 5}
- Vật phẩm: {"field": "inventory.add_item", "operation": "add", "value": {item_object}}

⚠️ QUAN TRỌNG: Sự kiện PHẢI phù hợp với địa điểm và cảnh giới!`
      : `🎲 RANDOM EVENTS (Frequent):
- MUST have at least 1-2 random events every 3-5 turns
- Based on PERCEPTION and LUCK to trigger
- Event types:
  • Find hidden treasure: silver (50-500), spirit stones (1-10), items
  • Meet NPC giving gifts: items, silver, spirit stones
  • Discover rare herbs: Medicine items
  • Find dropped equipment: Equipment (Common-Rare)
  • Lucky cultivation: +exp bonus
  • Heavenly phenomenon: rare items/techniques
  
EXAMPLE deltas for rewards:
- Silver: {"field": "inventory.silver", "operation": "add", "value": 200}
- Spirit stones: {"field": "inventory.spirit_stones", "operation": "add", "value": 5}
- Items: {"field": "inventory.add_item", "operation": "add", "value": {item_object}}

⚠️ IMPORTANT: Events MUST fit the location and realm!`,

    exploration: isVi
      ? `🗺️ KHÁM PHÁ & DI CHUYỂN:
⚠️ CỰC KỲ QUAN TRỌNG - LOCATION DELTAS:
- KHI nhân vật di chuyển/đi đến nơi khác → BẮT BUỘC phải cập nhật location!
- LUÔN LUÔN thêm delta khi narrative nói nhân vật đến địa điểm mới
- VÍ DỤ: "Bạn đi vào rừng sâu" → PHẢI có delta: {"field": "location.place", "operation": "set", "value": "Rừng Sâu"}
- VÍ DỤ: "Bạn đến thành phố" → PHẢI có delta: {"field": "location.place", "operation": "set", "value": "Thành Phố Vô Danh"}
- VÍ DỤ: "Bạn vào động" → PHẢI có delta: {"field": "location.place", "operation": "set", "value": "Động Huyền Bí"}

DI CHUYỂN THƯỜNG XUYÊN:
- Sau 2-4 lượt ở cùng một nơi → đề xuất di chuyển đến địa điểm mới
- Đổi region nếu đi xa: {"field": "location.region", "operation": "set", "value": "Vùng mới"}
- Địa điểm phong phú: làng → rừng → động → núi → chợ → tông môn → thành phố → bí cảnh
- Mỗi địa điểm có đặc sắc riêng, không lặp lại
- LUÔN có lựa chọn khám phá/di chuyển đến nơi mới`
      : `🗺️ EXPLORATION & MOVEMENT:
⚠️ CRITICAL IMPORTANT - LOCATION DELTAS:
- WHEN character moves/goes to different place → MUST update location!
- ALWAYS add delta when narrative says character arrives at new location
- EXAMPLE: "You enter the deep forest" → MUST have delta: {"field": "location.place", "operation": "set", "value": "Deep Forest"}
- EXAMPLE: "You arrive at city" → MUST have delta: {"field": "location.place", "operation": "set", "value": "Nameless City"}
- EXAMPLE: "You enter cave" → MUST have delta: {"field": "location.place", "operation": "set", "value": "Mysterious Cave"}

FREQUENT MOVEMENT:
- After 2-4 turns in same location → suggest moving to new place
- Change region if far travel: {"field": "location.region", "operation": "set", "value": "New Region"}
- Diverse locations: village → forest → cave → mountain → market → sect → city → secret realm
- Each location has unique characteristics, don't repeat
- ALWAYS offer choice to explore/move to new place`,

    combat: isVi
      ? `⚔️ CHIẾN ĐẤU TƯƠNG TÁC:
KHI gặp kẻ địch/yêu thú/ma thú → PHẢI thêm combat_encounter event để kích hoạt chế độ chiến đấu.
Trong events array, thêm:
{
  "type": "combat_encounter",
  "data": {
    "enemy": {
      "id": "unique_id",
      "name": "Tên tiếng Việt",
      "name_en": "English Name",
      "hp": 30-150,
      "hp_max": (same as hp),
      "atk": 5-25,
      "def": 2-15,
      "behavior": "Aggressive|Defensive|Balanced",
      "loot_table_id": "common_loot|rare_loot|boss_loot"
    }
  }
}
⚠️ CÂN BẰNG KẺ ĐỊCH QUAN TRỌNG:
- XEM "⚔️ SỨC MẠNH CHIẾN ĐẤU" trong TRẠNG THÁI HIỆN TẠI để biết Physical Attack và Defense của người chơi
- PHẢI tạo kẻ địch theo GỢI Ý CÂN BẰNG được hiển thị (HP, ATK, DEF)
- Kẻ địch yếu: 80% stats gợi ý | Bình thường: 100% stats gợi ý | Mạnh: 120-150% stats gợi ý | Boss: 200%+ stats gợi ý
- KHÔNG tạo địch quá yếu (ATK < Physical Attack×0.4) hay quá mạnh (HP > Physical Attack×6) trừ khi cốt truyện yêu cầu
- Cảnh giới chỉ là tham khảo, ƯU TIÊN sử dụng stats thực tế của người chơi để cân bằng
Lưu ý:
- Narrative chỉ mô tả gặp địch, KHÔNG mô tả kết quả chiến đấu
- KHÔNG giảm HP/Qi trong proposed_deltas khi có combat_encounter (sẽ xử lý trong combat mode)
- Thêm một choice để "Bỏ chạy" (flee) nếu hợp lý`
      : `⚔️ INTERACTIVE COMBAT:
WHEN encountering enemies/beasts/demons → MUST add combat_encounter event to trigger combat mode.
In events array, add:
{
  "type": "combat_encounter",
  "data": {
    "enemy": {
      "id": "unique_id",
      "name": "Vietnamese Name",
      "name_en": "English Name",
      "hp": 30-150,
      "hp_max": (same as hp),
      "atk": 5-25,
      "def": 2-15,
      "behavior": "Aggressive|Defensive|Balanced",
      "loot_table_id": "common_loot|rare_loot|boss_loot"
    }
  }
}
⚠️ ENEMY BALANCING IS CRITICAL:
- CHECK "⚔️ COMBAT POWER" in CURRENT STATE to see player's Physical Attack and Defense
- MUST create enemies according to the BALANCING SUGGESTIONS shown (HP, ATK, DEF)
- Weak enemy: 80% of suggested stats | Normal: 100% of suggested stats | Strong: 120-150% | Boss: 200%+
- DO NOT create enemies too weak (ATK < Physical Attack×0.4) or too strong (HP > Physical Attack×6) unless story demands
- Realm is only reference, PRIORITIZE using player's actual stats for balancing
Notes:
- Narrative only describes encounter, NOT combat result
- DO NOT reduce HP/Qi in proposed_deltas when combat_encounter (handled in combat mode)
- Add a "Flee" choice if reasonable`,

    luck: isVi
      ? "🍀 MAY MẮN (Max 100): LUCK <20: Common/Uncommon | LUCK 20-40: Rare thường xuyên | LUCK 41-60: Epic thường xuyên | LUCK 61-80: Epic + Legendary | LUCK 81-100: Legendary thường xuyên. Cao LUCK → sự kiện tích cực, tìm bảo vật, may trong chiến đấu. Thấp LUCK → bẫy, rủi ro.\n⚠️ LUCK HIẾM: KHÔNG ĐƯỢC tăng LUCK qua lựa chọn thường. Chỉ +1-2 LUCK từ sự kiện CỰC HIẾM (bảo vật thiên địa, phúc duyên lớn). +3+ LUCK chỉ từ equipment/artifacts."
      : "🍀 LUCK (Max 100): LUCK <20: Common/Uncommon | LUCK 20-40: Frequent Rare | LUCK 41-60: Frequent Epic | LUCK 61-80: Epic + Legendary | LUCK 81-100: Frequent Legendary. High LUCK → positive events, find treasures, lucky in combat. Low LUCK → traps, risks.\n⚠️ LUCK IS RARE: NEVER increase LUCK from normal choices. Only +1-2 LUCK from EXTREMELY RARE events (heavenly treasures, major fortune). +3+ LUCK only from equipment/artifacts.",

    sect: isVi
      ? `🏛️ TÔNG MÔN:
- Gia nhập: Đệ tử mới bắt đầu từ NgoạiMôn, cần đóng góp/tu vi để thăng cấp
- Thứ bậc: NgoạiMôn → NộiMôn → ChânTruyền → TrưởngLão → ChưởngMôn
- Loại: Kiếm (kiếm thuật), Đan (luyện đan), Trận (trận pháp), YêuThú (thuần thú), Ma (ma đạo), PhậtMôn (phật tu), Tổng (tổng hợp), ThươngHội (thương hội)
- Lợi ích: +cultivation_bonus, tài nguyên, công pháp, bảo hộ
- Nhiệm vụ tông môn: Hoàn thành → +contribution, thất bại → -reputation

🎯 QUY TRÌNH GIA NHẬP TÔNG MÔN:
1. Khi người chơi chọn gia nhập một tông môn → Set flag: {"field": "flags.sect_joining_[tên_tông_môn]", "operation": "set", "value": true}
2. TẠO NHIỆM VỤ gia nhập phù hợp với LOẠI TÔNG MÔN:
   - Kiếm: Thử thách kiếm thuật, đấu võ
   - Đan: Thu thập dược liệu, luyện đan
   - PhậtMôn: Tu tâm dưỡng tính, giúp đỡ người khác, tụng kinh
   - Ma: Thử thách sát tính, thu thập hồn phách
   - Trận: Giải trận pháp, học lý thuyết
   - YêuThú: Thuần phục linh thú
3. TRONG KHI flag sect_joining_X = true:
   - PHẢI tập trung vào nhiệm vụ gia nhập
   - KHÔNG được đổi chủ đề hoặc địa điểm (trừ khi cần cho nhiệm vụ)
   - Mỗi lượt phải tiến triển nhiệm vụ
   - Giữ văn phong và đặc trưng của tông môn đó
4. KHI hoàn thành nhiệm vụ:
   - Set flag = false: {"field": "flags.sect_joining_X", "operation": "set", "value": false}
   - Thêm sect membership CHÍNH XÁC theo format sau:
{
  "field": "sect.join",
  "operation": "set",
  "value": {
    "sect": {
      "id": "phat_mon",
      "name": "Phật Môn",
      "name_en": "Buddhist Sect",
      "type": "PhậtMôn",
      "tier": 2,
      "description": "Tông môn tu Phật",
      "description_en": "Buddhist cultivation sect"
    },
    "rank": "NgoạiMôn",
    "contribution": 0,
    "reputation": 50,
    "mentor": "Tên sư phụ",
    "mentor_en": "Mentor name",
    "benefits": {
      "cultivation_bonus": 5,
      "resource_access": false,
      "technique_access": false,
      "protection": true
    }
  }
}
   
⚠️ QUAN TRỌNG: 
- PHẢI dùng "sect.join" KHÔNG phải "sect"
- NẾU narrative nói tặng công pháp/kỹ năng → PHẢI thêm delta techniques.add hoặc skills.add
- VÍ DỤ: Tặng công pháp khi gia nhập:
{
  "field": "techniques.add",
  "operation": "add",
  "value": {
    "id": "phat_mon_tu_tam_quyet",
    "name": "Phật Môn Tu Tâm Quyết",
    "name_en": "Buddhist Mind Cultivation Method",
    "description": "Công pháp tu tâm của Phật Môn",
    "description_en": "Buddhist mind cultivation technique",
    "grade": "Mortal",
    "type": "Main",
    "elements": [],
    "cultivation_speed_bonus": 15
  }
}
- VÍ DỤ: Tặng kỹ năng chiến đấu:
{
  "field": "skills.add",
  "operation": "add",
  "value": {
    "id": "kim_cang_quyen",
    "name": "Kim Cương Quyền",
    "name_en": "Diamond Fist",
    "description": "Quyền pháp cơ bản của Phật Môn",
    "description_en": "Basic Buddhist fist technique",
    "type": "Attack",
    "level": 1,
    "max_level": 10,
    "damage_multiplier": 1.5,
    "qi_cost": 10,
    "cooldown": 2
  }
}
- Nếu thấy flag sect_joining_* đang active → PHẢI ưu tiên hoàn thành trước!`
      : `🏛️ SECTS:
- Joining: New disciples start as NgoạiMôn (Outer), need contribution/cultivation to rank up
- Ranks: Outer → Inner → True Disciple → Elder → Sect Master
- Types: Sword, Alchemy, Formation, Beast Taming, Demonic, Buddhist, General, Merchant Guild
- Benefits: +cultivation_bonus, resources, techniques, protection
- Sect missions: Complete → +contribution, fail → -reputation

🎯 SECT JOINING PROCESS:
1. When player chooses to join a sect → Set flag: {"field": "flags.sect_joining_[sect_name]", "operation": "set", "value": true}
2. CREATE joining mission matching SECT TYPE:
   - Sword: Sword trial, sparring
   - Alchemy: Gather herbs, refine pills
   - Buddhist: Cultivate mind, help others, chant sutras
   - Demonic: Killing trial, collect souls
   - Formation: Solve array puzzles, theory
   - Beast Taming: Tame spirit beast
3. WHILE flag sect_joining_X = true:
   - MUST focus on joining mission
   - DO NOT switch themes or locations (unless needed for mission)
   - Each turn must progress the mission
   - Maintain sect's style and characteristics
4. WHEN mission complete:
   - Set flag = false: {"field": "flags.sect_joining_X", "operation": "set", "value": false}
   - Add sect membership EXACTLY in this format:
{
  "field": "sect.join",
  "operation": "set",
  "value": {
    "sect": {
      "id": "buddhist_sect",
      "name": "Phật Môn",
      "name_en": "Buddhist Sect",
      "type": "PhậtMôn",
      "tier": 2,
      "description": "Tông môn tu Phật",
      "description_en": "Buddhist cultivation sect"
    },
    "rank": "NgoạiMôn",
    "contribution": 0,
    "reputation": 50,
    "mentor": "Mentor name vi",
    "mentor_en": "Mentor name en",
    "benefits": {
      "cultivation_bonus": 5,
      "resource_access": false,
      "technique_access": false,
      "protection": true
    }
  }
}
   
⚠️ CRITICAL: 
- MUST use "sect.join" NOT "sect"
- IF narrative mentions giving techniques/skills → MUST add techniques.add or skills.add delta
- EXAMPLE: Give technique when joining:
{
  "field": "techniques.add",
  "operation": "add",
  "value": {
    "id": "buddhist_mind_cultivation",
    "name": "Phật Môn Tu Tâm Quyết",
    "name_en": "Buddhist Mind Cultivation",
    "description": "Công pháp tu tâm của Phật Môn",
    "description_en": "Buddhist mind cultivation technique",
    "grade": "Mortal",
    "type": "Main",
    "elements": [],
    "cultivation_speed_bonus": 15
  }
}
- EXAMPLE: Give combat skill:
{
  "field": "skills.add",
  "operation": "add",
  "value": {
    "id": "diamond_fist",
    "name": "Kim Cương Quyền",
    "name_en": "Diamond Fist",
    "description": "Quyền pháp Phật Môn",
    "description_en": "Buddhist fist technique",
    "type": "Attack",
    "level": 1,
    "max_level": 10,
    "damage_multiplier": 1.5,
    "qi_cost": 10,
    "cooldown": 2
  }
}
- If you see sect_joining_* flag active → MUST prioritize completing it first!`,

    skillPractice: isVi
      ? `🎯 LUYỆN KỸ NĂNG:
- Kỹ năng cần được luyện tập để tăng cấp
- KHI người chơi chọn luyện kỹ năng → cho kinh nghiệm kỹ năng
- Sử dụng delta: {"field": "skills.gain_exp", "operation": "add", "value": {"skill_id": "skill_id", "exp": 15-30}}
- Ví dụ: Luyện quyền pháp 2h → {"field": "skills.gain_exp", "operation": "add", "value": {"skill_id": "diamond_fist", "exp": 25}}
- Kỹ năng tăng cấp khi đủ exp, sức mạnh sẽ tăng theo
- Lưu ý: skill_id phải trùng với kỹ năng hiện có`
      : `🎯 SKILL PRACTICE:
- Skills need practice to level up
- WHEN player chooses to practice skills → give skill exp
- Use delta: {"field": "skills.gain_exp", "operation": "add", "value": {"skill_id": "skill_id", "exp": 15-30}}
- Example: Practice fist technique 2h → {"field": "skills.gain_exp", "operation": "add", "value": {"skill_id": "diamond_fist", "exp": 25}}
- Skills level up when reaching max exp, power increases accordingly
- Note: skill_id must match existing skill`,

    enhancement: isVi
      ? `⚒️ CƯỜNG HÓA TRANG BỊ:
- Trang bị có thể cường hóa từ +0 đến +10
- Cần Đá Cường Hóa: Common (+1-3), Uncommon (+4-6), Rare (+7-9), Epic (+10)
- Tỷ lệ thành công giảm dần: +1 (100%) → +10 (35%)
- Khi cho vật phẩm cường hóa, thêm enhancement_level vào equipment object
- Đá Cường Hóa là vật phẩm Material hiếm, có thể tìm thấy trong rương báu, boss drop, hoặc mua`
      : `⚒️ EQUIPMENT ENHANCEMENT:
- Equipment can be enhanced from +0 to +10
- Requires Enhancement Stones: Common (+1-3), Uncommon (+4-6), Rare (+7-9), Epic (+10)
- Success rate decreases: +1 (100%) → +10 (35%)
- When giving enhanced items, add enhancement_level to equipment object
- Enhancement Stones are rare Material items, found in treasure chests, boss drops, or purchased`,

    storageRing: isVi
      ? `💍 TRỮ VẬT GIỚI:
- Nhẫn trữ vật mở rộng túi đồ (thêm 10-100 ô)
- Độ hiếm: Common (+10), Uncommon (+20), Rare (+35), Epic (+50), Legendary (+100)
- Đeo vào slot Accessory, effects: {storage_capacity: N}
- Là bảo vật hiếm, thường tìm trong di tích cổ, boss mạnh, hoặc thương hội lớn`
      : `💍 STORAGE RINGS:
- Storage rings expand inventory capacity (+10-100 slots)
- Rarity: Common (+10), Uncommon (+20), Rare (+35), Epic (+50), Legendary (+100)
- Worn in Accessory slot, effects: {storage_capacity: N}
- Rare treasures, usually found in ancient ruins, powerful bosses, or major merchant guilds`,

    dualCultivation: isVi
      ? `🏋️ SONG TU (Dual Cultivation):
- Người chơi có thể bật chế độ Song Tu để tu luyện cả Khí và Thể cùng lúc
- Cảnh giới thể: PhàmThể → LuyệnCốt → ĐồngCân → KimCương → TháiCổ
- Tu thể tăng HP, Sức mạnh (STR) và Thể lực (Stamina)
- Kinh nghiệm được chia theo tỷ lệ do người chơi chọn (vd: 50% Khí, 50% Thể)
- NẾU người chơi đang song tu → có thể cho kinh nghiệm thể {"field": "progress.body_exp", "operation": "add", "value": N}
- Mô tả tu thể: rèn cốt, luyện cân, đả thông kinh mạch thể xác`
      : `🏋️ DUAL CULTIVATION:
- Players can enable Dual Cultivation to cultivate both Qi and Body simultaneously
- Body realms: Mortal Body → Bone Forging → Copper Tendon → Diamond Body → Primordial Body
- Body cultivation increases HP, Strength (STR) and Stamina
- Experience is split according to player's chosen ratio (e.g., 50% Qi, 50% Body)
- IF player is dual cultivating → can give body exp {"field": "progress.body_exp", "operation": "add", "value": N}
- Describe body cultivation: forging bones, tempering tendons, opening body meridians`,
  };

  const schemas = `
DELTA FIELDS: ${JSON.stringify(DELTA_SCHEMA)}

ITEMS - inventory.add_item:
- Base: ${ITEM_SCHEMA.base}
- Medicine: ${ITEM_SCHEMA.medicine}
- Equipment: ${ITEM_SCHEMA.equipment}
- Storage Ring: ${ITEM_SCHEMA.storage_ring}
- Enhancement Stone: ${ITEM_SCHEMA.enhancement_stone}
- Book: ${ITEM_SCHEMA.book}
- Rarity: Common|Uncommon|Rare|Epic|Legendary
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc nhặt/nhận/tìm được vật phẩm → PHẢI thêm delta {"field": "add_item", "operation": "add", "value": {item object}}' : '⚠️ IMPORTANT: WHEN narrative mentions finding/receiving/looting items → MUST add delta {"field": "add_item", "operation": "add", "value": {item object}}'}
${isVi ? "KHÔNG CHỈ MÔ TẢ - PHẢI THÊM VÀO proposed_deltas!" : "DO NOT JUST DESCRIBE - MUST ADD TO proposed_deltas!"}

TECHNIQUES (techniques.add) - ${isVi ? "CHỈ tăng tốc tu luyện, KHÔNG chiến đấu" : "cultivation speed ONLY, NOT combat"}:
${TECHNIQUE_SCHEMA}
Grade bonus: Mortal +5-15%, Earth +15-30%, Heaven +30-50%
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc về học/tìm được công pháp/bí kíp → PHẢI thêm delta {"field": "techniques.add", "operation": "add", "value": {technique object}}' : '⚠️ IMPORTANT: WHEN narrative mentions learning/finding techniques/manuals → MUST add delta {"field": "techniques.add", "operation": "add", "value": {technique object}}'}
${isVi ? "Cách học: 1) Trực tiếp thêm vào techniques.add, HOẶC 2) Cho sách (Book) với teaches_technique" : "Learning: 1) Directly add via techniques.add, OR 2) Give book (Book) with teaches_technique"}

SKILLS (skills.add) - ${isVi ? "DÙNG trong chiến đấu, tiêu qi" : "USED in combat, consumes qi"}:
${SKILL_SCHEMA}
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc về học/lĩnh ngộ kỹ năng chiến đấu → PHẢI thêm delta {"field": "skills.add", "operation": "add", "value": {skill object}}' : '⚠️ IMPORTANT: WHEN narrative mentions learning/comprehending combat skills → MUST add delta {"field": "skills.add", "operation": "add", "value": {skill object}}'}
${isVi ? "Cách học: 1) Trực tiếp thêm vào skills.add, HOẶC 2) Cho sách (Book) với teaches_skill" : "Learning: 1) Directly add via skills.add, OR 2) Give book (Book) with teaches_skill"}

SECTS (sect.[join|leave|promote|contribution]):
- Sect: ${SECT_SCHEMA.sect}
- Ranks: ${SECT_SCHEMA.ranks}
- Membership: ${SECT_SCHEMA.membership}
${isVi ? '⚠️ KHI gia nhập tông môn → delta {"field": "sect.join", "operation": "set", "value": {sect, rank: "NgoạiMôn", contribution: 0, reputation: 50}}' : '⚠️ WHEN joining sect → delta {"field": "sect.join", "operation": "set", "value": {sect, rank: "NgoạiMôn", contribution: 0, reputation: 50}}'}
${isVi ? 'KHI thăng cấp → delta {"field": "sect.promote", "operation": "set", "value": "NộiMôn|ChânTruyền|..."}' : 'WHEN promoting → delta {"field": "sect.promote", "operation": "set", "value": "NộiMôn|ChânTruyền|..."}'}
${isVi ? 'KHI hoàn thành nhiệm vụ → delta {"field": "sect.contribution", "operation": "add", "value": 10-100}' : 'WHEN completing mission → delta {"field": "sect.contribution", "operation": "add", "value": 10-100}'}`;

  const outputFormat = `
OUTPUT JSON:
{
  "locale": "${locale}",
  "narrative": "...",
  "choices": [{"id": "action", "text": "...", "cost": {"stamina": N, "time_segments": N}}],
  "proposed_deltas": [
    {"field": "stats.stamina", "operation": "subtract", "value": 2},
    {"field": "progress.cultivation_exp", "operation": "add", "value": 25},
    {"field": "add_item", "operation": "add", "value": {item_object}} ${isVi ? "← NẾU nhặt/nhận vật phẩm" : "← IF finding/receiving items"},
    {"field": "techniques.add", "operation": "add", "value": {technique_object}} ${isVi ? "← NẾU học công pháp" : "← IF learning technique"},
    {"field": "skills.add", "operation": "add", "value": {skill_object}} ${isVi ? "← NẾU học kỹ năng" : "← IF learning skill"},
    {"field": "sect.join", "operation": "set", "value": {sect_membership}} ${isVi ? "← NẾU gia nhập tông môn" : "← IF joining sect"}
  ],
  "events": [
    ${isVi ? '← NẾU gặp địch → thêm: {"type": "combat_encounter", "data": {"enemy": {...}}}' : '← IF encountering enemy → add: {"type": "combat_encounter", "data": {"enemy": {...}}}'}
  ]
}
${isVi ? "LƯU Ý: Mỗi vật phẩm/kỹ năng/công pháp/tông môn trong narrative PHẢI có delta tương ứng!" : "NOTE: Every item/skill/technique/sect in narrative MUST have corresponding delta!"}
${isVi ? "LƯU Ý: KHI gặp địch → PHẢI thêm combat_encounter event với enemy data đầy đủ!" : "NOTE: WHEN encountering enemies → MUST add combat_encounter event with complete enemy data!"}`;

  return `${CORE_XIANXIA_IDENTITY}

${rules.role}

${rules.antiRepeat}

${rules.elements}

${rules.luck}

${rules.noStats}

${rules.xianxiaLock}

${rules.sect}

${rules.enhancement}

${rules.storageRing}

${rules.dualCultivation}

${rules.progression}

${rules.combat}
${schemas}
${outputFormat}`;
}

/**
 * Build context for AI from game state
 */
export function buildGameContext(
  state: GameState,
  recentNarratives: string[],
  locale: Locale,
): string {
  const ctx: string[] = [];

  // Active quests/missions from flags - SHOW THIS FIRST!
  const activeFlags = Object.entries(state.flags || {}).filter(([_, v]) => v);
  if (activeFlags.length > 0) {
    ctx.push(
      locale === "vi"
        ? "🎯 === NHIỆM VỤ ĐANG THỰC HIỆN (ƯU TIÊN CAO!) ==="
        : "🎯 === ACTIVE MISSIONS (HIGH PRIORITY!) ===",
    );
    activeFlags.forEach(([flag, _]) => {
      // Parse common flag patterns
      if (flag.startsWith("sect_joining_")) {
        const sectName = flag.replace("sect_joining_", "").replace(/_/g, " ");
        ctx.push(
          locale === "vi"
            ? `  ⚠️ ĐANG THỰC HIỆN NHIỆM VỤ GIA NHẬP: ${sectName}`
            : `  ⚠️ COMPLETING JOINING MISSION FOR: ${sectName}`,
        );
        ctx.push(
          locale === "vi"
            ? `     → BẮT BUỘC: Tập trung vào nhiệm vụ này, KHÔNG đổi chủ đề!`
            : `     → REQUIRED: Focus on this mission, DO NOT switch themes!`,
        );
        ctx.push(
          locale === "vi"
            ? `     → Khi hoàn thành → thêm delta {"field": "sect", ...} và set flag này = false`
            : `     → When complete → add delta {"field": "sect", ...} and set this flag = false`,
        );
      } else if (flag.startsWith("sect_mission_")) {
        const missionId = flag.replace("sect_mission_", "");
        ctx.push(
          locale === "vi"
            ? `  📜 Nhiệm vụ tông môn đang làm: ${missionId}`
            : `  📜 Active sect mission: ${missionId}`,
        );
      } else if (flag.startsWith("quest_")) {
        const questName = flag.replace("quest_", "").replace(/_/g, " ");
        ctx.push(
          locale === "vi"
            ? `  🗡️ Nhiệm vụ: ${questName}`
            : `  🗡️ Quest: ${questName}`,
        );
      } else {
        ctx.push(`  • ${flag}`);
      }
    });
    ctx.push("");
    ctx.push(
      locale === "vi"
        ? "⚠️ LƯU Ý: Ưu tiên hoàn thành nhiệm vụ trên trước khi chuyển sang nội dung khác!"
        : "⚠️ NOTE: Prioritize completing above missions before moving to other content!",
    );
    ctx.push("");
  }

  // Story summary
  ctx.push(
    locale === "vi" ? "=== TÓM TẮT CÂU CHUYỆN ===" : "=== STORY SUMMARY ===",
  );
  ctx.push(state.story_summary);
  ctx.push("");

  // Recent turns
  if (recentNarratives.length > 0) {
    ctx.push(
      locale === "vi" ? "=== 3 LƯỢT GẦN NHẤT ===" : "=== RECENT 3 TURNS ===",
    );
    recentNarratives.forEach((narrative, i) => {
      ctx.push(`[Turn ${state.turn_count - recentNarratives.length + i + 1}]`);
      ctx.push(narrative);
      ctx.push("");
    });
  }

  // Current state
  ctx.push(
    locale === "vi" ? "=== TRẠNG THÁI HIỆN TẠI ===" : "=== CURRENT STATE ===",
  );
  ctx.push(
    locale === "vi"
      ? `Vị trí: ${state.location.place}, ${state.location.region}`
      : `Location: ${state.location.place}, ${state.location.region}`,
  );
  ctx.push(
    locale === "vi"
      ? `Thời gian: Năm ${state.time_year}, Tháng ${state.time_month}, Ngày ${state.time_day} - ${state.time_segment}`
      : `Time: Year ${state.time_year}, Month ${state.time_month}, Day ${state.time_day} - ${state.time_segment}`,
  );
  ctx.push("");

  // Calculate required exp for next level
  const requiredExp = getRequiredExp(
    state.progress.realm,
    state.progress.realm_stage,
  );
  const expDisplay =
    requiredExp === Infinity
      ? state.progress.cultivation_exp
      : `${state.progress.cultivation_exp}/${requiredExp}`;

  ctx.push(
    locale === "vi"
      ? `Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage} (Exp: ${expDisplay})`
      : `Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage} (Exp: ${expDisplay})`,
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
        ? `🏋️ Song Tu: ${bodyRealmName} tầng ${bodyStage + 1} (Body Exp: ${bodyExp}) | Chia exp: ${expSplit}% Khí / ${100 - expSplit}% Thể`
        : `🏋️ Dual Cultivation: ${bodyRealmName} stage ${bodyStage + 1} (Body Exp: ${bodyExp}) | Split: ${expSplit}% Qi / ${100 - expSplit}% Body`,
    );
  }

  // Calculate total cultivation speed multiplier
  const spiritRootBonus = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueBonus = getTechniqueBonus(state);
  const sectBonus = state.sect_membership?.benefits?.cultivation_bonus
    ? 1.0 + state.sect_membership.benefits.cultivation_bonus / 100
    : 1.0;
  const totalMultiplier = spiritRootBonus * techniqueBonus * sectBonus;

  ctx.push(
    locale === "vi"
      ? `Linh căn: ${state.spirit_root.elements.join("/")} - ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)})`
      : `Spirit Root: ${state.spirit_root.elements.join("/")} - ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)})`,
  );

  // Show total cultivation multiplier from all sources
  if (sectBonus > 1.0) {
    ctx.push(
      locale === "vi"
        ? `Tốc độ tu luyện tổng hợp: x${totalMultiplier.toFixed(2)} (Linh căn x${spiritRootBonus.toFixed(1)} + Công pháp x${techniqueBonus.toFixed(2)} + Tông môn x${sectBonus.toFixed(2)})`
        : `Total Cultivation Speed: x${totalMultiplier.toFixed(2)} (Spirit Root x${spiritRootBonus.toFixed(1)} + Techniques x${techniqueBonus.toFixed(2)} + Sect x${sectBonus.toFixed(2)})`,
    );
  } else {
    ctx.push(
      locale === "vi"
        ? `Tốc độ tu luyện tổng hợp: x${totalMultiplier.toFixed(2)} (Linh căn x${spiritRootBonus.toFixed(1)} + Công pháp x${techniqueBonus.toFixed(2)})`
        : `Total Cultivation Speed: x${totalMultiplier.toFixed(2)} (Spirit Root x${spiritRootBonus.toFixed(1)} + Techniques x${techniqueBonus.toFixed(2)})`,
    );
  }
  ctx.push("");

  // Calculate total attributes including equipment bonuses
  const totalAttrs = calculateTotalAttributes(state);

  ctx.push(
    `HP: ${state.stats.hp}/${state.stats.hp_max} | Qi: ${state.stats.qi}/${state.stats.qi_max} | Stamina: ${state.stats.stamina}/${state.stats.stamina_max}`,
  );

  // Show CURRENT stats (with equipment) - THESE ARE THE REAL NUMBERS
  ctx.push(
    locale === "vi"
      ? `CHỈ SỐ HIỆN TẠI (đã bao gồm trang bị):`
      : `CURRENT STATS (including equipment):`,
  );
  ctx.push(
    `STR: ${totalAttrs.str} | AGI: ${totalAttrs.agi} | INT: ${totalAttrs.int} | PER: ${totalAttrs.perception} | LUCK: ${totalAttrs.luck}`,
  );

  // Show base stats and equipment bonuses if different
  if (
    totalAttrs.str !== state.attrs.str ||
    totalAttrs.agi !== state.attrs.agi ||
    totalAttrs.int !== state.attrs.int ||
    totalAttrs.perception !== state.attrs.perception ||
    totalAttrs.luck !== state.attrs.luck
  ) {
    ctx.push(
      locale === "vi"
        ? `  - Base (không trang bị): STR ${state.attrs.str}, AGI ${state.attrs.agi}, INT ${state.attrs.int}, PER ${state.attrs.perception}, LUCK ${state.attrs.luck}`
        : `  - Base (no equipment): STR ${state.attrs.str}, AGI ${state.attrs.agi}, INT ${state.attrs.int}, PER ${state.attrs.perception}, LUCK ${state.attrs.luck}`,
    );
    ctx.push(
      locale === "vi"
        ? `  - Bonus từ trang bị: STR +${totalAttrs.str - state.attrs.str}, AGI +${totalAttrs.agi - state.attrs.agi}, INT +${totalAttrs.int - state.attrs.int}, PER +${totalAttrs.perception - state.attrs.perception}, LUCK +${totalAttrs.luck - state.attrs.luck}`
        : `  - Equipment bonus: STR +${totalAttrs.str - state.attrs.str}, AGI +${totalAttrs.agi - state.attrs.agi}, INT +${totalAttrs.int - state.attrs.int}, PER +${totalAttrs.perception - state.attrs.perception}, LUCK +${totalAttrs.luck - state.attrs.luck}`,
    );
  }

  // Calculate derived combat stats for enemy balancing
  const physicalAttack = Math.floor(totalAttrs.str * 1.5);
  const qiAttack = Math.floor(totalAttrs.int * 2 + totalAttrs.str / 2);
  const defense = Math.floor(5 + totalAttrs.agi / 3);
  const critChance = 10 + totalAttrs.str * 0.2 + totalAttrs.luck * 0.3;
  const evasion = Math.min(
    75,
    5 +
      totalAttrs.agi * 0.5 +
      totalAttrs.perception * 0.3 +
      totalAttrs.luck * 0.2,
  );

  ctx.push(
    locale === "vi"
      ? `⚔️ SỨC MẠNH CHIẾN ĐẤU (dùng để cân bằng kẻ địch):`
      : `⚔️ COMBAT POWER (for enemy balancing):`,
  );
  ctx.push(
    locale === "vi"
      ? `  - Tấn công vật lý: ${physicalAttack} (STR×1.5) | Tấn công khí công: ${qiAttack} (INT×2 + STR÷2)`
      : `  - Physical Attack: ${physicalAttack} (STR×1.5) | Qi Attack: ${qiAttack} (INT×2 + STR÷2)`,
  );
  ctx.push(
    locale === "vi"
      ? `  - Phòng thủ: ${defense} | Chí mạng: ${critChance.toFixed(1)}% | Né tránh: ${evasion.toFixed(1)}%`
      : `  - Defense: ${defense} | Critical: ${critChance.toFixed(1)}% | Evasion: ${evasion.toFixed(1)}%`,
  );
  ctx.push(
    locale === "vi"
      ? `  📊 KHI TẠO KẺ ĐỊCH: HP nên ${Math.floor(physicalAttack * 2)}-${Math.floor(physicalAttack * 4)}, ATK nên ${Math.floor(physicalAttack * 0.6)}-${Math.floor(physicalAttack * 1.2)}, DEF nên ${Math.floor(defense * 0.6)}-${Math.floor(defense * 1.2)}`
      : `  📊 WHEN CREATING ENEMIES: HP should be ${Math.floor(physicalAttack * 2)}-${Math.floor(physicalAttack * 4)}, ATK should be ${Math.floor(physicalAttack * 0.6)}-${Math.floor(physicalAttack * 1.2)}, DEF should be ${Math.floor(defense * 0.6)}-${Math.floor(defense * 1.2)}`,
  );
  ctx.push("");

  // Resources and inventory capacity
  const baseCapacity = state.inventory.max_slots || 20;
  const ringCapacity = state.inventory.storage_ring?.capacity || 0;
  const totalCapacity = baseCapacity + ringCapacity;
  const usedSlots = state.inventory.items.length;

  ctx.push(
    locale === "vi"
      ? `Tài sản: ${state.inventory.silver} bạc, ${state.inventory.spirit_stones} linh thạch`
      : `Resources: ${state.inventory.silver} silver, ${state.inventory.spirit_stones} spirit stones`,
  );
  ctx.push(
    locale === "vi"
      ? `Túi đồ: ${usedSlots}/${totalCapacity} ô${state.inventory.storage_ring ? ` (💍 ${state.inventory.storage_ring.name} +${ringCapacity})` : ""}`
      : `Inventory: ${usedSlots}/${totalCapacity} slots${state.inventory.storage_ring ? ` (💍 ${state.inventory.storage_ring.name_en} +${ringCapacity})` : ""}`,
  );
  ctx.push("");

  // Equipped items
  const equippedCount = Object.values(state.equipped_items).filter(
    Boolean,
  ).length;
  if (equippedCount > 0) {
    ctx.push(
      locale === "vi" ? "=== TRANG BỊ HIỆN TẠI ===" : "=== EQUIPPED ITEMS ===",
    );
    Object.entries(state.equipped_items).forEach(([slot, item]) => {
      if (item) {
        const baseName = locale === "vi" ? item.name : item.name_en;
        // Show enhancement level if enhanced
        const enhanceLevel = item.enhancement_level || 0;
        const name =
          enhanceLevel > 0 ? `${baseName} +${enhanceLevel}` : baseName;
        const stats = [];
        if (item.bonus_stats) {
          if (item.bonus_stats.str) stats.push(`STR+${item.bonus_stats.str}`);
          if (item.bonus_stats.agi) stats.push(`AGI+${item.bonus_stats.agi}`);
          if (item.bonus_stats.int) stats.push(`INT+${item.bonus_stats.int}`);
          if (item.bonus_stats.perception)
            stats.push(`PER+${item.bonus_stats.perception}`);
          if (item.bonus_stats.luck)
            stats.push(`LUCK+${item.bonus_stats.luck}`);
          if (item.bonus_stats.hp) stats.push(`HP+${item.bonus_stats.hp}`);
          if (item.bonus_stats.qi) stats.push(`Qi+${item.bonus_stats.qi}`);
        }
        // Show storage ring capacity
        if (item.effects?.storage_capacity) {
          stats.push(`+${item.effects.storage_capacity} slots`);
        }
        ctx.push(`  ${slot}: ${name} [${item.rarity}] (${stats.join(", ")})`);
      }
    });
    ctx.push("");
  }

  // Helper function to translate rarity
  const translateRarity = (rarity: string, loc: Locale) => {
    if (loc === "vi") {
      const rarityMap: Record<string, string> = {
        Common: "Phàm Phẩm",
        Uncommon: "Hạ Phẩm",
        Rare: "Trung Phẩm",
        Epic: "Thượng Phẩm",
        Legendary: "Cực Phẩm",
      };
      return rarityMap[rarity] || rarity;
    }
    return rarity;
  };

  const translateSlot = (slot: string, loc: Locale) => {
    if (loc === "vi") {
      const slotMap: Record<string, string> = {
        Weapon: "Vũ Khí",
        Head: "Đầu",
        Chest: "Ngực",
        Legs: "Chân",
        Feet: "Giày",
        Hands: "Tay",
        Accessory: "Phụ Kiện",
        Artifact: "Bảo Vật",
      };
      return slotMap[slot] || slot;
    }
    return slot;
  };

  // Inventory items with details
  ctx.push(
    locale === "vi"
      ? `Vật phẩm trong túi: ${state.inventory.items.length} món`
      : `Inventory items: ${state.inventory.items.length} items`,
  );
  if (state.inventory.items.length > 0) {
    state.inventory.items.slice(0, 10).forEach((item) => {
      const baseName = locale === "vi" ? item.name : item.name_en;
      // Show enhancement level if enhanced
      const enhanceLevel = item.enhancement_level || 0;
      const name = enhanceLevel > 0 ? `${baseName} +${enhanceLevel}` : baseName;
      const rarity = translateRarity(item.rarity, locale);
      const details = [];
      details.push(`x${item.quantity}`);
      details.push(item.type);
      details.push(rarity);

      // Show bonus stats for equipment
      if (
        (item.type === "Equipment" || item.type === "Accessory") &&
        item.bonus_stats
      ) {
        const stats = [];
        if (item.bonus_stats.str) stats.push(`STR+${item.bonus_stats.str}`);
        if (item.bonus_stats.agi) stats.push(`AGI+${item.bonus_stats.agi}`);
        if (item.bonus_stats.int) stats.push(`INT+${item.bonus_stats.int}`);
        if (item.bonus_stats.perception)
          stats.push(`PER+${item.bonus_stats.perception}`);
        if (item.bonus_stats.luck) stats.push(`LUCK+${item.bonus_stats.luck}`);
        if (item.bonus_stats.hp) stats.push(`HP+${item.bonus_stats.hp}`);
        if (item.bonus_stats.qi) stats.push(`Qi+${item.bonus_stats.qi}`);
        if (stats.length > 0) details.push(`(${stats.join(", ")})`);
        if (item.equipment_slot)
          details.push(`[${translateSlot(item.equipment_slot, locale)}]`);
      }

      // Show effects for consumables and storage rings
      if (item.effects && Object.keys(item.effects).length > 0) {
        const effects = [];
        if (item.effects.hp_restore)
          effects.push(
            locale === "vi"
              ? `Hồi ${item.effects.hp_restore} HP`
              : `Heal ${item.effects.hp_restore} HP`,
          );
        if (item.effects.qi_restore)
          effects.push(
            locale === "vi"
              ? `Hồi ${item.effects.qi_restore} Qi`
              : `Restore ${item.effects.qi_restore} Qi`,
          );
        if (item.effects.cultivation_exp)
          effects.push(`+${item.effects.cultivation_exp} Exp`);
        if (item.effects.storage_capacity)
          effects.push(
            locale === "vi"
              ? `+${item.effects.storage_capacity} ô túi`
              : `+${item.effects.storage_capacity} slots`,
          );
        if (effects.length > 0) details.push(`(${effects.join(", ")})`);
      }

      ctx.push(`  - ${name} ${details.join(" ")}`);
    });
    if (state.inventory.items.length > 10) {
      ctx.push(
        locale === "vi"
          ? `  ... và ${state.inventory.items.length - 10} vật phẩm khác`
          : `  ... and ${state.inventory.items.length - 10} more items`,
      );
    }
  }
  ctx.push("");

  // Helper function to translate terms
  const translateGrade = (grade: string, loc: Locale) => {
    if (loc === "vi") {
      const gradeMap: Record<string, string> = {
        Mortal: "Phàm Cấp",
        Earth: "Địa Cấp",
        Heaven: "Thiên Cấp",
      };
      return gradeMap[grade] || grade;
    }
    return grade;
  };

  const translateTechType = (type: string, loc: Locale) => {
    if (loc === "vi") {
      const typeMap: Record<string, string> = { Main: "Chính", Support: "Phụ" };
      return typeMap[type] || type;
    }
    return type;
  };

  const translateSkillType = (type: string, loc: Locale) => {
    if (loc === "vi") {
      const typeMap: Record<string, string> = {
        Attack: "Tấn Công",
        Defense: "Phòng Thủ",
        Movement: "Thân Pháp",
        Support: "Hỗ Trợ",
      };
      return typeMap[type] || type;
    }
    return type;
  };

  // Techniques (for cultivation speed) with element compatibility
  if (state.techniques && state.techniques.length > 0) {
    ctx.push(
      locale === "vi"
        ? "=== CÔNG PHÁP (Tăng tốc tu luyện) ==="
        : "=== TECHNIQUES (Cultivation Speed) ===",
    );
    state.techniques.forEach((tech) => {
      const name = locale === "vi" ? tech.name : tech.name_en;
      const elements =
        tech.elements && tech.elements.length > 0
          ? `[${tech.elements.join("/")}]`
          : "";
      const speedBonus = tech.cultivation_speed_bonus
        ? `+${tech.cultivation_speed_bonus}%`
        : "";
      const grade = translateGrade(tech.grade, locale);
      const techType = translateTechType(tech.type, locale);
      ctx.push(`  - ${name} ${elements} (${grade}, ${techType}) ${speedBonus}`);
    });
    ctx.push("");
  }

  // Skills (for combat)
  if (state.skills && state.skills.length > 0) {
    ctx.push(
      locale === "vi" ? "=== KỸ NĂNG CHIẾN ĐẤU ===" : "=== COMBAT SKILLS ===",
    );
    state.skills.forEach((skill) => {
      const name = locale === "vi" ? skill.name : skill.name_en;
      const element = skill.element ? `[${skill.element}]` : "";
      const skillType = translateSkillType(skill.type, locale);
      const dmg = skill.damage_multiplier ? `${skill.damage_multiplier}x` : "";
      const cost = skill.qi_cost ? `${skill.qi_cost} qi` : "";
      ctx.push(
        `  - ${name} ${element} Lv.${skill.level}/${skill.max_level} [${skillType}] (${dmg}, ${cost})`,
      );
    });
    ctx.push("");
  }

  // Sect membership
  if (state.sect_membership) {
    const sect = state.sect_membership;
    ctx.push(locale === "vi" ? "=== TÔNG MÔN ===" : "=== SECT ===");
    const sectName = locale === "vi" ? sect.sect.name : sect.sect.name_en;
    const rankNames: Record<string, { vi: string; en: string }> = {
      NgoạiMôn: { vi: "Ngoại Môn Đệ Tử", en: "Outer Disciple" },
      NộiMôn: { vi: "Nội Môn Đệ Tử", en: "Inner Disciple" },
      ChânTruyền: { vi: "Chân Truyền Đệ Tử", en: "True Disciple" },
      TrưởngLão: { vi: "Trưởng Lão", en: "Elder" },
      ChưởngMôn: { vi: "Chưởng Môn", en: "Sect Master" },
    };
    const rankDisplay = rankNames[sect.rank]?.[locale] || sect.rank;
    ctx.push(`  ${sectName} - ${rankDisplay}`);
    ctx.push(
      locale === "vi"
        ? `  Đóng góp: ${sect.contribution} | Thanh danh: ${sect.reputation}/100`
        : `  Contribution: ${sect.contribution} | Reputation: ${sect.reputation}/100`,
    );
    if (sect.mentor) {
      const mentorName =
        locale === "vi" ? sect.mentor : sect.mentor_en || sect.mentor;
      ctx.push(
        locale === "vi" ? `  Sư phụ: ${mentorName}` : `  Mentor: ${mentorName}`,
      );
    }
    ctx.push(
      locale === "vi"
        ? `  Lợi ích: Tu luyện +${sect.benefits.cultivation_bonus}%${sect.benefits.resource_access ? ", Tài nguyên" : ""}${sect.benefits.technique_access ? ", Công pháp" : ""}${sect.benefits.protection ? ", Bảo hộ" : ""}`
        : `  Benefits: Cultivation +${sect.benefits.cultivation_bonus}%${sect.benefits.resource_access ? ", Resources" : ""}${sect.benefits.technique_access ? ", Techniques" : ""}${sect.benefits.protection ? ", Protection" : ""}`,
    );
    ctx.push("");
  } else {
    ctx.push(
      locale === "vi"
        ? "=== TÔNG MÔN: Chưa gia nhập (Tản tu) ==="
        : "=== SECT: Not joined (Rogue cultivator) ===",
    );
    ctx.push("");
  }

  ctx.push(
    locale === "vi" ? `Nhân quả: ${state.karma}` : `Karma: ${state.karma}`,
  );

  return ctx.join("\n");
}

/**
 * Build user message with scene template
 */
export function buildUserMessage(
  sceneContext: string,
  choiceId: string | null,
  locale: Locale,
  choiceText?: string | null,
): string {
  if (choiceId) {
    // Use the actual choice text if provided (for custom actions or regular choices)
    const displayChoice = choiceText || choiceId;
    return locale === "vi"
      ? `Người chơi đã chọn: ${displayChoice}\n\nTiếp tục câu chuyện dựa trên lựa chọn này. Mô tả kết quả và đưa ra lựa chọn mới.`
      : `Player chose: ${displayChoice}\n\nContinue the story based on this choice. Describe the outcome and provide new choices.`;
  } else {
    return locale === "vi"
      ? `${sceneContext}\n\nBắt đầu tình huống mới này. Mô tả chi tiết và đưa ra lựa chọn.`
      : `${sceneContext}\n\nBegin this new situation. Describe in detail and provide choices.`;
  }
}

/**
 * Build variety enforcement hints to prevent repetitive narratives
 */
export function buildVarietyEnforcement(
  themesToAvoid: string[],
  turnCount: number,
  locale: Locale,
): string {
  const hints: string[] = [];

  if (locale === "vi") {
    hints.push("=== YÊU CẦU ĐA DẠNG ===");

    if (themesToAvoid.length > 0) {
      hints.push(
        `TRÁNH các chủ đề đã xuất hiện gần đây: ${themesToAvoid.join(", ")}`,
      );
      hints.push("Hãy tạo tình huống MỚI và KHÁC BIỆT hoàn toàn.");
    }

    // Xianxia-specific variety suggestions
    const varietySuggestions = [
      "Thiên địa dị biến hoặc linh khí xao động",
      "Nhân quả từ hành động cũ quay lại",
      "Gặp quý nhân hoặc kẻ thù trong quá khứ",
      "Cơ duyên hiếm nhưng đầy rủi ro",
      "Áp lực đột phá hoặc bình cảnh",
      "Âm mưu tông môn hoặc tranh đoạt tài nguyên",
      "Phát hiện di tích cổ xưa hoặc bí mật",
      "Thiên kiếp hoặc thử thách từ trời",
    ];

    const suggestionIndex = turnCount % varietySuggestions.length;
    hints.push(`GỢI Ý TIÊN HIỆP: ${varietySuggestions[suggestionIndex]}`);
  } else {
    hints.push("=== VARIETY REQUIREMENTS ===");

    if (themesToAvoid.length > 0) {
      hints.push(
        `AVOID themes that appeared recently: ${themesToAvoid.join(", ")}`,
      );
      hints.push("Create a completely NEW and DIFFERENT situation.");
    }

    // Xianxia-specific variety suggestions
    const varietySuggestions = [
      "Heaven and earth phenomenon or spiritual energy fluctuation",
      "Karma from past actions returning",
      "Meet a benefactor or old enemy",
      "Rare opportunity with great risk",
      "Breakthrough pressure or bottleneck",
      "Sect intrigue or resource competition",
      "Discover ancient ruins or secrets",
      "Heavenly tribulation or divine trial",
    ];

    const suggestionIndex = turnCount % varietySuggestions.length;
    hints.push(`XIANXIA SUGGESTION: ${varietySuggestions[suggestionIndex]}`);
  }

  return hints.join("\n");
}
