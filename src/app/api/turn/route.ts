import { NextResponse } from "next/server";
import { runQueries, turnLogQueries } from "@/lib/database/queries";
import { generateAITurn, getFallbackResponse } from "@/lib/ai/agent";
import {
  GameState,
  ProposedDelta,
  ValidatedTurnResult,
  GameEvent,
  SectMembership,
  SectRank,
  Skill,
  KnownNPC,
  StoryArc,
} from "@/types/game";
import {
  updateStamina,
  updateHP,
  updateQi,
  clampStat,
  performBreakthrough,
  canBreakthrough,
  performBodyBreakthrough,
  canBodyBreakthrough,
  calculateCultivationExpGain,
  advanceTime,
  refreshLifespanForRealm,
} from "@/lib/game/mechanics";
import { createTurnRNG } from "@/lib/game/rng";
import { getApplicableTemplates, selectRandomTemplate } from "@/lib/game/scenes";
import { generateLoot, resolveLootTable } from "@/lib/game/loot";
import {
  initialRelationsForSect,
  initialRelationsForSectByType,
  getSectById,
} from "@/lib/game/sects";
import { mostHostileRival, resolveSectMissions } from "@/lib/game/sect-missions";
import { abortWarOnSectLeave, tryResolveWar, tryStartWar } from "@/lib/game/sect-wars";
import { calculateTotalAttributes } from "@/lib/game/equipment";
import { REGIONS } from "@/lib/world/regions";
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

    // Load run (with character) and recent turn logs in parallel — they only
    // need runId, so there is no reason to serialize the two round trips.
    const [run, recentLogs] = await Promise.all([
      runQueries.getByIdWithCharacter(runId),
      turnLogQueries.getLastTurns(runId, 3).catch(() => []),
    ]);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const characterName = run.character?.name;

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

    // Recent narratives for context (fetched above in parallel). Only the most
    // recent is sent verbatim in buildGameContext; the older ones are compacted
    // to 140-char previews for anti-repetition signal without blowing up tokens.
    const recentNarratives = recentLogs.map((log) => log.narrative);

    // Track recent scene types to avoid repetition
    const recentSceneTypes = recentLogs
      .map((log) => (log.ai_json as any)?.sceneType)
      .filter(Boolean);

    // Stagnation breaker: if the last 3 turns produced no movement, no combat
    // encounter and no arc progress, force a fresh narrative beat this turn.
    let beatDirective = "";
    if (recentLogs.length >= 3) {
      const stagnant = recentLogs.every((log) => {
        const ai = log.ai_json as any;
        const deltas: any[] = ai?.proposed_deltas || [];
        const evts: any[] = ai?.events || [];
        const moved = deltas.some(
          (d) => d?.field === "location.place" || d?.field === "location.region"
        );
        const fought = evts.some((e) => e?.type === "combat_encounter");
        const arcMoved = deltas.some(
          (d) => typeof d?.field === "string" && d.field.startsWith("arc.")
        );
        return !moved && !fought && !arcMoved;
      });
      if (stagnant) {
        const beats =
          locale === "vi"
            ? [
                "một nhân vật (ưu tiên Nhân vật quen) xuất hiện với yêu cầu khẩn cấp",
                "tin đồn về cơ duyên tại một khu vực THẬT từ 'Lối đi' — kèm lựa chọn đi ngay",
                "kẻ thù hoặc đối thủ cũ xuất hiện gây sự (combat_encounter nếu giao chiến)",
                "dị tượng thiên địa / biến cố môi trường buộc phải hành động ngay",
                "thương đoàn, chợ phiên hoặc sự kiện đông người đặc biệt đang diễn ra",
                "manh mối mới cho tuyến truyện đang mở (arc.advance) hoặc mở arc mới",
              ]
            : [
                "a character (prefer a Known NPC) arrives with an urgent request",
                "a rumor about an opportunity at a REAL area from 'Paths' — include a go-now choice",
                "an old enemy or rival shows up to cause trouble (combat_encounter if it comes to blows)",
                "a heavenly phenomenon / environmental event forces immediate action",
                "a merchant caravan, fair, or unusual public gathering is underway",
                "a fresh clue for an open story arc (arc.advance) or open a new arc",
              ];
        const beat = beats[rng.randomInt(0, beats.length - 1)];
        beatDirective =
          locale === "vi"
            ? `🎬 CHỐNG TRÌ TRỆ: 3 lượt qua không có biến chuyển lớn. Lượt này BẮT BUỘC có: ${beat}.`
            : `🎬 ANTI-STAGNATION: the last 3 turns had no major development. This turn MUST feature: ${beat}.`;
        console.log("[Turn] Stagnation detected, injecting beat directive");
      }
    }

    // Arc seeding: with no open arc the story drifts — direct the AI to open
    // one themed to the player's current realm.
    const activeArcCount = (state.story_arcs || []).filter((a) => a.status === "active").length;
    if (activeArcCount === 0 && turnNo >= 3) {
      const arcThemes: Record<string, { vi: string; en: string }> = {
        PhàmNhân: {
          vi: "bước chân vào con đường tu tiên (bái sư, công pháp đầu tiên, gia nhập tông môn)",
          en: "first steps onto the cultivation path (find a master, a first technique, join a sect)",
        },
        LuyệnKhí: {
          vi: "khẳng định bản thân (đối thủ đồng lứa, bí mật linh căn, thử thách tông môn)",
          en: "proving oneself (a same-generation rival, a spirit-root secret, a sect trial)",
        },
        TrúcCơ: {
          vi: "danh tiếng và hiểm họa khu vực (truy tìm công pháp địa giai, thế lực hắc ám trỗi dậy)",
          en: "regional fame and threats (hunt an earth-grade technique, a dark force rising)",
        },
        KếtĐan: {
          vi: "tranh đoạt thiên tài địa bảo, ân oán đại tông môn, bí cảnh thượng cổ",
          en: "contesting heavenly treasures, great-sect feuds, an ancient secret realm",
        },
        NguyênAnh: {
          vi: "chuẩn bị thiên kiếp phi thăng, di sản thượng giới, đại địch cuối cùng",
          en: "ascension tribulation prep, a higher-world legacy, one final nemesis",
        },
      };
      const theme = arcThemes[state.progress.realm] || arcThemes.PhàmNhân;
      const seed =
        locale === "vi"
          ? `📖 KHÔNG có tuyến truyện đang mở — lượt này PHẢI mở arc mới (arc.start) theo chủ đề cảnh giới: ${theme.vi}.`
          : `📖 NO story arc is open — this turn MUST open a new arc (arc.start) themed to the realm: ${theme.en}.`;
      beatDirective = beatDirective ? `${beatDirective}\n${seed}` : seed;
    }

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
        choiceText,
        beatDirective
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

    // Resolve active sect missions (may grant contribution/rewards, push
    // sect_mission events for completion/failure).
    if (state.sect_missions && state.sect_missions.length > 0) {
      const missionEvents = resolveSectMissions(state, aiResult.proposed_deltas, events);
      events.push(...missionEvents);
    }

    // Resolve finished sect war (must run BEFORE the scheduler so a new
    // war isn't started on the same turn the old one ends).
    const warEnded = tryResolveWar(state);
    if (warEnded) events.push(warEnded);

    // Scheduler: maybe start a new war if conditions hold.
    const warStarted = tryStartWar(state, () => rng.random());
    if (warStarted) events.push(warStarted.event);

    // Rival ambush: if player has a strongly hostile rival sect, a ~8% chance
    // per turn of being ambushed — unless already in dungeon or already
    // facing a combat encounter this turn.
    const alreadyInCombat = events.some((e) => e.type === "combat_encounter");
    const inDungeon = Boolean(state.dungeon?.dungeon_id);
    if (!alreadyInCombat && !inDungeon && state.sect_membership) {
      const hostile = mostHostileRival(state);
      if (hostile && rng.random() < 0.08) {
        const rivalSect = getSectById(hostile.sect_id);
        if (rivalSect) {
          // Use total attrs (base + equipment) so the ambush scales against
          // the player's actual build, not the bare attribute stat.
          const totalAttrs = calculateTotalAttributes(state);
          const phys = Math.floor(totalAttrs.str * 1.5);
          const def = Math.floor(5 + totalAttrs.agi / 3);
          const hp = Math.max(30, Math.floor(phys * 2.5));
          events.push({
            type: "combat_encounter",
            data: {
              enemy: {
                id: `rival_${rivalSect.id}_${turnNo}`,
                name: `Đệ tử ${rivalSect.name}`,
                name_en: `${rivalSect.name_en} Disciple`,
                hp,
                hp_max: hp,
                atk: Math.max(5, Math.floor(phys * 0.9)),
                def: Math.max(2, Math.floor(def * 0.9)),
                behavior: "Aggressive",
                loot_table_id: "rare_loot",
                rival_sect_id: rivalSect.id,
                enemy_sect_id: rivalSect.id,
              },
              reason: "rival_ambush",
            },
          });
        }
      }
    }

    // Auto-advance every breakthrough earned this turn (Qi + Body).
    // Loops so a big exp spike that crosses multiple stages doesn't stall on
    // the cap.
    while (canBreakthrough(state)) {
      if (!performBreakthrough(state)) break;
      events.push({
        type: "breakthrough",
        data: {
          realm: state.progress.realm,
          stage: state.progress.realm_stage,
        },
      });
    }

    while (canBodyBreakthrough(state)) {
      if (!performBodyBreakthrough(state)) break;
      events.push({
        type: "body_breakthrough",
        data: {
          realm: state.progress.body_realm,
          stage: state.progress.body_stage,
        },
      });
    }

    // Realm breakthroughs extend lifespan — keep the numbers in sync
    if (events.some((e) => e.type === "breakthrough")) {
      refreshLifespanForRealm(state);
    }

    // Win condition: first arrival at peak Nguyên Anh (final realm, stage 9)
    if (
      state.progress.realm === "NguyênAnh" &&
      state.progress.realm_stage >= 9 &&
      !state.flags.peak_realm_reached
    ) {
      state.flags.peak_realm_reached = true;
      events.push({
        type: "quest_update",
        data: {
          milestone: "peak_realm",
          realm: state.progress.realm,
          stage: state.progress.realm_stage,
        },
      });
    }

    // Append any milestones earned this turn to the rolling story summary
    updateStorySummary(state, events, aiResult.proposed_deltas, locale, turnNo);

    // Update turn count in state before saving
    state.turn_count = turnNo;

    // === CRITICAL SAVES (must complete before response) ===
    console.log(
      `Saving state - Skills: ${state.skills?.length || 0}, Techniques: ${state.techniques?.length || 0}`
    );

    // Run the two critical saves in parallel
    const [saveResult] = await Promise.all([
      runQueries.update(runId, state),
      turnLogQueries.create(runId, turnNo, choiceId, aiResult.narrative, {
        ...aiResult,
        sceneType: selectedSceneType,
      }),
    ]);

    // Track save status in response
    if (!saveResult.success) {
      console.error(`[Turn] State save failed: ${saveResult.error}`);
      events.push({
        type: "status_effect",
        data: {
          type: "save_warning",
          message: saveResult.error || "Failed to save progress",
        },
      });
    }

    // === FIRE-AND-FORGET OPERATIONS (don't block response) ===
    // These are optional and can complete after response is sent
    const combatEvents = events.filter((e) => e.type === "combat");
    const combatWins = combatEvents.filter((e) => e.data.victory === true).length;

    // Launch all optional operations without awaiting
    // This significantly reduces response time
    Promise.all([
      // Sync to normalized tables
      syncInventoryToTables(runId, state.inventory, state.equipped_items).catch(() => {}),
      syncSkillsToTables(runId, state.skills).catch(() => {}),
      syncTechniquesToTables(runId, state.techniques).catch(() => {}),
      // Update leaderboard (using character name from combined query - no extra DB call!)
      characterName
        ? updatePlayerStats(runId, characterName, state, combatWins).catch(() => {})
        : Promise.resolve(),
      // Record combat history
      ...combatEvents
        .filter((event) => event.data.enemy && event.data.victory !== undefined)
        .map((event) =>
          recordCombatHistory(
            runId,
            event.data.enemy.id || "unknown",
            event.data.enemy.name || "Unknown Enemy",
            event.data.victory,
            event.data.playerDamage || 0,
            event.data.enemyDamage || 0,
            event.data.loot || {},
            { year: state.time_year, month: state.time_month, day: state.time_day },
            turnNo
          ).catch(() => {})
        ),
    ]).catch(() => {
      // Ignore all errors from fire-and-forget operations
      console.log("Some background sync operations failed (non-critical)");
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
    const shape: string[] = [];
    if (value && typeof value === "object") {
      if (value.grade) shape.push(`grade=${value.grade}`);
      if (value.cultivation_speed_bonus !== undefined)
        shape.push(`cult_speed=${value.cultivation_speed_bonus}`);
      if (value.type) shape.push(`type=${value.type}`);
      if (value.damage_multiplier !== undefined) shape.push(`dmg=${value.damage_multiplier}`);
      if (value.qi_cost !== undefined) shape.push(`qi=${value.qi_cost}`);
      if (value.cooldown !== undefined) shape.push(`cd=${value.cooldown}`);
    }
    console.log(
      `Applying delta: ${field} ${operation}`,
      value?.name || value?.id,
      shape.length ? `[${shape.join(", ")}]` : ""
    );
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
  } else if (parts[0] === "add_item" || parts[0] === "loot") {
    // The prompt's output examples use the bare forms ("add_item" / "loot");
    // without this alias those deltas were silently dropped.
    applyInventoryDelta(state, parts[0], operation, value, rng, events);
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
  } else if (parts[0] === "npc") {
    applyNpcDelta(state, parts[1], value);
  } else if (parts[0] === "arc") {
    applyArcDelta(state, parts[1], value, events);
  }
}

