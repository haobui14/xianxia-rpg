import { NextResponse } from "next/server";
import { runQueries, turnLogQueries, characterQueries } from "@/lib/database/queries";
import { generateAITurn, getFallbackResponse } from "@/lib/ai/agent";
import {
  GameState,
  ProposedDelta,
  ValidatedTurnResult,
  GameEvent,
  SectMembership,
  SectRank,
  Skill,
} from "@/types/game";
import {
  updateStamina,
  updateHP,
  updateQi,
  applyCost,
  canAffordCost,
  clampStat,
  performBreakthrough,
  canBreakthrough,
  performBodyBreakthrough,
  canBodyBreakthrough,
  calculateCultivationExpGain,
  advanceTime,
} from "@/lib/game/mechanics";
import { createTurnRNG } from "@/lib/game/rng";
import { getApplicableTemplates, selectRandomTemplate } from "@/lib/game/scenes";
import { generateLoot, validateLoot } from "@/lib/game/loot";
import {
  recordCombatHistory,
  updatePlayerStats,
  syncInventoryToTables,
  syncSkillsToTables,
  syncTechniquesToTables,
} from "@/lib/database/syncHelper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, choiceId, selectedChoice } = body;

    if (!runId) {
      return NextResponse.json({ error: "Run ID required" }, { status: 400 });
    }

    // Load run
    const run = await runQueries.getById(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const state: GameState = run.current_state as GameState;
    const locale = run.locale;
    const turnNo = state.turn_count + 1;

    // Migration: Add elements field to techniques that don't have it
    if (state.techniques) {
      state.techniques = state.techniques.map((tech) => {
        if (!tech.elements) {
          // Default to character's first spirit root element if not specified
          return { ...tech, elements: [state.spirit_root.elements[0]] };
        }
        return tech;
      });
    }

    // Migration: Initialize market for existing games
    if (!state.market) {
      state.market = {
        items: [],
        last_regenerated: new Date().toISOString(),
        next_regeneration: {
          month: (state.time_month % 12) + 1,
          year: state.time_month === 12 ? state.time_year + 1 : state.time_year,
        },
      };
    }

    // Migration: Add equipment_slot to accessories that don't have it
    state.inventory.items = state.inventory.items.map((item) => {
      if (item.type === "Accessory" && !item.equipment_slot) {
        return { ...item, equipment_slot: "Accessory" };
      }
      return item;
    });

    // Migration: Move incorrectly stored techniques/skills from inventory to proper arrays
    const techniqueTypes = ["Main", "Support"];
    const skillTypes = ["Attack", "Defense", "Movement"];

    const misplacedTechniques = state.inventory.items.filter((item) =>
      techniqueTypes.includes(item.type)
    );
    const misplacedSkills = state.inventory.items.filter((item) => skillTypes.includes(item.type));

    if (misplacedTechniques.length > 0) {
      console.log(
        `Found ${misplacedTechniques.length} techniques incorrectly stored as items, migrating...`
      );
      misplacedTechniques.forEach((item) => {
        // Check if not already in techniques array
        const alreadyExists = state.techniques.some(
          (t) => t.id === item.id || t.name === item.name
        );
        if (!alreadyExists) {
          // Convert item to technique format
          const grade: "Mortal" | "Earth" | "Heaven" =
            item.rarity === "Rare" || item.rarity === "Epic"
              ? "Earth"
              : item.rarity === "Legendary"
                ? "Heaven"
                : "Mortal";

          const technique = {
            id: item.id,
            name: item.name,
            name_en: item.name_en || item.name,
            description: item.description,
            description_en: item.description_en || item.description,
            grade,
            type: item.type as "Main" | "Support",
            elements: [state.spirit_root.elements[0]], // Default to character's element
            cultivation_speed_bonus:
              item.rarity === "Legendary"
                ? 40
                : item.rarity === "Epic"
                  ? 25
                  : item.rarity === "Rare"
                    ? 15
                    : 10,
          };
          state.techniques.push(technique);
        }
      });
    }

    if (misplacedSkills.length > 0) {
      console.log(
        `Found ${misplacedSkills.length} skills incorrectly stored as items, migrating...`
      );
      misplacedSkills.forEach((item) => {
        const alreadyExists = state.skills.some((s) => s.id === item.id || s.name === item.name);
        if (!alreadyExists) {
          // Default skill type based on name/description or default to 'attack'
          let skillType: "attack" | "defense" | "support" = "attack";
          const nameLower = (item.name || item.name_en || "").toLowerCase();
          const descLower = (item.description || item.description_en || "").toLowerCase();

          if (
            nameLower.includes("defend") ||
            nameLower.includes("shield") ||
            nameLower.includes("block") ||
            descLower.includes("defend") ||
            descLower.includes("shield") ||
            descLower.includes("protect")
          ) {
            skillType = "defense";
          } else if (
            nameLower.includes("heal") ||
            nameLower.includes("buff") ||
            nameLower.includes("support") ||
            descLower.includes("heal") ||
            descLower.includes("buff") ||
            descLower.includes("support")
          ) {
            skillType = "support";
          }

          const skill: Skill = {
            id: item.id,
            name: item.name,
            name_en: item.name_en || item.name,
            description: item.description,
            description_en: item.description_en || item.description,
            type: skillType,
            level: 1,
            max_level: 10,
            damage_multiplier: skillType === "attack" ? 1.5 : 1.0,
            qi_cost: 10,
            cooldown: 2,
          };
          state.skills.push(skill);
        }
      });
    }

    // Remove misplaced techniques/skills from inventory
    if (misplacedTechniques.length > 0 || misplacedSkills.length > 0) {
      state.inventory.items = state.inventory.items.filter(
        (item) => !techniqueTypes.includes(item.type) && !skillTypes.includes(item.type)
      );
      console.log(
        `Cleaned up inventory, removed ${misplacedTechniques.length + misplacedSkills.length} misplaced items`
      );
    }

    // Create RNG for this turn
    const rng = createTurnRNG(run.world_seed, turnNo);

    // Get recent narratives for context (increased from 3 to 5 for better anti-repetition)
    const recentLogs = await turnLogQueries.getLastTurns(runId, 5);
    const recentNarratives = recentLogs.map((log) => log.narrative);

    // Track recent scene types to avoid repetition
    const recentSceneTypes = recentLogs
      .map((log) => (log.ai_json as any)?.sceneType)
      .filter(Boolean);

    // Apply choice costs immediately (before AI generation)
    const events: GameEvent[] = [];
    if (selectedChoice && selectedChoice.cost) {
      if (selectedChoice.cost.stamina) {
        applyStatDelta(state, "stamina", "subtract", selectedChoice.cost.stamina);
        // Update last_stamina_regen timestamp when stamina changes
        state.last_stamina_regen = new Date().toISOString();
      }
      if (selectedChoice.cost.qi) {
        applyStatDelta(state, "qi", "subtract", selectedChoice.cost.qi);
      }
      if (selectedChoice.cost.silver) {
        state.inventory.silver = Math.max(0, state.inventory.silver - selectedChoice.cost.silver);
      }
      if (selectedChoice.cost.spirit_stones) {
        state.inventory.spirit_stones = Math.max(
          0,
          state.inventory.spirit_stones - selectedChoice.cost.spirit_stones
        );
      }
      if (selectedChoice.cost.time_segments) {
        advanceTime(state, selectedChoice.cost.time_segments);
      }
    }

    // Select scene template if starting new scene
    let sceneContext = "";
    let selectedSceneType = "";
    if (!choiceId || state.turn_count === 0) {
      const applicableTemplates = getApplicableTemplates(state);

      // Filter out recently used scene types to increase variety
      const filteredTemplates = applicableTemplates.filter((t) => !recentSceneTypes.includes(t.id));

      // Use filtered templates if available, otherwise fall back to all
      const templatesToUse = filteredTemplates.length > 2 ? filteredTemplates : applicableTemplates;
      const template = selectRandomTemplate(templatesToUse, rng);

      if (template) {
        sceneContext = template.getPromptContext(state, locale);
        selectedSceneType = template.id;
      } else {
        sceneContext =
          locale === "vi"
            ? "Nhân vật đang ở trong một khu vực yên tĩnh."
            : "The character is in a quiet area.";
      }
    } else {
      sceneContext =
        locale === "vi"
          ? `Tiếp tục từ lựa chọn: ${selectedChoice?.text || choiceId}`
          : `Continuing from choice: ${selectedChoice?.text || choiceId}`;
    }

    // Get the actual choice text for custom actions
    const choiceText = selectedChoice?.text || null;

    // Call AI
    let aiResult;
    try {
      aiResult = await generateAITurn(
        state,
        recentNarratives,
        sceneContext,
        choiceId,
        locale,
        choiceText
      );
    } catch (error) {
      console.error("AI generation failed, using fallback:", error);
      aiResult = getFallbackResponse(state, locale);
    }

    // Add AI events to existing events from costs
    events.push(...aiResult.events);

    // Validate and apply deltas from AI
    console.log(`AI proposed ${aiResult.proposed_deltas?.length || 0} deltas`);
    applyValidatedDeltas(state, aiResult.proposed_deltas, rng, events);

    // Check for breakthrough
    if (canBreakthrough(state)) {
      const breakthroughSuccess = performBreakthrough(state);
      if (breakthroughSuccess) {
        events.push({
          type: "breakthrough",
          data: {
            realm: state.progress.realm,
            stage: state.progress.realm_stage,
          },
        });
      }
    }

    // Check for body cultivation breakthrough
    if (canBodyBreakthrough(state)) {
      const bodyBreakthroughSuccess = performBodyBreakthrough(state);
      if (bodyBreakthroughSuccess) {
        events.push({
          type: "body_breakthrough",
          data: {
            realm: state.progress.body_realm,
            stage: state.progress.body_stage,
          },
        });
      }
    }

    // Update story summary every 10 turns
    if (turnNo % 10 === 0) {
      updateStorySummary(state, aiResult.narrative, locale);
    }

    // Record combat events to history table
    const combatEvents = events.filter((e) => e.type === "combat");
    for (const event of combatEvents) {
      if (event.data.enemy && event.data.victory !== undefined) {
        await recordCombatHistory(
          runId,
          event.data.enemy.id || "unknown",
          event.data.enemy.name || "Unknown Enemy",
          event.data.victory,
          event.data.playerDamage || 0,
          event.data.enemyDamage || 0,
          event.data.loot || {},
          {
            year: state.time_year,
            month: state.time_month,
            day: state.time_day,
          },
          turnNo
        );
      }
    }

    // Update leaderboard statistics
    const character = await characterQueries.getById(run.character_id);
    if (character) {
      const combatWins = combatEvents.filter((e) => e.data.victory === true).length;
      await updatePlayerStats(runId, character.name, state, combatWins);
    }

    // Sync to normalized tables (optional - don't fail if functions don't exist)
    try {
      await syncInventoryToTables(runId, state.inventory, state.equipped_items);
      await syncSkillsToTables(runId, state.skills);
      await syncTechniquesToTables(runId, state.techniques);
    } catch (err) {
      // Ignore sync errors - this is optional functionality
      console.log("Table sync skipped (function not available)");
    }

    // Update turn count in state
    state.turn_count = turnNo;

    // Save state with retry logic
    console.log(
      `Saving state - Skills: ${state.skills?.length || 0}, Techniques: ${state.techniques?.length || 0}`
    );
    const saveResult = await runQueries.update(runId, state);

    // Track save status in response
    if (!saveResult.success) {
      console.error(`[Turn] State save failed: ${saveResult.error}`);
      // Add save failure event to notify frontend
      events.push({
        type: "status_effect",
        data: {
          type: "save_warning",
          message: saveResult.error || "Failed to save progress",
        },
      });
    }

    // Save turn log with scene type for future anti-repetition
    await turnLogQueries.create(runId, turnNo, choiceId, aiResult.narrative, {
      ...aiResult,
      sceneType: selectedSceneType,
    });

    // Return result with save status
    const result: ValidatedTurnResult = {
      narrative: aiResult.narrative,
      choices: aiResult.choices,
      state,
      events,
      turn_no: turnNo,
      saveStatus: saveResult,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing turn:", error);
    return NextResponse.json({ error: "Failed to process turn" }, { status: 500 });
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
      console.error("Failed to apply delta:", delta, error);
    }
  }
}

