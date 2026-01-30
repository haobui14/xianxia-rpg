"use client";

import { useState, useEffect, useCallback } from "react";

export type MoveType =
  | "attack"
  | "qi_attack"
  | "defend"
  | "flee"
  | "skill_attack"
  | "skill_defense"
  | "skill_buff"
  | "enemy_attack"
  | "critical_hit"
  | "miss"
  | "dodge";

interface CombatMoveAnimationProps {
  moveType: MoveType | null;
  isPlayerMove: boolean;
  onComplete?: () => void;
  skillElement?: "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ" | null;
}

const ELEMENT_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  Kim: { primary: "#C0C0C0", secondary: "#E8E8E8", glow: "rgba(192, 192, 192, 0.8)" },
  Mộc: { primary: "#22C55E", secondary: "#86EFAC", glow: "rgba(34, 197, 94, 0.8)" },
  Thủy: { primary: "#3B82F6", secondary: "#93C5FD", glow: "rgba(59, 130, 246, 0.8)" },
  Hỏa: { primary: "#EF4444", secondary: "#FCA5A5", glow: "rgba(239, 68, 68, 0.8)" },
  Thổ: { primary: "#A16207", secondary: "#FDE047", glow: "rgba(161, 98, 7, 0.8)" },
};

/**
 * CombatMoveAnimation - Visual effects for combat actions
 */
