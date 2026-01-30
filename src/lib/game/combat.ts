import { GameState, Enemy, GameEvent } from "@/types/game";
import { DeterministicRNG } from "./rng";
import { updateHP, updateQi, clampStat } from "./mechanics";
import { calculateTotalAttributes, getEquipmentBonus } from "./equipment";

export interface CombatResult {
  victory: boolean;
  narrative: string;
  playerDamage: number;
  enemyDamage: number;
  events: GameEvent[];
}

/**
 * Calculate base damage with proper stat consideration
 */
function calculateDamage(
  atk: number,
  def: number,
  str: number, // Character STR for physical damage
  perception: number, // Affects accuracy
  luck: number, // Affects crit chance
  rng: DeterministicRNG
): number {
  // Accuracy check based on perception
  const accuracyBonus = perception * 0.01; // Each perception = +1% accuracy
  const hitChance = 0.85 + accuracyBonus; // Base 85% hit chance

  if (!rng.chance(Math.min(0.99, hitChance))) {
    return 0; // Miss!
  }

  // Factor in strength for physical attacks
  const effectiveAtk = atk + Math.floor(str / 2);
  const baseDamage = Math.max(1, effectiveAtk - def);
  const variance = rng.randomInt(-2, 5);

  // Critical hit calculation with STR and LUCK
  const critChance = 0.1 + str * 0.002 + luck * 0.003; // Base 10% + STR + LUCK bonus
  const critMultiplier = rng.chance(critChance) ? 1.5 + luck * 0.01 : 1.0; // LUCK increases crit damage

  return Math.floor(baseDamage * critMultiplier + variance);
}

/**
 * Calculate magical/qi damage
 */
function calculateQiDamage(
  intStat: number,
  strStat: number,
  perception: number,
  luck: number,
  def: number,
  rng: DeterministicRNG
): number {
  // Accuracy check - qi attacks more accurate due to INT
  const accuracyBonus = (perception + intStat) * 0.01;
  const hitChance = 0.9 + accuracyBonus; // Base 90% hit chance for qi attacks

  if (!rng.chance(Math.min(0.99, hitChance))) {
    return 0; // Miss!
  }

  // INT is primary stat for qi attacks, STR adds bonus
  const effectiveAtk = intStat * 2 + Math.floor(strStat / 2);
  const baseDamage = Math.max(1, effectiveAtk - Math.floor(def / 2)); // Qi bypasses some defense
  const variance = rng.randomInt(-3, 6);

  // Critical hit with INT and LUCK
  const critChance = 0.15 + intStat * 0.003 + luck * 0.004; // Qi attacks have higher base crit
  const critMultiplier = rng.chance(critChance) ? 2.0 + luck * 0.015 : 1.0; // Higher crit damage for qi

  return Math.floor(baseDamage * critMultiplier + variance);
}

/**
 * Calculate effective defense
 */
function calculateDefense(
  baseDefense: number,
  agiStat: number,
  luck: number,
  isDefending: boolean
): number {
  const agiBonus = Math.floor(agiStat / 3);
  const luckBonus = Math.floor(luck / 10); // LUCK provides small defense bonus
  const defenseBonus = isDefending ? 8 : 0;
  return baseDefense + agiBonus + luckBonus + defenseBonus;
}

/**
 * Calculate dodge chance
 */
function calculateDodgeChance(agiStat: number, perception: number, luck: number): number {
  // AGI is primary, perception and luck secondary
  const baseChance = 0.05; // 5% base dodge
  const agiBonus = agiStat * 0.01; // Each AGI = +1% dodge
  const perBonus = perception * 0.003; // Each PER = +0.3% dodge
  const luckBonus = luck * 0.002; // Each LUCK = +0.2% dodge
  return Math.min(0.4, baseChance + agiBonus + perBonus + luckBonus); // Cap at 40%
}

/**
 * Process a single combat turn
 */
