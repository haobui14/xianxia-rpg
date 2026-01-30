"use client";

import { useState } from "react";
import { GameState } from "@/types/game";
import { RegionId } from "@/types/world";
import { Locale } from "@/lib/i18n/translations";

interface WorldMapProps {
  state: GameState;
  locale: Locale;
  onTravelArea?: (areaId: string) => Promise<void>;
  onTravelRegion?: (regionId: RegionId) => Promise<void>;
}

// Region display data
const REGION_DATA: Record<
  RegionId,
  {
    name: string;
    name_en: string;
    color: string;
    bgColor: string;
    element: string;
    element_en: string;
    tier: number;
    position: { x: number; y: number };
  }
> = {
  thanh_van: {
    name: "Thanh Vân",
    name_en: "Azure Cloud",
    color: "text-green-400",
    bgColor: "bg-green-900/50",
    element: "🌿 Mộc",
    element_en: "🌿 Wood",
    tier: 1,
    position: { x: 50, y: 70 },
  },
  hoa_son: {
    name: "Hỏa Sơn",
    name_en: "Fire Mountain",
    color: "text-red-400",
    bgColor: "bg-red-900/50",
    element: "🔥 Hỏa",
    element_en: "🔥 Fire",
    tier: 2,
    position: { x: 20, y: 40 },
  },
  huyen_thuy: {
    name: "Huyền Thủy",
    name_en: "Mystic Waters",
    color: "text-blue-400",
    bgColor: "bg-blue-900/50",
    element: "💧 Thủy",
    element_en: "💧 Water",
    tier: 3,
    position: { x: 80, y: 40 },
  },
  tram_loi: {
    name: "Trầm Lôi",
    name_en: "Silent Thunder",
    color: "text-yellow-400",
    bgColor: "bg-yellow-900/50",
    element: "⚡ Kim",
    element_en: "⚡ Metal",
    tier: 4,
    position: { x: 30, y: 15 },
  },
  vong_linh: {
    name: "Vọng Linh",
    name_en: "Spirit Watch",
    color: "text-purple-400",
    bgColor: "bg-purple-900/50",
    element: "🌍 Thổ",
    element_en: "🌍 Earth",
    tier: 5,
    position: { x: 70, y: 15 },
  },
};

// Region connections for drawing lines
const REGION_CONNECTIONS: [RegionId, RegionId][] = [
  ["thanh_van", "hoa_son"],
  ["thanh_van", "huyen_thuy"],
  ["hoa_son", "tram_loi"],
  ["huyen_thuy", "vong_linh"],
  ["tram_loi", "vong_linh"],
];