/**
 * Apply a single delta with validation
 */
function applyDelta(state: GameState, delta: ProposedDelta, rng: any, events: GameEvent[]): void {
  const { field, operation, value } = delta;

  // Log skill/technique additions
  if (field.startsWith("skills.") || field.startsWith("techniques.")) {
    console.log(`Applying delta: ${field} ${operation}`, value?.name || value?.id);
  }

  // Parse field path (e.g., "stats.hp", "inventory.silver")
  const parts = field.split(".");

  if (parts[0] === "stats") {
    applyStatDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === "attrs") {
    applyAttrDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === "progress") {
    applyProgressDelta(state, parts[1], operation, value as number);
  } else if (parts[0] === "inventory") {
    applyInventoryDelta(state, parts[1], operation, value, rng, events);
  } else if (parts[0] === "karma") {
    applyKarmaDelta(state, operation, value as number);
  } else if (parts[0] === "techniques") {
    applyTechniqueDelta(state, parts[1], operation, value);
  } else if (parts[0] === "skills") {
    applySkillDelta(state, parts[1], operation, value);
  } else if (parts[0] === "sect") {
    applySectDelta(state, parts[1], operation, value, events);
  } else if (parts[0] === "location") {
    applyLocationDelta(state, parts[1], operation, value);
  }
}

