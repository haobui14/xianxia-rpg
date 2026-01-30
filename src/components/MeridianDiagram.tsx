"use client";

import { useMemo } from "react";
import { GameState, Element, Realm } from "@/types/game";
import { Locale } from "@/lib/i18n/translations";

interface MeridianDiagramProps {
  state: GameState;
  locale: Locale;
  size?: "small" | "medium" | "large";
}

// Element color mapping
const ELEMENT_COLORS: Record<Element, string> = {
  Kim: "#d4af37", // Metal - Gold
  Mộc: "#22c55e", // Wood - Green
  Thủy: "#3b82f6", // Water - Blue
  Hỏa: "#ef4444", // Fire - Red
  Thổ: "#a16207", // Earth - Brown
};

// Realm colors for qi flow
const REALM_QI_COLORS: Record<Realm, string> = {
  PhàmNhân: "#6b7280",
  LuyệnKhí: "#10b981",
  TrúcCơ: "#3b82f6",
  KếtĐan: "#8b5cf6",
  NguyênAnh: "#f59e0b",
};

// Meridian points positions (normalized 0-100)
const MERIDIAN_POINTS = [
  { id: 1, name: "Bách Hội", name_en: "Crown", x: 50, y: 8 }, // Top of head
  { id: 2, name: "Ấn Đường", name_en: "Third Eye", x: 50, y: 15 }, // Between eyebrows
  { id: 3, name: "Đản Trung", name_en: "Heart", x: 50, y: 38 }, // Chest center
  { id: 4, name: "Trung Quản", name_en: "Solar Plexus", x: 50, y: 48 }, // Upper abdomen
  { id: 5, name: "Đan Điền", name_en: "Dantian", x: 50, y: 58 }, // Lower abdomen (main)
  { id: 6, name: "Lao Cung (L)", name_en: "Palm (L)", x: 25, y: 55 }, // Left palm
  { id: 7, name: "Lao Cung (R)", name_en: "Palm (R)", x: 75, y: 55 }, // Right palm
  { id: 8, name: "Dũng Tuyền (L)", name_en: "Foot (L)", x: 40, y: 92 }, // Left foot
  { id: 9, name: "Dũng Tuyền (R)", name_en: "Foot (R)", x: 60, y: 92 }, // Right foot
];

// Qi flow paths connecting meridians
const QI_PATHS = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 3, to: 6 },
  { from: 3, to: 7 },
  { from: 5, to: 8 },
  { from: 5, to: 9 },
];

