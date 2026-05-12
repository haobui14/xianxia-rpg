"use client";

import { useState, useMemo } from "react";
import { GameState } from "@/types/game";
import { RegionId } from "@/types/world";
import { Locale } from "@/lib/i18n/translations";
import { SectionHead, Pill } from "@/components/ui";

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
    description: string;
    description_en: string;
    color: string;
    bgColor: string;
    borderColor: string;
    element: string;
    element_en: string;
    tier: number;
    position: { x: number; y: number };
  }
> = {
  thanh_van: {
    name: "Thanh Vân",
    name_en: "Azure Cloud",
    description: "Vùng đất yên bình với linh khí dồi dào, nơi lý tưởng cho người mới tu luyện.",
    description_en: "A peaceful land rich with spiritual energy, ideal for beginning cultivators.",
    color: "text-green-400",
    bgColor: "bg-green-900/50",
    borderColor: "border-green-400/30",
    element: "🌿 Mộc",
    element_en: "🌿 Wood",
    tier: 1,
    position: { x: 50, y: 70 },
  },
  hoa_son: {
    name: "Hỏa Sơn",
    name_en: "Fire Mountain",
    description: "Ngọn núi lửa cổ đại, nơi rèn luyện ý chí và sức mạnh trong lửa nóng.",
    description_en: "An ancient volcanic mountain, where will and power are forged in flame.",
    color: "text-red-400",
    bgColor: "bg-red-900/50",
    borderColor: "border-red-400/30",
    element: "🔥 Hỏa",
    element_en: "🔥 Fire",
    tier: 2,
    position: { x: 20, y: 40 },
  },
  huyen_thuy: {
    name: "Huyền Thủy",
    name_en: "Mystic Waters",
    description: "Vùng sông hồ huyền bí, ẩn chứa nhiều bí ẩn trong làn nước sâu thẳm.",
    description_en: "A mystical waterland concealing secrets in its boundless depths.",
    color: "text-blue-400",
    bgColor: "bg-blue-900/50",
    borderColor: "border-blue-400/30",
    element: "💧 Thủy",
    element_en: "💧 Water",
    tier: 3,
    position: { x: 80, y: 40 },
  },
  tram_loi: {
    name: "Trầm Lôi",
    name_en: "Silent Thunder",
    description: "Vùng đất u tĩnh nhưng ẩn chứa sấm sét, thử thách những kẻ mạnh.",
    description_en: "A deceptively quiet land where hidden thunder tests the strong.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-900/50",
    borderColor: "border-yellow-400/30",
    element: "⚡ Kim",
    element_en: "⚡ Metal",
    tier: 4,
    position: { x: 30, y: 15 },
  },
  vong_linh: {
    name: "Vọng Linh",
    name_en: "Spirit Watch",
    description: "Vùng đất thiêng liêng nơi ranh giới giữa cõi sống và cõi chết mờ nhạt.",
    description_en: "Sacred ground where the boundary between life and death grows thin.",
    color: "text-purple-400",
    bgColor: "bg-purple-900/50",
    borderColor: "border-purple-400/30",
    element: "🌍 Thổ",
    element_en: "🌍 Earth",
    tier: 5,
    position: { x: 70, y: 15 },
  },
};

// Single source of truth for region adjacency
const ADJACENCY: Record<RegionId, RegionId[]> = {
  thanh_van: ["hoa_son", "huyen_thuy"],
  hoa_son: ["thanh_van", "tram_loi"],
  huyen_thuy: ["thanh_van", "vong_linh"],
  tram_loi: ["hoa_son", "vong_linh"],
  vong_linh: ["huyen_thuy", "tram_loi"],
};

// Derive connection edges from adjacency (deduplicated)
const REGION_CONNECTIONS: [RegionId, RegionId][] = (() => {
  const edges: [RegionId, RegionId][] = [];
  const seen = new Set<string>();
  for (const [from, neighbors] of Object.entries(ADJACENCY)) {
    for (const to of neighbors) {
      const key = [from, to].sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([from as RegionId, to as RegionId]);
      }
    }
  }
  return edges;
})();