/**
 * Persistent NPC registry — lets the narrative reuse characters across turns.
 * Operation-agnostic: the field name decides the action.
 */
function applyNpcDelta(state: GameState, field: string, value: any): void {
  if (!value || typeof value !== "object") return;
  state.npcs ||= [];
  const turn = state.turn_count + 1;
  const clampRel = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));

  const findNpc = () =>
    state.npcs!.find(
      (n) =>
        (value.id && n.id === value.id) ||
        (value.name && n.name === value.name) ||
        (value.name_en && n.name_en === value.name_en)
    );

  if (field === "add") {
    if (!value.name && !value.name_en) return;
    const existing = findNpc();
    if (existing) {
      // Re-introduced NPC: refresh instead of duplicating
      existing.last_seen_turn = turn;
      if (value.location) existing.location = value.location;
      if (value.notes) existing.notes = String(value.notes).slice(0, 120);
      if (typeof value.relationship === "number")
        existing.relationship = clampRel(value.relationship);
      return;
    }
    const npc: KnownNPC = {
      id: value.id || `npc_${(value.name || value.name_en).toLowerCase().replace(/\s+/g, "_")}`,
      name: value.name || value.name_en,
      name_en: value.name_en || value.name,
      role: value.role || "",
      location: value.location,
      relationship: clampRel(typeof value.relationship === "number" ? value.relationship : 0),
      notes: value.notes ? String(value.notes).slice(0, 120) : undefined,
      last_seen_turn: turn,
    };
    state.npcs.push(npc);
    // Cap registry: evict the stalest low-stakes NPC first
    const MAX_NPCS = 15;
    if (state.npcs.length > MAX_NPCS) {
      const evictable = [...state.npcs].sort(
        (a, b) =>
          Math.abs(a.relationship) - Math.abs(b.relationship) ||
          a.last_seen_turn - b.last_seen_turn
      );
      const target = evictable[0];
      state.npcs = state.npcs.filter((n) => n.id !== target.id);
    }
  } else if (field === "update") {
    const npc = findNpc();
    if (!npc) return;
    npc.last_seen_turn = turn;
    if (typeof value.relationship_delta === "number") {
      npc.relationship = clampRel(npc.relationship + value.relationship_delta);
    } else if (typeof value.relationship === "number") {
      npc.relationship = clampRel(value.relationship);
    }
    if (value.notes) npc.notes = String(value.notes).slice(0, 120);
    if (value.location) npc.location = value.location;
    if (value.role) npc.role = value.role;
  }
}