function applyStatDelta(state: GameState, stat: string, operation: string, value: number): void {
  const maxChange = 100; // Max change per turn
  const clampedValue = clampStat(value, -maxChange, maxChange);

  if (stat === "hp") {
    const delta = operation === "subtract" ? -clampedValue : clampedValue;
    updateHP(state, delta);
  } else if (stat === "qi") {
    const delta = operation === "subtract" ? -clampedValue : clampedValue;
    updateQi(state, delta);
  } else if (stat === "stamina") {
    const delta = operation === "subtract" ? -clampedValue : clampedValue;
    updateStamina(state, delta);
  } else if (stat === "hp_max") {
    if (operation === "add") {
      state.stats.hp_max += Math.min(clampedValue, 50);
    }
  } else if (stat === "qi_max") {
    if (operation === "add") {
      state.stats.qi_max += Math.min(clampedValue, 100);
    }
  }
}

function applyAttrDelta(state: GameState, attr: string, operation: string, value: number): void {
  const maxChange = 5; // Max attr change per turn
  const clampedValue = clampStat(value, 0, maxChange);

  const attrs: any = state.attrs;
  if (attrs[attr] !== undefined && operation === "add") {
    attrs[attr] += clampedValue;
  }
}

function applyProgressDelta(
  state: GameState,
  field: string,
  operation: string,
  value: number
): void {
  if (field === "cultivation_exp" && operation === "add") {
    const maxExpGain = 100; // Increased from 50 for faster progression
    const clampedValue = Math.min(value, maxExpGain);
    // Apply spirit root bonus to cultivation exp gain
    const bonusedExp = calculateCultivationExpGain(state, clampedValue);

    // Check if dual cultivation is enabled
    if (state.progress.cultivation_path === "dual") {
      // Fixed 70/30 split: 70% Qi, 30% Body
      const qiExp = Math.floor(bonusedExp * 0.7);
      const bodyExp = Math.floor(bonusedExp * 0.3);

      state.progress.cultivation_exp += qiExp;

      // Initialize body cultivation if not present
      if (!state.progress.body_exp) state.progress.body_exp = 0;
      if (!state.progress.body_realm) state.progress.body_realm = "PhàmThể";
      if (!state.progress.body_stage) state.progress.body_stage = 0;

      state.progress.body_exp += bodyExp;

      console.log(`Dual cultivation - Qi: ${qiExp} (70%), Body: ${bodyExp} (30%)`);
    } else {
      // Single cultivation path - all exp goes to Qi
      state.progress.cultivation_exp += bonusedExp;
    }
  } else if (field === "body_exp" && operation === "add") {
    // Direct body exp (legacy support, but shouldn't be used with dual cultivation)
    const maxExpGain = 100; // Increased from 50 for faster body cultivation
    const clampedValue = Math.min(value, maxExpGain);

    // Initialize body cultivation if not present
    if (!state.progress.body_exp) state.progress.body_exp = 0;
    if (!state.progress.body_realm) state.progress.body_realm = "PhàmThể";
    if (!state.progress.body_stage) state.progress.body_stage = 0;

    state.progress.body_exp += clampedValue;
    console.log(`Body exp gained: ${clampedValue}, total: ${state.progress.body_exp}`);
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
  if (field === "silver") {
    if (operation === "add") {
      state.inventory.silver += Math.min(value as number, 1000);
    } else if (operation === "subtract") {
      state.inventory.silver = Math.max(0, state.inventory.silver - (value as number));
    }
  } else if (field === "spirit_stones") {
    if (operation === "add") {
      state.inventory.spirit_stones += Math.min(value as number, 100);
    }
  } else if (field === "add_item") {
    // Add item to inventory - stack if duplicate
    if (typeof value === "object" && value.id) {
      // Validate: Don't add techniques/skills to inventory (they have their own arrays)
      if (["Main", "Support", "Attack", "Defense", "Movement"].includes(value.type)) {
        console.warn(
          `Ignoring ${value.type} type item in inventory.add_item - should use techniques/skills delta instead`
        );
        return;
      }

      const existingItem = state.inventory.items.find(
        (item) => item.id === value.id && item.type === value.type
      );

      if (existingItem) {
        // Stack the item
        existingItem.quantity += value.quantity || 1;
      } else {
        // Add new item
        state.inventory.items.push({
          ...value,
          quantity: value.quantity || 1,
        });
      }

      events.push({
        type: "loot",
        data: { item: value },
      });
    }
  } else if (field === "loot") {
    // Generate loot from table
    if (typeof value === "string") {
      const loot = generateLoot(value, rng, state.progress.realm === "PhàmNhân" ? "vi" : "en");
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
        type: "loot",
        data: {
          silver: loot.silver,
          spiritStones: loot.spiritStones,
          items: loot.items,
        },
      });
    }
  }
}

