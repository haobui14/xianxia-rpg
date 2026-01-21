/**
 * Travel System Logic
 * Handles movement between areas and regions
 */

import { TravelState, TravelResult, RegionId, Area } from '@/types/world';
import { Realm, CharacterStats } from '@/types/game';
import { REGIONS, getArea, getRegion, getAreasInRegion, isRegionAccessible, getStartingArea } from './regions';

// Realm order for comparison
const REALM_ORDER: Realm[] = ['PhàmNhân', 'LuyệnKhí', 'TrúcCơ', 'KếtĐan', 'NguyênAnh'];

/**
 * Get realm index for comparison
 */
function getRealmIndex(realm: Realm): number {
  return REALM_ORDER.indexOf(realm);
}

/**
 * Initialize travel state for a new game
 */
export function initTravelState(): TravelState {
  const start = getStartingArea();
  return {
    current_region: start.region,
    current_area: start.area,
    discovered_areas: {
      thanh_van: [start.area],
      hoa_son: [],
      huyen_thuy: [],
      tram_loi: [],
      vong_linh: [],
    },
    region_reputation: {
      thanh_van: 0,
      hoa_son: 0,
      huyen_thuy: 0,
      tram_loi: 0,
      vong_linh: 0,
    },
    travel_history: [start.area],
  };
}

/**
 * Check if player can travel to an area within the current region
 */
export function canTravelToArea(
  travel: TravelState,
  targetAreaId: string,
  stamina: number
): { canTravel: boolean; reason?: string; reason_en?: string; staminaCost: number } {
  const currentArea = getArea(travel.current_area);
  const targetArea = getArea(targetAreaId);

  if (!targetArea) {
    return {
      canTravel: false,
      reason: 'Khu vực không tồn tại',
      reason_en: 'Area does not exist',
      staminaCost: 0,
    };
  }

  // Check if target is in same region
  if (targetArea.region_id !== travel.current_region) {
    return {
      canTravel: false,
      reason: 'Khu vực ở vùng khác',
      reason_en: 'Area is in different region',
      staminaCost: 0,
    };
  }

  // Check if area is connected
  if (currentArea && !currentArea.connected_areas.includes(targetAreaId)) {
    // Allow if area is discovered (can return to any discovered area)
    const discoveredInRegion = travel.discovered_areas[travel.current_region] || [];
    if (!discoveredInRegion.includes(targetAreaId)) {
      return {
        canTravel: false,
        reason: 'Khu vực chưa được khám phá',
        reason_en: 'Area not yet discovered',
        staminaCost: 0,
      };
    }
  }

  const staminaCost = 5; // Base cost for area travel

  if (stamina < staminaCost) {
    return {
      canTravel: false,
      reason: `Thiếu thể lực (cần ${staminaCost})`,
      reason_en: `Not enough stamina (need ${staminaCost})`,
      staminaCost,
    };
  }

  return { canTravel: true, staminaCost };
}

/**
 * Check if player can travel to another region
 */
export function canTravelToRegion(
  travel: TravelState,
  targetRegionId: RegionId,
  playerRealm: Realm,
  stamina: number
): { canTravel: boolean; reason?: string; reason_en?: string; staminaCost: number; warning?: string; warning_en?: string } {
  const targetRegion = REGIONS[targetRegionId];

  if (!targetRegion) {
    return {
      canTravel: false,
      reason: 'Vùng không tồn tại',
      reason_en: 'Region does not exist',
      staminaCost: 0,
    };
  }

  // Check if regions are adjacent
  if (!isRegionAccessible(targetRegionId, travel.current_region)) {
    return {
      canTravel: false,
      reason: 'Vùng không liền kề',
      reason_en: 'Regions not adjacent',
      staminaCost: 0,
    };
  }

  const staminaCost = 20; // Base cost for region travel

  if (stamina < staminaCost) {
    return {
      canTravel: false,
      reason: `Thiếu thể lực (cần ${staminaCost})`,
      reason_en: `Not enough stamina (need ${staminaCost})`,
      staminaCost,
    };
  }

  // Soft gate check - warn but allow
  const playerRealmIndex = getRealmIndex(playerRealm);
  const recommendedRealmIndex = getRealmIndex(targetRegion.recommended_realm);

  let warning: string | undefined;
  let warning_en: string | undefined;

  if (playerRealmIndex < recommendedRealmIndex) {
    warning = `Cảnh báo: ${targetRegion.name} khuyến nghị tu vi ${targetRegion.recommended_realm}. Tu vi của ngươi có thể chưa đủ!`;
    warning_en = `Warning: ${targetRegion.name_en} recommends ${targetRegion.recommended_realm} realm. Your cultivation may be insufficient!`;
  }

  return { canTravel: true, staminaCost, warning, warning_en };
}

