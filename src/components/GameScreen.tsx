"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  GameState,
  Choice,
  ValidatedTurnResult,
  Realm,
  Enemy,
  CombatLogEntry,
} from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";
import CharacterSheet from "./CharacterSheet";
import SectView from "./SectView";
import InventoryView from "./InventoryView";
import MarketView from "./MarketView";
import NotificationManager from "./NotificationManager";
import DebugInventory from "./DebugInventory";
import BreakthroughModal, { BreakthroughEvent } from "./BreakthroughModal";
import CombatView from "./CombatView";

interface GameScreenProps {
  runId: string;
  locale: Locale;
  userId?: string;
}

export default function GameScreen({ runId, locale, userId }: GameScreenProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [narrative, setNarrative] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "game" | "character" | "sect" | "inventory" | "market" | "notifications"
  >("game");
  const [breakthroughEvent, setBreakthroughEvent] =
    useState<BreakthroughEvent | null>(null);
  const [previousExp, setPreviousExp] = useState<number | undefined>(undefined);
  const [testCombat, setTestCombat] = useState<{
    enemy: Enemy;
    log: CombatLogEntry[];
    playerTurn: boolean;
    playerHp: number;
  } | null>(null);
  // Active combat state - triggered by AI combat_encounter events
  const [activeCombat, setActiveCombat] = useState<{
    enemy: Enemy;
    log: CombatLogEntry[];
    playerTurn: boolean;
  } | null>(null);
  const [customAction, setCustomAction] = useState("");
  const firstTurnStartedRef = useRef(false);
  const lastNotificationRef = useRef<number>(0);
  const previousStaminaRef = useRef<number>(0);
  const previousRealmRef = useRef<{ realm: Realm; stage: number } | null>(null);

  const processTurn = useCallback(
    async (choiceId: string | null, selectedChoice?: Choice) => {
      setProcessing(true);
      setError("");

      // Store previous exp for animation
      if (state) {
        setPreviousExp(state.progress.cultivation_exp);
        previousRealmRef.current = {
          realm: state.progress.realm,
          stage: state.progress.realm_stage,
        };
      }

      try {
        const response = await fetch("/api/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ runId, choiceId, selectedChoice }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process turn");
        }

        const result: ValidatedTurnResult = await response.json();
        console.log("Turn result:", result);

        // Check for breakthrough event
        if (previousRealmRef.current) {
          const prevRealm = previousRealmRef.current.realm;
          const prevStage = previousRealmRef.current.stage;
          const newRealm = result.state.progress.realm;
          const newStage = result.state.progress.realm_stage;

          // Detect breakthrough (realm changed or stage increased)
          if (
            prevRealm !== newRealm ||
            (prevRealm === newRealm && newStage > prevStage)
          ) {
            // Calculate stat increases (approximate based on typical breakthrough)
            const breakthroughData: BreakthroughEvent = {
              previousRealm: prevRealm,
              previousStage: prevStage,
              newRealm: newRealm,
              newStage: newStage,
              statIncreases: {},
            };

            // For realm breakthroughs, show major stat increases
            if (prevRealm !== newRealm) {
              breakthroughData.statIncreases = {
                hp_max:
                  prevRealm === "PhàmNhân"
                    ? 50
                    : prevRealm === "LuyệnKhí"
                      ? 100
                      : 150,
                qi_max:
                  prevRealm === "PhàmNhân"
                    ? 100
                    : prevRealm === "LuyệnKhí"
                      ? 200
                      : 300,
                str:
                  prevRealm === "PhàmNhân"
                    ? 2
                    : prevRealm === "LuyệnKhí"
                      ? 3
                      : 4,
                agi:
                  prevRealm === "PhàmNhân"
                    ? 2
                    : prevRealm === "LuyệnKhí"
                      ? 3
                      : 4,
                int:
                  prevRealm === "PhàmNhân"
                    ? 2
                    : prevRealm === "LuyệnKhí"
                      ? 3
                      : 4,
                perception:
                  prevRealm === "PhàmNhân"
                    ? 1
                    : prevRealm === "LuyệnKhí"
                      ? 2
                      : 3,
              };
            } else {
              // Stage breakthrough within same realm
              breakthroughData.statIncreases = {
                hp_max:
                  prevRealm === "LuyệnKhí"
                    ? 30
                    : prevRealm === "TrúcCơ"
                      ? 50
                      : 80,
                qi_max:
                  prevRealm === "LuyệnKhí"
                    ? 50
                    : prevRealm === "TrúcCơ"
                      ? 80
                      : 120,
                str:
                  prevRealm === "LuyệnKhí" ? 1 : prevRealm === "TrúcCơ" ? 2 : 3,
                agi:
                  prevRealm === "LuyệnKhí" ? 1 : prevRealm === "TrúcCơ" ? 2 : 3,
                int:
                  prevRealm === "LuyệnKhí" ? 1 : prevRealm === "TrúcCơ" ? 2 : 3,
              };
            }

            setBreakthroughEvent(breakthroughData);
          }
        }

        setState(result.state);
        setNarrative(result.narrative);
        setChoices(result.choices);

        // Check for combat_encounter event from AI
        const combatEncounter = result.events?.find(
          (e) => e.type === "combat_encounter",
        );
        if (combatEncounter && combatEncounter.data?.enemy) {
          const enemy = combatEncounter.data.enemy as Enemy;
          // Ensure hp_max is set
          if (!enemy.hp_max) {
            enemy.hp_max = enemy.hp;
          }
          console.log("Combat encounter triggered:", enemy);
          setActiveCombat({
            enemy,
            log: [],
            playerTurn: true,
          });
        }
      } catch (err) {
        console.error("Turn error:", err);
        setError(
          locale === "vi" ? "Lỗi xử lý lượt chơi" : "Error processing turn",
        );
      } finally {
        setProcessing(false);
      }
    },
    [runId, locale, state],
  );

  const handleEquipItem = useCallback(
    async (itemId: string, action: "equip" | "unequip") => {
      try {
        const response = await fetch("/api/equip-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId, action }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Equip API error:", errorData);
          throw new Error(errorData.error || "Failed to equip/unequip item");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err) {
        console.error("Equip error:", err);
        setError(
          (err instanceof Error ? err.message : "") ||
            (locale === "vi" ? "Lỗi trang bị" : "Error equipping item"),
        );
      }
    },
    [locale],
  );

  const handleMarketAction = useCallback(
    async (itemId: string, action: "buy" | "sell") => {
      try {
        const response = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId, action }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to complete transaction");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Market error:", err);
        setError(
          err.message ||
            (locale === "vi" ? "Lỗi giao dịch" : "Transaction error"),
        );
      }
    },
    [locale],
  );

  const handleRefreshMarket = useCallback(async () => {
    try {
      const response = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "refresh" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refresh market");
      }

      const result = await response.json();
      setState(result.state);
    } catch (err: any) {
      console.error("Refresh error:", err);
      setError(
        err.message || (locale === "vi" ? "Lỗi làm mới" : "Refresh error"),
      );
    }
  }, [locale]);

  const handleExchange = useCallback(
    async (amount: number) => {
      try {
        const response = await fetch("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "exchange", amount }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to exchange");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Exchange error:", err);
        setError(
          err.message || (locale === "vi" ? "Lỗi đổi tiền" : "Exchange error"),
        );
      }
    },
    [locale],
  );

  const handleDiscardItem = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        const response = await fetch("/api/discard-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId, quantity }),
        });

        if (!response.ok) {
          throw new Error("Failed to discard item");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err) {
        console.error("Discard error:", err);
        setError(
          locale === "vi" ? "Lỗi vứt vật phẩm" : "Error discarding item",
        );
      }
    },
    [locale],
  );

  const handleUseItem = useCallback(
    async (itemId: string) => {
      try {
        const response = await fetch("/api/use-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to use item");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Use item error:", err);
        setError(
          err.message ||
            (locale === "vi" ? "Lỗi sử dụng vật phẩm" : "Error using item"),
        );
      }
    },
    [locale],
  );

  const handleEnhanceItem = useCallback(
    async (itemId: string) => {
      try {
        const response = await fetch("/api/enhance-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ itemId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to enhance item");
        }

        const result = await response.json();
        setState(result.state);
        return result.result; // Return the enhancement result for the modal
      } catch (err: any) {
        console.error("Enhance item error:", err);
        setError(
          err.message ||
            (locale === "vi"
              ? "Lỗi cường hóa vật phẩm"
              : "Error enhancing item"),
        );
        return null;
      }
    },
    [locale],
  );

  // Handle ability swap (techniques/skills)
  const handleAbilitySwap = useCallback(
    async (
      abilityType: "technique" | "skill",
      activeId: string | null,
      queueId: string | null,
      action: "swap" | "forget" | "learn" | "discard",
    ) => {
      try {
        const response = await fetch("/api/swap-ability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            runId,
            abilityType,
            activeId,
            queueId,
            action,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to swap ability");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Ability swap error:", err);
        setError(
          err.message ||
            (locale === "vi"
              ? "Lỗi hoán đổi năng lực"
              : "Error swapping ability"),
        );
      }
    },
    [runId, locale],
  );

  // Handle dual cultivation toggle
  const handleToggleDualCultivation = useCallback(async () => {
    try {
      const response = await fetch("/api/dual-cultivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "toggle" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to toggle dual cultivation");
      }

      const result = await response.json();
      setState(result.state);
    } catch (err: any) {
      console.error("Dual cultivation error:", err);
      setError(
        err.message ||
          (locale === "vi"
            ? "Lỗi chuyển đổi song tu"
            : "Error toggling dual cultivation"),
      );
    }
  }, [locale]);

  // Handle exp split change
  const handleSetExpSplit = useCallback(
    async (split: number) => {
      try {
        const response = await fetch("/api/dual-cultivation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "set_split", split }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to set exp split");
        }

        const result = await response.json();
        setState(result.state);
      } catch (err: any) {
        console.error("Exp split error:", err);
        setError(
          err.message ||
            (locale === "vi"
              ? "Lỗi cài đặt phân chia kinh nghiệm"
              : "Error setting exp split"),
        );
      }
    },
    [locale],
  );

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
    setTestCombat({
      enemy: dummyEnemy,
      log: [],
      playerTurn: true,
      playerHp: state.stats.hp,
    });
  }, [state]);

  // Handle test combat action
  const handleTestCombatAction = useCallback(
    (
      action: "attack" | "qi_attack" | "defend" | "flee" | "skill",
      skillId?: string,
    ) => {
      if (!testCombat || !state) return;

      const { enemy, log, playerHp } = testCombat;
      const newLog = [...log];
      const turnNumber = Math.floor(log.length / 2) + 1;

      // Helper to apply enemy damage
      const applyEnemyTurn = (
        isDefending: boolean,
        currentPlayerHp: number,
        currentEnemy: Enemy,
        currentLog: CombatLogEntry[],
      ) => {
        setTimeout(() => {
          const enemyDamage = Math.floor(
            currentEnemy.atk * (0.8 + Math.random() * 0.4),
          );
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
              : null,
          );
        }, 800);
      };

      // Handle skill usage
      if (action === "skill" && skillId) {
        const skill = state.skills?.find((s) => s.id === skillId);
        if (
          skill &&
          state.stats.qi >= skill.qi_cost &&
          (!skill.current_cooldown || skill.current_cooldown <= 0)
        ) {
          // Deduct qi
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  stats: { ...prev.stats, qi: prev.stats.qi - skill.qi_cost },
                }
              : prev,
          );

          // Calculate skill damage
          console.log("[Test Skill DEBUG - Full Skill]", skill);
          console.log(
            "[Test Skill DEBUG - damage_multiplier]",
            skill.damage_multiplier,
            typeof skill.damage_multiplier,
          );
          const baseDamage = state.attrs.str * 1.5;
          const skillDamage = baseDamage * (skill.damage_multiplier || 1);
          console.log("[Test Skill DEBUG - Calculation]", {
            baseDamage,
            multiplier: skill.damage_multiplier,
            skillDamage,
          });
          const playerMiss = Math.random() < 0.1;
          const playerCrit = Math.random() < 0.15;
          const rawDamage = Math.floor(skillDamage * (playerCrit ? 1.5 : 1));
          const finalDamage = playerMiss
            ? 0
            : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

          console.log("[Test Skill]", {
            str: state.attrs.str,
            baseDamage,
            multiplier: skill.damage_multiplier,
            skillDamage,
            rawDamage,
            enemyDef: enemy.def,
            finalDamage,
          });

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

          // Set skill cooldown and grant skill exp
          setState((prev) => {
            if (!prev || !prev.skills) return prev;
            return {
              ...prev,
              skills: prev.skills.map((s) => {
                if (s.id === skillId) {
                  // Grant 5-15 exp for using skill
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
              }),
            };
          });

          if (newEnemy.hp <= 0) {
            setTestCombat(null);
            return;
          }

          setTestCombat((prev) =>
            prev
              ? { ...prev, enemy: newEnemy, log: newLog, playerTurn: false }
              : null,
          );
          applyEnemyTurn(false, playerHp, newEnemy, newLog);

          // Reduce cooldowns
          setState((prev) => {
            if (!prev || !prev.skills) return prev;
            return {
              ...prev,
              skills: prev.skills.map((s) => ({
                ...s,
                current_cooldown:
                  s.current_cooldown && s.current_cooldown > 0
                    ? s.current_cooldown - 1
                    : 0,
              })),
            };
          });
          return;
        }
      }

      // Simple combat simulation
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

        setTestCombat((prev) =>
          prev ? { ...prev, log: newLog, playerTurn: false } : null,
        );
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

        setTestCombat((prev) =>
          prev ? { ...prev, log: newLog, playerTurn: false } : null,
        );
        applyEnemyTurn(true, playerHp, enemy, newLog);
        return;
      }

      // Attack or qi_attack
      const baseDamage =
        action === "qi_attack"
          ? state.attrs.int * 2 + state.attrs.str
          : state.attrs.str * 1.5;
      const isCritical = Math.random() < 0.15;
      const isMiss = Math.random() < 0.1;
      const rawDamage = Math.floor(baseDamage * (isCritical ? 2 : 1));
      const damage = isMiss
        ? 0
        : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

      console.log("[Test Normal]", {
        str: state.attrs.str,
        baseDamage,
        rawDamage,
        enemyDef: enemy.def,
        damage,
        action,
      });

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
      const newEnemyHp = Math.max(
        0,
        enemy.hp - (isMiss ? 0 : Math.max(0, damage)),
      );
      const updatedEnemy = { ...enemy, hp: newEnemyHp };

      // Enemy turn (if not dead)
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
    [testCombat, state],
  );

  // Handle active combat action (from AI combat_encounter)
  const handleActiveCombatAction = useCallback(
    (
      action: "attack" | "qi_attack" | "defend" | "flee" | "skill",
      skillId?: string,
    ) => {
      if (!activeCombat || !state) return;

      const { enemy, log } = activeCombat;
      const newLog = [...log];
      const turnNumber = Math.floor(log.length / 2) + 1;

      // Helper to apply enemy turn
      const applyEnemyTurn = (
        isDefending: boolean,
        currentEnemy: Enemy,
        currentLog: CombatLogEntry[],
      ) => {
        setTimeout(() => {
          const enemyDamage = Math.floor(
            currentEnemy.atk * (0.8 + Math.random() * 0.4),
          );
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

          // Apply damage to player state
          setState((prev) => {
            if (!prev) return prev;
            const newHp = Math.max(0, prev.stats.hp - finalDamage);
            return {
              ...prev,
              stats: {
                ...prev.stats,
                hp: newHp,
              },
            };
          });

          setActiveCombat((prev) =>
            prev
              ? {
                  ...prev,
                  log: [...prev.log, enemyLogEntry],
                  playerTurn: true,
                }
              : null,
          );
        }, 800);
      };

      // Handle skill usage
      if (action === "skill" && skillId) {
        const skill = state.skills?.find((s) => s.id === skillId);
        if (
          skill &&
          state.stats.qi >= skill.qi_cost &&
          (!skill.current_cooldown || skill.current_cooldown <= 0)
        ) {
          // Deduct qi
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  stats: { ...prev.stats, qi: prev.stats.qi - skill.qi_cost },
                }
              : prev,
          );

          // Calculate skill damage based on skill type
          let finalDamage = 0;
          let healAmount = 0;

          if (skill.type === "attack") {
            const baseDamage = state.attrs.str * 1.5;
            const skillDamage = baseDamage * skill.damage_multiplier;
            const playerMiss = Math.random() < 0.1;
            const playerCrit = Math.random() < 0.15;
            const rawDamage = Math.floor(skillDamage * (playerCrit ? 1.5 : 1));
            finalDamage = playerMiss
              ? 0
              : Math.max(1, rawDamage - Math.floor(activeCombat.enemy.def / 2));

            console.log("[Active Skill]", {
              str: state.attrs.str,
              baseDamage,
              multiplier: skill.damage_multiplier,
              skillDamage,
              rawDamage,
              enemyDef: activeCombat.enemy.def,
              finalDamage,
            });
          } else if (skill.type === "defense" && skill.effects?.heal_percent) {
            healAmount = Math.floor(
              state.stats.hp_max * skill.effects.heal_percent,
            );
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    stats: {
                      ...prev.stats,
                      hp: Math.min(
                        prev.stats.hp_max,
                        prev.stats.hp + healAmount,
                      ),
                    },
                  }
                : prev,
            );
          } else if (skill.type === "support" && skill.effects?.heal_percent) {
            healAmount = Math.floor(
              state.stats.hp_max * skill.effects.heal_percent,
            );
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    stats: {
                      ...prev.stats,
                      hp: Math.min(
                        prev.stats.hp_max,
                        prev.stats.hp + healAmount,
                      ),
                    },
                  }
                : prev,
            );
          }

          const playerLogEntry: CombatLogEntry = {
            id: `log-${Date.now()}`,
            turn: turnNumber,
            actor: "player",
            action: "skill",
            damage: finalDamage,
            healAmount: healAmount,
            isCritical: finalDamage > 0 && Math.random() < 0.15,
            isMiss: finalDamage === 0 && skill.type === "attack",
            timestamp: Date.now(),
          };

          const newEnemy = {
            ...enemy,
            hp: Math.max(0, enemy.hp - finalDamage),
          };
          newLog.push(playerLogEntry);

          // Set skill cooldown and grant skill exp
          setState((prev) => {
            if (!prev || !prev.skills) return prev;
            return {
              ...prev,
              skills: prev.skills.map((s) => {
                if (s.id === skillId) {
                  // Grant 5-15 exp for using skill
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
              }),
            };
          });

          if (newEnemy.hp <= 0) {
            setActiveCombat(null);
            return;
          }

          setActiveCombat((prev) =>
            prev
              ? { ...prev, enemy: newEnemy, log: newLog, playerTurn: false }
              : null,
          );
          applyEnemyTurn(false, newEnemy, newLog);

          // Reduce cooldowns
          setState((prev) => {
            if (!prev || !prev.skills) return prev;
            return {
              ...prev,
              skills: prev.skills.map((s) => ({
                ...s,
                current_cooldown:
                  s.current_cooldown && s.current_cooldown > 0
                    ? s.current_cooldown - 1
                    : 0,
              })),
            };
          });
          return;
        }
      }

      // Handle flee
      if (action === "flee") {
        const fleeChance = Math.random();
        if (fleeChance > 0.5) {
          // Successful flee
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

        setActiveCombat((prev) =>
          prev ? { ...prev, log: newLog, playerTurn: false } : null,
        );
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

        setActiveCombat((prev) =>
          prev ? { ...prev, log: newLog, playerTurn: false } : null,
        );
        applyEnemyTurn(true, enemy, newLog);
        return;
      }

      // Attack or qi_attack
      const baseDamage =
        action === "qi_attack"
          ? state.attrs.int * 2 + state.attrs.str
          : state.attrs.str * 1.5; // Normal attack uses STR × 1.5
      const isCritical = Math.random() < 0.15;
      const isMiss = Math.random() < 0.1;
      const rawDamage = Math.floor(baseDamage * (isCritical ? 2 : 1));
      const damage = isMiss
        ? 0
        : Math.max(1, rawDamage - Math.floor(enemy.def / 2));

      console.log("[Active Normal]", {
        str: state.attrs.str,
        baseDamage,
        rawDamage,
        enemyDef: enemy.def,
        damage,
        action,
      });

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
            : prev,
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
      const newEnemyHp = Math.max(
        0,
        enemy.hp - (isMiss ? 0 : Math.max(0, damage)),
      );
      const updatedEnemy = { ...enemy, hp: newEnemyHp };

      // Enemy turn (if not dead)
      if (newEnemyHp > 0) {
        setActiveCombat({
          enemy: updatedEnemy,
          log: newLog,
          playerTurn: false,
        });
        applyEnemyTurn(false, updatedEnemy, newLog);
        return;
      }

      // Enemy dead - victory!
      setActiveCombat({
        enemy: updatedEnemy,
        log: newLog,
        playerTurn: true,
      });
    },
    [activeCombat, state],
  );

  // Handle combat end - apply loot and continue game
  const handleActiveCombatEnd = useCallback(async () => {
    if (!activeCombat || !state) return;

    const victory = activeCombat.enemy.hp <= 0;
    const playerDied = state.stats.hp <= 0;

    let updatedState = { ...state };

    if (victory) {
      // Calculate loot based on enemy
      const lootSilver = Math.floor(Math.random() * 50) + 20;
      const lootExp = Math.floor(Math.random() * 30) + 20;

      // Update state with loot
      updatedState = {
        ...updatedState,
        inventory: {
          ...updatedState.inventory,
          silver: updatedState.inventory.silver + lootSilver,
        },
        progress: {
          ...updatedState.progress,
          cultivation_exp: updatedState.progress.cultivation_exp + lootExp,
        },
      };

      // Show loot notification
      setNarrative((prev) => {
        const lootText =
          locale === "vi"
            ? `\n\n🎉 Chiến thắng! Bạn nhận được ${lootSilver} bạc và ${lootExp} điểm tu luyện.`
            : `\n\n🎉 Victory! You received ${lootSilver} silver and ${lootExp} cultivation points.`;
        return prev + lootText;
      });
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

    // Clear combat
    setActiveCombat(null);
  }, [activeCombat, state, locale, runId]);

  const loadRun = useCallback(async () => {
    try {
      console.log("Loading run:", runId);
      const response = await fetch(`/api/run/${runId}`);
      if (!response.ok) throw new Error("Failed to load run");

      const data = await response.json();
      console.log("Loaded run data:", data.run.current_state);

      // Regenerate stamina based on real-time elapsed
      const loadedState = data.run.current_state;
      if (
        loadedState.last_stamina_regen &&
        loadedState.stats.stamina < loadedState.stats.stamina_max
      ) {
        const now = new Date();
        const lastRegen = new Date(loadedState.last_stamina_regen);
        const minutesElapsed = Math.floor(
          (now.getTime() - lastRegen.getTime()) / 60000,
        );

        if (minutesElapsed > 0) {
          const staminaToRegen = Math.min(
            minutesElapsed,
            loadedState.stats.stamina_max - loadedState.stats.stamina,
          );
          loadedState.stats.stamina += staminaToRegen;
          loadedState.last_stamina_regen = now.toISOString();
          console.log(
            `Regenerated ${staminaToRegen} stamina (${minutesElapsed} minutes elapsed)`,
          );

          // Save updated state
          await fetch(`/api/run/${runId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: loadedState }),
          });
        }
      }

      setState(loadedState);

      // If game has already started, load the last turn's narrative and choices
      if (data.run.current_state.turn_count > 0) {
        const turnLogResponse = await fetch(`/api/turn-log/${runId}/last`);
        if (turnLogResponse.ok) {
          const turnLog = await turnLogResponse.json();
          console.log("Loaded last turn:", turnLog);
          setNarrative(turnLog.narrative);
          if (turnLog.ai_json?.choices) {
            setChoices(turnLog.ai_json.choices);
          }
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Load run error:", err);
      setError("Failed to load game");
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    console.log("State changed:", state);
    if (state && state.turn_count === 0 && !firstTurnStartedRef.current) {
      // Start first turn automatically (only once)
      firstTurnStartedRef.current = true;
      console.log("Starting first turn for run:", runId);
      processTurn(null);
    } else {
      console.log("Not starting turn:", {
        hasState: !!state,
        turnCount: state?.turn_count,
        alreadyStarted: firstTurnStartedRef.current,
      });
    }
  }, [state, runId, processTurn]);
  // Check for full stamina and send notification
  useEffect(() => {
    if (!state || !userId) return;

    const checkStamina = async () => {
      const isStaminaFull = state.stats.stamina === state.stats.stamina_max;
      const wasStaminaNotFull =
        previousStaminaRef.current < state.stats.stamina_max;
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Send notification if:
      // 1. Stamina just became full (wasn't full before)
      // 2. Haven't sent notification in last hour
      if (
        isStaminaFull &&
        wasStaminaNotFull &&
        lastNotificationRef.current < oneHourAgo
      ) {
        try {
          const response = await fetch("/api/notify-stamina-full", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });

          if (response.ok) {
            console.log("Stamina full notification sent");
            lastNotificationRef.current = now;
          }
        } catch (error) {
          console.error("Failed to send stamina notification:", error);
        }
      }

      previousStaminaRef.current = state.stats.stamina;
    };

    // Check immediately
    checkStamina();

    // Check every minute
    const interval = setInterval(checkStamina, 60000);

    return () => clearInterval(interval);
  }, [state?.stats.stamina, state?.stats.stamina_max, userId]);
  const handleChoice = async (choiceId: string) => {
    const selectedChoice = choices.find((c) => c.id === choiceId);

    // Check if can afford the cost
    if (selectedChoice?.cost && state) {
      if (
        selectedChoice.cost.stamina &&
        state.stats.stamina < selectedChoice.cost.stamina
      ) {
        setError(locale === "vi" ? "Không đủ Thể Lực!" : "Not enough Stamina!");
        return;
      }
      if (selectedChoice.cost.qi && state.stats.qi < selectedChoice.cost.qi) {
        setError(locale === "vi" ? "Không đủ Linh Lực!" : "Not enough Qi!");
        return;
      }
      if (
        selectedChoice.cost.silver &&
        state.inventory.silver < selectedChoice.cost.silver
      ) {
        setError(locale === "vi" ? "Không đủ Bạc!" : "Not enough Silver!");
        return;
      }
      if (
        selectedChoice.cost.spirit_stones &&
        state.inventory.spirit_stones < selectedChoice.cost.spirit_stones
      ) {
        setError(
          locale === "vi"
            ? "Không đủ Linh Thạch!"
            : "Not enough Spirit Stones!",
        );
        return;
      }
    }

    await processTurn(choiceId, selectedChoice);
  };

  const handleCustomAction = async () => {
    if (!customAction.trim()) return;

    // Create a custom choice with the user's input
    const customChoice: Choice = {
      id: "custom_action",
      text: customAction.trim(),
    };

    await processTurn("custom_action", customChoice);
    setCustomAction(""); // Clear input after submission
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">{t(locale, "loading")}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">
          {error || t(locale, "error")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-xianxia-accent/30 pb-2">
          <button
            onClick={() => setActiveTab("game")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "game"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabGame")}
          </button>
          <button
            onClick={() => setActiveTab("character")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "character"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabCharacter")}
          </button>
          <button
            onClick={() => setActiveTab("sect")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "sect"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {locale === "vi" ? "⛩️ Môn Phái" : "⛩️ Sect"}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "inventory"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {t(locale, "tabInventory")}
          </button>
          <button
            onClick={() => setActiveTab("market")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "market"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            {locale === "vi" ? "Chợ" : "Market"}
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-3 py-2 text-sm md:px-4 md:text-base rounded-t-lg transition-colors ${
              activeTab === "notifications"
                ? "bg-xianxia-accent text-white"
                : "bg-xianxia-dark hover:bg-xianxia-accent/20"
            }`}
          >
            🔔
          </button>
        </div>

        {/* Content */}
        {activeTab === "game" && (
          <div className="space-y-6">
            {/* Quick Stats Bar */}
            <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">HP: </span>
                  <span className="font-medium text-red-400">
                    {state.stats.hp}/{state.stats.hp_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{t(locale, "qi")}: </span>
                  <span className="font-medium text-blue-400">
                    {state.stats.qi}/{state.stats.qi_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">
                    {t(locale, "stamina")}:{" "}
                  </span>
                  <span className="font-medium text-green-400">
                    {state.stats.stamina}/{state.stats.stamina_max}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">
                    {t(locale, "cultivation")}:{" "}
                  </span>
                  <span className="font-medium text-xianxia-gold">
                    {t(locale, state.progress.realm)}{" "}
                    {state.progress.realm_stage}
                  </span>
                </div>
              </div>
            </div>

            {/* Narrative */}
            <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
              <div className="prose prose-invert max-w-none">
                {narrative ? (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {narrative}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">
                    {processing
                      ? locale === "vi"
                        ? "Đang tạo câu chuyện..."
                        : "Generating story..."
                      : locale === "vi"
                        ? "Bắt đầu cuộc phiêu lưu..."
                        : "Start your adventure..."}
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {/* Choices */}
            {!processing && choices.length > 0 && (
              <div className="space-y-3">
                {choices.map((choice) => {
                  const canAfford =
                    !choice.cost ||
                    ((!choice.cost.stamina ||
                      (state && state.stats.stamina >= choice.cost.stamina)) &&
                      (!choice.cost.qi ||
                        (state && state.stats.qi >= choice.cost.qi)) &&
                      (!choice.cost.silver ||
                        (state &&
                          state.inventory.silver >= choice.cost.silver)) &&
                      (!choice.cost.spirit_stones ||
                        (state &&
                          state.inventory.spirit_stones >=
                            choice.cost.spirit_stones)));

                  return (
                    <button
                      key={choice.id}
                      onClick={() => handleChoice(choice.id)}
                      disabled={processing || !canAfford}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        !canAfford
                          ? "bg-red-900/20 border-red-500/30 opacity-60 cursor-not-allowed"
                          : "bg-xianxia-accent/10 hover:bg-xianxia-accent/20 border-xianxia-accent/30"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="font-medium">{choice.text}</div>
                      {choice.cost && (
                        <div className="text-sm mt-1 flex flex-wrap gap-2">
                          {choice.cost.stamina && (
                            <span
                              className={
                                state &&
                                state.stats.stamina < choice.cost.stamina
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "stamina")}: {choice.cost.stamina}
                            </span>
                          )}
                          {choice.cost.qi && (
                            <span
                              className={
                                state && state.stats.qi < choice.cost.qi
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "qi")}: {choice.cost.qi}
                            </span>
                          )}
                          {choice.cost.silver && (
                            <span
                              className={
                                state &&
                                state.inventory.silver < choice.cost.silver
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "silver")}: {choice.cost.silver}
                            </span>
                          )}
                          {choice.cost.spirit_stones && (
                            <span
                              className={
                                state &&
                                state.inventory.spirit_stones <
                                  choice.cost.spirit_stones
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }
                            >
                              {t(locale, "spiritStones")}:{" "}
                              {choice.cost.spirit_stones}
                            </span>
                          )}
                          {choice.cost.time_segments && (
                            <span className="text-gray-400">
                              Time: {choice.cost.time_segments}
                            </span>
                          )}
                        </div>
                      )}
                      {!canAfford && (
                        <div className="text-xs text-red-400 mt-1">
                          {locale === "vi"
                            ? "(Không đủ điều kiện)"
                            : "(Cannot afford)"}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Custom Action Input */}
                <div className="mt-4 p-4 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg">
                  <label className="block text-sm font-medium text-xianxia-accent mb-2">
                    {locale === "vi"
                      ? "✍️ Hoặc nhập hành động của bạn:"
                      : "✍️ Or type your own action:"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !processing &&
                          customAction.trim()
                        ) {
                          handleCustomAction();
                        }
                      }}
                      disabled={processing}
                      placeholder={
                        locale === "vi"
                          ? "Ví dụ: Tôi muốn khám phá hang động phía đông..."
                          : "Example: I want to explore the cave to the east..."
                      }
                      className="flex-1 px-4 py-2 bg-xianxia-dark border border-xianxia-accent/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-xianxia-accent disabled:opacity-50"
                    />
                    <button
                      onClick={handleCustomAction}
                      disabled={processing || !customAction.trim()}
                      className="px-6 py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {locale === "vi" ? "Gửi" : "Submit"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {locale === "vi"
                      ? "Bạn có thể nhập bất kỳ hành động nào bạn muốn thực hiện. AI sẽ xử lý và tạo kết quả phù hợp với câu chuyện."
                      : "You can type any action you want to take. The AI will process it and generate results fitting the story."}
                  </p>
                </div>
              </div>
            )}

            {processing && (
              <div className="p-4 bg-xianxia-accent/10 border border-xianxia-accent/30 rounded-lg text-center text-xianxia-accent">
                {locale === "vi"
                  ? "Đang xử lý lượt chơi..."
                  : "Processing turn..."}
              </div>
            )}
          </div>
        )}

        {activeTab === "character" && (
          <CharacterSheet
            state={state}
            locale={locale}
            previousExp={previousExp}
            onAbilitySwap={handleAbilitySwap}
            onToggleDualCultivation={handleToggleDualCultivation}
            onSetExpSplit={handleSetExpSplit}
          />
        )}
        {activeTab === "sect" && <SectView state={state} locale={locale} />}
        {activeTab === "inventory" && (
          <InventoryView
            state={state}
            locale={locale}
            onEquipItem={handleEquipItem}
            onDiscardItem={handleDiscardItem}
            onUseItem={handleUseItem}
            onEnhanceItem={handleEnhanceItem}
          />
        )}
        {activeTab === "market" && (
          <MarketView
            state={state}
            locale={locale}
            onBuyItem={(id) => handleMarketAction(id, "buy")}
            onSellItem={(id) => handleMarketAction(id, "sell")}
            onRefreshMarket={handleRefreshMarket}
            onExchange={handleExchange}
          />
        )}
        {activeTab === "notifications" && userId && (
          <NotificationManager userId={userId} locale={locale} />
        )}
      </div>

      {/* Debug buttons - remove after testing */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <DebugInventory />
        <button
          onClick={startTestCombat}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg transition-colors"
        >
          {locale === "vi" ? "⚔️ Test Combat" : "⚔️ Test Combat"}
        </button>
      </div>

      {/* Test Combat View */}
      {testCombat && state && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CombatView
              state={state}
              enemy={testCombat.enemy}
              locale={locale}
              combatLog={testCombat.log}
              playerTurn={testCombat.playerTurn}
              onAction={handleTestCombatAction}
              onCombatEnd={() => setTestCombat(null)}
              overridePlayerHp={testCombat.playerHp}
            />
            <button
              onClick={() => setTestCombat(null)}
              className="mt-4 w-full py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
            >
              {locale === "vi" ? "Đóng Test Combat" : "Close Test Combat"}
            </button>
          </div>
        </div>
      )}

      {/* Active Combat View - Triggered by AI combat_encounter */}
      {activeCombat && state && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CombatView
              state={state}
              enemy={activeCombat.enemy}
              locale={locale}
              combatLog={activeCombat.log}
              playerTurn={activeCombat.playerTurn}
              onAction={handleActiveCombatAction}
              onCombatEnd={handleActiveCombatEnd}
            />
          </div>
        </div>
      )}

      {/* Breakthrough Modal */}
      {breakthroughEvent && (
        <BreakthroughModal
          event={breakthroughEvent}
          locale={locale}
          onClose={() => setBreakthroughEvent(null)}
        />
      )}
    </div>
  );
}