function applyKarmaDelta(state: GameState, operation: string, value: number): void {
  const maxChange = 20;
  const clampedValue = clampStat(value, -maxChange, maxChange);

  if (operation === "add") {
    state.karma += clampedValue;
  } else if (operation === "subtract") {
    state.karma -= clampedValue;
  }
}

function applyTechniqueDelta(state: GameState, field: string, operation: string, value: any): void {
  // Constants for technique limits
  const MAX_TECHNIQUES = 5;
  const MAX_PER_TYPE = 2; // Max 2 Main, 2 Support (but 5 total max)

  if (field === "add" && operation === "add") {
    // Validate technique structure
    if (value && value.id && value.name && value.name_en && value.grade && value.type) {
      // Initialize arrays if they don't exist
      if (!state.techniques) {
        state.techniques = [];
      }
      if (!state.technique_queue) {
        state.technique_queue = [];
      }

      // Check if technique already exists in active or queue
      const existsActive = state.techniques.some((t) => t.id === value.id);
      const existsQueue = state.technique_queue.some((t) => t.id === value.id);
      if (existsActive || existsQueue) {
        return; // Already have this technique
      }

      // Ensure elements field exists
      if (!value.elements) {
        value.elements = [];
      }
      // Ensure cultivation_speed_bonus exists (default based on grade)
      if (value.cultivation_speed_bonus === undefined) {
        const gradeBonus = { Mortal: 10, Earth: 20, Heaven: 40 };
        value.cultivation_speed_bonus = gradeBonus[value.grade as keyof typeof gradeBonus] || 10;
      }

      // Count techniques by type
      const techType = value.type as "Main" | "Support";
      const countByType = state.techniques.filter((t) => t.type === techType).length;

      // Check if we can add to active techniques
      if (state.techniques.length < MAX_TECHNIQUES && countByType < MAX_PER_TYPE) {
        state.techniques.push(value);
        console.log(
          `Added technique ${value.name} to active list (${state.techniques.length}/${MAX_TECHNIQUES})`
        );
      } else {
        // Add to queue
        state.technique_queue.push(value);
        console.log(
          `Added technique ${value.name} to queue (active full: ${state.techniques.length}/${MAX_TECHNIQUES}, type ${techType}: ${countByType}/${MAX_PER_TYPE})`
        );
      }
    }
  }
}

