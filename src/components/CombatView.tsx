"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameState, Enemy, CombatLogEntry } from "@/types/game";
import { Locale, t } from "@/lib/i18n/translations";
import HealthBar from "./HealthBar";
import EnemyPortrait from "./EnemyPortrait";
import { DamageNumberManager, DamageNumberData } from "./DamageNumber";
import CombatMoveAnimation, { MoveType, useCombatAnimation } from "./CombatMoveAnimation";

interface CombatViewProps {
  state: GameState;
  enemy: Enemy;
  locale: Locale;
  combatLog: CombatLogEntry[];
  playerTurn: boolean;
  onAction: (
    action: "attack" | "qi_attack" | "defend" | "flee" | "skill",
    skillId?: string
  ) => void;
  onCombatEnd: () => void;
  overridePlayerHp?: number; // For test combat to track HP separately
}

export default function CombatView({
  state,
  enemy,
  locale,
  combatLog,
  playerTurn,
  onAction,
  onCombatEnd,
  overridePlayerHp,
}: CombatViewProps) {
  // Use overridden HP if provided, otherwise use state HP
  const playerHp = overridePlayerHp !== undefined ? overridePlayerHp : state.stats.hp;
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const combatLogRef = useRef<HTMLDivElement>(null);
  const lastLogLengthRef = useRef(0);
  const { currentMove, triggerAnimation, clearAnimation } = useCombatAnimation();
  const lastProcessedLogRef = useRef<string | null>(null);

  // Auto-scroll combat log
  useEffect(() => {
    if (combatLogRef.current && combatLog.length > lastLogLengthRef.current) {
      combatLogRef.current.scrollTop = combatLogRef.current.scrollHeight;
      lastLogLengthRef.current = combatLog.length;
    }
  }, [combatLog]);

  // Process new combat log entries for animations
  useEffect(() => {
    const lastEntry = combatLog[combatLog.length - 1];
    if (!lastEntry) return;

    // Prevent processing the same entry twice
    if (lastProcessedLogRef.current === lastEntry.id) return;
    lastProcessedLogRef.current = lastEntry.id;

    // Create damage number
    const newDamageNumber: DamageNumberData = {
      id: `dmg-${Date.now()}-${Math.random()}`,
      value: lastEntry.damage || 0,
      type: lastEntry.isMiss
        ? "miss"
        : lastEntry.isDodged
          ? "dodge"
          : lastEntry.isBlocked
            ? "blocked"
            : lastEntry.healAmount
              ? "heal"
              : lastEntry.isCritical
                ? "critical"
                : "damage",
      x: lastEntry.actor === "player" ? 100 : -100,
      y: -20 + Math.random() * 40,
    };

    // Add damage number
    if (lastEntry.damage || lastEntry.isMiss || lastEntry.isDodged || lastEntry.healAmount) {
      setDamageNumbers((prev) => [...prev, newDamageNumber]);
    }

    // Determine move animation type
    const isPlayerMove = lastEntry.actor === "player";
    let moveType: MoveType | null = null;

    // Find skill by actionName if this was a skill action
    const usedSkill =
      lastEntry.action === "skill" && lastEntry.actionName
        ? state.skills?.find(
            (s) => s.name === lastEntry.actionName || s.name_en === lastEntry.actionName
          )
        : undefined;

    if (lastEntry.isMiss) {
      moveType = "miss";
    } else if (lastEntry.isDodged) {
      moveType = "dodge";
    } else if (lastEntry.isCritical) {
      moveType = "critical_hit";
    } else if (lastEntry.action === "defend") {
      moveType = "defend";
    } else if (lastEntry.action === "qi_attack") {
      moveType = "qi_attack";
    } else if (lastEntry.action === "skill") {
      // Determine skill type based on the skill used
      if (usedSkill?.type === "defense") {
        moveType = "skill_defense";
      } else if (usedSkill?.type === "support") {
        moveType = "skill_buff";
      } else {
        moveType = "skill_attack";
      }
    } else if (lastEntry.action === "attack") {
      moveType = isPlayerMove ? "attack" : "enemy_attack";
    }

    // Trigger move animation
    if (moveType) {
      // Get skill element if applicable
      const skillElement = usedSkill?.element as "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ" | undefined;
      triggerAnimation(moveType, isPlayerMove, skillElement);
    }

    // Trigger hit animation
    if (lastEntry.damage && !lastEntry.isMiss && !lastEntry.isDodged) {
      if (lastEntry.actor === "player") {
        setEnemyHit(true);
        setTimeout(() => setEnemyHit(false), 200);
      } else {
        setPlayerHit(true);
        setTimeout(() => setPlayerHit(false), 200);
      }
    }
  }, [combatLog, state.skills, triggerAnimation]);

  // Remove damage number after animation
  const handleRemoveDamageNumber = useCallback((id: string) => {
    setDamageNumbers((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Check if enemy/player is dead (must be before keyboard handler)
  const enemyDead = enemy.hp <= 0;
  const playerDead = playerHp <= 0;

  // Handle action button click
  const handleAction = useCallback(
    (action: "attack" | "qi_attack" | "defend" | "flee" | "skill", skillId?: string) => {
      if (!playerTurn) return;
      onAction(action as any, skillId || selectedSkill || undefined);
      setSelectedSkill(null);
    },
    [playerTurn, onAction, selectedSkill]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerTurn || enemyDead || playerDead) return;
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "1":
          handleAction("attack");
          break;
        case "2":
          if (state.stats.qi >= 10) handleAction("qi_attack");
          break;
        case "3":
          handleAction("defend");
          break;
        case "4":
          handleAction("flee");
          break;
        default: {
          // Keys 5-9 for skills
          const skillIdx = parseInt(e.key) - 5;
          if (skillIdx >= 0 && skillIdx < (state.skills?.length || 0)) {
            const skill = state.skills![skillIdx];
            const cd = combatLog.length === 0 ? 0 : skill.current_cooldown || 0;
            if (state.stats.qi >= skill.qi_cost && cd <= 0) {
              handleAction("skill", skill.id);
            }
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerTurn, enemyDead, playerDead, handleAction, state.stats.qi, state.skills, combatLog]);

  // Format combat log entry
  const formatLogEntry = (entry: CombatLogEntry): string => {
    const actorName =
      entry.actor === "player"
        ? locale === "vi"
          ? "Bạn"
          : "You"
        : locale === "vi"
          ? enemy.name
          : enemy.name_en;

    if (entry.isMiss) {
      return locale === "vi" ? `${actorName} đã đánh trượt!` : `${actorName} missed!`;
    }

    if (entry.isDodged) {
      return locale === "vi"
        ? `${entry.actor === "player" ? (locale === "vi" ? enemy.name : enemy.name_en) : locale === "vi" ? "Bạn" : "You"} đã né tránh!`
        : `${entry.actor === "player" ? enemy.name_en : "You"} dodged!`;
    }

    if (entry.healAmount) {
      return locale === "vi"
        ? `${actorName} hồi phục ${entry.healAmount} HP!`
        : `${actorName} healed ${entry.healAmount} HP!`;
    }

    const actionText =
      entry.action === "defend"
        ? locale === "vi"
          ? "phòng thủ"
          : "defended"
        : entry.action === "qi_attack"
          ? locale === "vi"
            ? "tấn công bằng khí"
            : "qi attacked"
          : locale === "vi"
            ? "tấn công"
            : "attacked";

    const critText = entry.isCritical ? (locale === "vi" ? " (Chí mạng!)" : " (Critical!)") : "";

    return locale === "vi"
      ? `${actorName} ${actionText}${entry.damage ? ` gây ${entry.damage} sát thương` : ""}${critText}`
      : `${actorName} ${actionText}${entry.damage ? ` for ${entry.damage} damage` : ""}${critText}`;
  };

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-6">
      {/* Combat Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-red-500 animate-pulse">
          {locale === "vi" ? "⚔️ CHIẾN ĐẤU ⚔️" : "⚔️ COMBAT ⚔️"}
        </h2>
        <div
          className={`inline-flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            playerTurn
              ? "bg-green-900/40 border border-green-500/50 text-green-400"
              : "bg-red-900/40 border border-red-500/50 text-red-400 animate-pulse"
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${playerTurn ? "bg-green-400" : "bg-red-400"}`}
          />
          {playerTurn
            ? locale === "vi"
              ? "Lượt của bạn"
              : "Your Turn"
            : locale === "vi"
              ? "Lượt của địch"
              : "Enemy's Turn"}
        </div>
      </div>

      {/* Combat Move Animation Overlay */}
      <CombatMoveAnimation
        moveType={currentMove?.type || null}
        isPlayerMove={currentMove?.isPlayerMove ?? true}
        skillElement={currentMove?.skillElement}
        onComplete={clearAnimation}
      />

      {/* Combat Arena */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative">
        {/* Player Side */}
        <div className={`relative ${playerHit ? "animate-bounce" : ""}`}>
          <div className="text-center mb-2">
            <span className="text-xianxia-gold font-bold">{locale === "vi" ? "Bạn" : "You"}</span>
          </div>
          <div className="space-y-2">
            <HealthBar
              current={playerHp}
              max={state.stats.hp_max}
              type="hp"
              size="medium"
              label="HP"
            />
            <HealthBar
              current={state.stats.qi}
              max={state.stats.qi_max}
              type="qi"
              size="small"
              label={t(locale, "qi")}
            />
          </div>
          {/* Player stats */}
          <div className="mt-2 text-xs text-gray-400 flex justify-around">
            <span>STR: {state.attrs.str}</span>
            <span>AGI: {state.attrs.agi}</span>
            <span>INT: {state.attrs.int}</span>
          </div>

          {/* Damage numbers for player */}
          <DamageNumberManager
            numbers={damageNumbers.filter((n) => n.x && n.x < 0)}
            onRemove={handleRemoveDamageNumber}
          />
        </div>

        {/* VS Indicator */}
        <div className="flex items-center justify-center">
          <div className="text-4xl font-bold text-xianxia-accent animate-pulse">VS</div>
        </div>

        {/* Enemy Side */}
        <div className="relative">
          <EnemyPortrait enemy={enemy} locale={locale} isHit={enemyHit} isDead={enemyDead} />

          {/* Damage numbers for enemy */}
          <DamageNumberManager
            numbers={damageNumbers.filter((n) => n.x && n.x > 0)}
            onRemove={handleRemoveDamageNumber}
          />
        </div>
      </div>

      {/* Combat Log */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">
            {locale === "vi" ? "Nhật ký chiến đấu" : "Combat Log"}
          </h3>
          <button
            onClick={() => setLogExpanded(!logExpanded)}
            className="text-xs text-gray-500 hover:text-xianxia-accent transition-colors px-2 py-0.5 rounded border border-gray-700 hover:border-xianxia-accent/50"
            aria-label={logExpanded ? "Collapse combat log" : "Expand combat log"}
          >
            {logExpanded
              ? locale === "vi"
                ? "▲ Thu gọn"
                : "▲ Collapse"
              : locale === "vi"
                ? "▼ Mở rộng"
                : "▼ Expand"}
          </button>
        </div>
        <div
          ref={combatLogRef}
          className={`${logExpanded ? "h-64" : "h-32"} overflow-y-auto bg-xianxia-darker rounded p-3 space-y-1 text-sm transition-all duration-300`}
          role="log"
          aria-live="polite"
          aria-label={locale === "vi" ? "Nhật ký chiến đấu" : "Combat Log"}
        >
          {combatLog.length === 0 ? (
            <div className="text-gray-500 italic">
              {locale === "vi" ? "Chiến đấu bắt đầu..." : "Combat begins..."}
            </div>
          ) : (
            combatLog.map((entry) => (
              <div
                key={entry.id}
                className={`${
                  entry.actor === "player" ? "text-green-400" : "text-red-400"
                } ${entry.isCritical ? "font-bold" : ""}`}
              >
                <span className="text-gray-500 text-xs mr-2">[{entry.turn}]</span>
                {formatLogEntry(entry)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {!enemyDead && !playerDead && (
        <div className="space-y-4">
          {/* Main Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => handleAction("attack")}
              disabled={!playerTurn}
              className={`p-3 rounded-lg border transition-all relative ${
                playerTurn
                  ? "bg-red-900/30 border-red-500/50 hover:bg-red-900/50 text-red-400"
                  : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="absolute top-1 right-1.5 text-[10px] font-mono opacity-40 hidden md:inline">
                1
              </span>
              <div className="font-bold">{locale === "vi" ? "⚔️ Tấn Công" : "⚔️ Attack"}</div>
              <div className="text-xs opacity-70">
                {locale === "vi" ? "Sát thương vật lý" : "Physical damage"}
              </div>
            </button>

            <button
              onClick={() => handleAction("qi_attack")}
              disabled={!playerTurn || state.stats.qi < 10}
              className={`p-3 rounded-lg border transition-all relative ${
                playerTurn && state.stats.qi >= 10
                  ? "bg-blue-900/30 border-blue-500/50 hover:bg-blue-900/50 text-blue-400"
                  : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="absolute top-1 right-1.5 text-[10px] font-mono opacity-40 hidden md:inline">
                2
              </span>
              <div className="font-bold">{locale === "vi" ? "✨ Khí Công" : "✨ Qi Attack"}</div>
              <div className="text-xs opacity-70">
                {locale === "vi" ? "Chi phí: 10 Khí" : "Cost: 10 Qi"}
              </div>
            </button>

            <button
              onClick={() => handleAction("defend")}
              disabled={!playerTurn}
              className={`p-3 rounded-lg border transition-all relative ${
                playerTurn
                  ? "bg-yellow-900/30 border-yellow-500/50 hover:bg-yellow-900/50 text-yellow-400"
                  : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="absolute top-1 right-1.5 text-[10px] font-mono opacity-40 hidden md:inline">
                3
              </span>
              <div className="font-bold">{locale === "vi" ? "🛡️ Phòng Thủ" : "🛡️ Defend"}</div>
              <div className="text-xs opacity-70">
                {locale === "vi" ? "Giảm sát thương" : "Reduce damage"}
              </div>
            </button>

            <button
              onClick={() => handleAction("flee")}
              disabled={!playerTurn}
              className={`p-3 rounded-lg border transition-all relative ${
                playerTurn
                  ? "bg-gray-700/30 border-gray-500/50 hover:bg-gray-700/50 text-gray-400"
                  : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="absolute top-1 right-1.5 text-[10px] font-mono opacity-40 hidden md:inline">
                4
              </span>
              <div className="font-bold">{locale === "vi" ? "🏃 Chạy Trốn" : "🏃 Flee"}</div>
              <div className="text-xs opacity-70">
                {locale === "vi" ? "Cơ hội thoát" : "Chance to escape"}
              </div>
            </button>
          </div>

          {/* Skills (if any) */}
          {state.skills && state.skills.length > 0 && (
            <div>
              <h4 className="text-sm text-gray-400 mb-2">
                {locale === "vi" ? "Kỹ năng:" : "Skills:"}
              </h4>
              <div className="flex flex-wrap gap-2">
                {state.skills.map((skill, index) => {
                  // At combat start (empty log), all skills should be available
                  // current_cooldown is reset to 0 for fresh combat
                  const effectiveCooldown =
                    combatLog.length === 0 ? 0 : skill.current_cooldown || 0;

                  const canUse =
                    playerTurn && state.stats.qi >= skill.qi_cost && effectiveCooldown <= 0;
                  const onCooldown = effectiveCooldown > 0;

                  return (
                    <button
                      key={skill.id}
                      onClick={() => {
                        if (!canUse) return;
                        onAction("skill", skill.id);
                        setSelectedSkill(null);
                      }}
                      disabled={!canUse}
                      className={`px-3 py-2 rounded border text-sm transition-all relative ${
                        canUse
                          ? "bg-purple-900/30 border-purple-500/50 hover:bg-purple-900/50 text-purple-400 cursor-pointer"
                          : "bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {index < 5 && (
                        <span className="absolute top-0.5 right-1 text-[10px] font-mono opacity-40 hidden md:inline">
                          {index + 5}
                        </span>
                      )}
                      <div>{locale === "vi" ? skill.name : skill.name_en}</div>
                      <div className="text-xs opacity-70">
                        {onCooldown
                          ? `(${locale === "vi" ? "Hồi chiêu" : "Cooldown"}: ${effectiveCooldown})`
                          : `(${skill.qi_cost} ${locale === "vi" ? "Khí" : "Qi"})`}
                      </div>
                      {skill.type && (
                        <div className="text-xs opacity-50">
                          {skill.type === "attack" ? "⚔️" : skill.type === "defense" ? "🛡️" : "✨"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Combat End States */}
      {enemyDead && (
        <div
          className="text-center p-6 bg-green-900/20 border border-green-500/50 rounded-lg"
          role="alert"
        >
          <h3 className="text-2xl font-bold text-green-400 mb-2">
            {locale === "vi" ? "🎉 CHIẾN THẮNG! 🎉" : "🎉 VICTORY! 🎉"}
          </h3>
          <p className="text-gray-300 mb-4">
            {locale === "vi" ? `Bạn đã đánh bại ${enemy.name}!` : `You defeated ${enemy.name_en}!`}
          </p>
          <button
            onClick={onCombatEnd}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
          >
            {locale === "vi" ? "Thu thập chiến lợi phẩm" : "Collect Loot"}
          </button>
        </div>
      )}

      {playerDead && (
        <div
          className="text-center p-6 bg-red-900/20 border border-red-500/50 rounded-lg"
          role="alert"
        >
          <h3 className="text-2xl font-bold text-red-400 mb-2">
            {locale === "vi" ? "💀 THẤT BẠI 💀" : "💀 DEFEAT 💀"}
          </h3>
          <p className="text-gray-300 mb-4">
            {locale === "vi" ? "Bạn đã bị đánh bại..." : "You have been defeated..."}
          </p>
          <button
            onClick={onCombatEnd}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
          >
            {locale === "vi" ? "Tiếp tục" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
