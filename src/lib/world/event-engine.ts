/**
 * Event Engine - Handles event selection, processing, and outcomes
 */

import {
  RandomEvent,
  EventState,
  EventChoice,
  EventOutcome,
  EventTrigger,
  RegionId,
} from "@/types/world";
import { Realm, Element, GameState, ProposedDelta } from "@/types/game";
import { ALL_EVENTS, getEventsByTrigger, getEventsForRegion, getEventById } from "./events";

// Event trigger chances by trigger type
const EVENT_TRIGGER_CHANCES: Record<EventTrigger, number> = {
  exploration: 0.4, // 40% chance during exploration
  travel: 0.25, // 25% chance during travel
  cultivation: 0.15, // 15% chance during cultivation
  rest: 0.1, // 10% chance during rest
  combat_end: 0.2, // 20% chance after combat
  area_enter: 0.3, // 30% chance when entering new area
};

// Realm order for comparison
const REALM_ORDER: Realm[] = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];

/**
 * Initialize event state
 */
export function initEventState(): EventState {
  return {
    active_event: null,
    selected_choice: null,
    event_cooldowns: {},
    recent_events: [],
    total_events_triggered: 0,
  };
}

/**
 * Check if an event should trigger
 */
export function shouldTriggerEvent(trigger: EventTrigger, rng: () => number): boolean {
  const chance = EVENT_TRIGGER_CHANCES[trigger] || 0.1;
  return rng() < chance;
}

/**
 * Get valid events for current situation
 */