/**
 * Story arcs — multi-turn goals that outlive the AI's 3-turn memory.
 * Pushes quest_update events so the UI can toast journal changes.
 */
function applyArcDelta(state: GameState, field: string, value: any, events: GameEvent[]): void {
  if (!value || typeof value !== "object") return;
  state.story_arcs ||= [];
  const turn = state.turn_count + 1;
  const active = () => state.story_arcs!.filter((a) => a.status === "active");
  const findArc = () =>
    state.story_arcs!.find(
      (a) => a.status === "active" && (a.id === value.id || a.title === value.title)
    );
  const arcEvent = (kind: string, arc: StoryArc) =>
    events.push({
      type: "quest_update",
      data: {
        kind,
        title: arc.title,
        title_en: arc.title_en,
        stage: arc.stage,
        total_stages: arc.total_stages,
      },
    });

  if (field === "start") {
    if (!value.title && !value.title_en) return;
    if (findArc()) return; // already running
    if (active().length >= 3) return; // keep focus: max 3 concurrent arcs
    const totalStages = Math.max(2, Math.min(6, Number(value.total_stages) || 3));
    const arc: StoryArc = {
      id:
        value.id || `arc_${(value.title || value.title_en).toLowerCase().replace(/\s+/g, "_")}`,
      title: value.title || value.title_en,
      title_en: value.title_en || value.title,
      hook: String(value.hook || "").slice(0, 150),
      stage: 1,
      total_stages: totalStages,
      status: "active",
      started_turn: turn,
      updated_turn: turn,
    };
    state.story_arcs.push(arc);
    arcEvent("arc_started", arc);
  } else if (field === "advance") {
    const arc = findArc();
    if (!arc) return;
    arc.stage += 1;
    arc.updated_turn = turn;
    if (value.hook) arc.hook = String(value.hook).slice(0, 150);
    if (arc.stage >= arc.total_stages) {
      arc.status = "completed";
      arcEvent("arc_completed", arc);
    } else {
      arcEvent("arc_advanced", arc);
    }
  } else if (field === "complete" || field === "abandon") {
    const arc = findArc();
    if (!arc) return;
    arc.status = field === "complete" ? "completed" : "abandoned";
    arc.updated_turn = turn;
    if (value.resolution) arc.hook = String(value.resolution).slice(0, 150);
    if (arc.status === "completed") arcEvent("arc_completed", arc);
  }

  // Prune finished arcs beyond the most recent 3 (kept for summary flavor)
  const finished = state.story_arcs.filter((a) => a.status !== "active");
  if (finished.length > 3) {
    const keep = new Set(
      finished
        .sort((a, b) => b.updated_turn - a.updated_turn)
        .slice(0, 3)
        .map((a) => a.id)
    );
    state.story_arcs = state.story_arcs.filter((a) => a.status === "active" || keep.has(a.id));
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

      // Stack by id, or — for non-equipment — by name+rarity too: AI-minted
      // items get fresh ids every turn, so identical pills/herbs would
      // otherwise pile up as separate slots and bloat the context each turn.
      const nameStackable = value.type !== "Equipment" && value.type !== "Accessory";
      const existingItem = state.inventory.items.find(
        (item) =>
          (item.id === value.id && item.type === value.type) ||
          (nameStackable &&
            item.type === value.type &&
            item.rarity === value.rarity &&
            ((!!value.name && item.name === value.name) ||
              (!!value.name_en && item.name_en === value.name_en)))
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
    // Generate loot from table — resolve aliases/unknown ids to a real table
    // appropriate to the player's current region tier.
    if (typeof value === "string") {
      const regionTier = state.travel ? REGIONS[state.travel.current_region]?.tier || 1 : 1;
      const tableId = resolveLootTable(value, regionTier);
      const loot = generateLoot(tableId, rng, "vi");
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

function looksLikeSkill(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (typeof value.damage_multiplier === "number") return true;
  if (typeof value.qi_cost === "number") return true;
  if (typeof value.cooldown === "number") return true;
  const t = typeof value.type === "string" ? value.type.toLowerCase() : "";
  if (["attack", "defense", "support", "movement"].includes(t)) return true;
  return false;
}

function looksLikeTechnique(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (typeof value.cultivation_speed_bonus === "number") return true;
  if (typeof value.qi_recovery_bonus === "number") return true;
  if (typeof value.breakthrough_bonus === "number") return true;
  if (typeof value.grade === "string" && ["Mortal", "Earth", "Heaven"].includes(value.grade)) {
    return true;
  }
  return false;
}

function applyTechniqueDelta(state: GameState, field: string, operation: string, value: any): void {
  const MAX_TECHNIQUES = 5;

  if (field === "add" && operation === "add") {
    // Misaddressed: AI sent a combat skill via techniques.add — reroute.
    // Combat markers (damage_multiplier / qi_cost / cooldown / combat type) win
    // even if a stray `grade` is also present.
    if (looksLikeSkill(value)) {
      console.warn(
        `Rerouting techniques.add → skills.add for ${value?.name || value?.id} (combat markers present)`
      );
      applySkillDelta(state, "add", "add", value);
      return;
    }

    // Validate technique structure
    if (value && value.id && value.name && value.name_en && value.grade) {
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
      // Mastery defaults (player levels techniques up with spirit stones)
      if (typeof value.level !== "number" || value.level < 1) value.level = 1;
      if (typeof value.max_level !== "number") value.max_level = 10;

      if (state.techniques.length < MAX_TECHNIQUES) {
        state.techniques.push(value);
        console.log(
          `Added technique ${value.name} to active list (${state.techniques.length}/${MAX_TECHNIQUES})`
        );
      } else {
        state.technique_queue.push(value);
        console.log(
          `Added technique ${value.name} to queue (active full: ${state.techniques.length}/${MAX_TECHNIQUES})`
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
    // Misaddressed: AI sent a cultivation technique via skills.add — reroute
    if (looksLikeTechnique(value) && !looksLikeSkill(value)) {
      console.warn(
        `Rerouting skills.add → techniques.add for ${value?.name || value?.id} (looks like a technique)`
      );
      applyTechniqueDelta(state, "add", "add", value);
      return;
    }

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
      syncTravelWithLocation(state, "place", value);
      console.log(`Location changed to: ${value}`);
    } else if (field === "region" && typeof value === "string") {
      state.location.region = value;
      syncTravelWithLocation(state, "region", value);
      console.log(`Region changed to: ${value}`);
    }
  }
}

/**
 * Keep the travel/map state in step with AI-narrated movement. When the AI
 * sets location.place/region to a REAL map name (the context feeds it those),
 * update current_area/current_region and mark the area discovered so the
 * WorldMap lights up from story play, not just the Travel UI.
 */
function syncTravelWithLocation(state: GameState, field: "place" | "region", value: string): void {
  if (!state.travel) return;
  const norm = (s: string) => s.toLowerCase().trim();
  const target = norm(value);

  const markDiscovered = (regionId: string, areaId: string) => {
    state.travel!.discovered_areas ||= {} as any;
    const list = (state.travel!.discovered_areas as Record<string, string[]>)[regionId] || [];
    if (!list.includes(areaId)) list.push(areaId);
    (state.travel!.discovered_areas as Record<string, string[]>)[regionId] = list;
  };

  if (field === "place") {
    // Prefer an area in the current region, then fall back to any region
    const regionsToSearch = [
      REGIONS[state.travel.current_region],
      ...Object.values(REGIONS).filter((r) => r.id !== state.travel!.current_region),
    ].filter(Boolean);
    for (const region of regionsToSearch) {
      const area = region.areas.find(
        (a) => norm(a.name) === target || norm(a.name_en) === target || a.id === value
      );
      if (area) {
        state.travel.current_region = region.id;
        state.travel.current_area = area.id;
        markDiscovered(region.id, area.id);
        state.travel.travel_history = [...(state.travel.travel_history || []), area.id].slice(-10);
        console.log(`[Travel Sync] Area: ${area.id} (${region.id})`);
        return;
      }
    }
  } else {
    const region = Object.values(REGIONS).find(
      (r) => norm(r.name) === target || norm(r.name_en) === target || r.id === value
    );
    if (region && region.id !== state.travel.current_region) {
      state.travel.current_region = region.id;
      // Land at the region's safe hub (or first area)
      const entryArea = region.areas.find((a) => a.is_safe) || region.areas[0];
      if (entryArea) {
        state.travel.current_area = entryArea.id;
        markDiscovered(region.id, entryArea.id);
        state.travel.travel_history = [...(state.travel.travel_history || []), entryArea.id].slice(
          -10
        );
      }
      console.log(`[Travel Sync] Region: ${region.id}`);
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

      // Seed sect_relations. For named sects we use the hand-authored
      // rival/ally lists; for AI-invented sects (id not in NAMED_SECTS) we
      // fall back to a type-based alignment matrix so rival missions,
      // ambushes, and the Relations panel still have something to work with.
      const namedSeed = initialRelationsForSect(membership.sect.id);
      const seeded =
        Object.keys(namedSeed).length > 0
          ? namedSeed
          : initialRelationsForSectByType(membership.sect.type, membership.sect.id);
      state.sect_relations ||= {};
      for (const [sectId, rel] of Object.entries(seeded)) {
        if (!(sectId in state.sect_relations)) {
          state.sect_relations[sectId] = {
            sect_id: sectId,
            relation: rel,
            last_changed_turn: state.turn_count,
          };
        }
      }

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
      // If a war is active when the player leaves, log it to history as a
      // loss and clear it so a rejoin doesn't inherit a dangling war.
      abortWarOnSectLeave(state);
      state.sect_membership = undefined;
      state.sect = undefined;
      state.sect_en = undefined;
      // Clear sect-scoped state so a rejoin later starts fresh: any active
      // missions lose their host; rival/ally relations must be re-seeded
      // from the new sect's matrix on next join.
      state.sect_missions = [];
      state.sect_relations = {};
      if (state.flags) {
        for (const key of Object.keys(state.flags)) {
          if (key.startsWith("sect_mission_") || key.startsWith("sect_joining_")) {
            delete state.flags[key];
          }
        }
      }
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
 * Update story summary — a rolling log of turn-stamped milestones instead of
 * the old blind 150-char narrative tail-slices (which produced garbled prose
 * the AI couldn't use). Only appends when something noteworthy happened, and
 * keeps the last 8 entries so per-turn prompt tokens stay bounded.
 */
function updateStorySummary(
  state: GameState,
  events: GameEvent[],
  deltas: ProposedDelta[],
  locale: string,
  turnNo: number
): void {
  const vi = locale === "vi";
  const stamps: string[] = [];

  for (const e of events) {
    const d = e.data as Record<string, any>;
    switch (e.type as string) {
      case "breakthrough":
        stamps.push(vi ? `đột phá ${d.realm} tầng ${d.stage}` : `broke through ${d.realm} s${d.stage}`);
        break;
      case "body_breakthrough":
        stamps.push(vi ? `luyện thể ${d.realm} tầng ${d.stage}` : `body realm ${d.realm} s${d.stage}`);
        break;
      case "sect_join":
        stamps.push(vi ? `gia nhập ${d.sect?.name ?? "tông môn"}` : `joined ${d.sect?.name_en ?? d.sect?.name ?? "a sect"}`);
        break;
      case "sect_promotion":
        stamps.push(vi ? `thăng ${d.newRank}` : `promoted to ${d.newRank}`);
        break;
      case "sect_expulsion":
        stamps.push(vi ? `rời ${d.sect}` : `left ${d.sect}`);
        break;
      case "quest_update":
        if (d.kind === "arc_completed") {
          stamps.push(
            vi ? `hoàn thành "${d.title}"` : `completed "${d.title_en ?? d.title}"`
          );
        } else if (d.milestone === "peak_realm") {
          stamps.push(vi ? "đạt đỉnh Nguyên Anh viên mãn" : "reached peak Nascent Soul");
        }
        break;
    }
  }

  for (const delta of deltas) {
    if (delta.operation === "set" && typeof delta.value === "string") {
      if (delta.field === "location.region") {
        stamps.push(vi ? `tới vùng ${delta.value}` : `reached region ${delta.value}`);
      } else if (delta.field === "location.place") {
        stamps.push(vi ? `tới ${delta.value}` : `arrived at ${delta.value}`);
      }
    }
  }

  if (stamps.length === 0) return;

  const existing = state.story_summary ? state.story_summary.split(" | ") : [];
  const tag = vi ? `[L${turnNo}]` : `[T${turnNo}]`;
  const merged = [...existing, ...stamps.map((s) => `${tag} ${s}`)];
  state.story_summary = merged.slice(-8).join(" | ");
}
