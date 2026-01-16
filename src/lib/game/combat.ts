import { GameState, Enemy, GameEvent } from '@/types/game';
import { DeterministicRNG } from './rng';
import { updateHP, updateQi, clampStat } from './mechanics';

export interface CombatResult {
  victory: boolean;
  narrative: string;
  playerDamage: number;
  enemyDamage: number;
  events: GameEvent[];
}

/**
 * Calculate base damage
 */
function calculateDamage(
  atk: number,
  def: number,
  rng: DeterministicRNG
): number {
  const baseDamage = Math.max(1, atk - def);
  const variance = rng.randomInt(-2, 3);
  const critical = rng.chance(0.15) ? 1.5 : 1.0;
  return Math.floor(baseDamage * critical + variance);
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

  if (playerAction === 'attack') {
    playerDamage = calculateDamage(state.attrs.str + 5, enemy.def, rng);
    enemy.hp -= playerDamage;
    narrative += `Bạn tấn công gây ${playerDamage} sát thương. `;
  } else if (playerAction === 'defend') {
    // Defending reduces incoming damage
    narrative += `Bạn phòng thủ. `;
  } else if (playerAction === 'qi_attack') {
    if (state.stats.qi >= 10) {
      updateQi(state, -10);
      playerDamage = calculateDamage(
        state.attrs.int * 2 + state.attrs.str,
        enemy.def,
        rng
      );
      enemy.hp -= playerDamage;
      narrative += `Bạn sử dụng 10 Linh lực, gây ${playerDamage} sát thương thuộc tính! `;
    } else {
      narrative += `Không đủ Linh lực! Bạn tấn công thường. `;
      playerDamage = calculateDamage(state.attrs.str + 5, enemy.def, rng);
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
  const playerDef = state.attrs.agi + (playerAction === 'defend' ? 5 : 0);
  enemyDamage = calculateDamage(enemyAtk, playerDef, rng);

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