export function getValidEvents(
  trigger: EventTrigger,
  regionId: RegionId,
  playerRealm: Realm,
  playerElements: Element[],
  playerFlags: string[],
  eventCooldowns: Record<string, number>
): RandomEvent[] {
  const events = getEventsForRegion(regionId, trigger);
  const realmIndex = REALM_ORDER.indexOf(playerRealm);

  return events.filter((event) => {
    // Check cooldown
    if (eventCooldowns[event.id] && eventCooldowns[event.id] > 0) {
      return false;
    }

    // Check realm requirement (soft gate - still include but with warning)
    if (event.realm_requirement) {
      const requiredIndex = REALM_ORDER.indexOf(event.realm_requirement);
      if (realmIndex < requiredIndex) {
        return false; // Events with realm requirements are hard gates
      }
    }

    // Check max realm
    if (event.realm_maximum) {
      const maxIndex = REALM_ORDER.indexOf(event.realm_maximum);
      if (realmIndex > maxIndex) {
        return false;
      }
    }

    // Check required flags
    if (event.requires_flags) {
      for (const flag of event.requires_flags) {
        if (!playerFlags.includes(flag)) {
          return false;
        }
      }
    }

    // Check excluded flags
    if (event.excludes_flags) {
      for (const flag of event.excludes_flags) {
        if (playerFlags.includes(flag)) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Select an event using weighted random
 */
export function selectEvent(
  validEvents: RandomEvent[],
  playerElements: Element[],
  rng: () => number
): RandomEvent | null {
  if (validEvents.length === 0) return null;

  // Calculate weights with element affinity bonus
  const weights = validEvents.map((event) => {
    let weight = event.weight;

    // 50% bonus if player has matching element
    if (event.element_affinity && playerElements.includes(event.element_affinity)) {
      weight *= 1.5;
    }

    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * totalWeight;

  for (let i = 0; i < validEvents.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return validEvents[i];
    }
  }

  return validEvents[validEvents.length - 1];
}

/**
 * Try to trigger an event
 */
export function tryTriggerEvent(
  trigger: EventTrigger,
  regionId: RegionId,
  playerRealm: Realm,
  playerElements: Element[],
  playerFlags: string[],
  eventState: EventState,
  rng: () => number
): { event: RandomEvent | null; newEventState: EventState } {
  // Check if should trigger
  if (!shouldTriggerEvent(trigger, rng)) {
    return { event: null, newEventState: eventState };
  }

  // Get valid events
  const validEvents = getValidEvents(
    trigger,
    regionId,
    playerRealm,
    playerElements,
    playerFlags,
    eventState.event_cooldowns
  );

  // Select event
  const event = selectEvent(validEvents, playerElements, rng);

  if (!event) {
    return { event: null, newEventState: eventState };
  }

  // Update event state
  const newEventState: EventState = {
    ...eventState,
    active_event: event,
    selected_choice: null,
    total_events_triggered: eventState.total_events_triggered + 1,
    recent_events: [event.id, ...eventState.recent_events.slice(0, 4)],
  };

  return { event, newEventState };
}

/**
 * Get available choices for an event
 */
export function getAvailableChoices(
  event: RandomEvent,
  state: GameState
): Array<{ choice: EventChoice; available: boolean; reason?: string }> {
  return event.choices.map((choice) => {
    if (!choice.requirements) {
      return { choice, available: true };
    }

    const req = choice.requirements;

    // Check stat requirement
    if (req.stat) {
      const value = getNestedValue(state, req.stat.key);
      if (typeof value !== "number" || value < req.stat.min) {
        if (choice.hidden_until_met) {
          return { choice, available: false, reason: "hidden" };
        }
        return {
          choice,
          available: false,
          reason: `Requires ${req.stat.key.split(".").pop()} >= ${req.stat.min}`,
        };
      }
    }

    // Check item requirement
    if (req.item) {
      const hasItem = state.inventory.items.some((item) => item.id === req.item);
      if (!hasItem) {
        if (choice.hidden_until_met) {
          return { choice, available: false, reason: "hidden" };
        }
        return { choice, available: false, reason: `Requires item: ${req.item}` };
      }
    }

    // Check skill requirement
    if (req.skill) {
      const hasSkill = state.skills.some((skill) => skill.id === req.skill);
      if (!hasSkill) {
        if (choice.hidden_until_met) {
          return { choice, available: false, reason: "hidden" };
        }
        return { choice, available: false, reason: `Requires skill: ${req.skill}` };
      }
    }

    // Check realm requirement
    if (req.realm) {
      const playerIndex = REALM_ORDER.indexOf(state.progress.realm);
      const requiredIndex = REALM_ORDER.indexOf(req.realm);
      if (playerIndex < requiredIndex) {
        if (choice.hidden_until_met) {
          return { choice, available: false, reason: "hidden" };
        }
        return { choice, available: false, reason: `Requires realm: ${req.realm}` };
      }
    }

    // Check karma
    if (req.karma_min !== undefined && state.karma < req.karma_min) {
      if (choice.hidden_until_met) {
        return { choice, available: false, reason: "hidden" };
      }
      return { choice, available: false, reason: `Requires karma >= ${req.karma_min}` };
    }

    if (req.karma_max !== undefined && state.karma > req.karma_max) {
      if (choice.hidden_until_met) {
        return { choice, available: false, reason: "hidden" };
      }
      return { choice, available: false, reason: `Requires karma <= ${req.karma_max}` };
    }

    return { choice, available: true };
  });
}

/**
 * Select an outcome from a choice using weighted random
 */
export function selectOutcome(choice: EventChoice, rng: () => number): EventOutcome {
  if (choice.outcomes.length === 1) {
    return choice.outcomes[0];
  }

  const totalWeight = choice.outcome_weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * totalWeight;

  for (let i = 0; i < choice.outcomes.length; i++) {
    roll -= choice.outcome_weights[i];
    if (roll <= 0) {
      return choice.outcomes[i];
    }
  }

  return choice.outcomes[choice.outcomes.length - 1];
}

/**
 * Process an event choice
 */
export function processEventChoice(
  eventState: EventState,
  choiceId: string,
  rng: () => number
): {
  outcome: EventOutcome | null;
  newEventState: EventState;
  error?: string;
} {
  if (!eventState.active_event) {
    return {
      outcome: null,
      newEventState: eventState,
      error: "No active event",
    };
  }

  const choice = eventState.active_event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    return {
      outcome: null,
      newEventState: eventState,
      error: "Invalid choice",
    };
  }

  // Select outcome
  const outcome = selectOutcome(choice, rng);

  // Update event state
  const newEventState: EventState = {
    ...eventState,
    active_event: null,
    selected_choice: choiceId,
    event_cooldowns: eventState.active_event.cooldown_turns
      ? {
          ...eventState.event_cooldowns,
          [eventState.active_event.id]: eventState.active_event.cooldown_turns,
        }
      : eventState.event_cooldowns,
  };

  return { outcome, newEventState };
}

/**
 * Decrease all event cooldowns by 1 turn
 */
export function tickEventCooldowns(eventState: EventState): EventState {
  const newCooldowns: Record<string, number> = {};

  for (const [eventId, turns] of Object.entries(eventState.event_cooldowns)) {
    if (turns > 1) {
      newCooldowns[eventId] = turns - 1;
    }
  }

  return {
    ...eventState,
    event_cooldowns: newCooldowns,
  };
}

/**
 * Apply event outcome to game state
 * Returns the list of deltas to apply
 */
export function getOutcomeEffects(outcome: EventOutcome): {
  deltas: ProposedDelta[];
  items: string[];
  removeItems: string[];
  combatEnemy: string | null;
  unlockArea: string | null;
  setFlags: string[];
  clearFlags: string[];
  teleport: { region: RegionId; area: string } | null;
} {
  return {
    deltas: outcome.effects,
    items: outcome.items || [],
    removeItems: outcome.remove_items || [],
    combatEnemy: outcome.trigger_combat || null,
    unlockArea: outcome.unlock_area || null,
    setFlags: outcome.set_flags || [],
    clearFlags: outcome.clear_flags || [],
    teleport: outcome.teleport_to || null,
  };
}

/**
 * Get event narrative based on locale
 */
export function getEventNarrative(event: RandomEvent, locale: "vi" | "en"): string {
  return locale === "vi" ? event.narrative : event.narrative_en;
}

/**
 * Get choice text based on locale
 */
export function getChoiceText(choice: EventChoice, locale: "vi" | "en"): string {
  return locale === "vi" ? choice.text : choice.text_en;
}

/**
 * Get outcome narrative based on locale
 */
export function getOutcomeNarrative(outcome: EventOutcome, locale: "vi" | "en"): string {
  return locale === "vi" ? outcome.narrative : outcome.narrative_en;
}

/**
 * Helper to get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Cancel active event (for when player leaves area, etc.)
 */
export function cancelActiveEvent(eventState: EventState): EventState {
  return {
    ...eventState,
    active_event: null,
    selected_choice: null,
  };
}

/**
 * Force trigger a specific event by ID
 */
export function forceTriggerEvent(
  eventId: string,
  eventState: EventState
): { event: RandomEvent | null; newEventState: EventState } {
  const event = getEventById(eventId);

  if (!event) {
    return { event: null, newEventState: eventState };
  }

  const newEventState: EventState = {
    ...eventState,
    active_event: event,
    selected_choice: null,
    total_events_triggered: eventState.total_events_triggered + 1,
    recent_events: [event.id, ...eventState.recent_events.slice(0, 4)],
  };

  return { event, newEventState };
}