export function processCombatTurn(
  state: GameState,
  enemy: Enemy,
  playerAction: "attack" | "defend" | "qi_attack" | "skill",
  rng?: DeterministicRNG,
  skillId?: string
): CombatResult {
  const events: GameEvent[] = [];
  let narrative = "";

  // Player's turn
  let playerDamage = 0;
  let enemyDamage = 0;

  // Use total attributes including equipment
  const totalAttrs = calculateTotalAttributes(state);

  // Decrease cooldowns for all skills
  if (state.skills) {
    state.skills.forEach((skill) => {
      if (skill.current_cooldown && skill.current_cooldown > 0) {
        skill.current_cooldown -= 1;
      }
    });
  }

  if (playerAction === "skill" && skillId) {
    // Use a skill
    const skill = state.skills?.find((s) => s.id === skillId);
    if (!skill) {
      narrative += `Không tìm thấy kỹ năng! `;
      playerAction = "attack"; // Fall back to normal attack
    } else if (skill.current_cooldown && skill.current_cooldown > 0) {
      narrative += `Kỹ năng ${skill.name} đang hồi chiêu (${skill.current_cooldown} lượt)! `;
      playerAction = "attack"; // Fall back to normal attack
    } else if (state.stats.qi < skill.qi_cost) {
      narrative += `Không đủ Linh lực để dùng ${skill.name}! `;
      playerAction = "attack"; // Fall back to normal attack
    } else {
      // Use the skill
      updateQi(state, -skill.qi_cost);
      skill.current_cooldown = skill.cooldown;

      if (skill.type === "attack") {
        // Skills: Calculate normal attack damage, then multiply by skill multiplier
        const normalAttackDamage = calculateDamage(
          totalAttrs.str,
          enemy.def,
          totalAttrs.str,
          totalAttrs.perception,
          totalAttrs.luck,
          rng!
        );
        // Apply skill multiplier (1.5x = 50% more damage than normal attack)
        playerDamage = Math.floor(normalAttackDamage * skill.damage_multiplier);
        enemy.hp -= playerDamage;
        narrative += `Bạn dùng ${skill.name}, gây ${playerDamage} sát thương! `;

        // Grant skill exp for using it (5-15 exp per use)
        const skillExpGain = rng!.randomInt(5, 15);
        if (!skill.exp) skill.exp = 0;
        if (!skill.max_exp) skill.max_exp = skill.level * 100; // 100 exp per level
        skill.exp += skillExpGain;

        // Level up skill if enough exp
        while (skill.exp >= skill.max_exp && skill.level < skill.max_level) {
          skill.exp -= skill.max_exp;
          skill.level += 1;
          skill.max_exp = skill.level * 100;
          skill.damage_multiplier = (skill.damage_multiplier || 1.5) * 1.05; // +5% damage per level
          narrative += `[${skill.name} lên cấp ${skill.level}!] `;
        }

        // Apply additional effects
        if (skill.effects?.stun_chance && rng!.chance(skill.effects.stun_chance)) {
          narrative += `${enemy.name} bị choáng! `;
          // Enemy loses next turn (implement in future)
        }
        if (skill.effects?.defense_break) {
          enemy.def = Math.max(0, enemy.def - skill.effects.defense_break);
          narrative += `Phòng thủ của ${enemy.name} giảm ${skill.effects.defense_break}! `;
        }
      } else if (skill.type === "defense") {
        // Defense skill - boost defense or heal
        if (skill.effects?.defense_boost) {
          narrative += `Bạn dùng ${skill.name}, tăng phòng thủ! `;
          // Defense boost will be applied when calculating damage taken
        }
        if (skill.effects?.heal_percent) {
          const healAmount = Math.floor(state.stats.hp_max * skill.effects.heal_percent);
          updateHP(state, healAmount);
          narrative += `Bạn dùng ${skill.name}, hồi ${healAmount} HP! `;
        }

        // Grant skill exp for defense skills
        const skillExpGain = rng!.randomInt(5, 15);
        if (!skill.exp) skill.exp = 0;
        if (!skill.max_exp) skill.max_exp = skill.level * 100;
        skill.exp += skillExpGain;

        while (skill.exp >= skill.max_exp && skill.level < skill.max_level) {
          skill.exp -= skill.max_exp;
          skill.level += 1;
          skill.max_exp = skill.level * 100;
          if (skill.effects?.heal_percent) {
            skill.effects.heal_percent = (skill.effects.heal_percent || 0.1) * 1.05;
          }
          narrative += `[${skill.name} lên cấp ${skill.level}!] `;
        }
      } else if (skill.type === "support") {
        // Support skill - buffs, debuffs, etc.
        if (skill.effects?.heal_percent) {
          const healAmount = Math.floor(state.stats.hp_max * skill.effects.heal_percent);
          updateHP(state, healAmount);
          narrative += `Bạn dùng ${skill.name}, hồi ${healAmount} HP! `;
        }
        if (skill.effects?.buff_stats) {
          narrative += `Bạn dùng ${skill.name}, tăng cường thuộc tính! `;
          // Stat buffs would need to be tracked separately
        }

        // Grant skill exp for support skills
        const skillExpGain = rng!.randomInt(5, 15);
        if (!skill.exp) skill.exp = 0;
        if (!skill.max_exp) skill.max_exp = skill.level * 100;
        skill.exp += skillExpGain;

        while (skill.exp >= skill.max_exp && skill.level < skill.max_level) {
          skill.exp -= skill.max_exp;
          skill.level += 1;
          skill.max_exp = skill.level * 100;
          narrative += `[${skill.name} lên cấp ${skill.level}!] `;
        }
      }
    }
  }

  if (playerAction === "attack") {
    // Normal attack uses base STR only (skills use Physical Attack which is higher)
    playerDamage = calculateDamage(
      totalAttrs.str, // Base STR for normal attacks
      enemy.def,
      totalAttrs.str,
      totalAttrs.perception,
      totalAttrs.luck,
      rng!
    );
    enemy.hp -= playerDamage;
    if (playerDamage === 0) {
      narrative += `Bạn tấn công nhưng bị trượt! `;
    } else {
      narrative += `Bạn tấn công gây ${playerDamage} sát thương. `;
    }
  } else if (playerAction === "defend") {
    // Defending reduces incoming damage
    narrative += `Bạn phòng thủ. `;
  } else if (playerAction === "qi_attack") {
    if (state.stats.qi >= 10) {
      updateQi(state, -10);
      playerDamage = calculateQiDamage(
        totalAttrs.int,
        totalAttrs.str,
        totalAttrs.perception,
        totalAttrs.luck,
        enemy.def,
        rng!
      );
      enemy.hp -= playerDamage;
      if (playerDamage === 0) {
        narrative += `Bạn sử dụng 10 Linh lực nhưng đối thủ né được! `;
      } else {
        narrative += `Bạn sử dụng 10 Linh lực, gây ${playerDamage} sát thương thuộc tính! `;
      }
    } else {
      narrative += `Không đủ Linh lực! Bạn tấn công thường. `;
      playerDamage = calculateDamage(
        totalAttrs.str, // Base STR for normal attack fallback
        enemy.def,
        totalAttrs.str,
        totalAttrs.perception,
        totalAttrs.luck,
        rng!
      );
      enemy.hp -= playerDamage;
    }
  }

  // Check if enemy defeated
  if (enemy.hp <= 0) {
    narrative += `${enemy.name} đã bị đánh bại!`;
    events.push({
      type: "combat",
      data: { result: "victory", enemy: enemy.name },
    });

    return {
      victory: true,
      narrative,
      playerDamage,
      enemyDamage: 0,
      events,
    };
  }

  // Check if player dodges enemy attack
  const dodgeChance = calculateDodgeChance(totalAttrs.agi, totalAttrs.perception, totalAttrs.luck);
  if (rng!.chance(dodgeChance)) {
    narrative += `Bạn né tránh đòn tấn công của ${enemy.name}! `;
    enemyDamage = 0;
  } else {
    // Enemy's turn
    const enemyAtk = enemy.atk;
    const playerDef = calculateDefense(
      5, // Base player defense
      totalAttrs.agi,
      totalAttrs.luck,
      playerAction === "defend"
    );

    // Factor in equipped items' defense bonuses
    const hpBonus = getEquipmentBonus(state, "hp");
    const agiBonus = getEquipmentBonus(state, "agi");
    const equipmentDefenseBonus = Math.floor(hpBonus / 20) + Math.floor(agiBonus / 3);

    enemyDamage = calculateDamage(
      enemyAtk,
      playerDef + equipmentDefenseBonus,
      0, // Enemy STR (uses atk instead)
      5, // Enemy perception
      5, // Enemy luck
      rng!
    );

    updateHP(state, -enemyDamage);
    if (enemyDamage === 0) {
      narrative += `${enemy.name} tấn công nhưng bị trượt. `;
    } else {
      narrative += `${enemy.name} tấn công gây ${enemyDamage} sát thương. `;
    }
  }

  // Check if player defeated
  if (state.stats.hp <= 0) {
    narrative += `Bạn đã bị đánh bại...`;
    events.push({
      type: "combat",
      data: { result: "defeat", enemy: enemy.name },
    });

    return {
      victory: false,
      narrative,
      playerDamage,
      enemyDamage,
      events,
    };
  }

  narrative += `HP còn: ${state.stats.hp}/${state.stats.hp_max}`;

  events.push({
    type: "combat",
    data: { result: "ongoing", playerHP: state.stats.hp, enemyHP: enemy.hp },
  });

  return {
    victory: false,
    narrative,
    playerDamage,
    enemyDamage,
    events,
  };
}