/**
 * Apply skill delta (combat skills)
 */
function applySkillDelta(state: GameState, field: string, operation: string, value: any): void {
  // Constants for skill limits: 6 total, max 2 per type
  const MAX_SKILLS = 6;
  const MAX_PER_TYPE = 2;

  if (field === "gain_exp" && operation === "add") {
    // Give exp to a specific skill
    if (value && value.skill_id && typeof value.exp === "number") {
      const skill = state.skills?.find((s) => s.id === value.skill_id);
      if (skill) {
        if (!skill.exp) skill.exp = 0;
        if (!skill.max_exp) skill.max_exp = skill.level * 100;

        const expGain = Math.min(value.exp, 50); // Cap at 50 per action
        skill.exp += expGain;

        // Handle level ups
        while (skill.exp >= skill.max_exp && skill.level < skill.max_level) {
          skill.exp -= skill.max_exp;
          skill.level += 1;
          skill.max_exp = skill.level * 100;
          skill.damage_multiplier = (skill.damage_multiplier || 1.5) * 1.05; // +5% per level
          console.log(`Skill ${skill.name} leveled up to ${skill.level}!`);
        }

        console.log(`Skill ${skill.name} gained ${expGain} exp (${skill.exp}/${skill.max_exp})`);
      } else {
        console.warn(`Skill not found: ${value.skill_id}`);
      }
    }
  } else if (field === "add" && operation === "add") {
    // Validate skill structure
    if (value && value.id && value.name && value.name_en && value.type) {
      // Initialize arrays if they don't exist
      if (!state.skills) {
        state.skills = [];
      }
      if (!state.skill_queue) {
        state.skill_queue = [];
      }

      // Check if skill already exists in active list
      const existingIndex = state.skills.findIndex((s) => s.id === value.id);
      if (existingIndex >= 0) {
        // Upgrade existing skill level
        const existingSkill = state.skills[existingIndex];
        if (existingSkill.level < existingSkill.max_level) {
          existingSkill.level += 1;
          // Increase damage multiplier slightly on level up
          existingSkill.damage_multiplier = (existingSkill.damage_multiplier || 1) * 1.1;
        }
        return;
      }

      // Check if skill exists in queue (upgrade if so)
      const queueIndex = state.skill_queue.findIndex((s) => s.id === value.id);
      if (queueIndex >= 0) {
        const queueSkill = state.skill_queue[queueIndex];
        if (queueSkill.level < queueSkill.max_level) {
          queueSkill.level += 1;
          queueSkill.damage_multiplier = (queueSkill.damage_multiplier || 1) * 1.1;
        }
        return;
      }

      // Create new skill object
      // Normalize type to lowercase to match the Skill interface ("attack" | "defense" | "support")
      const normalizedType = (value.type || "attack").toLowerCase() as "attack" | "defense" | "support";
      // Validate the type
      const validTypes = ["attack", "defense", "support"];
      const finalType = validTypes.includes(normalizedType) ? normalizedType : "attack";

      const newSkill: any = {
        id: value.id,
        name: value.name,
        name_en: value.name_en,
        description: value.description || "",
        description_en: value.description_en || "",
        type: finalType,
        element: value.element,
        level: value.level || 1,
        max_level: value.max_level || 10,
        damage_multiplier: value.damage_multiplier || 1.5,
        qi_cost: value.qi_cost || 10,
        cooldown: value.cooldown || 1,
        current_cooldown: 0, // Always start with 0 cooldown
        effects: value.effects,
      };

      // Count skills by type (normalize to lowercase for comparison)
      const skillType = (value.type || "").toLowerCase();
      const countByType = state.skills.filter(
        (s) => (s.type || "").toLowerCase() === skillType
      ).length;

      // Check if we can add to active skills
      if (state.skills.length < MAX_SKILLS && countByType < MAX_PER_TYPE) {
        state.skills.push(newSkill);
        console.log(
          `Added skill ${value.name} to active list (${state.skills.length}/${MAX_SKILLS})`
        );
      } else {
        // Add to queue
        state.skill_queue.push(newSkill);
        console.log(
          `Added skill ${value.name} to queue (active full: ${state.skills.length}/${MAX_SKILLS}, type ${skillType}: ${countByType}/${MAX_PER_TYPE})`
        );
      }
    }
  }
}

