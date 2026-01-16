/**
 * Migration Script - Run from command line to migrate data
 * Usage: npx tsx src/scripts/migrate-to-tables.ts
 */

import { createClient } from '@supabase/supabase-js';
import { GameState } from '../types/game';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateRun(runId: string, state: GameState, characterName: string) {
  try {
    // Clear existing data for this run
    await supabase.from('character_inventory').delete().eq('run_id', runId);
    await supabase.from('character_equipment').delete().eq('run_id', runId);

    // Migrate inventory items
    if (state.inventory.items.length > 0) {
      const inventoryData = state.inventory.items.map(item => ({
        run_id: runId,
        item_id: item.id,
        item_data: item,
        quantity: item.quantity,
        is_equipped: false,
        equipped_slot: null
      }));

      const { error: invError } = await supabase
        .from('character_inventory')
        .insert(inventoryData);

      if (invError) {
        console.error(`  ⚠️  Inventory migration failed:`, invError.message);
      } else {
        console.log(`  ✓ Migrated ${inventoryData.length} inventory items`);
      }
    }

    // Migrate equipped items
    let equippedCount = 0;
    for (const [slot, item] of Object.entries(state.equipped_items)) {
      if (item) {
        const { error: eqError } = await supabase
          .from('character_equipment')
          .insert({
            run_id: runId,
            slot,
            item_data: item,
            inventory_item_id: null
          });

        if (eqError) {
          console.error(`  ⚠️  Equipment migration failed for ${slot}:`, eqError.message);
        } else {
          equippedCount++;
        }
      }
    }
    
    if (equippedCount > 0) {
      console.log(`  ✓ Migrated ${equippedCount} equipped items`);
    }

    // Migrate player statistics
    const totalWealth = state.inventory.silver + (state.inventory.spirit_stones * 100);
    
    const { error: statsError } = await supabase
      .from('player_statistics')
      .upsert({
        run_id: runId,
        character_name: characterName,
        current_realm: state.progress.realm,
        realm_stage: state.progress.realm_stage,
        total_wealth: totalWealth,
        total_combat_wins: 0, // Would need to calculate from turn logs
        highest_cultivation_exp: state.progress.cultivation_exp,
        achievements_count: 0,
        updated_at: new Date().toISOString()
      });

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
  console.log('🚀 Starting migration to normalized tables...\n');

  try {
    // Get all runs
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, character_id, current_state');

    if (runsError) {
      throw new Error(`Failed to fetch runs: ${runsError.message}`);
    }

    if (!runs || runs.length === 0) {
      console.log('ℹ️  No runs found to migrate');
      return;
    }

    console.log(`Found ${runs.length} runs to migrate\n`);

    // Get all characters
    const { data: characters, error: charsError } = await supabase
      .from('characters')
      .select('id, name');

    if (charsError) {
      throw new Error(`Failed to fetch characters: ${charsError.message}`);
    }

    const characterMap = new Map(characters?.map(c => [c.id, c.name]) || []);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const characterName = characterMap.get(run.character_id) || 'Unknown';
      
      console.log(`[${i + 1}/${runs.length}] Migrating run ${run.id} (${characterName})...`);
      
      const state = run.current_state as GameState;
      const result = await migrateRun(run.id, state, characterName);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
      
      console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log('✅ Migration Complete!\n');
    console.log(`Total runs processed: ${runs.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
