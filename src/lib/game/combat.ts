import { GameState, Enemy, GameEvent } from '@/types/game';
import { DeterministicRNG } from './rng';
import { updateHP, updateQi, clampStat } from './mechanics';
import { calculateTotalAttributes, getEquipmentBonus } from './equipment';

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
  str: number,  // Add character STR for physical damage
  rng: DeterministicRNG
): number {
  // Factor in strength for physical attacks
  const effectiveAtk = atk + Math.floor(str / 2);
  const baseDamage = Math.max(1, effectiveAtk - def);
  const variance = rng.randomInt(-2, 5);
  const critical = rng.chance(0.15 + (str * 0.002)) ? 1.5 : 1.0; // STR increases crit chance
  return Math.floor(baseDamage * critical + variance);
}

/**
 * Calculate magical/qi damage
 */
function calculateQiDamage(
  intStat: number,
  strStat: number,
  def: number,
  rng: DeterministicRNG
): number {
  // INT is primary stat for qi attacks, STR adds bonus
  const effectiveAtk = intStat * 2 + Math.floor(strStat / 2);
  const baseDamage = Math.max(1, effectiveAtk - Math.floor(def / 2)); // Qi bypasses some defense
  const variance = rng.randomInt(-3, 6);
  const critical = rng.chance(0.20 + (intStat * 0.003)) ? 2.0 : 1.0; // INT increases crit chance and multiplier
  return Math.floor(baseDamage * critical + variance);
}

/**
 * Calculate effective defense
 */
function calculateDefense(
  baseDefense: number,
  agiStat: number,
  isDefending: boolean
): number {
  const agiBonus = Math.floor(agiStat / 3);
  const defenseBonus = isDefending ? 8 : 0;
  return baseDefense + agiBonus + defenseBonus;
}

/**
 * Process a single combat turn
 */
