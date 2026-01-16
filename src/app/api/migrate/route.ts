import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { runQueries, characterQueries } from "@/lib/database/queries";
import {
  syncInventoryToTables,
  updatePlayerStats,
} from "@/lib/database/syncHelper";
import { GameState } from "@/types/game";

/**
 * Migration API - Migrate existing data from JSONB to normalized tables
 * Run this once to populate the new tables with existing game data
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (admin check could be added here)
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Get all characters for this user
    const characters = await characterQueries.getByUserId(user.id);

    for (const character of characters) {
      // Get all runs for this character
      const runs = await runQueries.getByCharacterId(character.id);

      for (const run of runs) {
        results.processed++;

        try {
          const state = run.current_state as GameState;

          // Sync inventory and equipped items
          const inventoryResult = await syncInventoryToTables(
            run.id,
            state.inventory,
            state.equipped_items
          );

          if (!inventoryResult.success) {
            throw new Error("Failed to sync inventory");
          }

          // Update player statistics for leaderboard
          const statsResult = await updatePlayerStats(
            run.id,
            character.name,
            state,
            0 // Combat wins - would need to calculate from existing data
          );

          if (!statsResult.success) {
            throw new Error("Failed to update player stats");
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Run ${run.id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Count total runs
    const characters = await characterQueries.getByUserId(user.id);
    let totalRuns = 0;

    for (const character of characters) {
      const runs = await runQueries.getByCharacterId(character.id);
      totalRuns += runs.length;
    }

    // Count migrated items in tables
    const { data: inventoryData, error: invError } = await supabase
      .from("character_inventory")
      .select("run_id", { count: "exact", head: true });

    const { data: equipmentData, error: eqError } = await supabase
      .from("character_equipment")
      .select("run_id", { count: "exact", head: true });

    const { data: statsData, error: statsError } = await supabase
      .from("player_statistics")
      .select("run_id", { count: "exact", head: true });

    if (invError || eqError || statsError) {
      throw new Error("Failed to check migration status");
    }

    return NextResponse.json({
      totalRuns,
      migratedInventoryItems: inventoryData,
      migratedEquipmentSlots: equipmentData,
      migratedPlayerStats: statsData,
      needsMigration: totalRuns > 0 && (!statsData || statsData.length === 0),
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
