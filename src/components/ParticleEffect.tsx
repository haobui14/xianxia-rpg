"use client";

import { useState, useEffect, useMemo, CSSProperties } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
}

interface ParticleEffectProps {
  type: "exp" | "cultivation" | "breakthrough" | "season" | "portal" | "qi-flow" | "sparkle";
  isActive?: boolean;
  count?: number;
  color?: string;
  colors?: string[];
  className?: string;
  duration?: number;
  intensity?: "low" | "medium" | "high";
  direction?: "up" | "down" | "random";
}

/**
 * ParticleEffect - Reusable particle effect system for various game states
 */
export default function ParticleEffect({
  type,
  isActive = true,
  count,
  color,
  colors,
  className = "",
  duration = 2000,
  intensity = "medium",
  direction = "up",
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Get particle configuration based on type
  const config = useMemo(() => {
    const intensityMultiplier = intensity === "low" ? 0.5 : intensity === "high" ? 2 : 1;

    switch (type) {
      case "exp":
        return {
          count: count ?? Math.floor(8 * intensityMultiplier),
          colors: colors ?? ["#22c55e", "#10b981", "#34d399"],
          minSize: 4,
          maxSize: 8,
          duration: duration,
          minDuration: duration * 0.8,
          maxDuration: duration * 1.2,
        };
      case "cultivation":
        return {
          count: count ?? Math.floor(12 * intensityMultiplier),
          colors: colors ?? ["#8b5cf6", "#a78bfa", "#c4b5fd"],
          minSize: 3,
          maxSize: 6,
          duration: duration,
          minDuration: duration * 0.7,
          maxDuration: duration * 1.3,
        };
      case "breakthrough":
        return {
          count: count ?? Math.floor(30 * intensityMultiplier),
          colors: colors ?? ["#fbbf24", "#f59e0b", "#d97706", "#ffffff"],
          minSize: 5,
          maxSize: 12,
          duration: duration,
          minDuration: duration * 0.5,
          maxDuration: duration * 1.5,
        };
      case "season":
        return {
          count: count ?? Math.floor(20 * intensityMultiplier),
          colors: colors ?? ["#22c55e", "#a16207", "#ef4444", "#e5e7eb"],
          minSize: 6,
          maxSize: 15,
          duration: duration * 2,
          minDuration: duration * 1.5,
          maxDuration: duration * 2.5,
        };
      case "portal":
        return {
          count: count ?? Math.floor(15 * intensityMultiplier),
          colors: colors ?? ["#3b82f6", "#8b5cf6", "#06b6d4"],
          minSize: 4,
          maxSize: 10,
          duration: duration,
          minDuration: duration * 0.8,
          maxDuration: duration * 1.2,
        };
      case "qi-flow":
        return {
          count: count ?? Math.floor(10 * intensityMultiplier),
          colors: colors ?? ["#8b5cf6", "#3b82f6", "#06b6d4"],
          minSize: 2,
          maxSize: 5,
          duration: duration,
          minDuration: duration * 0.9,
          maxDuration: duration * 1.1,
        };
      case "sparkle":
        return {
          count: count ?? Math.floor(6 * intensityMultiplier),
          colors: colors ?? ["#ffffff", "#fbbf24", "#f9fafb"],
          minSize: 3,
          maxSize: 7,
          duration: duration * 0.5,
          minDuration: duration * 0.3,
          maxDuration: duration * 0.7,
        };
      default:
        return {
          count: 10,
          colors: ["#8b5cf6"],
          minSize: 4,
          maxSize: 8,
          duration: duration,
          minDuration: duration * 0.8,
          maxDuration: duration * 1.2,
        };
    }
  }, [type, count, colors, duration, intensity]);

  // Generate particles
  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      return;
    }

    const generateParticles = () => {
      const newParticles: Particle[] = [];
      const particleColors = color ? [color] : config.colors;

      for (let i = 0; i < config.count; i++) {
        const particleDuration =
          config.minDuration + Math.random() * (config.maxDuration - config.minDuration);

        newParticles.push({
          id: Date.now() + i,
          x: Math.random() * 100, // percentage
          y: direction === "up" ? 100 : direction === "down" ? 0 : Math.random() * 100,
          size: config.minSize + Math.random() * (config.maxSize - config.minSize),
          color: particleColors[Math.floor(Math.random() * particleColors.length)],
          delay: Math.random() * 1000,
          duration: particleDuration,
          drift: (Math.random() - 0.5) * 100, // horizontal drift
          rotation: Math.random() * 720 - 360,
        });
      }

      setParticles(newParticles);
    };

    generateParticles();

    // Regenerate particles periodically for continuous effects
    if (type === "cultivation" || type === "season" || type === "qi-flow") {
      const interval = setInterval(generateParticles, config.duration);
      return () => clearInterval(interval);
    }
  }, [isActive, config, color, type, direction]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <ParticleElement key={particle.id} particle={particle} type={type} direction={direction} />
      ))}
    </div>
  );
}

interface ParticleElementProps {
  particle: Particle;
  type: ParticleEffectProps["type"];
  direction: ParticleEffectProps["direction"];
}