/**
 * Generate an enemy scaled to player's realm and stats
 */
export function generateEnemy(
  state: GameState,
  difficulty: "easy" | "medium" | "hard",
  rng: DeterministicRNG
): Enemy {
  const realmMultiplier =
    {
      PhàmNhân: 1,
      LuyệnKhí: 2,
      TrúcCơ: 4,
      KếtĐan: 8,
      NguyênAnh: 16,
    }[state.progress.realm] || 1;

  const difficultyMultiplier = {
    easy: 0.7,
    medium: 1.0,
    hard: 1.5,
  }[difficulty];

  const baseHP = 30 + state.progress.realm_stage * 20;
  const baseAtk = 8 + state.progress.realm_stage * 3;
  const baseDef = 3 + state.progress.realm_stage * 2;

  const monsterTypes = [
    {
      name: "Sói Hoang",
      name_en: "Wild Wolf",
      behavior: "Aggressive" as const,
    },
    {
      name: "Hổ Ma Thú",
      name_en: "Demonic Tiger",
      behavior: "Aggressive" as const,
    },
    { name: "Yêu Quái", name_en: "Demon", behavior: "Balanced" as const },
    {
      name: "Tu Sĩ Tà Đạo",
      name_en: "Evil Cultivator",
      behavior: "Balanced" as const,
    },
    {
      name: "Rắn Linh",
      name_en: "Spirit Snake",
      behavior: "Defensive" as const,
    },
    { name: "Thổ Phỉ", name_en: "Bandit", behavior: "Aggressive" as const },
  ];

  const selectedType = monsterTypes[rng.randomInt(0, monsterTypes.length - 1)];

  const hp = Math.floor(baseHP * realmMultiplier * difficultyMultiplier);

  return {
    id: `enemy_${state.turn_count}_${rng.randomInt(1000, 9999)}`,
    name: selectedType.name,
    name_en: selectedType.name_en,
    hp,
    hp_max: hp,
    atk: Math.floor(baseAtk * realmMultiplier * difficultyMultiplier),
    def: Math.floor(baseDef * realmMultiplier * difficultyMultiplier),
    behavior: selectedType.behavior,
    loot_table_id:
      difficulty === "hard"
        ? "rare_loot"
        : difficulty === "medium"
          ? "bandit_loot"
          : "common_herbs",
  };
}