export default function CombatMoveAnimation({
  moveType,
  isPlayerMove,
  onComplete,
  skillElement,
}: CombatMoveAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState<"idle" | "active" | "ending">("idle");

  useEffect(() => {
    if (moveType) {
      setIsVisible(true);
      setPhase("active");

      // Animation duration based on move type
      const duration = getMoveTypeDuration(moveType);

      const endTimer = setTimeout(() => {
        setPhase("ending");
      }, duration - 200);

      const completeTimer = setTimeout(() => {
        setIsVisible(false);
        setPhase("idle");
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(endTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [moveType, onComplete]);

  if (!isVisible || !moveType) return null;

  const elementColor = skillElement ? ELEMENT_COLORS[skillElement] : null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {/* Attack Animation - Slash effect */}
      {moveType === "attack" && (
        <AttackSlash isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Qi Attack Animation - Energy burst */}
      {moveType === "qi_attack" && (
        <QiBurst isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Defend Animation - Shield effect */}
      {moveType === "defend" && (
        <DefendShield isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Skill Attack Animation */}
      {moveType === "skill_attack" && (
        <SkillAttack
          isPlayerMove={isPlayerMove}
          phase={phase}
          elementColor={elementColor}
        />
      )}

      {/* Skill Defense Animation */}
      {moveType === "skill_defense" && (
        <SkillDefense
          isPlayerMove={isPlayerMove}
          phase={phase}
          elementColor={elementColor}
        />
      )}

      {/* Skill Buff Animation */}
      {moveType === "skill_buff" && (
        <SkillBuff
          isPlayerMove={isPlayerMove}
          phase={phase}
          elementColor={elementColor}
        />
      )}

      {/* Enemy Attack Animation */}
      {moveType === "enemy_attack" && (
        <EnemyAttack phase={phase} />
      )}

      {/* Critical Hit Animation */}
      {moveType === "critical_hit" && (
        <CriticalHit isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Miss Animation */}
      {moveType === "miss" && (
        <MissEffect isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Dodge Animation */}
      {moveType === "dodge" && (
        <DodgeEffect isPlayerMove={isPlayerMove} phase={phase} />
      )}

      {/* Flee Animation */}
      {moveType === "flee" && (
        <FleeEffect phase={phase} />
      )}
    </div>
  );
}

function getMoveTypeDuration(moveType: MoveType): number {
  switch (moveType) {
    case "critical_hit":
      return 800;
    case "skill_attack":
    case "skill_defense":
    case "skill_buff":
      return 700;
    case "qi_attack":
      return 600;
    case "attack":
    case "enemy_attack":
      return 500;
    case "defend":
      return 400;
    case "miss":
    case "dodge":
      return 400;
    case "flee":
      return 600;
    default:
      return 500;
  }
}

// Attack Slash Component
function AttackSlash({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-end pr-8" : "justify-start pl-8"
      }`}
    >
      {/* Slash lines */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`absolute h-1 bg-gradient-to-r rounded-full ${
            isPlayerMove
              ? "from-transparent via-red-500 to-red-300 animate-combat-slash-right"
              : "from-red-300 via-red-500 to-transparent animate-combat-slash-left"
          }`}
          style={{
            width: "120px",
            transform: `rotate(${-30 + i * 30}deg)`,
            animationDelay: `${i * 50}ms`,
            opacity: phase === "ending" ? 0 : 1,
            transition: "opacity 150ms",
          }}
        />
      ))}
      {/* Impact sparks */}
      <div className="absolute">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-combat-spark"
            style={{
              transform: `rotate(${i * 60}deg) translateX(30px)`,
              animationDelay: `${100 + i * 30}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Qi Burst Component
function QiBurst({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-end pr-12" : "justify-start pl-12"
      }`}
    >
      {/* Energy orb */}
      <div
        className={`relative w-16 h-16 rounded-full animate-combat-qi-burst ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: "radial-gradient(circle, #8B5CF6 0%, #3B82F6 50%, transparent 70%)",
          boxShadow: "0 0 30px #8B5CF6, 0 0 60px #3B82F6",
          transition: "opacity 150ms",
        }}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-2 rounded-full animate-pulse"
          style={{
            background: "radial-gradient(circle, white 0%, #A78BFA 50%, transparent 70%)",
          }}
        />
      </div>
      {/* Energy trails */}
      <div className="absolute">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-8 bg-gradient-to-t from-transparent via-purple-400 to-blue-400 rounded-full animate-combat-qi-trail"
            style={{
              transform: `rotate(${i * 45}deg) translateY(-40px)`,
              animationDelay: `${i * 40}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Defend Shield Component
function DefendShield({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-start pl-8" : "justify-end pr-8"
      }`}
    >
      {/* Shield */}
      <div
        className={`relative w-20 h-24 animate-combat-shield ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.6) 0%, rgba(245, 158, 11, 0.4) 50%, rgba(217, 119, 6, 0.6) 100%)",
          borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
          border: "3px solid #FCD34D",
          boxShadow: "0 0 20px rgba(251, 191, 36, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)",
          transition: "opacity 150ms",
        }}
      >
        {/* Shield highlight */}
        <div
          className="absolute top-2 left-2 w-6 h-6 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)",
          }}
        />
      </div>
      {/* Shield ripples */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute w-24 h-28 border-2 border-yellow-400/50 rounded-full animate-combat-shield-ripple"
          style={{
            borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Skill Attack Component
function SkillAttack({
  isPlayerMove,
  phase,
  elementColor,
}: {
  isPlayerMove: boolean;
  phase: string;
  elementColor: { primary: string; secondary: string; glow: string } | null;
}) {
  const color = elementColor || { primary: "#8B5CF6", secondary: "#C4B5FD", glow: "rgba(139, 92, 246, 0.8)" };

  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-end pr-8" : "justify-start pl-8"
      }`}
    >
      {/* Skill energy burst */}
      <div
        className={`relative w-24 h-24 animate-combat-skill-burst ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{
          transition: "opacity 150ms",
        }}
      >
        {/* Core */}
        <div
          className="absolute inset-4 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${color.secondary} 0%, ${color.primary} 70%, transparent 100%)`,
            boxShadow: `0 0 30px ${color.glow}, 0 0 60px ${color.glow}`,
          }}
        />
        {/* Rotating rings */}
        {[0, 1].map((i) => (
          <div
            key={i}
            className="absolute inset-0 border-2 rounded-full animate-spin"
            style={{
              borderColor: `${color.primary}`,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              animationDuration: `${0.5 + i * 0.3}s`,
              transform: `rotate(${i * 45}deg)`,
            }}
          />
        ))}
        {/* Energy particles */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-combat-skill-particle"
            style={{
              backgroundColor: color.secondary,
              boxShadow: `0 0 6px ${color.glow}`,
              top: "50%",
              left: "50%",
              transform: `rotate(${i * 45}deg) translateX(40px)`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Skill Defense Component
function SkillDefense({
  isPlayerMove,
  phase,
  elementColor,
}: {
  isPlayerMove: boolean;
  phase: string;
  elementColor: { primary: string; secondary: string; glow: string } | null;
}) {
  const color = elementColor || { primary: "#22C55E", secondary: "#86EFAC", glow: "rgba(34, 197, 94, 0.8)" };

  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-start pl-4" : "justify-end pr-4"
      }`}
    >
      {/* Barrier dome */}
      <div
        className={`relative w-32 h-32 animate-combat-barrier ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, ${color.primary}40 70%, ${color.primary}80 100%)`,
          borderRadius: "50%",
          boxShadow: `0 0 40px ${color.glow}, inset 0 0 30px ${color.glow}`,
          transition: "opacity 150ms",
        }}
      >
        {/* Hexagon pattern overlay */}
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            backgroundImage: `repeating-conic-gradient(from 0deg, ${color.secondary} 0deg 60deg, transparent 60deg 120deg)`,
            backgroundSize: "20px 20px",
          }}
        />
      </div>
    </div>
  );
}

// Skill Buff Component
function SkillBuff({
  isPlayerMove,
  phase,
  elementColor,
}: {
  isPlayerMove: boolean;
  phase: string;
  elementColor: { primary: string; secondary: string; glow: string } | null;
}) {
  const color = elementColor || { primary: "#FBBF24", secondary: "#FDE68A", glow: "rgba(251, 191, 36, 0.8)" };

  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-start pl-8" : "justify-end pr-8"
      }`}
    >
      {/* Rising energy */}
      <div
        className={`relative w-24 h-32 ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{ transition: "opacity 150ms" }}
      >
        {/* Ascending particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-combat-buff-rise"
            style={{
              backgroundColor: i % 2 === 0 ? color.primary : color.secondary,
              boxShadow: `0 0 8px ${color.glow}`,
              left: `${20 + (i % 4) * 20}%`,
              bottom: 0,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
        {/* Aura glow */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(ellipse at bottom, ${color.glow} 0%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}

// Enemy Attack Component
function EnemyAttack({ phase }: { phase: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-start pl-8">
      {/* Claw marks */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`absolute h-1.5 bg-gradient-to-r from-red-600 via-red-400 to-transparent rounded-full animate-combat-claw ${
            phase === "ending" ? "opacity-0" : "opacity-100"
          }`}
          style={{
            width: "100px",
            transform: `translateY(${(i - 1) * 15}px) rotate(-15deg)`,
            animationDelay: `${i * 60}ms`,
            transition: "opacity 150ms",
          }}
        />
      ))}
    </div>
  );
}

// Critical Hit Component
function CriticalHit({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-end pr-8" : "justify-start pl-8"
      }`}
    >
      {/* Screen flash */}
      <div
        className={`absolute inset-0 bg-yellow-500/20 animate-combat-flash ${
          phase === "ending" ? "opacity-0" : ""
        }`}
      />
      {/* Impact star */}
      <div
        className={`relative w-32 h-32 animate-combat-critical ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{ transition: "opacity 100ms" }}
      >
        {/* Star rays */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-16 bg-gradient-to-t from-transparent via-yellow-400 to-white rounded-full"
            style={{
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
              transformOrigin: "center center",
            }}
          />
        ))}
        {/* Center burst */}
        <div
          className="absolute top-1/2 left-1/2 w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, white 0%, #FCD34D 50%, transparent 100%)",
            boxShadow: "0 0 40px #FBBF24, 0 0 80px #F59E0B",
          }}
        />
      </div>
    </div>
  );
}

// Miss Effect Component
function MissEffect({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-end pr-16" : "justify-start pl-16"
      }`}
    >
      {/* Whoosh lines */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`absolute h-0.5 bg-gradient-to-r from-gray-500 to-transparent rounded-full animate-combat-whoosh ${
            phase === "ending" ? "opacity-0" : "opacity-100"
          }`}
          style={{
            width: "60px",
            transform: `translateY(${(i - 1) * 10}px)`,
            animationDelay: `${i * 40}ms`,
            transition: "opacity 150ms",
          }}
        />
      ))}
    </div>
  );
}

// Dodge Effect Component
function DodgeEffect({
  isPlayerMove,
  phase,
}: {
  isPlayerMove: boolean;
  phase: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center ${
        isPlayerMove ? "justify-start pl-8" : "justify-end pr-8"
      }`}
    >
      {/* After-images */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`absolute w-12 h-16 rounded-lg animate-combat-afterimage ${
            phase === "ending" ? "opacity-0" : ""
          }`}
          style={{
            background: "linear-gradient(180deg, rgba(34, 211, 238, 0.4) 0%, rgba(34, 211, 238, 0.1) 100%)",
            transform: `translateX(${i * 20}px)`,
            animationDelay: `${i * 80}ms`,
            transition: "opacity 150ms",
          }}
        />
      ))}
    </div>
  );
}

// Flee Effect Component
function FleeEffect({ phase }: { phase: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-start pl-4">
      {/* Speed lines */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`absolute h-0.5 bg-gradient-to-l from-white/50 to-transparent rounded-full animate-combat-speed-line ${
            phase === "ending" ? "opacity-0" : "opacity-100"
          }`}
          style={{
            width: `${40 + Math.random() * 40}px`,
            top: `${20 + i * 12}%`,
            left: "20%",
            animationDelay: `${i * 50}ms`,
            transition: "opacity 150ms",
          }}
        />
      ))}
      {/* Dust cloud */}
      <div
        className={`absolute left-4 bottom-1/3 w-16 h-12 rounded-full animate-combat-dust ${
          phase === "ending" ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: "radial-gradient(ellipse, rgba(156, 163, 175, 0.5) 0%, transparent 70%)",
          transition: "opacity 150ms",
        }}
      />
    </div>
  );
}

// Hook to use combat animations
export function useCombatAnimation() {
  const [currentMove, setCurrentMove] = useState<{
    type: MoveType;
    isPlayerMove: boolean;
    skillElement?: "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ" | null;
  } | null>(null);

  const triggerAnimation = useCallback(
    (
      type: MoveType,
      isPlayerMove: boolean,
      skillElement?: "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ" | null
    ) => {
      setCurrentMove({ type, isPlayerMove, skillElement });
    },
    []
  );

  const clearAnimation = useCallback(() => {
    setCurrentMove(null);
  }, []);

  return {
    currentMove,
    triggerAnimation,
    clearAnimation,
  };
}
