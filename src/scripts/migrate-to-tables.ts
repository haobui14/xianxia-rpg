/**
 * Migration Script - Run from command line to migrate data
 * Usage: npx tsx src/scripts/migrate-to-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import { GameState } from "../types/game";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateRun(
  runId: string,
  state: GameState,
  characterName: string
) {
  try {
    // Prepare inventory items for RPC
    const inventoryItems = state.inventory.items.map((item) => ({
      item_id: item.id,
      item_data: item,
      quantity: item.quantity,
    }));

    // Prepare equipped items for RPC
    const equippedItemsArray = Object.entries(state.equipped_items)
      .filter(([_, item]) => item !== null && item !== undefined)
      .map(([slot, item]) => ({
        slot,
        item_data: item,
      }));

    // Use RPC function to sync inventory (service role bypasses RLS)
    const { error: invError } = await supabase.rpc(
      "sync_character_inventory_admin",
      {
        p_run_id: runId,
        p_inventory_items: inventoryItems,
        p_equipped_items: equippedItemsArray,
      }
    );

    if (invError) {
      console.error(`  ⚠️  Inventory migration failed:`, invError.message);
    } else {
      console.log(
        `  ✓ Migrated ${inventoryItems.length} inventory items and ${equippedItemsArray.length} equipped items`
      );
    }

    // Migrate player statistics using admin RPC
    const totalWealth =
      state.inventory.silver + state.inventory.spirit_stones * 100;

    const { error: statsError } = await supabase.rpc(
      "upsert_player_statistics_admin",
      {
        p_run_id: runId,
        p_character_name: characterName,
        p_current_realm: state.progress.realm,
        p_realm_stage: state.progress.realm_stage,
        p_total_wealth: totalWealth,
        p_total_combat_wins: 0,
        p_total_deaths: 0,
        p_highest_cultivation_exp: state.progress.cultivation_exp,
        p_play_time_minutes: 0,
        p_achievements_count: 0,
      }
    );

    if (statsError) {
      console.error(`  ⚠️  Statistics migration failed:`, statsError.message);
    } else {
      console.log(`  ✓ Migrated player statistics`);
    }

    return { success: true };
  } catch (error) {
    console.error(`  ❌ Migration failed:`, error);
    return { success: false, error };
  }
}

async function main() {
  console.log("🚀 Starting migration to normalized tables...\n");

  try {
    // Get all runs
    const { data: runs, error: runsError } = await supabase
      .from("runs")
      .select("id, character_id, current_state");

    if (runsError) {
      throw new Error(`Failed to fetch runs: ${runsError.message}`);
    }

    if (!runs || runs.length === 0) {
      console.log("ℹ️  No runs found to migrate");
      return;
    }

    console.log(`Found ${runs.length} runs to migrate\n`);

    // Get all characters
    const { data: characters, error: charsError } = await supabase
      .from("characters")
      .select("id, name");

    if (charsError) {
      throw new Error(`Failed to fetch characters: ${charsError.message}`);
    }

    const characterMap = new Map(characters?.map((c) => [c.id, c.name]) || []);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const characterName = characterMap.get(run.character_id) || "Unknown";

      console.log(
        `[${i + 1}/${runs.length}] Migrating run ${
          run.id
        } (${characterName})...`
      );

      const state = run.current_state as GameState;
      const result = await migrateRun(run.id, state, characterName);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      console.log("");
    }

    console.log("═══════════════════════════════════════");
    console.log("✅ Migration Complete!\n");
    console.log(`Total runs processed: ${runs.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
