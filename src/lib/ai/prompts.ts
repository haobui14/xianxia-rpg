import { z } from 'zod';
import { Locale, GameState, AITurnResult, Choice, ProposedDelta, GameEvent } from '@/types/game';
import { calculateTotalAttributes } from '@/lib/game/equipment';
import { getRequiredExp, getSpiritRootBonus, getTechniqueBonus } from '@/lib/game/mechanics';

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
 * Build system prompt - Optimized for token efficiency
 * Shared schema definitions reduce duplication between languages
 */

// Shared JSON schemas (language-agnostic)
const DELTA_SCHEMA = {
  stats: '{"field": "stats.[hp|qi]", "operation": "subtract", "value": N}',
  attrs: '{"field": "attrs.[str|agi|int|perception|luck]", "operation": "add", "value": N}',
  exp: '{"field": "progress.cultivation_exp", "operation": "add", "value": 15-50}',
  resources: '{"field": "inventory.[spirit_stones|silver]", "operation": "add", "value": N}',
};

const ITEM_SCHEMA = {
  base: 'id, name, name_en, description, description_en, type, rarity, quantity',
  medicine: 'type="Medicine", effects: {hp_restore?, qi_restore?, cultivation_exp?, permanent_[stat]?}',
  equipment: 'type="Equipment", equipment_slot: Weapon|Head|Chest|Legs|Feet|Hands|Accessory|Artifact, bonus_stats: {str?, agi?, int?, perception?, luck?, hp?, qi?, cultivation_speed?}',
  book: 'type="Book", teaches_technique?: {TECHNIQUE_SCHEMA} OR teaches_skill?: {SKILL_SCHEMA}. Books teach ONE technique OR ONE skill when used.',
};

const TECHNIQUE_SCHEMA = 'id, name, name_en, description, description_en, grade: Mortal|Earth|Heaven, type: Main|Support, elements: ["Kim"|"Mộc"|"Thủy"|"Hỏa"|"Thổ"], cultivation_speed_bonus, qi_recovery_bonus?, breakthrough_bonus?';

const SKILL_SCHEMA = 'id, name, name_en, description, description_en, type: Attack|Defense|Movement|Support, element?, level, max_level, damage_multiplier, qi_cost, cooldown, effects?';

