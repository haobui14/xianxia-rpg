/**
 * Sync Helper - Keep JSONB state and normalized tables in sync
 * This ensures data consistency between current_state and the new tables
 * Uses RPC functions to bypass RLS restrictions where needed
 */

import { supabase } from "./client";
import { GameState } from "@/types/game";
import {
  marketQueries,
  combatQueries,
  leaderboardQueries,
} from "./extendedQueries";

/**
 * Sync inventory from JSONB to normalized tables
 * Uses RPC function to handle RLS properly
 */
export async function syncInventoryToTables(
  runId: string,
  inventory: GameState["inventory"],
  equippedItems: GameState["equipped_items"],
) {
  try {
    // Prepare inventory items
    const inventoryItems = inventory.items.map((item) => ({
      item_id: item.id,
      item_data: item,
      quantity: item.quantity,
    }));

    // Prepare equipped items
    const equippedItemsArray = Object.entries(equippedItems)
      .filter(([_, item]) => item !== null && item !== undefined)
      .map(([slot, item]) => ({
        slot,
        item_data: item,
      }));

    // Use RPC function to sync inventory (bypasses RLS with proper auth check)
    const { error } = await supabase.rpc("sync_character_inventory", {
      p_run_id: runId,
      p_inventory_items: inventoryItems,
      p_equipped_items: equippedItemsArray,
    });

    if (error) {
      // Function might not exist - that's okay
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    // Silently fail if RPC function doesn't exist
    return { success: false, error };
  }
}

/**
 * Load inventory from normalized tables to JSONB state
 */
export async function loadInventoryFromTables(runId: string): Promise<{
  inventory: GameState["inventory"];
  equippedItems: GameState["equipped_items"];
} | null> {
  try {
    // Use imported supabase

    // Get inventory items
    const { data: inventoryData, error: invError } = await supabase
      .from("character_inventory")
      .select("*")
      .eq("run_id", runId)
      .eq("is_equipped", false);

    if (invError) throw invError;

    // Get equipped items
    const { data: equippedData, error: eqError } = await supabase
      .from("character_equipment")
      .select("*")
      .eq("run_id", runId);

    if (eqError) throw eqError;

    // Transform to GameState format
    const inventory = {
      silver: 0, // These need to be loaded from current_state
      spirit_stones: 0,
      items: (inventoryData || []).map((item: any) => ({
        ...item.item_data,
        quantity: item.quantity,
      })),
      max_slots: 20, // Default inventory capacity
    };

    const equippedItems: GameState["equipped_items"] = {};
    (equippedData || []).forEach((eq: any) => {
      equippedItems[eq.slot as keyof GameState["equipped_items"]] =
        eq.item_data;
    });

    return { inventory, equippedItems };
  } catch (error) {
    console.error("Error loading inventory from tables:", error);
    return null;
  }
}

/**
 * Sync market listings to tables
 */
export async function syncMarketToTables(
  worldSeed: string,
  generationQuarter: number,
  items: any[],
) {
  try {
    // Use imported supabase

    // Delete old listings for this quarter
    await supabase
      .from("market_listings")
      .delete()
      .eq("world_seed", worldSeed)
      .eq("generation_quarter", generationQuarter);

    // Insert new listings
    if (items.length > 0) {
      const listings = items.map((item) => ({
        world_seed: worldSeed,
        generation_quarter: generationQuarter,
        item_id: item.id,
        item_data: item,
        price_silver: item.price_silver || 0,
        price_spirit_stones: item.price_spirit_stones || 0,
        quantity_available: 1,
      }));

      await supabase.from("market_listings").insert(listings);
    }

    return { success: true };
  } catch (error) {
    console.error("Error syncing market:", error);
    return { success: false, error };
  }
}

/**
 * Load market listings from tables
 */
export async function loadMarketFromTables(
  worldSeed: string,
  generationQuarter: number,
) {
  try {
    // Use imported supabase

    const { data, error } = await supabase
      .from("market_listings")
      .select("*")
      .eq("world_seed", worldSeed)
      .eq("generation_quarter", generationQuarter);

    if (error) throw error;

    return (data || []).map((listing: any) => ({
      ...listing.item_data,
      price_silver: listing.price_silver,
      price_spirit_stones: listing.price_spirit_stones,
    }));
  } catch (error) {
    console.error("Error loading market from tables:", error);
    return null;
  }
}

/**
 * Record combat to history table
 */
export async function recordCombatHistory(
  runId: string,
  enemyId: string,
  enemyName: string,
  victory: boolean,
  playerDamageDealt: number,
  playerDamageTaken: number,
  rewards: any,
  gameDate: { year: number; month: number; day: number },
  turnNo: number,
) {
  try {
    await combatQueries.recordCombat(
      runId,
      enemyId,
      enemyName,
      victory,
      playerDamageDealt,
      playerDamageTaken,
      rewards,
      gameDate,
      turnNo,
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording combat history:", error);
    return { success: false, error };
  }
}

/**
 * Update player statistics for leaderboard
 */
export async function updatePlayerStats(
  runId: string,
  characterName: string,
  state: GameState,
  combatWins: number = 0,
) {
  try {
    await leaderboardQueries.updateStatistics(
      runId,
      characterName,
      state.progress.realm,
      state.progress.realm_stage,
      state.inventory.silver,
      state.inventory.spirit_stones,
      combatWins,
      state.progress.cultivation_exp,
      0, // achievements count - would need to track this
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating player stats:", error);
    return { success: false, error };
  }
}

/**
 * Record market transaction
 */
export async function recordMarketTransaction(
  runId: string,
  type: "buy" | "sell",
  itemId: string,
  itemName: string,
  quantity: number,
  priceSilver: number,
  priceSpiritStones: number,
  gameDate: { year: number; month: number; day: number },
) {
  try {
    await marketQueries.recordTransaction(
      runId,
      type,
      itemId,
      itemName,
      quantity,
      priceSilver,
      priceSpiritStones,
      gameDate,
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording transaction:", error);
    return { success: false, error };
  }
}

/**
 * Sync skills from JSONB state to normalized table
 */
export async function syncSkillsToTables(
  runId: string,
  skills: GameState["skills"],
) {
  try {
    if (!skills || skills.length === 0) return { success: true };

    // Prepare skills data
    const skillsData = skills.map((skill) => ({
      skill_id: skill.id,
      skill_data: skill,
      current_level: skill.level,
    }));

    // Use RPC function to sync skills
    const { error } = await supabase.rpc("sync_character_skills", {
      p_run_id: runId,
      p_skills: skillsData,
    });

    if (error) {
      // Try direct insert if RPC doesn't exist
      console.log("RPC sync_character_skills not found, using direct sync");
      return await syncSkillsDirect(runId, skills);
    }

    return { success: true };
  } catch (error) {
    console.error("Error syncing skills:", error);
    return { success: false, error };
  }
}

/**
 * Direct sync for skills (fallback if RPC not available)
 */
async function syncSkillsDirect(runId: string, skills: GameState["skills"]) {
  try {
    // Delete existing skills for this run
    await supabase.from("character_skills").delete().eq("run_id", runId);

    // Insert all skills
    if (skills.length > 0) {
      const skillRecords = skills.map((skill) => ({
        run_id: runId,
        skill_id: skill.id,
        skill_data: skill,
        current_level: skill.level,
        experience: skill.exp || 0,
      }));

      const { error } = await supabase
        .from("character_skills")
        .insert(skillRecords);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error in direct skills sync:", error);
    return { success: false, error };
  }
}

/**
 * Sync techniques from JSONB state to normalized table
 */
export async function syncTechniquesToTables(
  runId: string,
  techniques: GameState["techniques"],
) {
  try {
    if (!techniques || techniques.length === 0) return { success: true };

    // Prepare techniques data
    const techniquesData = techniques.map((tech) => ({
      technique_id: tech.id,
      technique_data: tech,
      mastery_level: 1, // Default mastery
    }));

    // Use RPC function to sync techniques
    const { error } = await supabase.rpc("sync_character_techniques", {
      p_run_id: runId,
      p_techniques: techniquesData,
    });

    if (error) {
      // Try direct insert if RPC doesn't exist
      console.log("RPC sync_character_techniques not found, using direct sync");
      return await syncTechniquesDirect(runId, techniques);
    }

    return { success: true };
  } catch (error) {
    console.error("Error syncing techniques:", error);
    return { success: false, error };
  }
}

/**
 * Direct sync for techniques (fallback if RPC not available)
 */
async function syncTechniquesDirect(
  runId: string,
  techniques: GameState["techniques"],
) {
  try {
    // Delete existing techniques for this run
    await supabase.from("character_techniques").delete().eq("run_id", runId);

    // Insert all techniques
    if (techniques.length > 0) {
      const techRecords = techniques.map((tech) => ({
        run_id: runId,
        technique_id: tech.id,
        technique_data: tech,
        mastery_level: 1,
      }));

      const { error } = await supabase
        .from("character_techniques")
        .insert(techRecords);

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error in direct techniques sync:", error);
    return { success: false, error };
  }
}

/**
 * Load skills from normalized tables
 */
export async function loadSkillsFromTables(
  runId: string,
): Promise<GameState["skills"] | null> {
  try {
    const { data, error } = await supabase
      .from("character_skills")
      .select("*")
      .eq("run_id", runId);

    if (error) throw error;

    return (data || []).map((record: any) => ({
      ...record.skill_data,
      level: record.current_level,
    }));
  } catch (error) {
    console.error("Error loading skills from tables:", error);
    return null;
  }
}

/**
 * Load techniques from normalized tables
 */
export async function loadTechniquesFromTables(
  runId: string,
): Promise<GameState["techniques"] | null> {
  try {
    const { data, error } = await supabase
      .from("character_techniques")
      .select("*")
      .eq("run_id", runId);

    if (error) throw error;

    return (data || []).map((record: any) => record.technique_data);
  } catch (error) {
    console.error("Error loading techniques from tables:", error);
    return null;
  }
}

/**
 * Full sync - sync entire game state to tables
 */
export async function fullSync(
  runId: string,
  state: GameState,
  characterName: string,
) {
  await syncInventoryToTables(runId, state.inventory, state.equipped_items);
  await syncSkillsToTables(runId, state.skills);
  await syncTechniquesToTables(runId, state.techniques);
  await updatePlayerStats(runId, characterName, state);
}
