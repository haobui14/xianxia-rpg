import { z } from 'zod';
import { Locale, GameState, AITurnResult, Choice, ProposedDelta, GameEvent } from '@/types/game';

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
  operation: z.enum(['add', 'subtract', 'set', 'multiply']),
  value: z.union([z.number(), z.string(), z.boolean(), z.any()]),
  reason: z.string().optional(),
});

export const GameEventSchema = z.object({
  type: z.enum([
    'combat',
    'loot',
    'breakthrough',
    'status_effect',
    'quest_update',
    'npc_interaction',
  ]),
  data: z.record(z.any()),
});

export const AITurnResultSchema = z.object({
  locale: z.enum(['vi', 'en']),
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
 * Build system prompt
 */
export function buildSystemPrompt(locale: Locale): string {
  if (locale === 'vi') {
    return `Bạn là Game Master cho game tu tiên RPG. Vai trò:
1. KỂ CHUYỆN: Mô tả tình huống hiện tại (150-250 từ), sinh động, có nhiều sự kiện và tiến triển
2. LỰA CHỌN: Đưa 2-5 lựa chọn hợp lý với kết quả rõ ràng
3. ĐỀ XUẤT: Đề xuất thay đổi stats đáng kể (server sẽ validate)

QUAN TRỌNG - TIẾN TRIỂN NHANH:
- MỖI HÀNH ĐỘNG CÓ KẾT QUẢ RÕ: Tăng cultivation_exp (15-50), thu thập vật phẩm (5-20 linh thạch, 50-200 bạc), cải thiện stats
- CHI PHÍ HỢP LÝ: Stamina cost 1-2 cho hành động thường, 3-4 cho khó, LUÔN có lựa chọn nghỉ (cost: 0)
- PHỤC HỒI: LUÔN có ít nhất 1 lựa chọn nghỉ ngơi hồi 10-20 stamina
- PHẦN THƯỞNG LỚN: Thu thập vật phẩm, tăng exp, học kĩ năng, tìm công pháp
- THỜI GIAN TRÔI: Các hành động nên tốn time_segments (1-2) để thời gian tiến triển
- CHIẾN ĐẤU: Khi chiến đấu quái vật, PHẢI giảm HP và qi qua proposed_deltas:
  * Mất HP: {"field": "stats.hp", "operation": "subtract", "value": 10-30}
  * Tiêu qi: {"field": "stats.qi", "operation": "subtract", "value": 5-20}
  * Chiến thắng thì có loot và exp
- NẾU kể về thu thập, PHẢI thêm proposed_deltas:
  * Thu linh thạch: {"field": "inventory.spirit_stones", "operation": "add", "value": 5-20}
  * Thu bạc: {"field": "inventory.silver", "operation": "add", "value": 50-200}
  * Tăng exp: {"field": "progress.cultivation_exp", "operation": "add", "value": 20-50}

VẬT PHẨM - QUAN TRỌNG:
  * CONSUMABLE (Đan dược, thuốc): type="Medicine", có "effects" để hồi phục hoặc tăng stats vĩnh viễn
    Ví dụ đan dược hồi máu: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "healing_pill_01",
      "name": "Hồi Huyết Đan",
      "name_en": "Healing Pill",
      "description": "Đan dược hồi phục 50 HP",
      "description_en": "Pill that restores 50 HP",
      "type": "Medicine",
      "rarity": "Common",
      "quantity": 1,
      "effects": {"hp_restore": 50}
    }}
    Ví dụ đan dược tăng exp: {"effects": {"cultivation_exp": 100}}
    Ví dụ đan dược tăng stats vĩnh viễn: {"effects": {"permanent_str": 2, "permanent_int": 1}}

  * EQUIPMENT (Vũ khí, giáp, phụ kiện): type="Equipment", có "equipment_slot" và "bonus_stats"
    Ví dụ vũ khí: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "iron_sword_01",
      "name": "Kiếm Sắt",
      "name_en": "Iron Sword",
      "description": "Thanh kiếm sắt thông thường",
      "description_en": "Common iron sword",
      "type": "Equipment",
      "equipment_slot": "Weapon",
      "rarity": "Common",
      "quantity": 1,
      "bonus_stats": {"str": 3, "hp": 10}
    }}
    Slots: "Weapon", "Head", "Chest", "Legs", "Feet", "Hands", "Accessory", "Artifact"

QUAN TRỌNG - FORMAT JSON:
- LUÔN bao gồm tất cả các trường: locale, narrative, choices, proposed_deltas, events
- events LUÔN là mảng rỗng [] (không cần thêm gì vào đây)

Trả về JSON:
{
  "locale": "vi",
  "narrative": "...",
  "choices": [
    {"id": "action", "text": "Hành động", "cost": {"stamina": 2, "time_segments": 1}}
  ],
  "proposed_deltas": [
    {"field": "progress.cultivation_exp", "operation": "add", "value": 30},
    {"field": "inventory.spirit_stones", "operation": "add", "value": 10}
  ],
  "events": []
}`;
  } else {
    return `You are a Game Master for a xianxia cultivation RPG. Role:
1. STORYTELLING: Describe current situation (150-250 words), engaging
2. CHOICES: Provide 2-5 reasonable choices
3. PROPOSALS: Suggest stat changes (server validates)

IMPORTANT - FAST PROGRESSION:
- EVERY ACTION HAS CLEAR RESULTS: Increase cultivation_exp (15-50), collect items (5-20 spirit stones, 50-200 silver), improve stats
- REASONABLE COSTS: Stamina cost 1-2 for normal actions, 3-4 for difficult, ALWAYS have rest option (cost: 0)
- RECOVERY: ALWAYS include at least 1 rest option recovering 10-20 stamina
- BIG REWARDS: Collect items, gain exp, learn skills, find techniques
- TIME PROGRESSION: Actions should cost time_segments (1-2) to advance time
- COMBAT: When fighting monsters, MUST reduce HP and qi via proposed_deltas:
  * Lose HP: {"field": "stats.hp", "operation": "subtract", "value": 10-30}
  * Use qi: {"field": "stats.qi", "operation": "subtract", "value": 5-20}
  * Victory gives loot and exp
- IF narrating collection, MUST add proposed_deltas:
  * Collect spirit stones: {"field": "inventory.spirit_stones", "operation": "add", "value": 5-20}
  * Collect silver: {"field": "inventory.silver", "operation": "add", "value": 50-200}
  * Gain exp: {"field": "progress.cultivation_exp", "operation": "add", "value": 20-50}

ITEMS - IMPORTANT:
  * CONSUMABLE (Pills, medicine): type="Medicine", has "effects" for restoration or permanent stat boosts
    Healing pill example: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "healing_pill_01",
      "name": "Hồi Huyết Đan",
      "name_en": "Healing Pill",
      "description": "Đan dược hồi phục 50 HP",
      "description_en": "Pill that restores 50 HP",
      "type": "Medicine",
      "rarity": "Common",
      "quantity": 1,
      "effects": {"hp_restore": 50}
    }}
    Exp boost pill: {"effects": {"cultivation_exp": 100}}
    Permanent stat pill: {"effects": {"permanent_str": 2, "permanent_int": 1}}

  * EQUIPMENT (Weapons, armor, accessories): type="Equipment", has "equipment_slot" and "bonus_stats"
    Weapon example: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "iron_sword_01",
      "name": "Kiếm Sắt",
      "name_en": "Iron Sword",
      "description": "Thanh kiếm sắt thông thường",
      "description_en": "Common iron sword",
      "type": "Equipment",
      "equipment_slot": "Weapon",
      "rarity": "Common",
      "quantity": 1,
      "bonus_stats": {"str": 3, "hp": 10}
    }}
    Slots: "Weapon", "Head", "Chest", "Legs", "Feet", "Hands", "Accessory", "Artifact"

IMPORTANT - JSON FORMAT:
- ALWAYS include all fields: locale, narrative, choices, proposed_deltas, events
- events ALWAYS empty array [] (don't add anything here)

Return JSON:
{
  "locale": "en",
  "narrative": "...",
  "choices": [
    {"id": "action", "text": "Action", "cost": {"stamina": 3}}
  ],
  "proposed_deltas": [
    {"field": "stats.qi", "operation": "add", "value": 5},
    {"field": "inventory.spirit_stones", "operation": "add", "value": 3}
  ],
  "events": []
}`;
  }
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

  // Story summary
  ctx.push(
    locale === 'vi' ? '=== TÓM TẮT CÂU CHUYỆN ===' : '=== STORY SUMMARY ==='
  );
  ctx.push(state.story_summary);
  ctx.push('');

  // Recent turns
  if (recentNarratives.length > 0) {
    ctx.push(
      locale === 'vi' ? '=== 3 LƯỢT GẦN NHẤT ===' : '=== RECENT 3 TURNS ==='
    );
    recentNarratives.forEach((narrative, i) => {
      ctx.push(`[Turn ${state.turn_count - recentNarratives.length + i + 1}]`);
      ctx.push(narrative);
      ctx.push('');
    });
  }

  // Current state
  ctx.push(locale === 'vi' ? '=== TRẠNG THÁI HIỆN TẠI ===' : '=== CURRENT STATE ===');
  ctx.push(
    locale === 'vi'
      ? `Vị trí: ${state.location.place}, ${state.location.region}`
      : `Location: ${state.location.place}, ${state.location.region}`
  );
  ctx.push(
    locale === 'vi'
      ? `Thời gian: Năm ${state.time_year}, Tháng ${state.time_month}, Ngày ${state.time_day} - ${state.time_segment}`
      : `Time: Year ${state.time_year}, Month ${state.time_month}, Day ${state.time_day} - ${state.time_segment}`
  );
  ctx.push('');

  ctx.push(
    locale === 'vi'
      ? `Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage} (Exp: ${state.progress.cultivation_exp})`
      : `Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage} (Exp: ${state.progress.cultivation_exp})`
  );
  ctx.push(
    locale === 'vi'
      ? `Linh căn: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade}`
      : `Spirit Root: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade}`
  );
  ctx.push('');

  ctx.push(
    `HP: ${state.stats.hp}/${state.stats.hp_max} | Qi: ${state.stats.qi}/${state.stats.qi_max} | Stamina: ${state.stats.stamina}/${state.stats.stamina_max}`
  );
  ctx.push(
    `STR: ${state.attrs.str} | AGI: ${state.attrs.agi} | INT: ${state.attrs.int} | PER: ${state.attrs.perception} | LUCK: ${state.attrs.luck}`
  );
  ctx.push('');

  ctx.push(
    locale === 'vi'
      ? `Tài sản: ${state.inventory.silver} bạc, ${state.inventory.spirit_stones} linh thạch`
      : `Resources: ${state.inventory.silver} silver, ${state.inventory.spirit_stones} spirit stones`
  );
  ctx.push(
    locale === 'vi'
      ? `Vật phẩm: ${state.inventory.items.length} món`
      : `Items: ${state.inventory.items.length} items`
  );
  if (state.inventory.items.length > 0) {
    state.inventory.items.slice(0, 5).forEach((item) => {
      const name = locale === 'vi' ? item.name : item.name_en;
      ctx.push(`  - ${name} x${item.quantity}`);
    });
  }
  ctx.push('');

  ctx.push(
    locale === 'vi' ? `Nhân quả: ${state.karma}` : `Karma: ${state.karma}`
  );

  return ctx.join('\n');
}

/**
 * Build user message with scene template
 */
export function buildUserMessage(
  sceneContext: string,
  choiceId: string | null,
  locale: Locale
): string {
  if (choiceId) {
    return locale === 'vi'
      ? `Người chơi đã chọn: ${choiceId}\n\nTiếp tục câu chuyện dựa trên lựa chọn này. Mô tả kết quả và đưa ra lựa chọn mới.`
      : `Player chose: ${choiceId}\n\nContinue the story based on this choice. Describe the outcome and provide new choices.`;
  } else {
    return locale === 'vi'
      ? `${sceneContext}\n\nBắt đầu tình huống mới này. Mô tả chi tiết và đưa ra lựa chọn.`
      : `${sceneContext}\n\nBegin this new situation. Describe in detail and provide choices.`;
  }
}
