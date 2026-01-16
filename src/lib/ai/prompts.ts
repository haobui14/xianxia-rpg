import { z } from 'zod';
import { Locale, GameState, AITurnResult, Choice, ProposedDelta, GameEvent } from '@/types/game';
import { calculateTotalAttributes } from '@/lib/game/equipment';

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

LINH CĂN & NGŨ HÀNH (SPIRIT ROOT & FIVE ELEMENTS) - QUAN TRỌNG:
- Linh căn quyết định tốc độ tu luyện của nhân vật
- Thiên Phẩm: x2.0 exp tu luyện (cực kỳ hiếm, thiên tài)
- Hiếm: x1.5 exp tu luyện (hiếm có, tài năng cao)  
- Khá: x1.2 exp tu luyện (khá tốt, trên trung bình)
- Phổ Thông: x1.0 exp tu luyện (bình thường)

HỆ NGŨ HÀNH (FIVE ELEMENTS CYCLE):
- Tương Sinh (Generate): Kim→Thủy→Mộc→Hỏa→Thổ→Kim (Metal→Water→Wood→Fire→Earth)
- Tương Khắc (Overcome): Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim

CÔNG PHÁP & THUỘC TÍNH:
- MỌI công pháp PHẢI có "elements" (1-2 thuộc tính)
- Khớp hoàn hảo: Công pháp cùng thuộc tính với linh căn → +30% exp
- Tương sinh: Linh căn sinh công pháp → +15% exp
- Tương khắc: Công pháp khắc linh căn → -20% exp (rất khó tu luyện)
- LUÔN xem xét linh căn khi kể về tu luyện và học công pháp

NGHIÊM CẤM - KHÔNG ĐƯỢC BỊA CHỈ SỐ:
- KHÔNG BAO GIỜ nói "sức mạnh tăng lên X", "chỉ số lên Y" trong narrative
- CHỈ mô tả cảm giác: "cảm thấy mạnh mẽ hơn", "năng lượng tràn trề"
- Trang bị ĐÃ ĐƯỢC ÁP DỤNG - KHÔNG kể lại bonus của trang bị đã đeo
- Muốn tăng stats thực sự → PHẢI dùng proposed_deltas
- Ví dụ SAI: "Sức mạnh tăng lên 8" (KHÔNG được phép!)
- Ví dụ ĐÚNG: "Cảm thấy sức mạnh dồi dào" + proposed_deltas: [{"field": "attrs.str", "operation": "add", "value": 1}]

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

  * EQUIPMENT (Vũ khí, giáp, phụ kiện): type="Equipment", BẮT BUỘC có "equipment_slot" và "bonus_stats"
    ** QUAN TRỌNG: MỌI TRANG BỊ PHẢI CÓ bonus_stats để tăng chỉ số nhân vật **
    ** Có thể tăng: str, agi, int, perception, luck, hp, qi, stamina, cultivation_speed **
    
    Ví dụ vũ khí: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "iron_sword_01",
      "name": "Kiếm Sắt",
      "name_en": "Iron Sword",
      "description": "Thanh kiếm sắt thông thường, tăng sức mạnh",
      "description_en": "Common iron sword, increases strength",
      "type": "Equipment",
      "equipment_slot": "Weapon",
      "rarity": "Common",
      "quantity": 1,
      "bonus_stats": {"str": 3, "hp": 10}
    }}
    
    Ví dụ giáp: {"equipment_slot": "Chest", "bonus_stats": {"hp": 50, "agi": -2}}
    Ví dụ nhẫn: {"equipment_slot": "Accessory", "bonus_stats": {"luck": 3, "perception": 2}}
    Ví dụ bảo vật: {"equipment_slot": "Artifact", "bonus_stats": {"int": 5, "cultivation_speed": 10}}
    
    Slots: "Weapon", "Head", "Chest", "Legs", "Feet", "Hands", "Accessory", "Artifact"