export default function WorldMap({ state, locale, onTravelArea, onTravelRegion }: WorldMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentRegion = state.travel?.current_region || "thanh_van";
  const currentArea = state.travel?.current_area || "thanh_van_village";
  const discoveredAreas = state.travel?.discovered_areas || ({} as Record<RegionId, string[]>);

  const handleRegionClick = (regionId: RegionId) => {
    if (regionId === currentRegion) {
      setSelectedRegion(selectedRegion === regionId ? null : regionId);
    } else {
      setSelectedRegion(regionId);
    }
  };

  const handleTravelToRegion = async (regionId: RegionId) => {
    if (!onTravelRegion || regionId === currentRegion) return;
    setIsLoading(true);
    try {
      await onTravelRegion(regionId);
      setSelectedRegion(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getTierStars = (tier: number) => "⭐".repeat(tier);

  const isRegionAccessible = (regionId: RegionId) => {
    const adjacentRegions: Record<RegionId, RegionId[]> = {
      thanh_van: ["hoa_son", "huyen_thuy"],
      hoa_son: ["thanh_van", "tram_loi"],
      huyen_thuy: ["thanh_van", "vong_linh"],
      tram_loi: ["hoa_son", "vong_linh"],
      vong_linh: ["huyen_thuy", "tram_loi"],
    };
    return adjacentRegions[currentRegion]?.includes(regionId) || regionId === currentRegion;
  };

  const hasDiscoveredArea = (regionId: RegionId) => {
    return (discoveredAreas[regionId]?.length || 0) > 0;
  };

  return (
    <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-xianxia-gold flex items-center gap-2">
        🗺️ {locale === "vi" ? "Bản Đồ Thế Giới" : "World Map"}
      </h2>

      {/* Current Location */}
      <div className="mb-4 p-3 bg-xianxia-darker rounded-lg">
        <div className="text-sm text-gray-400">
          {locale === "vi" ? "Vị trí hiện tại" : "Current Location"}
        </div>
        <div className={`font-bold ${REGION_DATA[currentRegion].color}`}>
          {locale === "vi" ? REGION_DATA[currentRegion].name : REGION_DATA[currentRegion].name_en}
        </div>
      </div>

      {/* Map View */}
      <div className="relative w-full h-64 bg-gray-900/50 rounded-lg overflow-hidden mb-4">
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {REGION_CONNECTIONS.map(([from, to], idx) => {
            const fromPos = REGION_DATA[from].position;
            const toPos = REGION_DATA[to].position;
            const isAccessible = from === currentRegion || to === currentRegion;
            return (
              <line
                key={idx}
                x1={`${fromPos.x}%`}
                y1={`${fromPos.y}%`}
                x2={`${toPos.x}%`}
                y2={`${toPos.y}%`}
                stroke={isAccessible ? "#fbbf24" : "#4b5563"}
                strokeWidth="2"
                strokeDasharray={isAccessible ? "none" : "5,5"}
                opacity={0.5}
              />
            );
          })}
        </svg>

        {/* Region Nodes */}
        {(Object.keys(REGION_DATA) as RegionId[]).map((regionId) => {
          const data = REGION_DATA[regionId];
          const isCurrent = regionId === currentRegion;
          const isAccessible = isRegionAccessible(regionId);
          const isSelected = selectedRegion === regionId;
          const hasVisited = hasDiscoveredArea(regionId);

          return (
            <button
              key={regionId}
              onClick={() => handleRegionClick(regionId)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                isSelected ? "scale-110 z-10" : "hover:scale-105"
              } ${!isAccessible && !isCurrent ? "opacity-50" : ""}`}
              style={{
                left: `${data.position.x}%`,
                top: `${data.position.y}%`,
              }}
            >
              <div
                className={`${data.bgColor} ${
                  isCurrent ? "ring-2 ring-xianxia-gold" : ""
                } ${isSelected ? "ring-2 ring-white" : ""} rounded-lg p-2 min-w-[80px]`}
              >
                <div className={`text-sm font-bold ${data.color}`}>
                  {locale === "vi" ? data.name : data.name_en}
                </div>
                <div className="text-xs text-gray-400">
                  {locale === "vi" ? data.element : data.element_en}
                </div>
                <div className="text-xs">{getTierStars(data.tier)}</div>
                {hasVisited && !isCurrent && <div className="text-xs text-green-400">✓</div>}
              </div>
              {isCurrent && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-xianxia-gold rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Region Info */}
      {selectedRegion && selectedRegion !== currentRegion && (
        <div
          className={`p-4 rounded-lg ${REGION_DATA[selectedRegion].bgColor} border border-${REGION_DATA[selectedRegion].color}/30`}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className={`font-bold ${REGION_DATA[selectedRegion].color}`}>
                {locale === "vi"
                  ? REGION_DATA[selectedRegion].name
                  : REGION_DATA[selectedRegion].name_en}
              </div>
              <div className="text-sm text-gray-400">
                {locale === "vi" ? "Cấp độ" : "Tier"}:{" "}
                {getTierStars(REGION_DATA[selectedRegion].tier)}
              </div>
            </div>
            <div className="text-2xl">{REGION_DATA[selectedRegion].element.split(" ")[0]}</div>
          </div>

          {isRegionAccessible(selectedRegion) ? (
            <button
              onClick={() => handleTravelToRegion(selectedRegion)}
              disabled={isLoading}
              className="w-full py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              {isLoading
                ? locale === "vi"
                  ? "Đang di chuyển..."
                  : "Traveling..."
                : locale === "vi"
                  ? `Di chuyển đến (20 thể lực)`
                  : `Travel (20 stamina)`}
            </button>
          ) : (
            <div className="text-center text-gray-400 py-2">
              {locale === "vi" ? "Không thể di chuyển trực tiếp" : "Cannot travel directly"}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-xianxia-gold rounded-full" />
          {locale === "vi" ? "Vị trí hiện tại" : "Current location"}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-yellow-500 rounded-full" />
          {locale === "vi" ? "Có thể di chuyển" : "Can travel"}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400">✓</span>
          {locale === "vi" ? "Đã khám phá" : "Explored"}
        </div>
        <div className="flex items-center gap-2">
          <span>⭐</span>
          {locale === "vi" ? "Cấp độ nguy hiểm" : "Danger level"}
        </div>
      </div>
    </div>
  );
}