export function processCombatTurn(
  state: GameState,
  enemy: Enemy,
  playerAction: 'attack' | 'defend' | 'qi_attack',
  rng: DeterministicRNG
): CombatResult {
  const events: GameEvent[] = [];
  let narrative = '';

  // Player's turn
  let playerDamage = 0;
  let enemyDamage = 0;
  
  // Use total attributes including equipment
  const totalAttrs = calculateTotalAttributes(state);

  if (playerAction === 'attack') {
    // Physical attack using STR
    playerDamage = calculateDamage(
      10, // Base attack power
      enemy.def,
      totalAttrs.str,
      rng
    );
    enemy.hp -= playerDamage;
    narrative += `Bạn tấn công gây ${playerDamage} sát thương. `;
  } else if (playerAction === 'defend') {
    // Defending reduces incoming damage
    narrative += `Bạn phòng thủ. `;
  } else if (playerAction === 'qi_attack') {
    if (state.stats.qi >= 10) {
      updateQi(state, -10);
      playerDamage = calculateQiDamage(
        totalAttrs.int,
        totalAttrs.str,
        enemy.def,
        rng
      );
      enemy.hp -= playerDamage;
      narrative += `Bạn sử dụng 10 Linh lực, gây ${playerDamage} sát thương thuộc tính! `;
    } else {
      narrative += `Không đủ Linh lực! Bạn tấn công thường. `;
      playerDamage = calculateDamage(10, enemy.def, totalAttrs.str, rng);
      enemy.hp -= playerDamage;
    }
  }

  // Check if enemy defeated
  if (enemy.hp <= 0) {
    narrative += `${enemy.name} đã bị đánh bại!`;
    events.push({
      type: 'combat',
      data: { result: 'victory', enemy: enemy.name },
    });

    return {
      victory: true,
      narrative,
      playerDamage,
      enemyDamage: 0,
      events,
    };
  }

  // Enemy's turn
  const enemyAtk = enemy.atk;
  const playerDef = calculateDefense(
    5, // Base player defense
    totalAttrs.agi,
    playerAction === 'defend'
  );
  
  // Factor in equipped items' defense bonuses
  const hpBonus = getEquipmentBonus(state, 'hp');
  const agiBonus = getEquipmentBonus(state, 'agi');
  const equipmentDefenseBonus = Math.floor(hpBonus / 20) + Math.floor(agiBonus / 3);
  
  enemyDamage = calculateDamage(
    enemyAtk,
    playerDef + equipmentDefenseBonus,
    0, // Enemy doesn't use player STR
    rng
  );

  updateHP(state, -enemyDamage);
  narrative += `${enemy.name} tấn công gây ${enemyDamage} sát thương. `;

  // Check if player defeated
  if (state.stats.hp <= 0) {
    narrative += `Bạn đã bị đánh bại...`;
    events.push({
      type: 'combat',
      data: { result: 'defeat', enemy: enemy.name },
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
    type: 'combat',
    data: { result: 'ongoing', playerHP: state.stats.hp, enemyHP: enemy.hp },
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
  difficulty: 'easy' | 'medium' | 'hard',
  rng: DeterministicRNG
): Enemy {
  const realmMultiplier = {
    'PhàmNhân': 1,
    'LuyệnKhí': 2,
    'TrúcCơ': 4,
    'KếtĐan': 8,
    'NguyênAnh': 16,
  }[state.progress.realm] || 1;

  const difficultyMultiplier = {
    easy: 0.7,
    medium: 1.0,
    hard: 1.5,
  }[difficulty];

  const baseHP = 30 + (state.progress.realm_stage * 20);
  const baseAtk = 8 + (state.progress.realm_stage * 3);
  const baseDef = 3 + (state.progress.realm_stage * 2);

  const monsterTypes = [
    { name: 'Sói Hoang', name_en: 'Wild Wolf', behavior: 'Aggressive' as const },
    { name: 'Hổ Ma Thú', name_en: 'Demonic Tiger', behavior: 'Aggressive' as const },
    { name: 'Yêu Quái', name_en: 'Demon', behavior: 'Balanced' as const },
    { name: 'Tu Sĩ Tà Đạo', name_en: 'Evil Cultivator', behavior: 'Balanced' as const },
    { name: 'Rắn Linh', name_en: 'Spirit Snake', behavior: 'Defensive' as const },
    { name: 'Thổ Phỉ', name_en: 'Bandit', behavior: 'Aggressive' as const },
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
    loot_table_id: difficulty === 'hard' ? 'rare_loot' : difficulty === 'medium' ? 'bandit_loot' : 'common_herbs',
  };
}

/**
 * Quick resolve entire combat
 */
export function resolveCompleteCombat(
  state: GameState,
  enemy: Enemy,
  rng: DeterministicRNG,
  locale: 'vi' | 'en'
): { victory: boolean; narrative: string; events: GameEvent[] } {
  let rounds = 0;
  const maxRounds = 20;
  let narrative = locale === 'vi' 
    ? `Chiến đấu bắt đầu với ${enemy.name}!\n\n`
    : `Combat begins with ${enemy.name_en || enemy.name}!\n\n`;
  const events: GameEvent[] = [];

  const enemyCopy = { ...enemy };

  while (rounds < maxRounds && state.stats.hp > 0 && enemyCopy.hp > 0) {
    rounds++;

    // Simple AI: choose action based on behavior
    const playerAction: 'attack' | 'defend' | 'qi_attack' =
      state.stats.qi >= 10 && rng.chance(0.3) ? 'qi_attack' : 'attack';

    const result = processCombatTurn(state, enemyCopy, playerAction, rng);
    narrative += `Hiệp ${rounds}: ${result.narrative}\n`;
    events.push(...result.events);

    if (result.victory || state.stats.hp <= 0) {
      break;
    }
  }

  const victory = enemyCopy.hp <= 0;

  if (victory) {
    narrative += locale === 'vi' 
      ? `\nThắng lợi! Bạn đã đánh bại ${enemy.name}.`
      : `\nVictory! You have defeated ${enemy.name_en || enemy.name}.`;
  } else if (state.stats.hp <= 0) {
    narrative += locale === 'vi'
      ? `\nThất bại... Bạn bị đánh bại.`
      : `\nDefeat... You have been defeated.`;
  }

  return { victory, narrative, events };
}