HỌC CÔNG PHÁP (Learning Techniques):
- Khi nhân vật học công pháp mới, dùng: {"field": "techniques.add", "operation": "add", "value": {...}}
- Ví dụ:
  {"field": "techniques.add", "operation": "add", "value": {
    "id": "blazing_sun_art",
    "name": "Liệt Dương Công",
    "name_en": "Blazing Sun Art",
    "description": "Công pháp hỏa hệ mạnh mẽ",
    "description_en": "Powerful fire-element technique",
    "grade": "Earth",
    "type": "Main",
    "elements": ["Hỏa"]
  }}
- Elements phải là: "Kim", "Mộc", "Thủy", "Hỏa", "Thổ"

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

SPIRIT ROOT & FIVE ELEMENTS - IMPORTANT:
- Spirit root determines cultivation speed
- Heavenly (ThiênPhẩm): x2.0 cultivation exp (extremely rare, genius)
- Rare (Hiếm): x1.5 cultivation exp (rare, high talent)
- Uncommon (Khá): x1.2 cultivation exp (above average)
- Common (PhổThông): x1.0 cultivation exp (normal)

FIVE ELEMENTS CYCLE (Wu Xing):
- Generation: Metal→Water→Wood→Fire→Earth→Metal
- Overcoming: Metal overcomes Wood, Wood overcomes Earth, Earth overcomes Water, Water overcomes Fire, Fire overcomes Metal

TECHNIQUES & ELEMENTS:
- ALL techniques MUST have "elements" array (1-2 elements)
- Perfect Match: Technique matches spirit root → +30% exp
- Generation: Spirit root generates technique element → +15% exp  
- Overcoming: Technique overcomes spirit root → -20% exp (very difficult)
- ALWAYS consider spirit root when narrating cultivation and learning techniques

STRICTLY FORBIDDEN - NEVER INVENT STATS:
- NEVER say "strength increased to X", "stats rose to Y" in narrative
- ONLY describe feelings: "feeling stronger", "energy surging"
- Equipment bonuses ALREADY APPLIED - DON'T narrate existing equipment bonuses
- To actually increase stats → MUST use proposed_deltas
- Wrong example: "Strength increased to 8" (FORBIDDEN!)
- Correct example: "Feeling surge of power" + proposed_deltas: [{"field": "attrs.str", "operation": "add", "value": 1}]

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

  * EQUIPMENT (Weapons, armor, accessories): type="Equipment", MUST have "equipment_slot" and "bonus_stats"
    ** CRITICAL: ALL EQUIPMENT MUST HAVE bonus_stats to increase character stats **
    ** Can increase: str, agi, int, perception, luck, hp, qi, stamina, cultivation_speed **
    
    Weapon example: {"field": "inventory.add_item", "operation": "add", "value": {
      "id": "iron_sword_01",
      "name": "Kiếm Sắt",
      "name_en": "Iron Sword",
      "description": "Thanh kiếm sắt thông thường, tăng sức mạnh",
      "description_en": "Common iron sword, increases strength",
      "type": "Equipment",
      "equipment_slot": "Weapon",
      "rarity": "Common",
      "quantity": 1,
      "bonus_stats": {"str": 3, "hp": 10}
    }}
    
    Armor example: {"equipment_slot": "Chest", "bonus_stats": {"hp": 50, "agi": -2}}
    Ring example: {"equipment_slot": "Accessory", "bonus_stats": {"luck": 3, "perception": 2}}
    Artifact example: {"equipment_slot": "Artifact", "bonus_stats": {"int": 5, "cultivation_speed": 10}}
    
    Slots: "Weapon", "Head", "Chest", "Legs", "Feet", "Hands", "Accessory", "Artifact"

LEARNING TECHNIQUES:
- When character learns new technique, use: {"field": "techniques.add", "operation": "add", "value": {...}}
- Example:
  {"field": "techniques.add", "operation": "add", "value": {
    "id": "blazing_sun_art",
    "name": "Liệt Dương Công",
    "name_en": "Blazing Sun Art",
    "description": "Công pháp hỏa hệ mạnh mẽ",
    "description_en": "Powerful fire-element technique",
    "grade": "Earth",
    "type": "Main",
    "elements": ["Hỏa"]
  }}