const REGION_TRAVEL_STAMINA = 20;

export default function WorldMap({ state, locale, onTravelRegion }: WorldMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<RegionId | null>(null);

  const currentRegion = state.travel?.current_region || "thanh_van";
  const discoveredAreas = state.travel?.discovered_areas || ({} as Record<RegionId, string[]>);
  const playerStamina = state.stats?.stamina ?? 0;
  const canAffordTravel = playerStamina >= REGION_TRAVEL_STAMINA;

  const isRegionAccessible = (regionId: RegionId) => {
    return ADJACENCY[currentRegion]?.includes(regionId) || regionId === currentRegion;
  };

  const hasDiscoveredArea = (regionId: RegionId) => {
    return (discoveredAreas[regionId]?.length || 0) > 0;
  };

  // Compute path hint: how many hops to reach region from current
  const regionDistances = useMemo(() => {
    const dist: Record<string, number> = { [currentRegion]: 0 };
    const queue: RegionId[] = [currentRegion];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const neighbor of ADJACENCY[cur] || []) {
        if (dist[neighbor] === undefined) {
          dist[neighbor] = dist[cur] + 1;
          queue.push(neighbor);
        }
      }
    }
    return dist;
  }, [currentRegion]);

  const handleRegionClick = (regionId: RegionId) => {
    if (regionId === currentRegion) {
      setSelectedRegion(selectedRegion === regionId ? null : regionId);
      setShowConfirm(false);
    } else {
      setSelectedRegion(regionId);
      setShowConfirm(false);
    }
  };

  const handleTravelToRegion = async (regionId: RegionId) => {
    if (!onTravelRegion || regionId === currentRegion) return;
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setIsLoading(true);
    try {
      await onTravelRegion(regionId);
      setSelectedRegion(null);
      setShowConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getTierStars = (tier: number) => "⭐".repeat(tier);

  return (
    <div role="region" aria-label={locale === "vi" ? "Bản Đồ Thế Giới" : "World Map"}>
      <SectionHead
        han="界"
        title={locale === "vi" ? "Thiên Hạ Lục Cảnh" : "Realm Map"}
        subtitle={locale === "vi" ? "Bản đồ tu giới" : "Cultivation realm map"}
        right={
          <Pill variant="cinnabar" withDot>
            {state.location.region}
          </Pill>
        }
      />
      <div className="bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-xianxia-gold flex items-center gap-2">
        🗺️ {locale === "vi" ? "Bản Đồ Thế Giới" : "World Map"}
      </h2>

      {/* Current Location + Stamina */}
      <div className="mb-4 p-3 bg-xianxia-darker rounded-lg flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">
            {locale === "vi" ? "Vị trí hiện tại" : "Current Location"}
          </div>
          <div className={`font-bold ${REGION_DATA[currentRegion].color}`}>
            {locale === "vi" ? REGION_DATA[currentRegion].name : REGION_DATA[currentRegion].name_en}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">{locale === "vi" ? "Thể lực" : "Stamina"}</div>
          <div className={`font-bold ${canAffordTravel ? "text-green-400" : "text-red-400"}`}>
            ⚡ {playerStamina}
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="relative w-full h-72 md:h-80 lg:h-96 bg-gray-900/50 rounded-lg overflow-hidden mb-4">
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          {REGION_CONNECTIONS.map(([from, to], idx) => {
            const fromPos = REGION_DATA[from].position;
            const toPos = REGION_DATA[to].position;
            const isActive = from === currentRegion || to === currentRegion;
            return (
              <line
                key={idx}
                x1={`${fromPos.x}%`}
                y1={`${fromPos.y}%`}
                x2={`${toPos.x}%`}
                y2={`${toPos.y}%`}
                stroke={isActive ? "#fbbf24" : "#4b5563"}
                strokeWidth={isActive ? "3" : "2"}
                strokeDasharray={isActive ? "none" : "5,5"}
                opacity={isActive ? 0.7 : 0.4}
              />
            );
          })}
        </svg>

        {/* Region Nodes */}
        {(Object.keys(REGION_DATA) as RegionId[]).map((regionId) => {
          const data = REGION_DATA[regionId];
          const isCurrent = regionId === currentRegion;
          const accessible = isRegionAccessible(regionId);
          const isSelected = selectedRegion === regionId;
          const isHovered = hoveredRegion === regionId;
          const hasVisited = hasDiscoveredArea(regionId);
          const distance = regionDistances[regionId] ?? 99;

          return (
            <button
              key={regionId}
              onClick={() => handleRegionClick(regionId)}
              onMouseEnter={() => setHoveredRegion(regionId)}
              onMouseLeave={() => setHoveredRegion(null)}
              onFocus={() => setHoveredRegion(regionId)}
              onBlur={() => setHoveredRegion(null)}
              aria-label={`${locale === "vi" ? data.name : data.name_en} — ${
                isCurrent
                  ? locale === "vi"
                    ? "Vị trí hiện tại"
                    : "Current location"
                  : accessible
                    ? locale === "vi"
                      ? "Có thể di chuyển"
                      : "Can travel"
                    : locale === "vi"
                      ? `Cách ${distance} vùng`
                      : `${distance} regions away`
              }`}
              aria-pressed={isSelected}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-xianxia-gold ${
                isSelected ? "scale-110 z-10" : "hover:scale-105"
              } ${!accessible && !isCurrent ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                left: `${data.position.x}%`,
                top: `${data.position.y}%`,
              }}
            >
              <div
                className={`${data.bgColor} ${
                  isCurrent ? "ring-2 ring-xianxia-gold" : ""
                } ${isSelected ? "ring-2 ring-white" : ""} rounded-lg p-2.5 md:p-3 min-w-[90px] md:min-w-[100px]`}
              >
                <div className={`text-sm md:text-base font-bold ${data.color} leading-tight`}>
                  {locale === "vi" ? data.name : data.name_en}
                </div>
                <div className="text-xs text-gray-400">
                  {locale === "vi" ? data.element : data.element_en}
                </div>
                <div className="text-xs">{getTierStars(data.tier)}</div>
                {hasVisited && !isCurrent && <div className="text-xs text-green-400">✓</div>}
                {isCurrent && (
                  <div className="text-[10px] text-xianxia-gold font-medium mt-0.5">
                    {locale === "vi" ? "Đang ở đây" : "You are here"}
                  </div>
                )}
              </div>
              {isCurrent && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-xianxia-gold rounded-full animate-pulse"
                  aria-hidden="true"
                />
              )}

              {/* Hover Tooltip */}
              {isHovered && !isSelected && (
                <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-xianxia-darker border border-xianxia-accent/50 rounded-lg p-3 text-left shadow-xl pointer-events-none">
                  <div className={`font-bold text-sm ${data.color}`}>
                    {locale === "vi" ? data.name : data.name_en}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {locale === "vi" ? data.description : data.description_en}
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5 flex items-center justify-between">
                    <span>{locale === "vi" ? data.element : data.element_en}</span>
                    <span>{getTierStars(data.tier)}</span>
                  </div>
                  {!isCurrent && (
                    <div className="text-xs mt-1.5 border-t border-gray-700 pt-1.5">
                      {accessible ? (
                        <span className="text-yellow-400">
                          {locale === "vi"
                            ? `Di chuyển: ${REGION_TRAVEL_STAMINA} thể lực`
                            : `Travel: ${REGION_TRAVEL_STAMINA} stamina`}
                        </span>
                      ) : (
                        <span className="text-gray-500">
                          {locale === "vi" ? `Cách ${distance} vùng` : `${distance} regions away`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Region Info */}
      {selectedRegion && selectedRegion !== currentRegion && (
        <div
          className={`p-4 rounded-lg ${REGION_DATA[selectedRegion].bgColor} border ${REGION_DATA[selectedRegion].borderColor} transition-all`}
          role="region"
          aria-label={
            locale === "vi"
              ? `Thông tin ${REGION_DATA[selectedRegion].name}`
              : `${REGION_DATA[selectedRegion].name_en} details`
          }
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className={`font-bold text-lg ${REGION_DATA[selectedRegion].color}`}>
                {locale === "vi"
                  ? REGION_DATA[selectedRegion].name
                  : REGION_DATA[selectedRegion].name_en}
              </div>
              <div className="text-sm text-gray-400">
                {locale === "vi" ? "Cấp độ" : "Tier"}:{" "}
                {getTierStars(REGION_DATA[selectedRegion].tier)}
              </div>
              <div className="text-xs text-gray-300 mt-1 max-w-xs">
                {locale === "vi"
                  ? REGION_DATA[selectedRegion].description
                  : REGION_DATA[selectedRegion].description_en}
              </div>
            </div>
            <div className="text-3xl">{REGION_DATA[selectedRegion].element.split(" ")[0]}</div>
          </div>

          {isRegionAccessible(selectedRegion) ? (
            <div className="space-y-2 mt-3">
              {/* Stamina warning */}
              {!canAffordTravel && (
                <div
                  className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-1.5"
                  role="alert"
                >
                  {locale === "vi"
                    ? `Không đủ thể lực! Cần ${REGION_TRAVEL_STAMINA}, hiện có ${playerStamina}.`
                    : `Not enough stamina! Need ${REGION_TRAVEL_STAMINA}, have ${playerStamina}.`}
                </div>
              )}

              {/* Confirm step */}
              {showConfirm ? (
                <div className="space-y-2">
                  <div className="text-sm text-yellow-200 bg-yellow-900/20 border border-yellow-500/30 rounded px-3 py-2">
                    {locale === "vi"
                      ? `Xác nhận di chuyển đến ${REGION_DATA[selectedRegion].name}?`
                      : `Confirm travel to ${REGION_DATA[selectedRegion].name_en}?`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTravelToRegion(selectedRegion)}
                      disabled={isLoading || !canAffordTravel}
                      className="flex-1 py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {isLoading
                        ? locale === "vi"
                          ? "Đang di chuyển..."
                          : "Traveling..."
                        : locale === "vi"
                          ? "✓ Xác nhận"
                          : "✓ Confirm"}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg font-medium transition-colors"
                    >
                      {locale === "vi" ? "Hủy" : "Cancel"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleTravelToRegion(selectedRegion)}
                  disabled={isLoading || !canAffordTravel}
                  className="w-full py-2 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {locale === "vi"
                    ? `Di chuyển đến (${REGION_TRAVEL_STAMINA} thể lực)`
                    : `Travel (${REGION_TRAVEL_STAMINA} stamina)`}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-2 mt-2">
              <div>
                {locale === "vi" ? "Không thể di chuyển trực tiếp" : "Cannot travel directly"}
              </div>
              <div className="text-xs mt-1 text-gray-500">
                {locale === "vi"
                  ? `Cách ${regionDistances[selectedRegion] ?? "?"} vùng từ vị trí hiện tại`
                  : `${regionDistances[selectedRegion] ?? "?"} regions from current location`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-xianxia-gold rounded-full" aria-hidden="true" />
          {locale === "vi" ? "Vị trí hiện tại" : "Current location"}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-yellow-500 rounded-full" aria-hidden="true" />
          {locale === "vi" ? "Có thể di chuyển" : "Can travel"}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400" aria-hidden="true">
            ✓
          </span>
          {locale === "vi" ? "Đã khám phá" : "Explored"}
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true">⭐</span>
          {locale === "vi" ? "Cấp độ nguy hiểm" : "Danger level"}
        </div>
      </div>
      </div>
    </div>
  );
}
