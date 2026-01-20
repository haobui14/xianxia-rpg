import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';
import { GameState } from '@/types/game';
import { syncInventoryToTables } from '@/lib/database/syncHelper';
import { attemptEnhancement, canEnhance, getEnhancementCost } from '@/lib/game/enhancement';
import { DeterministicRNG } from '@/lib/game/rng';

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId' },
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
    const state = run.current_state as GameState;

    // Find the item - check both inventory and equipped items
    let item = state.inventory.items.find(i => i.id === itemId);
    let isEquipped = false;

    if (!item) {
      // Check equipped items
      for (const slot of Object.keys(state.equipped_items)) {
        const equipped = state.equipped_items[slot as keyof typeof state.equipped_items];
        if (equipped && equipped.id === itemId) {
          item = equipped;
          isEquipped = true;
          break;
        }
      }
    }

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Validate item can be enhanced
    if (!canEnhance(item)) {
      return NextResponse.json(
        { error: 'Item cannot be enhanced (max level reached or invalid type)' },
        { status: 400 }
      );
    }

    // Check if player can afford the enhancement
    const cost = getEnhancementCost(item, state);
    if (!cost.canAfford) {
      return NextResponse.json(
        { error: 'Insufficient resources for enhancement' },
        { status: 400 }
      );
    }

    // Create RNG with a seed based on current time and item
    const seed = `${Date.now()}-${itemId}-${state.turn_count}`;
    const rng = new DeterministicRNG(seed);

    // Attempt enhancement
    const { success, result, updatedState } = attemptEnhancement(item, state, rng);

    // Update the run with new state
    await runQueries.update(run.id, updatedState);

    // Sync to normalized tables
    await syncInventoryToTables(run.id, updatedState.inventory, updatedState.equipped_items);

    return NextResponse.json({
      success: true,
      result,
      state: updatedState
    });
  } catch (error) {
    console.error('Enhancement error:', error);
    return NextResponse.json(
      { error: 'Failed to enhance item' },
      { status: 500 }
    );
  }
}