- Elements must be: "Kim", "Mộc", "Thủy", "Hỏa", "Thổ"

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
  
  // Calculate cultivation speed multiplier
  const spiritRootBonus = {
    'ThiênPhẩm': 2.0,
    'Hiếm': 1.5,
    'Khá': 1.2,
    'PhổThông': 1.0
  }[state.spirit_root.grade] || 1.0;
  
  ctx.push(
    locale === 'vi'
      ? `Linh căn: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade} (Tu luyện x${spiritRootBonus})`
      : `Spirit Root: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade} (Cultivation x${spiritRootBonus})`
  );
  ctx.push('');

  // Calculate total attributes including equipment bonuses
  const totalAttrs = calculateTotalAttributes(state);
  
  ctx.push(
    `HP: ${state.stats.hp}/${state.stats.hp_max} | Qi: ${state.stats.qi}/${state.stats.qi_max} | Stamina: ${state.stats.stamina}/${state.stats.stamina_max}`
  );
  
  // Show CURRENT stats (with equipment) - THESE ARE THE REAL NUMBERS
  ctx.push(
    locale === 'vi' 
      ? `CHỈ SỐ HIỆN TẠI (đã bao gồm trang bị):`
      : `CURRENT STATS (including equipment):`
  );
  ctx.push(
    `STR: ${totalAttrs.str} | AGI: ${totalAttrs.agi} | INT: ${totalAttrs.int} | PER: ${totalAttrs.perception} | LUCK: ${totalAttrs.luck}`
  );
  
  // Show base stats and equipment bonuses if different
  if (totalAttrs.str !== state.attrs.str || totalAttrs.agi !== state.attrs.agi || 
      totalAttrs.int !== state.attrs.int || totalAttrs.perception !== state.attrs.perception || 
      totalAttrs.luck !== state.attrs.luck) {
    ctx.push(
      locale === 'vi'
        ? `  - Base (không trang bị): STR ${state.attrs.str}, AGI ${state.attrs.agi}, INT ${state.attrs.int}, PER ${state.attrs.perception}, LUCK ${state.attrs.luck}`
        : `  - Base (no equipment): STR ${state.attrs.str}, AGI ${state.attrs.agi}, INT ${state.attrs.int}, PER ${state.attrs.perception}, LUCK ${state.attrs.luck}`
    );
    ctx.push(
      locale === 'vi'
        ? `  - Bonus từ trang bị: STR +${totalAttrs.str - state.attrs.str}, AGI +${totalAttrs.agi - state.attrs.agi}, INT +${totalAttrs.int - state.attrs.int}, PER +${totalAttrs.perception - state.attrs.perception}, LUCK +${totalAttrs.luck - state.attrs.luck}`
        : `  - Equipment bonus: STR +${totalAttrs.str - state.attrs.str}, AGI +${totalAttrs.agi - state.attrs.agi}, INT +${totalAttrs.int - state.attrs.int}, PER +${totalAttrs.perception - state.attrs.perception}, LUCK +${totalAttrs.luck - state.attrs.luck}`
    );
  }
  ctx.push('');

  ctx.push(
    locale === 'vi'
      ? `Tài sản: ${state.inventory.silver} bạc, ${state.inventory.spirit_stones} linh thạch`
      : `Resources: ${state.inventory.silver} silver, ${state.inventory.spirit_stones} spirit stones`
  );
  ctx.push('');

  // Equipped items
  const equippedCount = Object.values(state.equipped_items).filter(Boolean).length;
  if (equippedCount > 0) {
    ctx.push(locale === 'vi' ? '=== TRANG BỊ HIỆN TẠI ===' : '=== EQUIPPED ITEMS ===');
    Object.entries(state.equipped_items).forEach(([slot, item]) => {
      if (item) {
        const name = locale === 'vi' ? item.name : item.name_en;
        const stats = [];
        if (item.bonus_stats) {
          if (item.bonus_stats.str) stats.push(`STR+${item.bonus_stats.str}`);
          if (item.bonus_stats.agi) stats.push(`AGI+${item.bonus_stats.agi}`);
          if (item.bonus_stats.int) stats.push(`INT+${item.bonus_stats.int}`);
          if (item.bonus_stats.perception) stats.push(`PER+${item.bonus_stats.perception}`);
          if (item.bonus_stats.luck) stats.push(`LUCK+${item.bonus_stats.luck}`);
          if (item.bonus_stats.hp) stats.push(`HP+${item.bonus_stats.hp}`);
          if (item.bonus_stats.qi) stats.push(`Qi+${item.bonus_stats.qi}`);
        }
        ctx.push(`  ${slot}: ${name} [${item.rarity}] (${stats.join(', ')})`);
      }
    });
    ctx.push('');
  }

  // Inventory items with details
  ctx.push(
    locale === 'vi'
      ? `Vật phẩm trong túi: ${state.inventory.items.length} món`
      : `Inventory items: ${state.inventory.items.length} items`
  );
  if (state.inventory.items.length > 0) {
    state.inventory.items.slice(0, 10).forEach((item) => {
      const name = locale === 'vi' ? item.name : item.name_en;
      const details = [];
      details.push(`x${item.quantity}`);
      details.push(item.type);
      details.push(item.rarity);
      
      // Show bonus stats for equipment
      if (item.type === 'Equipment' && item.bonus_stats) {
        const stats = [];
        if (item.bonus_stats.str) stats.push(`STR+${item.bonus_stats.str}`);
        if (item.bonus_stats.agi) stats.push(`AGI+${item.bonus_stats.agi}`);
        if (item.bonus_stats.int) stats.push(`INT+${item.bonus_stats.int}`);
        if (item.bonus_stats.perception) stats.push(`PER+${item.bonus_stats.perception}`);
        if (item.bonus_stats.luck) stats.push(`LUCK+${item.bonus_stats.luck}`);
        if (item.bonus_stats.hp) stats.push(`HP+${item.bonus_stats.hp}`);
        if (item.bonus_stats.qi) stats.push(`Qi+${item.bonus_stats.qi}`);
        if (stats.length > 0) details.push(`(${stats.join(', ')})`);
        if (item.equipment_slot) details.push(`[${item.equipment_slot}]`);
      }
      
      // Show effects for consumables
      if (item.effects && Object.keys(item.effects).length > 0) {
        const effects = [];
        if (item.effects.hp_restore) effects.push(`Heal ${item.effects.hp_restore} HP`);
        if (item.effects.qi_restore) effects.push(`Restore ${item.effects.qi_restore} Qi`);
        if (item.effects.cultivation_exp) effects.push(`+${item.effects.cultivation_exp} Exp`);
        if (effects.length > 0) details.push(`(${effects.join(', ')})`);
      }
      
      ctx.push(`  - ${name} ${details.join(' ')}`);
    });
    if (state.inventory.items.length > 10) {
      ctx.push(`  ... and ${state.inventory.items.length - 10} more items`);
    }
  }
  ctx.push('');

  // Techniques with element compatibility
  if (state.techniques && state.techniques.length > 0) {
    ctx.push(locale === 'vi' ? '=== CÔNG PHÁP ===' : '=== TECHNIQUES ===');
    state.techniques.forEach((tech) => {
      const name = locale === 'vi' ? tech.name : tech.name_en;
      const elements = tech.elements && tech.elements.length > 0 
        ? `[${tech.elements.join('/')}]` 
        : '';
      ctx.push(`  - ${name} ${elements} (${tech.grade}, ${tech.type})`);
    });
    ctx.push('');
  }

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