/**
 * Execute travel to an area within current region
 */
export function travelToArea(
  travel: TravelState,
  targetAreaId: string
): { newTravel: TravelState; timeCost: number } {
  const targetArea = getArea(targetAreaId);

  const newTravel: TravelState = {
    ...travel,
    current_area: targetAreaId,
    travel_history: [targetAreaId, ...travel.travel_history.slice(0, 9)],
  };

  // Discover area if not already discovered
  if (!newTravel.discovered_areas[travel.current_region].includes(targetAreaId)) {
    newTravel.discovered_areas = {
      ...newTravel.discovered_areas,
      [travel.current_region]: [...newTravel.discovered_areas[travel.current_region], targetAreaId],
    };
  }

  return {
    newTravel,
    timeCost: 1, // 1 time segment for area travel
  };
}

/**
 * Execute travel to another region
 */
export function travelToRegion(
  travel: TravelState,
  targetRegionId: RegionId
): { newTravel: TravelState; timeCost: number } {
  const targetRegion = REGIONS[targetRegionId];
  const areas = getAreasInRegion(targetRegionId);

  // Find first safe area (city) or first area
  let entryArea = areas.find(a => a.type === 'city') || areas[0];

  // If player has visited before, go to first discovered area
  const discovered = travel.discovered_areas[targetRegionId];
  if (discovered && discovered.length > 0) {
    const firstDiscovered = getArea(discovered[0]);
    if (firstDiscovered) {
      entryArea = firstDiscovered;
    }
  }

  const newTravel: TravelState = {
    ...travel,
    current_region: targetRegionId,
    current_area: entryArea.id,
    travel_history: [entryArea.id, ...travel.travel_history.slice(0, 9)],
  };

  // Discover entry area if not already discovered
  if (!newTravel.discovered_areas[targetRegionId].includes(entryArea.id)) {
    newTravel.discovered_areas = {
      ...newTravel.discovered_areas,
      [targetRegionId]: [...newTravel.discovered_areas[targetRegionId], entryArea.id],
    };
  }

  return {
    newTravel,
    timeCost: 4, // 4 time segments for region travel
  };
}

/**
 * Discover a new area (from exploration or events)
 */
export function discoverArea(
  travel: TravelState,
  areaId: string
): TravelState {
  const area = getArea(areaId);
  if (!area) return travel;

  const regionId = area.region_id;
  const discovered = travel.discovered_areas[regionId] || [];

  if (discovered.includes(areaId)) {
    return travel; // Already discovered
  }

  return {
    ...travel,
    discovered_areas: {
      ...travel.discovered_areas,
      [regionId]: [...discovered, areaId],
    },
  };
}

/**
 * Update region reputation
 */
export function updateRegionReputation(
  travel: TravelState,
  regionId: RegionId,
  amount: number
): TravelState {
  const current = travel.region_reputation[regionId] || 0;
  const newRep = Math.max(-100, Math.min(100, current + amount));

  return {
    ...travel,
    region_reputation: {
      ...travel.region_reputation,
      [regionId]: newRep,
    },
  };
}

/**
 * Get available travel destinations from current location
 */
