import { NextResponse } from 'next/server';
import { runQueries, turnLogQueries } from '@/lib/database/queries';
import { generateAITurn, getFallbackResponse } from '@/lib/ai/agent';
import {
  GameState,
  ProposedDelta,
  ValidatedTurnResult,
  GameEvent,
} from '@/types/game';
import {
  updateStamina,
  updateHP,
  updateQi,
  applyCost,
  canAffordCost,
  clampStat,
  performBreakthrough,
  canBreakthrough,
  calculateCultivationExpGain,
  advanceTime,
} from '@/lib/game/mechanics';
import { createTurnRNG } from '@/lib/game/rng';
import {
  getApplicableTemplates,
  selectRandomTemplate,
} from '@/lib/game/scenes';
import { generateLoot, validateLoot } from '@/lib/game/loot';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, choiceId, selectedChoice } = body;

    if (!runId) {
      return NextResponse.json({ error: 'Run ID required' }, { status: 400 });
    }

    // Load run
    const run = await runQueries.getById(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const state: GameState = run.current_state as GameState;
    const locale = run.locale;
    const turnNo = state.turn_count + 1;

    // Create RNG for this turn
    const rng = createTurnRNG(run.world_seed, turnNo);

    // Get recent narratives for context
    const recentLogs = await turnLogQueries.getLastTurns(runId, 3);
    const recentNarratives = recentLogs.map((log) => log.narrative);

    // Apply choice costs immediately (before AI generation)
    const events: GameEvent[] = [];
    if (selectedChoice && selectedChoice.cost) {
      if (selectedChoice.cost.stamina) {
        applyStatDelta(state, 'stamina', 'subtract', selectedChoice.cost.stamina);
        // Update last_stamina_regen timestamp when stamina changes
        state.last_stamina_regen = new Date().toISOString();
      }
      if (selectedChoice.cost.qi) {
        applyStatDelta(state, 'qi', 'subtract', selectedChoice.cost.qi);
      }
      if (selectedChoice.cost.silver) {
        state.inventory.silver = Math.max(0, state.inventory.silver - selectedChoice.cost.silver);
      }
      if (selectedChoice.cost.spirit_stones) {
        state.inventory.spirit_stones = Math.max(0, state.inventory.spirit_stones - selectedChoice.cost.spirit_stones);
      }
      if (selectedChoice.cost.time_segments) {
        advanceTime(state, selectedChoice.cost.time_segments);
      }
    }

    // Select scene template if starting new scene
    let sceneContext = '';
    if (!choiceId || state.turn_count === 0) {
      const applicableTemplates = getApplicableTemplates(state);
      const template = selectRandomTemplate(applicableTemplates, rng);

      if (template) {
        sceneContext = template.getPromptContext(state, locale);
      } else {
        sceneContext =
          locale === 'vi'
            ? 'Nhân vật đang ở trong một khu vực yên tĩnh.'
            : 'The character is in a quiet area.';
      }
    } else {
      sceneContext =
        locale === 'vi'
          ? `Tiếp tục từ lựa chọn: ${choiceId}`
          : `Continuing from choice: ${choiceId}`;
    }

    // Call AI
    let aiResult;
    try {
      aiResult = await generateAITurn(
        state,
        recentNarratives,
        sceneContext,
        choiceId,
        locale
      );
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
      aiResult = getFallbackResponse(state, locale);
    }

    // Add AI events to existing events from costs
    events.push(...aiResult.events);

    // Validate and apply deltas from AI
    applyValidatedDeltas(state, aiResult.proposed_deltas, rng, events);

    // Check for breakthrough
    if (canBreakthrough(state)) {
      const breakthroughSuccess = performBreakthrough(state);
      if (breakthroughSuccess) {
        events.push({
          type: 'breakthrough',
          data: {
            realm: state.progress.realm,
            stage: state.progress.realm_stage,
          },
        });
      }
    }

    // Update turn count
    state.turn_count = turnNo;

    // Update story summary every 10 turns
    if (turnNo % 10 === 0) {
      updateStorySummary(state, aiResult.narrative, locale);
    }

    // Save state
    await runQueries.update(runId, state);

    // Save turn log
    await turnLogQueries.create(
      runId,
      turnNo,
      choiceId,
      aiResult.narrative,
      aiResult
    );

    // Return result
    const result: ValidatedTurnResult = {
      narrative: aiResult.narrative,
      choices: aiResult.choices,
      state,
      events,
      turn_no: turnNo,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing turn:', error);
    return NextResponse.json(
      { error: 'Failed to process turn' },
      { status: 500 }
    );
  }
}

/**
 * Apply validated deltas to state
 */
function applyValidatedDeltas(
  state: GameState,
  deltas: ProposedDelta[],
  rng: any,
  events: GameEvent[]
): void {
  for (const delta of deltas) {
    try {
      applyDelta(state, delta, rng, events);
    } catch (error) {
      console.error('Failed to apply delta:', delta, error);
    }
  }
}

/**
 * Apply a single delta with validation
 */
