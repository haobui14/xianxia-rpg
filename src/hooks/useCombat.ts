import { useState, useCallback, useRef } from "react";
import { GameState, Enemy, CombatLogEntry, GameEvent, ProposedDelta } from "@/types/game";
import { resolveSectMissions } from "@/lib/game/sect-missions";
import { creditWarScore, WAR_SCORE_PER_RIVAL_COMBAT } from "@/lib/game/sect-wars";
import { generateLoot, resolveLootTable } from "@/lib/game/loot";
import { DeterministicRNG } from "@/lib/game/rng";

interface TestCombatState {
  enemy: Enemy;
  log: CombatLogEntry[];
  playerTurn: boolean;
  playerHp: number;
}

interface ActiveCombatState {
  enemy: Enemy;
  log: CombatLogEntry[];
  playerTurn: boolean;
}

interface UseCombatProps {
  runId: string;
  locale: "vi" | "en";
  state: GameState | null;
  setState: React.Dispatch<React.SetStateAction<GameState | null>>;
  setNarrative: React.Dispatch<React.SetStateAction<string>>;
}

export function useCombat({ runId, locale, state, setState, setNarrative }: UseCombatProps) {
  const [testCombat, setTestCombat] = useState<TestCombatState | null>(null);
  const [activeCombat, setActiveCombat] = useState<ActiveCombatState | null>(null);
  // Re-entry guard: handleActiveCombatEnd is an async closure that mutates
  // mission progress; React strict-mode double-invoke or a rapid-double-click
  // could start a second pass on the same `activeCombat` before the first
  // finishes. The ref blocks that window deterministically.
  const combatEndInFlightRef = useRef(false);

  // Sync skills to database after combat
  const syncSkillsAfterCombat = useCallback(
    async (updatedSkills: any[]) => {
      if (!updatedSkills) return;

      try {
        console.log("[Sync Skills] Saving skill exp to database...", updatedSkills);
        const response = await fetch("/api/sync-skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            runId,
            skills: updatedSkills,
          }),
        });

        if (!response.ok) {
          console.error("[Sync Skills] Failed to sync skills");
        } else {
          console.log("[Sync Skills] Successfully synced skills to database");
        }
      } catch (err) {
        console.error("[Sync Skills] Error syncing skills:", err);
      }
    },
    [runId]
  );

  // Reset every skill's current_cooldown to 0. Called when a new combat starts
  // so leftover cooldowns from a previous fight don't show up as "all skills on
  // cooldown" the moment the player takes their first action.
  const resetSkillCooldowns = useCallback(() => {
    setState((prev) => {
      if (!prev || !prev.skills) return prev;
      const needsReset = prev.skills.some((s) => (s.current_cooldown || 0) > 0);
      if (!needsReset) return prev;
      return {
        ...prev,
        skills: prev.skills.map((s) => ({ ...s, current_cooldown: 0 })),
      };
    });
  }, [setState]);

  // Test combat with dummy enemy
  const startTestCombat = useCallback(() => {
    if (!state) return;
    const dummyEnemy: Enemy = {
      id: "test_enemy",
      name: "Sói Hoang",
      name_en: "Wild Wolf",
      hp: 50,
      hp_max: 50,
      atk: 8,
      def: 3,
      behavior: "Aggressive",
      loot_table_id: "common_herbs",
    };
    resetSkillCooldowns();
    setTestCombat({
      enemy: dummyEnemy,
      log: [],
      playerTurn: true,
      playerHp: state.stats.hp,
    });
  }, [state, resetSkillCooldowns]);

  // Handle test combat action
  const handleTestCombatAction = useCallback(
    (action: "attack" | "qi_attack" | "defend" | "flee" | "skill", skillId?: string) => {
      if (!testCombat || !state) return;

      const { enemy, log, playerHp } = testCombat;
      const newLog = [...log];
      const turnNumber = Math.floor(log.length / 2) + 1;

      // Reduce skill cooldowns at the start of player's turn (if not first turn)
      if (log.length > 0) {
        setState((prev) => {
          if (!prev || !prev.skills) return prev;
          return {
            ...prev,
            skills: prev.skills.map((s) => ({
              ...s,
              current_cooldown:
                s.current_cooldown && s.current_cooldown > 0 ? s.current_cooldown - 1 : 0,
            })),
          };
        });
      }

      // Helper to apply enemy damage
      const applyEnemyTurn = (
        isDefending: boolean,
        currentPlayerHp: number,
        currentEnemy: Enemy,
        currentLog: CombatLogEntry[]
      ) => {
        setTimeout(() => {
          const enemyDamage = Math.floor(currentEnemy.atk * (0.8 + Math.random() * 0.4));
          const defendBonus = isDefending ? 0.5 : 1;
          const enemyMiss = Math.random() < 0.15;
          const enemyCrit = Math.random() < 0.1;
          const finalDamage = enemyMiss
            ? 0
            : Math.floor(enemyDamage * defendBonus * (enemyCrit ? 1.5 : 1));

          const enemyLogEntry: CombatLogEntry = {
            id: `log-enemy-${Date.now()}`,
            turn: turnNumber,
            actor: "enemy",
            action: "attack",
            damage: finalDamage,
            isCritical: enemyCrit,
            isMiss: enemyMiss,
            timestamp: Date.now(),
          };

          const newPlayerHp = Math.max(0, currentPlayerHp - finalDamage);

          setTestCombat((prev) =>
            prev
              ? {
                  ...prev,
                  log: [...prev.log, enemyLogEntry],
                  playerTurn: true,
                  playerHp: newPlayerHp,
                }
              : null
          );
        }, 800);
      };

      // Handle skill usage
      if (action === "skill" && skillId) {
        const skill = state.skills?.find((s) => s.id === skillId);
        const effectiveCooldown = log.length === 0 ? 0 : skill?.current_cooldown || 0;
        if (skill && state.stats.qi >= skill.qi_cost && effectiveCooldown <= 0) {
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  stats: { ...prev.stats, qi: prev.stats.qi - skill.qi_cost },
                }
              : prev
          );

          // Match the active-combat path: nullish-coalesce + 1.5× floor + 2.5× crit
          const rawMultiplier = skill.damage_multiplier ?? 1.5;
          const skillMultiplier = Math.max(1.5, rawMultiplier);
          const baseDamage = state.attrs.str * 1.5;
          const skillDamage = baseDamage * skillMultiplier;
          const playerMiss = Math.random() < 0.08;
          const playerCrit = Math.random() < 0.15;
          const rawDamage = Math.floor(skillDamage * (playerCrit ? 2.5 : 1));
          const finalDamage = playerMiss ? 0 : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

          const playerLogEntry: CombatLogEntry = {
            id: `log-${Date.now()}`,
            turn: turnNumber,
            actor: "player",
            action: "skill",
            damage: finalDamage,
            isCritical: playerCrit,
            isMiss: playerMiss,
            timestamp: Date.now(),
          };

          const newEnemy = {
            ...enemy,
            hp: Math.max(0, enemy.hp - finalDamage),
          };
          newLog.push(playerLogEntry);

          if (!state || !state.skills) return;

          const updatedSkills = state.skills.map((s) => {
            if (s.id === skillId) {
              const skillExpGain = 5 + Math.floor(Math.random() * 11);
              const currentExp = s.exp || 0;
              const maxExp = s.max_exp || s.level * 100;
              let newExp = currentExp + skillExpGain;
              let newLevel = s.level;
              let newMaxExp = maxExp;
              let newDamageMultiplier = s.damage_multiplier;

              while (newExp >= newMaxExp && newLevel < s.max_level) {
                newExp -= newMaxExp;
                newLevel += 1;
                newMaxExp = newLevel * 100;
                newDamageMultiplier = newDamageMultiplier * 1.05;
              }

              return {
                ...s,
                current_cooldown: s.cooldown,
                exp: newExp,
                level: newLevel,
                max_exp: newMaxExp,
                damage_multiplier: newDamageMultiplier,
              };
            }
            return s;
          });

          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              skills: updatedSkills,
            };
          });

          if (newEnemy.hp <= 0) {
            syncSkillsAfterCombat(updatedSkills);
            setTestCombat(null);
            return;
          }

          setTestCombat((prev) =>
            prev ? { ...prev, enemy: newEnemy, log: newLog, playerTurn: false } : null
          );
          applyEnemyTurn(false, playerHp, newEnemy, newLog);
          return;
        }
        return;
      }

      if (action === "flee") {
        const fleeChance = Math.random();
        if (fleeChance > 0.5) {
          setTestCombat(null);
          return;
        }
        newLog.push({
          id: `log-${Date.now()}`,
          turn: turnNumber,
          actor: "player",
          action: "flee",
          isMiss: true,
          timestamp: Date.now(),
        });

        setTestCombat((prev) => (prev ? { ...prev, log: newLog, playerTurn: false } : null));
        applyEnemyTurn(false, playerHp, enemy, newLog);
        return;
      }

      if (action === "defend") {
        newLog.push({
          id: `log-${Date.now()}`,
          turn: turnNumber,
          actor: "player",
          action: "defend",
          timestamp: Date.now(),
        });

        setTestCombat((prev) => (prev ? { ...prev, log: newLog, playerTurn: false } : null));
        applyEnemyTurn(true, playerHp, enemy, newLog);
        return;
      }

      // Attack or qi_attack
      const baseDamage =
        action === "qi_attack" ? state.attrs.int * 2 + state.attrs.str : state.attrs.str * 1.5;
      const isCritical = Math.random() < 0.15;
      const isMiss = Math.random() < 0.1;
      const rawDamage = Math.floor(baseDamage * (isCritical ? 2 : 1));
      const damage = isMiss ? 0 : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

      newLog.push({
        id: `log-${Date.now()}`,
        turn: turnNumber,
        actor: "player",
        action: action,
        damage: Math.max(0, damage),
        isCritical,
        isMiss,
        timestamp: Date.now(),
      });

      const newEnemyHp = Math.max(0, enemy.hp - (isMiss ? 0 : Math.max(0, damage)));
      const updatedEnemy = { ...enemy, hp: newEnemyHp };

      if (newEnemyHp > 0) {
        setTestCombat({
          enemy: updatedEnemy,
          log: newLog,
          playerTurn: false,
          playerHp,
        });
        applyEnemyTurn(false, playerHp, updatedEnemy, newLog);
        return;
      }

      // Enemy dead
      setTestCombat({
        enemy: updatedEnemy,
        log: newLog,
        playerTurn: true,
        playerHp,
      });
    },
    [testCombat, state, setState, syncSkillsAfterCombat]
  );

  // Handle active combat action (from AI combat_encounter)
  const handleActiveCombatAction = useCallback(
    (action: "attack" | "qi_attack" | "defend" | "flee" | "skill", skillId?: string) => {
      if (!activeCombat || !state) return;

      const { enemy, log } = activeCombat;
      const newLog = [...log];
      const turnNumber = Math.floor(log.length / 2) + 1;

      console.log("[handleActiveCombatAction] Called", { action, skillId, logLength: log.length });

      // Reduce skill cooldowns at the start of player's turn (if not first turn)
      if (log.length > 0) {
        setState((prev) => {
          if (!prev || !prev.skills) return prev;
          return {
            ...prev,
            skills: prev.skills.map((s) => ({
              ...s,
              current_cooldown:
                s.current_cooldown && s.current_cooldown > 0 ? s.current_cooldown - 1 : 0,
            })),
          };
        });
      }

      // Helper to apply enemy turn
      const applyEnemyTurn = (
        isDefending: boolean,
        currentEnemy: Enemy,
        currentLog: CombatLogEntry[]
      ) => {
        setTimeout(() => {
          const enemyDamage = Math.floor(currentEnemy.atk * (0.8 + Math.random() * 0.4));
          const defendBonus = isDefending ? 0.5 : 1;
          const enemyMiss = Math.random() < 0.15;
          const enemyCrit = Math.random() < 0.1;
          const finalDamage = enemyMiss
            ? 0
            : Math.floor(enemyDamage * defendBonus * (enemyCrit ? 1.5 : 1));

          const enemyLogEntry: CombatLogEntry = {
            id: `log-enemy-${Date.now()}`,
            turn: turnNumber,
            actor: "enemy",
            action: "attack",
            damage: finalDamage,
            isCritical: enemyCrit,
            isMiss: enemyMiss,
            timestamp: Date.now(),
          };

          // Apply damage to player
          setState((prev) => {
            if (!prev) return prev;
            const newHp = Math.max(0, prev.stats.hp - finalDamage);
            return {
              ...prev,
              stats: { ...prev.stats, hp: newHp },
            };
          });

          setActiveCombat((prev) =>
            prev
              ? {
                  ...prev,
                  log: [...prev.log, enemyLogEntry],
                  playerTurn: true,
                }
              : null
          );
        }, 800);
      };

      // Handle skill usage
      if (action === "skill" && skillId) {
        const skill = state.skills?.find((s) => s.id === skillId);
        // At combat start (log empty), treat cooldown as 0
        const effectiveCooldown = log.length === 0 ? 0 : skill?.current_cooldown || 0;
        if (skill && state.stats.qi >= skill.qi_cost && effectiveCooldown <= 0) {
          // Calculate skill damage based on skill type
          let finalDamage = 0;
          let healAmount = 0;
          let playerMiss = false;
          let playerCrit = false;

          // Default: all skills do damage unless they're pure support/defense with healing
          const isAttackSkill =
            !skill.type ||
            skill.type === "attack" ||
            (skill.type !== "defense" && skill.type !== "support");
          const isHealSkill =
            (skill.type === "defense" || skill.type === "support") && skill.effects?.heal_percent;

          if (isAttackSkill || !isHealSkill) {
            // Attack skills or skills without a specific heal effect.
            //
            // Bug fixes:
            // - Use `??` instead of `||` so an explicit damage_multiplier of 0
            //   (corrupted data) doesn't silently fall through to the default.
            // - Enforce a 1.5× minimum: a skill costs Linh Lực + a cooldown,
            //   so it must hit harder than a free normal attack. Defense /
            //   support skills routed here as a fallback get the same floor.
            // - Bump skill crit from 1.5× to 2.5× so a crit-on-crit doesn't
            //   make a normal attack (2×) close on a skill (was only 1.5×).
            const rawMultiplier = skill.damage_multiplier ?? 1.5;
            const skillMultiplier = Math.max(1.5, rawMultiplier);
            const baseDamage = state.attrs.str * 1.5;
            const skillDamage = baseDamage * skillMultiplier;
            playerMiss = Math.random() < 0.08; // skills slightly more reliable
            playerCrit = Math.random() < 0.15;
            const rawDamage = Math.floor(skillDamage * (playerCrit ? 2.5 : 1));
            finalDamage = playerMiss
              ? 0
              : Math.max(1, rawDamage - Math.floor(activeCombat.enemy.def / 2));
          }

          if (isHealSkill) {
            healAmount = Math.floor(state.stats.hp_max * (skill.effects?.heal_percent ?? 0));
          }

          const playerLogEntry: CombatLogEntry = {
            id: `log-${Date.now()}`,
            turn: turnNumber,
            actor: "player",
            action: "skill",
            damage: finalDamage,
            healAmount: healAmount,
            isCritical: playerCrit,
            isMiss: playerMiss,
            timestamp: Date.now(),
          };

          const newEnemy = {
            ...enemy,
            hp: Math.max(0, enemy.hp - finalDamage),
          };
          newLog.push(playerLogEntry);

          // Calculate skill exp gain and update skills
          if (!state || !state.skills) return;

          const updatedSkills = state.skills.map((s) => {
            if (s.id === skillId) {
              const skillExpGain = 5 + Math.floor(Math.random() * 11);
              const currentExp = s.exp || 0;
              const maxExp = s.max_exp || s.level * 100;
              let newExp = currentExp + skillExpGain;
              let newLevel = s.level;
              let newMaxExp = maxExp;
              let newDamageMultiplier = s.damage_multiplier;

              // Handle level ups
              while (newExp >= newMaxExp && newLevel < s.max_level) {
                newExp -= newMaxExp;
                newLevel += 1;
                newMaxExp = newLevel * 100;
                newDamageMultiplier = newDamageMultiplier * 1.05;
              }

              return {
                ...s,
                current_cooldown: s.cooldown,
                exp: newExp,
                level: newLevel,
                max_exp: newMaxExp,
                damage_multiplier: newDamageMultiplier,
              };
            }
            return s;
          });

          // Update state: deduct qi, apply healing, update skills with exp and cooldown
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stats: {
                ...prev.stats,
                qi: prev.stats.qi - skill.qi_cost,
                hp: isHealSkill
                  ? Math.min(prev.stats.hp_max, prev.stats.hp + healAmount)
                  : prev.stats.hp,
              },
              skills: updatedSkills,
            };
          });

          if (newEnemy.hp <= 0) {
            // Combat won - persist skill exp to database
            syncSkillsAfterCombat(updatedSkills);
            setActiveCombat(null);
            return;
          }

          setActiveCombat((prev) =>
            prev ? { ...prev, enemy: newEnemy, log: newLog, playerTurn: false } : null
          );
          applyEnemyTurn(false, newEnemy, newLog);
          return;
        }
        // If skill conditions not met, return early to prevent falling through to attack
        return;
      }

      if (action === "flee") {
        const fleeChance = Math.random();
        if (fleeChance > 0.5) {
          setActiveCombat(null);
          return;
        }
        newLog.push({
          id: `log-${Date.now()}`,
          turn: turnNumber,
          actor: "player",
          action: "flee",
          isMiss: true,
          timestamp: Date.now(),
        });

        setActiveCombat((prev) => (prev ? { ...prev, log: newLog, playerTurn: false } : null));
        applyEnemyTurn(false, enemy, newLog);
        return;
      }

      if (action === "defend") {
        newLog.push({
          id: `log-${Date.now()}`,
          turn: turnNumber,
          actor: "player",
          action: "defend",
          timestamp: Date.now(),
        });

        setActiveCombat((prev) => (prev ? { ...prev, log: newLog, playerTurn: false } : null));
        applyEnemyTurn(true, enemy, newLog);
        return;
      }

      // Attack or qi_attack
      const baseDamage =
        action === "qi_attack" ? state.attrs.int * 2 + state.attrs.str : state.attrs.str * 1.5;
      const isCritical = Math.random() < 0.15;
      const isMiss = Math.random() < 0.1;
      const rawDamage = Math.floor(baseDamage * (isCritical ? 2 : 1));
      const damage = isMiss ? 0 : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

      // Consume qi for qi_attack
      if (action === "qi_attack" && state.stats.qi >= 10) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  qi: Math.max(0, prev.stats.qi - 10),
                },
              }
            : prev
        );
      }

      newLog.push({
        id: `log-${Date.now()}`,
        turn: turnNumber,
        actor: "player",
        action: action,
        damage: Math.max(0, damage),
        isCritical,
        isMiss,
        timestamp: Date.now(),
      });

      // Update enemy HP
      const newEnemyHp = Math.max(0, enemy.hp - (isMiss ? 0 : Math.max(0, damage)));
      const updatedEnemy = { ...enemy, hp: newEnemyHp };

      // Enemy turn (if not dead)
      if (newEnemyHp > 0) {
        setActiveCombat((prev) =>
          prev
            ? {
                ...prev,
                enemy: updatedEnemy,
                log: newLog,
                playerTurn: false,
              }
            : null
        );
        applyEnemyTurn(false, updatedEnemy, newLog);
        return;
      }

      setActiveCombat((prev) =>
        prev
          ? {
              ...prev,
              enemy: updatedEnemy,
              log: newLog,
              playerTurn: true,
            }
          : null
      );
    },
    [activeCombat, state, setState, syncSkillsAfterCombat]
  );

  // Handle combat end - apply loot and continue game
  const handleActiveCombatEnd = useCallback(async () => {
    if (!activeCombat) return;
    if (combatEndInFlightRef.current) return;
    combatEndInFlightRef.current = true;

    // Get the latest state from the server to ensure we have current dungeon progress
    let currentState = state;
    try {
      const stateResponse = await fetch(`/api/run/${runId}`);
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        currentState = stateData.run.current_state;
      }
    } catch (err) {
      console.error("Failed to fetch latest state:", err);
      // Continue with existing state if fetch fails
    }

    if (!currentState) {
      combatEndInFlightRef.current = false;
      return;
    }

    const victory = activeCombat.enemy.hp <= 0;
    const playerDied = currentState.stats.hp <= 0;

    let updatedState = { ...currentState };

    if (victory) {
      // Check if we're in a dungeon for enhanced rewards
      const isInDungeon = Boolean(
        currentState.dungeon?.dungeon_id && currentState.dungeon?.current_floor
      );

      // Roll loot from the enemy's curated loot table (was: hardcoded
      // Math.random() drops that ignored loot_table_id entirely).
      const lootTableId = resolveLootTable(activeCombat.enemy.loot_table_id, isInDungeon ? 2 : 1);
      const rng = new DeterministicRNG(
        `combat-${runId}-${currentState.turn_count}-${activeCombat.enemy.id}`
      );
      const rolled = generateLoot(lootTableId, rng, locale);

      const lootSilver = rolled.silver + (isInDungeon ? rng.randomInt(20, 50) : 0);
      const lootExp = isInDungeon ? rng.randomInt(40, 100) : rng.randomInt(20, 50);
      const lootSpiritStones = rolled.spiritStones;
      // Outside dungeons keep drops lean: at most 1 item from the table
      const lootItems = isInDungeon ? rolled.items : rolled.items.slice(0, 1);

      // Update state with loot
      updatedState = {
        ...updatedState,
        inventory: {
          ...updatedState.inventory,
          silver: updatedState.inventory.silver + lootSilver,
          spirit_stones: updatedState.inventory.spirit_stones + lootSpiritStones,
        },
        progress: {
          ...updatedState.progress,
          cultivation_exp: updatedState.progress.cultivation_exp + lootExp,
        },
      };

      // Add items to inventory — stack by id, or by name for non-equipment
      for (const lootItem of lootItems) {
        const existingItem = updatedState.inventory.items.find(
          (i) =>
            i.id === lootItem.id ||
            (lootItem.type !== "Equipment" &&
              lootItem.type !== "Accessory" &&
              i.type === lootItem.type &&
              i.name === lootItem.name)
        );
        if (existingItem) {
          existingItem.quantity = (existingItem.quantity || 1) + lootItem.quantity;
        } else {
          updatedState.inventory.items.push(lootItem);
        }
      }

      // Build loot notification message
      let lootText =
        locale === "vi"
          ? `\n\n🎉 Chiến thắng! Bạn nhận được ${lootSilver} bạc và ${lootExp} điểm tu luyện.`
          : `\n\n🎉 Victory! You received ${lootSilver} silver and ${lootExp} cultivation points.`;

      if (lootSpiritStones > 0) {
        lootText +=
          locale === "vi"
            ? ` Và ${lootSpiritStones} Linh Thạch!`
            : ` And ${lootSpiritStones} Spirit Stones!`;
      }

      if (lootItems.length > 0) {
        const itemNames = lootItems
          .map((item) => (locale === "vi" ? item.name : item.name_en))
          .join(", ");
        lootText += locale === "vi" ? ` Vật phẩm: ${itemNames}` : ` Items: ${itemNames}`;
      }

      // Advance sect missions that track combat victories / rival kills
      // AND credit the cultivation-exp gained from loot so cultivate_exp
      // missions progress after a fight too. resolveSectMissions mutates
      // state in place and returns completion events for the narrative.
      const rivalId = activeCombat.enemy.rival_sect_id;
      const combatEvent: GameEvent = {
        type: "combat",
        data: {
          victory: true,
          enemy: activeCombat.enemy.name,
          ...(rivalId ? { rival_sect_id: rivalId } : {}),
        },
      };
      const syntheticDeltas: ProposedDelta[] =
        lootExp > 0
          ? [{ field: "progress.cultivation_exp", operation: "add", value: lootExp }]
          : [];
      const missionEvents = resolveSectMissions(
        updatedState,
        syntheticDeltas,
        [combatEvent]
      );

      // Credit sect-war score if this was a combat against the warring
      // rival's member. The resolveSectMissions call already advanced any
      // matching defeat_rival_member mission — war score is independent.
      const warCredit = creditWarScore(
        updatedState,
        rivalId,
        WAR_SCORE_PER_RIVAL_COMBAT
      );
      if (warCredit > 0) {
        lootText +=
          locale === "vi"
            ? `\n\n⚔️ Chiến công tông môn: +${warCredit} điểm chiến tranh`
            : `\n\n⚔️ War merit: +${warCredit} war score`;
      }

      if (missionEvents.length > 0) {
        const completions = missionEvents
          .filter((e) => (e.data as { status?: string }).status === "completed")
          .map((e) => {
            const d = e.data as { name?: string; name_en?: string };
            return locale === "vi" ? d.name : d.name_en;
          })
          .filter(Boolean);
        if (completions.length > 0) {
          lootText +=
            locale === "vi"
              ? `\n\n📜 Hoàn thành nhiệm vụ: ${completions.join(", ")}`
              : `\n\n📜 Mission complete: ${completions.join(", ")}`;
        }
      }

      setNarrative((prev) => prev + lootText);
    } else if (playerDied) {
      // Player died - restore some HP to continue
      updatedState = {
        ...updatedState,
        stats: {
          ...updatedState.stats,
          hp: Math.floor(updatedState.stats.hp_max * 0.3), // Restore 30% HP
        },
        inventory: {
          ...updatedState.inventory,
          silver: Math.max(0, updatedState.inventory.silver - 50), // Lose some silver
        },
      };

      setNarrative((prev) => {
        const defeatText =
          locale === "vi"
            ? `\n\n💀 Bạn bị đánh bại... May mắn thay có người qua đường cứu giúp. Bạn mất 50 bạc.`
            : `\n\n💀 You were defeated... Fortunately, a passerby helped you. You lost 50 silver.`;
        return prev + defeatText;
      });
    }

    // Update local state
    setState(updatedState);

    // Save state to server
    try {
      await fetch(`/api/run/${runId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: updatedState }),
      });
    } catch (err) {
      console.error("Failed to save combat result:", err);
    }

    // Clear combat + release re-entry guard.
    setActiveCombat(null);
    combatEndInFlightRef.current = false;
  }, [activeCombat, state, locale, runId, setState, setNarrative]);

  return {
    // Test combat
    testCombat,
    setTestCombat,
    startTestCombat,
    handleTestCombatAction,
    // Active combat
    activeCombat,
    setActiveCombat,
    handleActiveCombatAction,
    handleActiveCombatEnd,
    // Utilities
    syncSkillsAfterCombat,
    resetSkillCooldowns,
  };
}