export function getAvailableDestinations(
  travel: TravelState,
  playerRealm: Realm,
  stamina: number
): {
  areas: Array<{ area: Area; canTravel: boolean; reason?: string; staminaCost: number }>;
  regions: Array<{ region: typeof REGIONS[RegionId]; canTravel: boolean; reason?: string; warning?: string; staminaCost: number }>;
} {
  const currentArea = getArea(travel.current_area);
  const currentRegion = REGIONS[travel.current_region];

  // Get connected and discovered areas
  const connectedAreaIds = new Set(currentArea?.connected_areas || []);
  const discoveredAreaIds = new Set(travel.discovered_areas[travel.current_region] || []);
  const allAccessibleAreaIds = new Set([...connectedAreaIds, ...discoveredAreaIds]);

  const areas = Array.from(allAccessibleAreaIds)
    .map(areaId => {
      const area = getArea(areaId);
      if (!area || area.id === travel.current_area) return null;

      const check = canTravelToArea(travel, areaId, stamina);
      return {
        area,
        canTravel: check.canTravel,
        reason: check.reason_en,
        staminaCost: check.staminaCost,
      };
    })
    .filter(Boolean) as Array<{ area: Area; canTravel: boolean; reason?: string; staminaCost: number }>;

  // Get adjacent regions
  const regions = currentRegion.adjacent_regions.map(regionId => {
    const region = REGIONS[regionId];
    const check = canTravelToRegion(travel, regionId, playerRealm, stamina);
    return {
      region,
      canTravel: check.canTravel,
      reason: check.reason_en,
      warning: check.warning_en,
      staminaCost: check.staminaCost,
    };
  });

  return { areas, regions };
}

/**
 * Get current location info
 */
export function getCurrentLocationInfo(travel: TravelState): {
  region: typeof REGIONS[RegionId];
  area: Area;
  discoveredCount: number;
  totalAreas: number;
  reputation: number;
} {
  const region = REGIONS[travel.current_region];
  const area = getArea(travel.current_area)!;
  const discovered = travel.discovered_areas[travel.current_region] || [];

  return {
    region,
    area,
    discoveredCount: discovered.length,
    totalAreas: region.areas.length,
    reputation: travel.region_reputation[travel.current_region] || 0,
  };
}

/**
 * Check if player should receive danger warning
 */
export function getDangerWarning(
  travel: TravelState,
  playerRealm: Realm
): { hasDanger: boolean; message?: string; message_en?: string } {
  const area = getArea(travel.current_area);
  const region = REGIONS[travel.current_region];

  if (!area || !region) {
    return { hasDanger: false };
  }

  const playerRealmIndex = getRealmIndex(playerRealm);
  const recommendedRealmIndex = getRealmIndex(region.recommended_realm);

  // Check if in dangerous area for current realm
  if (playerRealmIndex < recommendedRealmIndex) {
    if (area.danger_level > 2) {
      return {
        hasDanger: true,
        message: `Khu vực này rất nguy hiểm cho tu vi hiện tại của ngươi!`,
        message_en: `This area is very dangerous for your current cultivation level!`,
      };
    }
  }

  // Check area danger level relative to realm
  if (area.danger_level >= 4 && playerRealmIndex < 2) {
    return {
      hasDanger: true,
      message: `Cảnh báo: Khu vực nguy hiểm cấp ${area.danger_level}!`,
      message_en: `Warning: Danger level ${area.danger_level} area!`,
    };
  }

  return { hasDanger: false };
}

/**
 * Get exploration progress for a region
 */
export function getRegionExplorationProgress(
  travel: TravelState,
  regionId: RegionId
): { discovered: number; total: number; percentage: number } {
  const region = REGIONS[regionId];
  const discovered = travel.discovered_areas[regionId]?.length || 0;
  const total = region?.areas.length || 0;

  return {
    discovered,
    total,
    percentage: total > 0 ? Math.round((discovered / total) * 100) : 0,
  };
}

/**
 * Get all region exploration progress
 */
export function getAllExplorationProgress(travel: TravelState): Record<RegionId, { discovered: number; total: number; percentage: number }> {
  return {
    thanh_van: getRegionExplorationProgress(travel, 'thanh_van'),
    hoa_son: getRegionExplorationProgress(travel, 'hoa_son'),
    huyen_thuy: getRegionExplorationProgress(travel, 'huyen_thuy'),
    tram_loi: getRegionExplorationProgress(travel, 'tram_loi'),
    vong_linh: getRegionExplorationProgress(travel, 'vong_linh'),
  };
}