export default function MeridianDiagram({ state, locale, size = "medium" }: MeridianDiagramProps) {
  const { realm, realm_stage } = state.progress;
  const spiritElements = state.spirit_root.elements;

  // Calculate active meridians based on realm stage
  const activePointCount = useMemo(() => {
    if (realm === "PhàmNhân") return 0;
    // More points unlock as you progress
    // Stage 1-9 maps to 1-9 points
    return Math.min(realm_stage, 9);
  }, [realm, realm_stage]);

  // Get primary element color (or blend if multiple)
  const primaryColor = useMemo(() => {
    if (spiritElements.length === 0) return REALM_QI_COLORS[realm];
    if (spiritElements.length === 1) return ELEMENT_COLORS[spiritElements[0]];
    // Blend colors for dual elements
    return ELEMENT_COLORS[spiritElements[0]];
  }, [spiritElements, realm]);

  const secondaryColor = useMemo(() => {
    if (spiritElements.length > 1) return ELEMENT_COLORS[spiritElements[1]];
    return primaryColor;
  }, [spiritElements, primaryColor]);

  // Size mapping
  const dimensions = {
    small: { width: 120, height: 180 },
    medium: { width: 180, height: 270 },
    large: { width: 240, height: 360 },
  }[size];

  const pointRadius = size === "small" ? 4 : size === "medium" ? 6 : 8;

  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="10 0 80 100"
        preserveAspectRatio="xMidYMid meet"
        className="drop-shadow-lg"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="qiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body silhouette */}
        <g opacity="0.3" fill="none" stroke="#4b5563" strokeWidth="0.5">
          {/* Head */}
          <circle cx="50" cy="12" r="8" />
          {/* Neck */}
          <line x1="50" y1="20" x2="50" y2="25" />
          {/* Torso */}
          <path d="M 35 25 Q 35 30 38 35 L 40 60 Q 45 65 50 65 Q 55 65 60 60 L 62 35 Q 65 30 65 25" />
          {/* Arms */}
          <path d="M 35 28 Q 25 35 20 55 Q 18 58 20 60" />
          <path d="M 65 28 Q 75 35 80 55 Q 82 58 80 60" />
          {/* Legs */}
          <path d="M 42 65 L 40 90 L 38 95" />
          <path d="M 58 65 L 60 90 L 62 95" />
        </g>

        {/* Qi flow paths */}
        {QI_PATHS.map((path, index) => {
          const fromPoint = MERIDIAN_POINTS.find((p) => p.id === path.from)!;
          const toPoint = MERIDIAN_POINTS.find((p) => p.id === path.to)!;
          const isActive = path.from <= activePointCount && path.to <= activePointCount;

          return (
            <line
              key={`path-${index}`}
              x1={fromPoint.x}
              y1={fromPoint.y}
              x2={toPoint.x}
              y2={toPoint.y}
              stroke={isActive ? primaryColor : "#374151"}
              strokeWidth={isActive ? 1 : 0.5}
              strokeDasharray={isActive ? "4 2" : "2 2"}
              opacity={isActive ? 0.8 : 0.2}
              className={isActive ? "animate-qi-flow" : ""}
              style={{
                strokeDashoffset: isActive ? 0 : undefined,
              }}
              filter={isActive ? "url(#glow)" : undefined}
            />
          );
        })}

        {/* Meridian points */}
        {MERIDIAN_POINTS.map((point) => {
          const isActive = point.id <= activePointCount;
          const isDantian = point.id === 5; // Main cultivation point

          return (
            <g key={point.id}>
              Outer glow for active points
              {/* Main point */}
              <circle
                cx={point.x}
                cy={point.y}
                r={pointRadius / 2}
                fill={isActive ? (isDantian ? secondaryColor : primaryColor) : "#374151"}
                className={isActive ? "animate-meridian-pulse" : ""}
                filter={isActive ? (isDantian ? "url(#strongGlow)" : "url(#glow)") : undefined}
                style={{
                  transformOrigin: `${point.x}px ${point.y}px`,
                }}
              />
              {/* Inner bright spot for active dantian */}
              {isActive && isDantian && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={pointRadius / 4}
                  fill="white"
                  opacity="0.8"
                  className="animate-glow-pulse"
                />
              )}
            </g>
          );
        })}

        {/* Particles rising from dantian when cultivating */}
        {activePointCount > 0 && (
          <g className="animate-particle-spin" style={{ transformOrigin: "50px 58px" }}>
            {[0, 1, 2].map((i) => (
              <circle
                key={`particle-${i}`}
                cx={50 + Math.cos((i * 120 * Math.PI) / 180) * 8}
                cy={58 + Math.sin((i * 120 * Math.PI) / 180) * 8}
                r="1"
                fill={i % 2 === 0 ? primaryColor : secondaryColor}
                opacity="0.6"
              />
            ))}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 text-xs text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="text-gray-400">
            {spiritElements
              .map((e) =>
                locale === "vi"
                  ? e
                  : {
                      Kim: "Metal",
                      Mộc: "Wood",
                      Thủy: "Water",
                      Hỏa: "Fire",
                      Thổ: "Earth",
                    }[e]
              )
              .join(" + ")}
          </span>
        </div>
        <div className="text-gray-500">
          {locale === "vi"
            ? `${activePointCount}/9 kinh mạch khai mở`
            : `${activePointCount}/9 meridians open`}
        </div>
      </div>
    </div>
  );
}