/**
 * Apply location-related delta (change place or region)
 */
function applyLocationDelta(state: GameState, field: string, operation: string, value: any): void {
  if (operation === "set") {
    if (field === "place" && typeof value === "string") {
      state.location.place = value;
      console.log(`Location changed to: ${value}`);
    } else if (field === "region" && typeof value === "string") {
      state.location.region = value;
      console.log(`Region changed to: ${value}`);
    }
  }
}

/**
 * Apply sect-related delta (join, leave, promote, contribution)
 */
function applySectDelta(
  state: GameState,
  field: string,
  operation: string,
  value: any,
  events: GameEvent[]
): void {
  const validRanks: SectRank[] = ["NgoạiMôn", "NộiMôn", "ChânTruyền", "TrưởngLão", "ChưởngMôn"];

  if (field === "join" && operation === "set") {
    // Joining a new sect
    if (value && value.sect) {
      const membership: SectMembership = {
        sect: {
          id: value.sect.id || `sect_${Date.now()}`,
          name: value.sect.name,
          name_en: value.sect.name_en || value.sect.name,
          type: value.sect.type || "Tổng",
          element: value.sect.element,
          tier: value.sect.tier || 1,
          description: value.sect.description,
          description_en: value.sect.description_en,
        },
        rank: (value.rank as SectRank) || "NgoạiMôn",
        contribution: value.contribution || 0,
        reputation: value.reputation || 50,
        joined_date: new Date().toISOString(),
        missions_completed: 0,
        mentor: value.mentor,
        mentor_en: value.mentor_en,
        benefits: {
          cultivation_bonus: value.benefits?.cultivation_bonus || 5,
          resource_access: value.benefits?.resource_access || false,
          technique_access: value.benefits?.technique_access || false,
          protection: value.benefits?.protection || true,
        },
      };

      state.sect_membership = membership;
      // Legacy support
      state.sect = membership.sect.name;
      state.sect_en = membership.sect.name_en;

      events.push({
        type: "sect_join",
        data: { sect: membership.sect, rank: membership.rank },
      });
      console.log(`Joined sect: ${membership.sect.name} as ${membership.rank}`);
    }
  } else if (field === "leave" && operation === "set") {
    // Leaving the sect
    if (state.sect_membership) {
      const oldSect = state.sect_membership.sect.name;
      state.sect_membership = undefined;
      state.sect = undefined;
      state.sect_en = undefined;
      events.push({
        type: "sect_expulsion",
        data: { sect: oldSect, reason: value?.reason || "voluntary" },
      });
      console.log(`Left sect: ${oldSect}`);
    }
  } else if (field === "promote" && operation === "set") {
    // Promotion to new rank
    if (state.sect_membership && validRanks.includes(value as SectRank)) {
      const oldRank = state.sect_membership.rank;
      state.sect_membership.rank = value as SectRank;

      // Update benefits based on new rank
      const rankBenefits: Record<
        SectRank,
        {
          cultivation_bonus: number;
          resource_access: boolean;
          technique_access: boolean;
          protection: boolean;
        }
      > = {
        NgoạiMôn: {
          cultivation_bonus: 5,
          resource_access: false,
          technique_access: false,
          protection: true,
        },
        NộiMôn: {
          cultivation_bonus: 10,
          resource_access: true,
          technique_access: false,
          protection: true,
        },
        ChânTruyền: {
          cultivation_bonus: 20,
          resource_access: true,
          technique_access: true,
          protection: true,
        },
        TrưởngLão: {
          cultivation_bonus: 30,
          resource_access: true,
          technique_access: true,
          protection: true,
        },
        ChưởngMôn: {
          cultivation_bonus: 50,
          resource_access: true,
          technique_access: true,
          protection: true,
        },
      };
      state.sect_membership.benefits = rankBenefits[value as SectRank];

      events.push({
        type: "sect_promotion",
        data: {
          oldRank,
          newRank: value,
          sect: state.sect_membership.sect.name,
        },
      });
      console.log(`Promoted from ${oldRank} to ${value}`);
    }
  } else if (field === "contribution" && operation === "add") {
    // Adding contribution points
    if (state.sect_membership && typeof value === "number") {
      const maxContribution = 100; // Max contribution per turn
      const clampedValue = Math.min(Math.abs(value), maxContribution);
      state.sect_membership.contribution += clampedValue;
      console.log(`Added ${clampedValue} sect contribution`);
    }
  } else if (field === "reputation" && operation === "add") {
    // Adjusting reputation within sect
    if (state.sect_membership && typeof value === "number") {
      state.sect_membership.reputation = Math.max(
        0,
        Math.min(100, state.sect_membership.reputation + value)
      );
      console.log(`Sect reputation changed by ${value}, now ${state.sect_membership.reputation}`);
    }
  } else if (field === "mission" && operation === "add") {
    // Completing a mission
    if (state.sect_membership && typeof value === "number") {
      state.sect_membership.missions_completed += 1;
      state.sect_membership.contribution += value;
      events.push({
        type: "sect_mission",
        data: {
          reward: value,
          totalMissions: state.sect_membership.missions_completed,
        },
      });
      console.log(`Completed sect mission, +${value} contribution`);
    }
  }
}

/**
 * Update story summary
 */
function updateStorySummary(state: GameState, recentNarrative: string, locale: string): void {
  // Simple summary update (in production, could use AI to summarize)
  const prefix =
    locale === "vi"
      ? `${state.progress.realm} tầng ${state.progress.realm_stage}. `
      : `${state.progress.realm} stage ${state.progress.realm_stage}. `;

  const summary = state.story_summary + " " + recentNarrative.slice(0, 200);

  // Keep summary under 1000 chars
  if (summary.length > 1000) {
    state.story_summary = prefix + summary.slice(-800);
  } else {
    state.story_summary = summary;
  }
}
