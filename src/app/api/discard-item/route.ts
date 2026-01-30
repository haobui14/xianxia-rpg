import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { GameState } from "@/types/game";
import { syncInventoryToTables } from "@/lib/database/syncHelper";

export async function POST(request: NextRequest) {
  try {
    const { itemId, quantity } = await request.json();

    if (!itemId || !quantity || quantity < 1) {
      return NextResponse.json({ error: "Invalid itemId or quantity" }, { status: 400 });
    }

    // Get authenticated user
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get character
    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const character = characters[0];

    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json({ error: "No active run found" }, { status: 404 });
    }

    const run = runs[0];
    const state = run.current_state as GameState;

    // Find the item in inventory
    const itemIndex = state.inventory.items.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = state.inventory.items[itemIndex];

    // Check if trying to discard more than available
    if (quantity > item.quantity) {
      return NextResponse.json({ error: "Insufficient quantity" }, { status: 400 });
    }

    // Remove the specified quantity
    if (quantity >= item.quantity) {
      // Remove the entire item
      state.inventory.items.splice(itemIndex, 1);
    } else {
      // Reduce quantity
      state.inventory.items[itemIndex].quantity -= quantity;
    }

    // Update the run with new state
    await runQueries.update(run.id, state);

    // Sync to normalized tables
    await syncInventoryToTables(run.id, state.inventory, state.equipped_items);

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error("Discard item error:", error);
    return NextResponse.json({ error: "Failed to discard item" }, { status: 500 });
  }
}