export function buildSystemPrompt(locale: Locale): string {
  const isVi = locale === 'vi';

  const rules = {
    role: isVi
      ? 'Bạn là Game Master cho game tu tiên RPG.\n1. KỂ CHUYỆN: 150-250 từ, sinh động\n2. LỰA CHỌN: 2-5 lựa chọn\n3. ĐỀ XUẤT: Thay đổi stats qua proposed_deltas'
      : 'You are a Game Master for a xianxia cultivation RPG.\n1. STORYTELLING: 150-250 words, engaging\n2. CHOICES: 2-5 reasonable choices\n3. PROPOSALS: Stat changes via proposed_deltas',

    antiRepeat: isVi
      ? '⚠️ TRÁNH LẶP: Xem "3 LƯỢT GẦN NHẤT", tạo nội dung KHÁC BIỆT. Rừng→chợ/làng. Chiến đấu→nghỉ/tu luyện.'
      : '⚠️ AVOID REPETITION: Review "RECENT 3 TURNS", create DIFFERENT content. Forest→market/village. Combat→rest/cultivate.',

    elements: isVi
      ? 'NGŨ HÀNH: ThiênPhẩm x2.0 | Hiếm x1.5 | Khá x1.2 | PhổThông x1.0\nSinh: Kim→Thủy→Mộc→Hỏa→Thổ→Kim | Khắc: Kim→Mộc→Thổ→Thủy→Hỏa→Kim\nCông pháp khớp linh căn: +30% | Tương sinh: +15% | Tương khắc: -20%'
      : 'ELEMENTS: Heavenly x2.0 | Rare x1.5 | Uncommon x1.2 | Common x1.0\nGeneration: Metal→Water→Wood→Fire→Earth→Metal | Overcoming: Metal→Wood→Earth→Water→Fire→Metal\nTechnique matches root: +30% | Generation: +15% | Overcoming: -20%',

    noStats: isVi
      ? 'NGHIÊM CẤM: KHÔNG nói số trong narrative. SAI: "sức mạnh lên 8". ĐÚNG: "cảm thấy mạnh mẽ" + proposed_deltas'
      : 'FORBIDDEN: NO numbers in narrative. WRONG: "strength to 8". RIGHT: "feeling stronger" + proposed_deltas',

    progression: isVi
      ? 'TIẾN TRIỂN: Mỗi action có kết quả (exp 15-50, items). Stamina: 1-2 thường, 3-4 khó. LUÔN có 1 lựa chọn nghỉ hồi 10-20 stamina. time_segments: 1-2.'
      : 'PROGRESSION: Every action has results (exp 15-50, items). Stamina: 1-2 normal, 3-4 hard. ALWAYS 1 rest option recovering 10-20 stamina. time_segments: 1-2.',

    combat: isVi
      ? 'CHIẾN ĐẤU: PHẢI giảm HP (10-30) và qi (5-20) qua proposed_deltas. Thắng → loot + exp.'
      : 'COMBAT: MUST reduce HP (10-30) and qi (5-20) via proposed_deltas. Victory → loot + exp.',

    luck: isVi
      ? '🍀 MAY MẮN (Max 100): LUCK <20: Common/Uncommon | LUCK 20-40: Rare thường xuyên | LUCK 41-60: Epic thường xuyên | LUCK 61-80: Epic + Legendary | LUCK 81-100: Legendary thường xuyên. Cao LUCK → sự kiện tích cực, tìm bảo vật, may trong chiến đấu. Thấp LUCK → bẫy, rủi ro.\n⚠️ LUCK HIẾM: KHÔNG ĐƯỢC tăng LUCK qua lựa chọn thường. Chỉ +1-2 LUCK từ sự kiện CỰC HIẾM (bảo vật thiên địa, phúc duyên lớn). +3+ LUCK chỉ từ equipment/artifacts.'
      : '🍀 LUCK (Max 100): LUCK <20: Common/Uncommon | LUCK 20-40: Frequent Rare | LUCK 41-60: Frequent Epic | LUCK 61-80: Epic + Legendary | LUCK 81-100: Frequent Legendary. High LUCK → positive events, find treasures, lucky in combat. Low LUCK → traps, risks.\n⚠️ LUCK IS RARE: NEVER increase LUCK from normal choices. Only +1-2 LUCK from EXTREMELY RARE events (heavenly treasures, major fortune). +3+ LUCK only from equipment/artifacts.',
  };

  const schemas = `
DELTA FIELDS: ${JSON.stringify(DELTA_SCHEMA)}

ITEMS - inventory.add_item:
- Base: ${ITEM_SCHEMA.base}
- Medicine: ${ITEM_SCHEMA.medicine}
- Equipment: ${ITEM_SCHEMA.equipment}
- Book: ${ITEM_SCHEMA.book}
- Rarity: Common|Uncommon|Rare|Epic|Legendary
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc nhặt/nhận/tìm được vật phẩm → PHẢI thêm delta {"field": "add_item", "operation": "add", "value": {item object}}' : '⚠️ IMPORTANT: WHEN narrative mentions finding/receiving/looting items → MUST add delta {"field": "add_item", "operation": "add", "value": {item object}}'}
${isVi ? 'KHÔNG CHỈ MÔ TẢ - PHẢI THÊM VÀO proposed_deltas!' : 'DO NOT JUST DESCRIBE - MUST ADD TO proposed_deltas!'}

TECHNIQUES (techniques.add) - ${isVi ? 'CHỈ tăng tốc tu luyện, KHÔNG chiến đấu' : 'cultivation speed ONLY, NOT combat'}:
${TECHNIQUE_SCHEMA}
Grade bonus: Mortal +5-15%, Earth +15-30%, Heaven +30-50%
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc về học/tìm được công pháp/bí kíp → PHẢI thêm delta {"field": "techniques.add", "operation": "add", "value": {technique object}}' : '⚠️ IMPORTANT: WHEN narrative mentions learning/finding techniques/manuals → MUST add delta {"field": "techniques.add", "operation": "add", "value": {technique object}}'}
${isVi ? 'Cách học: 1) Trực tiếp thêm vào techniques.add, HOẶC 2) Cho sách (Book) với teaches_technique' : 'Learning: 1) Directly add via techniques.add, OR 2) Give book (Book) with teaches_technique'}

SKILLS (skills.add) - ${isVi ? 'DÙNG trong chiến đấu, tiêu qi' : 'USED in combat, consumes qi'}:
${SKILL_SCHEMA}
${isVi ? '⚠️ QUAN TRỌNG: KHI câu chuyện nhắc về học/lĩnh ngộ kỹ năng chiến đấu → PHẢI thêm delta {"field": "skills.add", "operation": "add", "value": {skill object}}' : '⚠️ IMPORTANT: WHEN narrative mentions learning/comprehending combat skills → MUST add delta {"field": "skills.add", "operation": "add", "value": {skill object}}'}
${isVi ? 'Cách học: 1) Trực tiếp thêm vào skills.add, HOẶC 2) Cho sách (Book) với teaches_skill' : 'Learning: 1) Directly add via skills.add, OR 2) Give book (Book) with teaches_skill'}`;

  const outputFormat = `
OUTPUT JSON:
{
  "locale": "${locale}",
  "narrative": "...",
  "choices": [{"id": "action", "text": "...", "cost": {"stamina": N, "time_segments": N}}],
  "proposed_deltas": [
    {"field": "stats.stamina", "operation": "subtract", "value": 2},
    {"field": "progress.cultivation_exp", "operation": "add", "value": 25},
    {"field": "add_item", "operation": "add", "value": {item_object}} ${isVi ? '← NẾU nhặt/nhận vật phẩm' : '← IF finding/receiving items'},
    {"field": "techniques.add", "operation": "add", "value": {technique_object}} ${isVi ? '← NẾU học công pháp' : '← IF learning technique'},
    {"field": "skills.add", "operation": "add", "value": {skill_object}} ${isVi ? '← NẾU học kỹ năng' : '← IF learning skill'}
  ],
  "events": []
}
${isVi ? 'LƯU Ý: Mỗi vật phẩm/kỹ năng/công pháp trong narrative PHẢI có delta tương ứng!' : 'NOTE: Every item/skill/technique in narrative MUST have corresponding delta!'}`;

  return `${rules.role}

${rules.antiRepeat}

${rules.elements}

${rules.luck}

${rules.noStats}

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

  // Calculate required exp for next level
  const requiredExp = getRequiredExp(state.progress.realm, state.progress.realm_stage);
  const expDisplay = requiredExp === Infinity 
    ? state.progress.cultivation_exp 
    : `${state.progress.cultivation_exp}/${requiredExp}`;

  ctx.push(
    locale === 'vi'
      ? `Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage} (Exp: ${expDisplay})`
      : `Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage} (Exp: ${expDisplay})`
  );
  
  // Calculate total cultivation speed multiplier
  const spiritRootBonus = getSpiritRootBonus(state.spirit_root.grade);
  const techniqueBonus = getTechniqueBonus(state);
  const totalMultiplier = spiritRootBonus * techniqueBonus;
  
  ctx.push(
    locale === 'vi'
      ? `Linh căn: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)})`
      : `Spirit Root: ${state.spirit_root.elements.join('/')} - ${state.spirit_root.grade} (x${spiritRootBonus.toFixed(1)})`
  );
  
  // Show total cultivation multiplier from all sources
  ctx.push(
    locale === 'vi'
      ? `Tốc độ tu luyện tổng hợp: x${totalMultiplier.toFixed(2)} (Linh căn x${spiritRootBonus.toFixed(1)} + Công pháp x${techniqueBonus.toFixed(2)})`
      : `Total Cultivation Speed: x${totalMultiplier.toFixed(2)} (Spirit Root x${spiritRootBonus.toFixed(1)} + Techniques x${techniqueBonus.toFixed(2)})`
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

  // Helper function to translate rarity
  const translateRarity = (rarity: string, loc: Locale) => {
    if (loc === 'vi') {
      const rarityMap: Record<string, string> = {
        'Common': 'Phàm Phẩm',
        'Uncommon': 'Hạ Phẩm', 
        'Rare': 'Trung Phẩm',
        'Epic': 'Thượng Phẩm',
        'Legendary': 'Cực Phẩm'
      };
      return rarityMap[rarity] || rarity;
    }
    return rarity;
  };

  const translateSlot = (slot: string, loc: Locale) => {
    if (loc === 'vi') {
      const slotMap: Record<string, string> = {
        'Weapon': 'Vũ Khí', 'Head': 'Đầu', 'Chest': 'Ngực', 
        'Legs': 'Chân', 'Feet': 'Giày', 'Hands': 'Tay',
        'Accessory': 'Phụ Kiện', 'Artifact': 'Bảo Vật'
      };
      return slotMap[slot] || slot;
    }
    return slot;
  };

  // Inventory items with details
  ctx.push(
    locale === 'vi'
      ? `Vật phẩm trong túi: ${state.inventory.items.length} món`
      : `Inventory items: ${state.inventory.items.length} items`
  );
  if (state.inventory.items.length > 0) {
    state.inventory.items.slice(0, 10).forEach((item) => {
      const name = locale === 'vi' ? item.name : item.name_en;
      const rarity = translateRarity(item.rarity, locale);
      const details = [];
      details.push(`x${item.quantity}`);
      details.push(item.type);
      details.push(rarity);
      
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
        if (item.equipment_slot) details.push(`[${translateSlot(item.equipment_slot, locale)}]`);
      }
      
      // Show effects for consumables
      if (item.effects && Object.keys(item.effects).length > 0) {
        const effects = [];
        if (item.effects.hp_restore) effects.push(locale === 'vi' ? `Hồi ${item.effects.hp_restore} HP` : `Heal ${item.effects.hp_restore} HP`);
        if (item.effects.qi_restore) effects.push(locale === 'vi' ? `Hồi ${item.effects.qi_restore} Qi` : `Restore ${item.effects.qi_restore} Qi`);
        if (item.effects.cultivation_exp) effects.push(`+${item.effects.cultivation_exp} Exp`);
        if (effects.length > 0) details.push(`(${effects.join(', ')})`);
      }
      
      ctx.push(`  - ${name} ${details.join(' ')}`);
    });
    if (state.inventory.items.length > 10) {
      ctx.push(locale === 'vi' ? `  ... và ${state.inventory.items.length - 10} vật phẩm khác` : `  ... and ${state.inventory.items.length - 10} more items`);
    }
  }
  ctx.push('');

  // Helper function to translate terms
  const translateGrade = (grade: string, loc: Locale) => {
    if (loc === 'vi') {
      const gradeMap: Record<string, string> = { 'Mortal': 'Phàm Cấp', 'Earth': 'Địa Cấp', 'Heaven': 'Thiên Cấp' };
      return gradeMap[grade] || grade;
    }
    return grade;
  };
  
  const translateTechType = (type: string, loc: Locale) => {
    if (loc === 'vi') {
      const typeMap: Record<string, string> = { 'Main': 'Chính', 'Support': 'Phụ' };
      return typeMap[type] || type;
    }
    return type;
  };

  const translateSkillType = (type: string, loc: Locale) => {
    if (loc === 'vi') {
      const typeMap: Record<string, string> = { 'Attack': 'Tấn Công', 'Defense': 'Phòng Thủ', 'Movement': 'Thân Pháp', 'Support': 'Hỗ Trợ' };
      return typeMap[type] || type;
    }
    return type;
  };

  // Techniques (for cultivation speed) with element compatibility
  if (state.techniques && state.techniques.length > 0) {
    ctx.push(locale === 'vi' ? '=== CÔNG PHÁP (Tăng tốc tu luyện) ===' : '=== TECHNIQUES (Cultivation Speed) ===');
    state.techniques.forEach((tech) => {
      const name = locale === 'vi' ? tech.name : tech.name_en;
      const elements = tech.elements && tech.elements.length > 0 
        ? `[${tech.elements.join('/')}]` 
        : '';
      const speedBonus = tech.cultivation_speed_bonus ? `+${tech.cultivation_speed_bonus}%` : '';
      const grade = translateGrade(tech.grade, locale);
      const techType = translateTechType(tech.type, locale);
      ctx.push(`  - ${name} ${elements} (${grade}, ${techType}) ${speedBonus}`);
    });
    ctx.push('');
  }

  // Skills (for combat)
  if (state.skills && state.skills.length > 0) {
    ctx.push(locale === 'vi' ? '=== KỸ NĂNG CHIẾN ĐẤU ===' : '=== COMBAT SKILLS ===');
    state.skills.forEach((skill) => {
      const name = locale === 'vi' ? skill.name : skill.name_en;
      const element = skill.element ? `[${skill.element}]` : '';
      const skillType = translateSkillType(skill.type, locale);
      const dmg = skill.damage_multiplier ? `${skill.damage_multiplier}x` : '';
      const cost = skill.qi_cost ? `${skill.qi_cost} qi` : '';
      ctx.push(`  - ${name} ${element} Lv.${skill.level}/${skill.max_level} [${skillType}] (${dmg}, ${cost})`);
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

/**
 * Build variety enforcement hints to prevent repetitive narratives
 */
export function buildVarietyEnforcement(
  themesToAvoid: string[],
  turnCount: number,
  locale: Locale
): string {
  const hints: string[] = [];
  
  if (locale === 'vi') {
    hints.push('=== YÊU CẦU ĐA DẠNG ===');
    
    if (themesToAvoid.length > 0) {
      hints.push(`TRÁNH các chủ đề đã xuất hiện gần đây: ${themesToAvoid.join(', ')}`);
      hints.push('Hãy tạo tình huống MỚI và KHÁC BIỆT hoàn toàn.');
    }
    
    // Add variety suggestions based on turn count
    const varietySuggestions = [
      'Thêm yếu tố bất ngờ hoặc twist',
      'Giới thiệu NPC mới với tính cách đặc biệt',
      'Mô tả cảnh quan hoặc thời tiết độc đáo',
      'Tạo xung đột nội tâm hoặc lựa chọn khó khăn',
      'Thêm yếu tố hài hước hoặc nhẹ nhàng',
      'Đưa ra cơ hội hiếm có (tương xứng LUCK)',
      'Kể về quá khứ hoặc hồi ức của nhân vật',
      'Tạo cuộc gặp gỡ bí ẩn hoặc kỳ lạ',
    ];
    
    const suggestionIndex = turnCount % varietySuggestions.length;
    hints.push(`GỢI Ý: ${varietySuggestions[suggestionIndex]}`);
    
  } else {
    hints.push('=== VARIETY REQUIREMENTS ===');
    
    if (themesToAvoid.length > 0) {
      hints.push(`AVOID themes that appeared recently: ${themesToAvoid.join(', ')}`);
      hints.push('Create a completely NEW and DIFFERENT situation.');
    }
    
    const varietySuggestions = [
      'Add a surprising element or plot twist',
      'Introduce a new NPC with unique personality',
      'Describe unique scenery or weather',
      'Create internal conflict or difficult choice',
      'Add humor or lighthearted moment',
      'Present rare opportunity (scale with LUCK)',
      'Reference character backstory or memories',
      'Create mysterious or strange encounter',
    ];
    
    const suggestionIndex = turnCount % varietySuggestions.length;
    hints.push(`SUGGESTION: ${varietySuggestions[suggestionIndex]}`);
  }
  
  return hints.join('\n');
}
