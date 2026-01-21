import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';
import { GameState } from '@/types/game';
import { RegionId } from '@/types/world';
import { migrateGameState } from '@/lib/game/mechanics';
import {
  canTravelToArea,
  canTravelToRegion,
  travelToArea,
  travelToRegion,
  getAvailableDestinations,
  getCurrentLocationInfo,
  getDangerWarning,
  discoverArea,
} from '@/lib/world/travel';
import { getRegion, getArea } from '@/lib/world/regions';

export async function POST(request: NextRequest) {
  try {
    const { action, destination } = await request.json();

    if (!action || !['travel_area', 'travel_region', 'get_destinations', 'get_location'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "travel_area", "travel_region", "get_destinations", or "get_location"' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get character
    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    const character = characters[0];

    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'No active run found' },
        { status: 404 }
      );
    }

    const run = runs[0];
    let state = migrateGameState(run.current_state as GameState);

    // Handle different actions
    if (action === 'get_location') {
      const locationInfo = getCurrentLocationInfo(state.travel!);
      const dangerWarning = getDangerWarning(state.travel!, state.progress.realm);

      return NextResponse.json({
        success: true,
        location: {
          region: {
            id: locationInfo.region.id,
            name: locationInfo.region.name,
            name_en: locationInfo.region.name_en,
            tier: locationInfo.region.tier,
            element: locationInfo.region.element,
          },
          area: {
            id: locationInfo.area.id,
            name: locationInfo.area.name,
            name_en: locationInfo.area.name_en,
            type: locationInfo.area.type,
            danger_level: locationInfo.area.danger_level,
            is_safe: locationInfo.area.is_safe,
            cultivation_bonus: locationInfo.area.cultivation_bonus,
          },
          discoveredCount: locationInfo.discoveredCount,
          totalAreas: locationInfo.totalAreas,
          reputation: locationInfo.reputation,
        },
        danger_warning: dangerWarning.hasDanger ? {
          message: dangerWarning.message,
          message_en: dangerWarning.message_en,
        } : null,
      });
    }

    if (action === 'get_destinations') {
      const destinations = getAvailableDestinations(
        state.travel!,
        state.progress.realm,
        state.stats.stamina
      );

      return NextResponse.json({
        success: true,
        areas: destinations.areas.map(a => ({
          id: a.area.id,
          name: a.area.name,
          name_en: a.area.name_en,
          type: a.area.type,
          danger_level: a.area.danger_level,
          canTravel: a.canTravel,
          reason: a.reason,
          staminaCost: a.staminaCost,
        })),
        regions: destinations.regions.map(r => ({
          id: r.region.id,
          name: r.region.name,
          name_en: r.region.name_en,
          tier: r.region.tier,
          element: r.region.element,
          canTravel: r.canTravel,
          reason: r.reason,
          warning: r.warning,
          staminaCost: r.staminaCost,
        })),
      });
    }

    if (action === 'travel_area') {
      if (!destination) {
        return NextResponse.json(
          { error: 'Destination area ID required' },
          { status: 400 }
        );
      }

      const canTravel = canTravelToArea(state.travel!, destination, state.stats.stamina);

      if (!canTravel.canTravel) {
        return NextResponse.json({
          success: false,
          error: canTravel.reason_en || canTravel.reason,
        }, { status: 400 });
      }

      // Execute travel
      const { newTravel, timeCost } = travelToArea(state.travel!, destination);

      // Apply stamina cost
      state.stats.stamina -= canTravel.staminaCost;

      // Update state
      state.travel = newTravel;

      // Advance time
      const timeOrder = ['Sáng', 'Chiều', 'Tối', 'Đêm'];
      let currentIndex = timeOrder.indexOf(state.time_segment);
      for (let i = 0; i < timeCost; i++) {
        currentIndex++;
        if (currentIndex >= timeOrder.length) {
          currentIndex = 0;
          state.time_day++;
          if (state.time_day > 30) {
            state.time_day = 1;
            state.time_month++;
            if (state.time_month > 12) {
              state.time_month = 1;
              state.time_year++;
              state.age++;
            }
          }
        }
      }
      state.time_segment = timeOrder[currentIndex] as any;

      // Get new location info
      const area = getArea(destination);
      const dangerWarning = getDangerWarning(state.travel!, state.progress.realm);

      // Save to database
      await runQueries.update(run.id, state);

      return NextResponse.json({
        success: true,
        state,
        travel_result: {
          arrived_at: {
            name: area?.name,
            name_en: area?.name_en,
            type: area?.type,
          },
          stamina_cost: canTravel.staminaCost,
          time_cost: timeCost,
        },
        danger_warning: dangerWarning.hasDanger ? {
          message: dangerWarning.message,
          message_en: dangerWarning.message_en,
        } : null,
      });
    }

    if (action === 'travel_region') {
      if (!destination) {
        return NextResponse.json(
          { error: 'Destination region ID required' },
          { status: 400 }
        );
      }

      const canTravel = canTravelToRegion(
        state.travel!,
        destination as RegionId,
        state.progress.realm,
        state.stats.stamina
      );

      if (!canTravel.canTravel) {
        return NextResponse.json({
          success: false,
          error: canTravel.reason_en || canTravel.reason,
        }, { status: 400 });
      }

      // Execute travel
      const { newTravel, timeCost } = travelToRegion(state.travel!, destination as RegionId);

      // Apply stamina cost
      state.stats.stamina -= canTravel.staminaCost;

      // Update state
      state.travel = newTravel;

      // Advance time
      const timeOrder = ['Sáng', 'Chiều', 'Tối', 'Đêm'];
      let currentIndex = timeOrder.indexOf(state.time_segment);
      for (let i = 0; i < timeCost; i++) {
        currentIndex++;
        if (currentIndex >= timeOrder.length) {
          currentIndex = 0;
          state.time_day++;
          if (state.time_day > 30) {
            state.time_day = 1;
            state.time_month++;
            if (state.time_month > 12) {
              state.time_month = 1;
              state.time_year++;
              state.age++;
            }
          }
        }
      }
      state.time_segment = timeOrder[currentIndex] as any;

      // Get new location info
      const region = getRegion(destination as RegionId);
      const area = getArea(newTravel.current_area);
      const dangerWarning = getDangerWarning(state.travel!, state.progress.realm);

      // Save to database
      await runQueries.update(run.id, state);

      return NextResponse.json({
        success: true,
        state,
        travel_result: {
          arrived_at: {
            region_name: region?.name,
            region_name_en: region?.name_en,
            area_name: area?.name,
            area_name_en: area?.name_en,
          },
          stamina_cost: canTravel.staminaCost,
          time_cost: timeCost,
          warning: canTravel.warning_en || canTravel.warning,
        },
        danger_warning: dangerWarning.hasDanger ? {
          message: dangerWarning.message,
          message_en: dangerWarning.message_en,
        } : null,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Travel error:', error);
    return NextResponse.json(
      { error: 'Failed to process travel action' },
      { status: 500 }
    );
  }
}
