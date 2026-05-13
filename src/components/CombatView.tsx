"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameState, Enemy, CombatLogEntry } from "@/types/game";
import { Locale, t } from "@/lib/i18n/translations";
import { DamageNumberManager, DamageNumberData } from "./DamageNumber";
import CombatMoveAnimation, {
  MoveType,
  useCombatAnimation,
} from "./CombatMoveAnimation";
import { Bar, Card, Pill, Seal } from "@/components/ui";

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
  overridePlayerHp?: number;
}

const ORD_HAN = ["一", "二", "三", "四", "五"];

function playerInitial(state: GameState): string {
  const name =
    (state as any).character_name ||
    (state as any).name ||
    "道";
  return String(name).charAt(0);
}

function enemyInitial(enemy: Enemy): string {
  const name = enemy.name || enemy.name_en || "魔";
  return name.charAt(0);
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
  const playerHp = overridePlayerHp !== undefined ? overridePlayerHp : state.stats.hp;
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
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

  // Process log entries for animations
  useEffect(() => {
    const lastEntry = combatLog[combatLog.length - 1];
    if (!lastEntry) return;
    if (lastProcessedLogRef.current === lastEntry.id) return;
    lastProcessedLogRef.current = lastEntry.id;

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

    if (
      lastEntry.damage ||
      lastEntry.isMiss ||
      lastEntry.isDodged ||
      lastEntry.healAmount
    ) {
      setDamageNumbers((prev) => [...prev, newDamageNumber]);
    }

    const isPlayerMove = lastEntry.actor === "player";
    let moveType: MoveType | null = null;
    const usedSkill =
      lastEntry.action === "skill" && lastEntry.actionName
        ? state.skills?.find(
            (s) =>
              s.name === lastEntry.actionName || s.name_en === lastEntry.actionName
          )
        : undefined;

    if (lastEntry.isMiss) moveType = "miss";
    else if (lastEntry.isDodged) moveType = "dodge";
    else if (lastEntry.isCritical) moveType = "critical_hit";
    else if (lastEntry.action === "defend") moveType = "defend";
    else if (lastEntry.action === "qi_attack") moveType = "qi_attack";
    else if (lastEntry.action === "skill") {
      if (usedSkill?.type === "defense") moveType = "skill_defense";
      else if (usedSkill?.type === "support") moveType = "skill_buff";
      else moveType = "skill_attack";
    } else if (lastEntry.action === "attack")
      moveType = isPlayerMove ? "attack" : "enemy_attack";

    if (moveType) {
      const skillElement = usedSkill?.element as
        | "Kim"
        | "Mộc"
        | "Thủy"
        | "Hỏa"
        | "Thổ"
        | undefined;
      triggerAnimation(moveType, isPlayerMove, skillElement);
    }

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

  const handleRemoveDamageNumber = useCallback((id: string) => {
    setDamageNumbers((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const enemyDead = enemy.hp <= 0;
  const playerDead = playerHp <= 0;

  const handleAction = useCallback(
    (
      action: "attack" | "qi_attack" | "defend" | "flee" | "skill",
      skillId?: string
    ) => {
      if (!playerTurn) return;
      onAction(action, skillId || selectedSkill || undefined);
      setSelectedSkill(null);
    },
    [playerTurn, onAction, selectedSkill]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerTurn || enemyDead || playerDead) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
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
          const skillIdx = parseInt(e.key) - 5;
          if (skillIdx >= 0 && skillIdx < (state.skills?.length || 0)) {
            const skill = state.skills![skillIdx];
            const cd = combatLog.length === 0 ? 0 : skill.current_cooldown || 0;
            if (state.stats.qi >= skill.qi_cost && cd <= 0) {
              handleAction("skill", skill.id);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    playerTurn,
    enemyDead,
    playerDead,
    handleAction,
    state.stats.qi,
    state.skills,
    combatLog,
  ]);

  // Format log entry as a narration string
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
      return locale === "vi"
        ? `${actorName} đã đánh trượt!`
        : `${actorName} missed!`;
    }
    if (entry.isDodged) {
      const target =
        entry.actor === "player"
          ? locale === "vi"
            ? enemy.name
            : enemy.name_en
          : locale === "vi"
            ? "Bạn"
            : "You";
      return locale === "vi" ? `${target} đã né tránh!` : `${target} dodged!`;
    }
    if (entry.healAmount) {
      return locale === "vi"
        ? `${actorName} hồi phục ${entry.healAmount} HP!`
        : `${actorName} healed ${entry.healAmount} HP!`;
    }

    const actionText =
      entry.action === "defend"
        ? locale === "vi"
          ? "vận khí phòng thủ"
          : "raises a guard"
        : entry.action === "qi_attack"
          ? locale === "vi"
            ? "thi triển khí công"
            : "unleashes qi"
          : entry.actionName
            ? locale === "vi"
              ? `thi triển ${entry.actionName}`
              : `casts ${entry.actionName}`
            : locale === "vi"
              ? "đánh ra một đòn"
              : "strikes";

    const critText = entry.isCritical
      ? locale === "vi"
        ? " — chí mạng!"
        : " — critical!"
      : "";

    return locale === "vi"
      ? `${actorName} ${actionText}${entry.damage ? `, gây ${entry.damage} sát thương` : ""}${critText}.`
      : `${actorName} ${actionText}${entry.damage ? `, dealing ${entry.damage} damage` : ""}${critText}.`;
  };

  const techniqueSkills = (state.skills || []).slice(0, 4);

  const enemyIntent =
    (enemy as any).intent || (enemy as any).next_action || null;

  return (
    <Card padding={0} style={{ maxWidth: 960, width: "100%", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "16px 22px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Seal size="lg">戰</Seal>
          <div>
            <div className="label">{t(locale, "combatTitle")}</div>
            <h2
              className="t-display"
              style={{
                fontSize: 24,
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {locale === "vi" ? enemy.name : enemy.name_en ?? enemy.name}
            </h2>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Pill variant={playerTurn ? "jade" : "cinnabar"} withDot>
            {playerTurn ? t(locale, "yourTurn") : t(locale, "enemyTurn")}
          </Pill>
          <button onClick={onCombatEnd} className="ink-btn ghost sm">
            {t(locale, "combatRetreat")} ✕
          </button>
        </div>
      </div>

      {/* Combat stage */}
      <div
        className="combat-stage"
        style={{
          margin: 22,
          padding: 28,
          position: "relative",
        }}
      >
        <CombatMoveAnimation
          moveType={currentMove?.type || null}
          isPlayerMove={currentMove?.isPlayerMove ?? true}
          skillElement={currentMove?.skillElement}
          onComplete={clearAnimation}
        />

        <div
          className="combat-stage-grid"
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Player */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: playerHit ? "translateX(-6px)" : "translateX(0)",
              transition: "transform 0.18s",
            }}
          >
            <div className="portrait">{playerInitial(state)}</div>
            <div
              className="t-display"
              style={{
                fontSize: 18,
                color: "var(--ink)",
                marginTop: 10,
              }}
            >
              {locale === "vi" ? "Bạn" : "You"}
            </div>
            <div className="label" style={{ marginBottom: 8 }}>
              {state.progress.realm}
            </div>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <Bar
                kind="hp"
                label="HP"
                value={playerHp}
                max={state.stats.hp_max}
              />
              <Bar
                kind="qi"
                label={t(locale, "qi")}
                value={state.stats.qi}
                max={state.stats.qi_max}
              />
            </div>
            <DamageNumberManager
              numbers={damageNumbers.filter((n) => n.x && n.x < 0)}
              onRemove={handleRemoveDamageNumber}
            />
          </div>

          {/* Center watermark */}
          <div
            className="t-han"
            style={{
              fontSize: 96,
              color: "var(--ink)",
              opacity: 0.08,
              userSelect: "none",
              letterSpacing: "-0.04em",
            }}
            aria-hidden
          >
            戰
          </div>

          {/* Enemy */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: enemyHit ? "translateX(6px)" : "translateX(0)",
              transition: "transform 0.18s",
            }}
          >
            <div className="portrait enemy">{enemyInitial(enemy)}</div>
            <div
              className="t-display"
              style={{
                fontSize: 18,
                color: "var(--cinnabar-deep)",
                marginTop: 10,
              }}
            >
              {locale === "vi" ? enemy.name : enemy.name_en}
            </div>
            <div className="label" style={{ marginBottom: 8 }}>
              {(enemy as any).tier
                ? locale === "vi"
                  ? `Cấp ${(enemy as any).tier}`
                  : `Tier ${(enemy as any).tier}`
                : (enemy as any).realm ?? ""}
            </div>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <Bar
                kind="hp"
                label="HP"
                value={enemy.hp}
                max={enemy.hp_max ?? enemy.hp}
              />
            </div>
            {enemyIntent && (
              <div
                className="label-cinnabar label"
                style={{ marginTop: 10, fontSize: 11 }}
              >
                {t(locale, "combatIntent")} — {enemyIntent}
              </div>
            )}
            <DamageNumberManager
              numbers={damageNumbers.filter((n) => n.x && n.x > 0)}
              onRemove={handleRemoveDamageNumber}
            />
          </div>
        </div>
      </div>

      {/* Action grid + log */}
      <div className="combat-action-grid">
        {/* Actions */}
        <div>
          {/* Techniques */}
          {techniqueSkills.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="label" style={{ marginBottom: 4 }}>
                {locale === "vi" ? "Công Pháp" : "Techniques"}
              </div>
              {techniqueSkills.map((skill, idx) => {
                const cd =
                  combatLog.length === 0 ? 0 : skill.current_cooldown || 0;
                const canUse =
                  playerTurn && state.stats.qi >= skill.qi_cost && cd <= 0;
                return (
                  <button
                    key={skill.id}
                    onClick={() => canUse && handleAction("skill", skill.id)}
                    disabled={!canUse}
                    className={`choice ${!canUse ? "cant-afford" : ""}`}
                    style={{ paddingTop: 10, paddingBottom: 10 }}
                  >
                    <span className="ord">{ORD_HAN[idx]}</span>
                    <div
                      className="t-display"
                      style={{ fontSize: 15, color: "var(--ink)" }}
                    >
                      {locale === "vi" ? skill.name : skill.name_en}
                    </div>
                    <div className="cost">
                      <span
                        className={`c-item ${state.stats.qi < skill.qi_cost ? "out" : ""}`}
                      >
                        <span className="t-han">氣</span>
                        {skill.qi_cost}
                      </span>
                      {cd > 0 && (
                        <span className="c-item out">
                          <span className="t-han">封</span>
                          {cd}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              className="t-body"
              style={{
                fontStyle: "italic",
                color: "var(--ink-mute)",
                fontSize: 13,
              }}
            >
              {locale === "vi"
                ? "Chưa lĩnh hội công pháp chiến đấu nào."
                : "No techniques learned yet."}
            </div>
          )}

          {/* Basic actions */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <button
              onClick={() => handleAction("attack")}
              disabled={!playerTurn || enemyDead || playerDead}
              className="ink-btn primary"
              style={{ justifyContent: "center" }}
            >
              <span className="t-han">擊</span>
              {locale === "vi" ? "Đánh" : "Attack"}
            </button>
            <button
              onClick={() => handleAction("defend")}
              disabled={!playerTurn || enemyDead || playerDead}
              className="ink-btn ghost"
              style={{ justifyContent: "center" }}
            >
              <span className="t-han">守</span>
              {locale === "vi" ? "Phòng" : "Defend"}
            </button>
            <button
              onClick={() => handleAction("flee")}
              disabled={!playerTurn || enemyDead || playerDead}
              className="ink-btn cinnabar"
              style={{ justifyContent: "center" }}
            >
              <span className="t-han">逃</span>
              {locale === "vi" ? "Chạy" : "Flee"}
            </button>
          </div>
        </div>

        {/* Combat log */}
        <div>
          <div className="label" style={{ marginBottom: 4 }}>
            {locale === "vi" ? "Nhật Ký Chiến Đấu" : "Combat Log"}
          </div>
          <div
            ref={combatLogRef}
            className="scroll-pad"
            style={{
              maxHeight: 280,
              overflowY: "auto",
              padding: 12,
              background: "var(--paper-deep)",
              border: "1px solid var(--line-soft)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            role="log"
            aria-live="polite"
          >
            {combatLog.length === 0 ? (
              <p
                className="t-body"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-mute)",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                {locale === "vi"
                  ? "Trận chiến vừa khai diễn…"
                  : "Battle has just begun…"}
              </p>
            ) : (
              combatLog.map((entry) => {
                const isPlayer = entry.actor === "player";
                const accent = isPlayer ? "var(--jade)" : "var(--cinnabar)";
                return (
                  <div
                    key={entry.id}
                    style={{
                      borderLeft: `2px solid ${accent}`,
                      paddingLeft: 10,
                    }}
                  >
                    <p
                      className="t-body"
                      style={{
                        margin: 0,
                        fontStyle: "italic",
                        fontSize: 13,
                        color: "var(--ink)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span
                        className="t-num"
                        style={{
                          color: "var(--ink-faint)",
                          marginRight: 6,
                          fontStyle: "normal",
                          fontSize: 11,
                        }}
                      >
                        [{entry.turn}]
                      </span>
                      {formatLogEntry(entry)}
                    </p>
                    {(entry.damage || entry.healAmount) && (
                      <div
                        className="t-num"
                        style={{
                          fontSize: 11,
                          color: isPlayer
                            ? "var(--jade-deep)"
                            : "var(--cinnabar-deep)",
                          marginTop: 2,
                        }}
                      >
                        {entry.healAmount
                          ? `+${entry.healAmount} HP`
                          : `−${entry.damage} HP`}
                        {entry.isCritical &&
                          ` · ${locale === "vi" ? "chí mạng" : "critical"}`}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* End states */}
      {(enemyDead || playerDead) && (
        <div
          style={{
            padding: "18px 22px 22px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            background: enemyDead ? "var(--paper-deep)" : "var(--paper)",
          }}
          role="alert"
        >
          <div>
            <div
              className="label"
              style={{
                color: enemyDead ? "var(--jade-deep)" : "var(--cinnabar-deep)",
              }}
            >
              {enemyDead ? t(locale, "victory") : t(locale, "defeat")}
            </div>
            <h3
              className="t-display"
              style={{
                margin: "4px 0 0",
                fontSize: 22,
                color: "var(--ink)",
              }}
            >
              {enemyDead
                ? locale === "vi"
                  ? `Đã thắng — ${enemy.name} ngã xuống.`
                  : `Victory — ${enemy.name_en} falls.`
                : locale === "vi"
                  ? "Đã bại — đạo tâm vẫn còn."
                  : "Defeated — yet the heart endures."}
            </h3>
          </div>
          <button
            onClick={onCombatEnd}
            className={enemyDead ? "ink-btn primary" : "ink-btn cinnabar"}
          >
            <span className="t-han">{enemyDead ? "繼" : "歸"}</span>
            {enemyDead
              ? locale === "vi"
                ? "Thu Chiến Lợi"
                : "Collect Loot"
              : locale === "vi"
                ? "Tiếp Tục"
                : "Continue"}
          </button>
        </div>
      )}
    </Card>
  );
}