function applyDelta(
  state: GameState,
  delta: ProposedDelta,
  rng: any,
  events: GameEvent[]
): void {
  const { field, operation, value } = delta;

  // Parse field path (e.g., "stats.hp", "inventory.silver")
  const parts = field.split('.');

  if (parts[0] === 'stats') {
    applyStatDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === 'attrs') {
    applyAttrDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === 'progress') {
    applyProgressDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === 'inventory') {
    applyInventoryDelta(state, parts[1], operation, value, rng, events);
  } else if (parts[0] === 'karma') {
    applyKarmaDelta(state, operation, value as number);
  }
}

function applyStatDelta(
  state: GameState,
  stat: string,
  operation: string,
  value: number
): void {
  const maxChange = 100; // Max change per turn
  const clampedValue = clampStat(value, -maxChange, maxChange);

  if (stat === 'hp') {
    const delta = operation === 'subtract' ? -clampedValue : clampedValue;
    updateHP(state, delta);
  } else if (stat === 'qi') {
    const delta = operation === 'subtract' ? -clampedValue : clampedValue;
    updateQi(state, delta);
  } else if (stat === 'stamina') {
    const delta = operation === 'subtract' ? -clampedValue : clampedValue;
    updateStamina(state, delta);
  } else if (stat === 'hp_max') {
    if (operation === 'add') {
      state.stats.hp_max += Math.min(clampedValue, 50);
    }
  } else if (stat === 'qi_max') {
    if (operation === 'add') {
      state.stats.qi_max += Math.min(clampedValue, 100);
    }
  }
}

function applyAttrDelta(
  state: GameState,
  attr: string,
  operation: string,
  value: number
): void {
  const maxChange = 5; // Max attr change per turn
  const clampedValue = clampStat(value, 0, maxChange);

  const attrs: any = state.attrs;
  if (attrs[attr] !== undefined && operation === 'add') {
    attrs[attr] += clampedValue;
  }
}

function applyProgressDelta(
  state: GameState,
  field: string,
  operation: string,
  value: number
): void {
  if (field === 'cultivation_exp' && operation === 'add') {
    const maxExpGain = 50;
    const clampedValue = Math.min(value, maxExpGain);
    state.progress.cultivation_exp += clampedValue;
  }
}

function applyInventoryDelta(
  state: GameState,
  field: string,
  operation: string,
  value: any,
  rng: any,
  events: GameEvent[]
): void {
  if (field === 'silver') {
    if (operation === 'add') {
      state.inventory.silver += Math.min(value as number, 500);
    } else if (operation === 'subtract') {
      state.inventory.silver = Math.max(
        0,
        state.inventory.silver - (value as number)
      );
    }
  } else if (field === 'spirit_stones') {
    if (operation === 'add') {
      state.inventory.spirit_stones += Math.min(value as number, 20);
    }
  } else if (field === 'add_item') {
    // Add item to inventory - stack if duplicate
    if (typeof value === 'object' && value.id) {
      const existingItem = state.inventory.items.find(
        (item) => item.id === value.id && item.type === value.type
      );
      
      if (existingItem) {
        // Stack the item
        existingItem.quantity += (value.quantity || 1);
      } else {
        // Add new item
        state.inventory.items.push({
          ...value,
          quantity: value.quantity || 1,
        });
      }
      
      events.push({
        type: 'loot',
        data: { item: value },
      });
    }
  } else if (field === 'loot') {
    // Generate loot from table
    if (typeof value === 'string') {
      const loot = generateLoot(value, rng, state.progress.realm === 'PhàmNhân' ? 'vi' : 'en');
      state.inventory.silver += loot.silver;
      state.inventory.spirit_stones += loot.spiritStones;
      
      // Stack items properly
      loot.items.forEach((item) => {
        const existingItem = state.inventory.items.find(
          (inv) => inv.id === item.id && inv.type === item.type
        );
        
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          state.inventory.items.push(item);
        }
      });

      events.push({
        type: 'loot',
        data: {
          silver: loot.silver,
          spiritStones: loot.spiritStones,
          items: loot.items,
        },
      });
    }
  }
}

function applyKarmaDelta(
  state: GameState,
  operation: string,
  value: number
): void {
  const maxChange = 20;
  const clampedValue = clampStat(value, -maxChange, maxChange);

  if (operation === 'add') {
    state.karma += clampedValue;
  } else if (operation === 'subtract') {
    state.karma -= clampedValue;
  }
}

/**
 * Update story summary
 */
function updateStorySummary(
  state: GameState,
  recentNarrative: string,
  locale: string
): void {
  // Simple summary update (in production, could use AI to summarize)
  const prefix =
    locale === 'vi'
      ? `${state.progress.realm} tầng ${state.progress.realm_stage}. `
      : `${state.progress.realm} stage ${state.progress.realm_stage}. `;

  const summary = state.story_summary + ' ' + recentNarrative.slice(0, 200);

  // Keep summary under 1000 chars
  if (summary.length > 1000) {
    state.story_summary = prefix + summary.slice(-800);
  } else {
    state.story_summary = summary;
  }
}