function ParticleElement({ particle, type, direction }: ParticleElementProps) {
  const style: CSSProperties = {
    position: "absolute",
    left: `${particle.x}%`,
    bottom: direction === "up" ? 0 : "auto",
    top: direction === "down" ? 0 : direction === "random" ? `${particle.y}%` : "auto",
    width: particle.size,
    height: particle.size,
    backgroundColor: particle.color,
    borderRadius: type === "season" ? "2px" : "50%",
    animationDelay: `${particle.delay}ms`,
    animationDuration: `${particle.duration}ms`,
    "--particle-drift": `${particle.drift}px`,
    "--rotation": `${particle.rotation}deg`,
    "--wind-drift": `${particle.drift}px`,
  } as CSSProperties;

  // Get animation class based on type
  const getAnimationClass = () => {
    switch (type) {
      case "exp":
        return "animate-exp-particle";
      case "cultivation":
        return "animate-particle-rise";
      case "breakthrough":
        return "animate-particle-rise animate-glow";
      case "season":
        return "animate-season-particle animate-floating-leaf";
      case "portal":
        return "animate-portal-ring";
      case "qi-flow":
        return "animate-qi-flow-enhanced";
      case "sparkle":
        return "animate-cosmic-stars";
      default:
        return "animate-particle-rise";
    }
  };

  return <span className={getAnimationClass()} style={style} />;
}

/**
 * BreakthroughEffect - Special effect for realm breakthroughs
 */
interface BreakthroughEffectProps {
  isActive: boolean;
  onComplete?: () => void;
}

export function BreakthroughEffect({ isActive, onComplete }: BreakthroughEffectProps) {
  const [phase, setPhase] = useState<"idle" | "buildup" | "explosion" | "settling">("idle");

  useEffect(() => {
    if (isActive) {
      setPhase("buildup");
      setTimeout(() => setPhase("explosion"), 500);
      setTimeout(() => setPhase("settling"), 1500);
      setTimeout(() => {
        setPhase("idle");
        onComplete?.();
      }, 3000);
    }
  }, [isActive, onComplete]);

  if (phase === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Background flash */}
      {phase === "explosion" && (
        <div className="absolute inset-0 bg-gradient-radial from-xianxia-gold/50 to-transparent animate-fade-out" />
      )}

      {/* Expanding rings */}
      {(phase === "explosion" || phase === "settling") && (
        <>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div
                className="border-2 border-xianxia-gold rounded-full animate-breakthrough-ring"
                style={{
                  width: "100px",
                  height: "100px",
                  animationDelay: `${i * 200}ms`,
                }}
              />
            </div>
          ))}
        </>
      )}

      {/* Particles */}
      <ParticleEffect
        type="breakthrough"
        isActive={phase === "explosion" || phase === "settling"}
        intensity="high"
        count={50}
      />

      {/* Lightning flashes */}
      {phase === "explosion" && (
        <div className="absolute inset-0 animate-lightning-flash bg-white/30" />
      )}
    </div>
  );
}

/**
 * MeditationAura - Glowing aura effect during cultivation
 */
interface MeditationAuraProps {
  isActive: boolean;
  color?: string;
  intensity?: "low" | "medium" | "high";
  className?: string;
}

export function MeditationAura({
  isActive,
  color = "#8b5cf6",
  intensity = "medium",
  className = "",
}: MeditationAuraProps) {
  if (!isActive) return null;

  const opacityMultiplier = intensity === "low" ? 0.5 : intensity === "high" ? 1.5 : 1;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* Inner glow */}
      <div
        className="absolute inset-0 rounded-full animate-meditation-aura"
        style={{
          background: `radial-gradient(circle, ${color}${Math.floor(30 * opacityMultiplier)
            .toString(16)
            .padStart(2, "0")} 0%, transparent 70%)`,
        }}
      />

      {/* Qi particles */}
      <ParticleEffect type="qi-flow" isActive={true} color={color} intensity={intensity} />
    </div>
  );
}

/**
 * PortalEffect - Swirling portal effect for dungeon entrance
 */
interface PortalEffectProps {
  isActive: boolean;
  color?: string;
  onComplete?: () => void;
}

export function PortalEffect({ isActive, color = "#8b5cf6", onComplete }: PortalEffectProps) {
  useEffect(() => {
    if (isActive && onComplete) {
      setTimeout(onComplete, 1500);
    }
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />

      {/* Portal swirl */}
      <div
        className="relative w-32 h-32 animate-portal-swirl"
        style={{
          background: `conic-gradient(from 0deg, ${color}, transparent, ${color})`,
          borderRadius: "50%",
        }}
      >
        {/* Inner rings */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 border-2 rounded-full animate-portal-ring"
            style={{
              borderColor: color,
              animationDelay: `${i * 300}ms`,
              transform: `scale(${1 - i * 0.2})`,
            }}
          />
        ))}
      </div>

      {/* Particles */}
      <ParticleEffect type="portal" isActive={true} color={color} intensity="high" />
    </div>
  );
}

/**
 * TravelEffect - Map path animation when moving between locations
 */
interface TravelEffectProps {
  isActive: boolean;
  fromLocation?: string;
  toLocation?: string;
  duration?: number;
  onComplete?: () => void;
}

export function TravelEffect({
  isActive,
  fromLocation,
  toLocation,
  duration = 2000,
  onComplete,
}: TravelEffectProps) {
  useEffect(() => {
    if (isActive && onComplete) {
      setTimeout(onComplete, duration);
    }
  }, [isActive, duration, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      {/* Fade overlay */}
      <div className="absolute inset-0 bg-xianxia-dark/90 animate-region-fade" />

      {/* Location transition text */}
      <div className="text-center">
        {fromLocation && (
          <div className="text-gray-500 text-sm mb-2 animate-fade-out">{fromLocation}</div>
        )}
        <div className="text-3xl font-bold text-xianxia-gold animate-region-name">
          {toLocation || "Traveling..."}
        </div>
      </div>

      {/* Travel particles */}
      <ParticleEffect type="sparkle" isActive={true} intensity="low" direction="random" />
    </div>
  );
}
