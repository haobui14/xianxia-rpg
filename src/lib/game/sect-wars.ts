import {
  GameEvent,
  GameState,
  SectWar,
  SectWarRecord,
} from "@/types/game";
import { getSectById } from "./sects";
import { mostHostileRival, shiftRelation } from "./sect-missions";

// Tuning
export const WAR_DURATION_TURNS = 8;
export const WAR_TARGET_SCORE = 60;
export const WAR_CHECK_INTERVAL = 5; // only roll scheduler every N turns
export const WAR_TRIGGER_CHANCE = 0.12; // per check
export const WAR_MIN_TURN = 20; // grace period at start of a run
export const WAR_HOSTILE_THRESHOLD = -60;

// Score awards
export const WAR_SCORE_PER_RIVAL_COMBAT = 10;
export const WAR_SCORE_PER_RIVAL_MISSION = 20;

/**
 * Attempt to start a war. Returns a war and an event if one was started,
 * otherwise null. Gates:
 *  - No active war
 *  - Player is in a named sect
 *  - Cooldown since last check has elapsed
 *  - Turn count > WAR_MIN_TURN (don't hit brand-new players)
 *  - There's at least one rival relation ≤ WAR_HOSTILE_THRESHOLD
 *  - Probability roll passes
 */
export function tryStartWar(
  state: GameState,
  rollFloat: () => number
): { war: SectWar; event: GameEvent } | null {
  if (state.sect_war) return null;
  if (!state.sect_membership) return null;
  if (state.turn_count < WAR_MIN_TURN) return null;

  const lastCheck = state.last_war_check_turn ?? -Infinity;
  if (state.turn_count - lastCheck < WAR_CHECK_INTERVAL) return null;
  state.last_war_check_turn = state.turn_count;

  const playerSect = getSectById(state.sect_membership.sect.id);
  if (!playerSect) return null; // AI-invented sect — skip wars for Phase 2

  const hostile = mostHostileRival(state);
  if (!hostile || hostile.relation > WAR_HOSTILE_THRESHOLD) return null;

  if (rollFloat() > WAR_TRIGGER_CHANCE) return null;

  const war: SectWar = {
    id:
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `war_${state.turn_count}_${Math.random().toString(36).slice(2, 10)}`,
    player_sect_id: playerSect.id,
    rival_sect_id: hostile.sect_id,
    start_turn: state.turn_count,
    end_turn: state.turn_count + WAR_DURATION_TURNS,
    player_score: 0,
    target_score: WAR_TARGET_SCORE,
    status: "active",
  };
  state.sect_war = war;

  return {
    war,
    event: {
      type: "sect_war_start",
      data: {
        war_id: war.id,
        player_sect_id: war.player_sect_id,
        rival_sect_id: war.rival_sect_id,
        end_turn: war.end_turn,
      },
    },
  };
}

/**
 * Credit war score from a player contribution (combat, mission). No-op if
 * no active war or the war's rival doesn't match. Returns the amount actually
 * credited (caller may show UI feedback).
 */
export function creditWarScore(
  state: GameState,
  rivalSectId: string | undefined,
  amount: number
): number {
  if (!state.sect_war || !rivalSectId) return 0;
  if (state.sect_war.rival_sect_id !== rivalSectId) return 0;
  state.sect_war.player_score += amount;
  return amount;
}

/**
 * If the active war has reached its end_turn, resolve it. Mutates state in
 * place (moves war to history, clears sect_war, applies win/loss rewards)
 * and returns the resolution event.
 */
export function tryResolveWar(state: GameState): GameEvent | null {
  const war = state.sect_war;
  if (!war) return null;
  if (state.turn_count < war.end_turn) return null;

  const won = war.player_score >= war.target_score;
  const record: SectWarRecord = {
    id: war.id,
    player_sect_id: war.player_sect_id,
    rival_sect_id: war.rival_sect_id,
    start_turn: war.start_turn,
    end_turn: war.end_turn,
    player_score: war.player_score,
    target_score: war.target_score,
    outcome: won ? "won" : "lost",
  };
  state.sect_war_history ||= [];
  state.sect_war_history.push(record);
  state.sect_war = null;

  if (state.sect_membership) {
    if (won) {
      state.sect_membership.contribution += 300;
      state.sect_membership.reputation = Math.min(
        100,
        state.sect_membership.reputation + 5
      );
      state.inventory.silver += 500;
      state.inventory.spirit_stones += 10;
      // Winning bullies the rival further.
      shiftRelation(state, war.rival_sect_id, -10);
    } else {
      state.sect_membership.reputation = Math.max(
        0,
        state.sect_membership.reputation - 5
      );
      // Losing softens the rival slightly (they respect your loss).
      shiftRelation(state, war.rival_sect_id, 5);
    }
  }

  return {
    type: "sect_war_end",
    data: {
      war_id: war.id,
      outcome: won ? "won" : "lost",
      player_score: war.player_score,
      target_score: war.target_score,
      rival_sect_id: war.rival_sect_id,
    },
  };
}

/**
 * Sanity check: if the player leaves the sect while a war is active, end
 * it cleanly as a loss (no reward penalty — they already paid by leaving).
 */
export function abortWarOnSectLeave(state: GameState): void {
  if (!state.sect_war) return;
  const war = state.sect_war;
  state.sect_war_history ||= [];
  state.sect_war_history.push({
    id: war.id,
    player_sect_id: war.player_sect_id,
    rival_sect_id: war.rival_sect_id,
    start_turn: war.start_turn,
    end_turn: state.turn_count,
    player_score: war.player_score,
    target_score: war.target_score,
    outcome: "lost",
  });
  state.sect_war = null;
}