/**
 * Quick resolve entire combat
 */
export function resolveCompleteCombat(
  state: GameState,
  enemy: Enemy,
  rng: DeterministicRNG,
  locale: "vi" | "en"
): { victory: boolean; narrative: string; events: GameEvent[] } {
  let rounds = 0;
  const maxRounds = 20;
  let narrative =
    locale === "vi"
      ? `Chiến đấu bắt đầu với ${enemy.name}!\n\n`
      : `Combat begins with ${enemy.name_en || enemy.name}!\n\n`;
  const events: GameEvent[] = [];

  const enemyCopy = { ...enemy };

  while (rounds < maxRounds && state.stats.hp > 0 && enemyCopy.hp > 0) {
    rounds++;

    // Simple AI: choose action based on behavior
    const playerAction: "attack" | "defend" | "qi_attack" =
      state.stats.qi >= 10 && rng.chance(0.3) ? "qi_attack" : "attack";

    const result = processCombatTurn(state, enemyCopy, playerAction, rng);
    narrative += `Hiệp ${rounds}: ${result.narrative}\n`;
    events.push(...result.events);

    if (result.victory || state.stats.hp <= 0) {
      break;
    }
  }

  const victory = enemyCopy.hp <= 0;

  if (victory) {
    narrative +=
      locale === "vi"
        ? `\nThắng lợi! Bạn đã đánh bại ${enemy.name}.`
        : `\nVictory! You have defeated ${enemy.name_en || enemy.name}.`;
  } else if (state.stats.hp <= 0) {
    narrative +=
      locale === "vi" ? `\nThất bại... Bạn bị đánh bại.` : `\nDefeat... You have been defeated.`;
  }

  return { victory, narrative, events };
}
