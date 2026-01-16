/**
 * Extended Database Queries for Normalized Tables
 * Helper functions to interact with the new database schema
 */

import { supabase } from './client';

// ============================================
// INVENTORY MANAGEMENT
// ============================================

export const inventoryQueries = {
  /**
   * Get all inventory items for a run
   */
  async getInventory(runId: string) {
    const { data, error } = await supabase
      .from('character_inventory')
      .select('*')
      .eq('run_id', runId)
      .order('acquired_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Add item to inventory (or update quantity if exists)
   */
  async addItem(runId: string, itemId: string, itemData: any, quantity: number = 1) {
    // Check if item already exists (and not equipped)
    const { data: existing } = await supabase
      .from('character_inventory')
      .select('*')
      .eq('run_id', runId)
      .eq('item_id', itemId)
      .eq('is_equipped', false)
      .single();
    
    if (existing) {
      // Update quantity
      const { data, error } = await supabase
        .from('character_inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Insert new item
      const { data, error } = await supabase
        .from('character_inventory')
        .insert({ run_id: runId, item_id: itemId, item_data: itemData, quantity })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  /**
   * Remove item from inventory
   */
  async removeItem(runId: string, itemId: string, quantity: number = 1) {
    const { data: item } = await supabase
      .from('character_inventory')
      .select('*')
      .eq('run_id', runId)
      .eq('item_id', itemId)
      .eq('is_equipped', false)
      .single();
    
    if (!item) throw new Error('Item not found');
    
    if (item.quantity > quantity) {
      // Decrease quantity
      const { data, error } = await supabase
        .from('character_inventory')
        .update({ quantity: item.quantity - quantity })
        .eq('id', item.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Remove entirely
      const { error } = await supabase
        .from('character_inventory')
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;
      return null;
    }
  },

  /**
   * Get equipped items
   */
  async getEquippedItems(runId: string) {
    const { data, error } = await supabase
      .from('character_equipment')
      .select('*')
      .eq('run_id', runId);
    
    if (error) throw error;
    return data;
  },

  /**
   * Equip an item
   */
  async equipItem(runId: string, inventoryItemId: string, slot: string, itemData: any) {
    // First, unequip anything in that slot
    const { data: existing } = await supabase
      .from('character_equipment')
      .select('*')
      .eq('run_id', runId)
      .eq('slot', slot)
      .single();
    
    if (existing) {
      // Unequip first
      await supabase
        .from('character_equipment')
        .delete()
        .eq('id', existing.id);
    }
    
    // Equip new item
    const { data, error } = await supabase
      .from('character_equipment')
      .insert({
        run_id: runId,
        slot,
        inventory_item_id: inventoryItemId,
        item_data: itemData
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update inventory item status
    await supabase
      .from('character_inventory')
      .update({ is_equipped: true, equipped_slot: slot })
      .eq('id', inventoryItemId);
    
    return data;
  },

  /**
   * Unequip an item
   */
  async unequipItem(runId: string, slot: string) {
    const { data: equipped } = await supabase
      .from('character_equipment')
      .select('*')
      .eq('run_id', runId)
      .eq('slot', slot)
      .single();
    
    if (!equipped) return null;
    
    // Remove from equipment
    await supabase
      .from('character_equipment')
      .delete()
      .eq('id', equipped.id);
    
    // Update inventory item status
    if (equipped.inventory_item_id) {
      await supabase
        .from('character_inventory')
        .update({ is_equipped: false, equipped_slot: null })
        .eq('id', equipped.inventory_item_id);
    }
    
    return equipped;
  }
};

// ============================================
// MARKET MANAGEMENT
// ============================================

export const marketQueries = {
  /**
   * Get market listings for current quarter
   */
  async getMarketListings(worldSeed: string, generationQuarter: number) {
    const { data, error } = await supabase
      .from('active_market_view')
      .select('*')
      .eq('world_seed', worldSeed)
      .eq('generation_quarter', generationQuarter);
    
    if (error) throw error;
    return data;
  },

  /**
   * Create market listings for a quarter
   */
  async createMarketListings(worldSeed: string, generationQuarter: number, items: any[]) {
    const { data, error } = await supabase
      .from('market_listings')
      .insert(
        items.map(item => ({
          world_seed: worldSeed,
          generation_quarter: generationQuarter,
          item_id: item.id,
          item_data: item,
          price_silver: item.price_silver || 0,
          price_spirit_stones: item.price_spirit_stones || 0,
          quantity_available: item.quantity || 1
        }))
      )
      .select();
    
    if (error) throw error;
    return data;
  },

  /**
   * Record a market transaction
   */
  async recordTransaction(
    runId: string,
    type: 'buy' | 'sell',
    itemId: string,
    itemName: string,
    quantity: number,
    priceSilver: number,
    priceSpiritStones: number,
    gameDate: { year: number; month: number; day: number }
  ) {
    const { data, error } = await supabase
      .from('market_transactions')
      .insert({
        run_id: runId,
        transaction_type: type,
        item_id: itemId,
        item_name: itemName,
        quantity,
        price_silver: priceSilver,
        price_spirit_stones: priceSpiritStones,
        transaction_date: gameDate
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get transaction history for a run
   */
  async getTransactionHistory(runId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('market_transactions')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// SKILLS & TECHNIQUES
// ============================================

export const skillQueries = {
  /**
   * Get character skills
   */
  async getCharacterSkills(runId: string) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_skills')
      .select('*')
      .eq('run_id', runId);
    
    if (error) throw error;
    return data;
  },

  /**
   * Add or update a skill
   */
  async upsertSkill(runId: string, skillId: string, skillData: any, level: number = 1) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_skills')
      .upsert({
        run_id: runId,
        skill_id: skillId,
        skill_data: skillData,
        current_level: level
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get character techniques
   */
  async getCharacterTechniques(runId: string) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_techniques')
      .select('*')
      .eq('run_id', runId);
    
    if (error) throw error;
    return data;
  },

  /**
   * Add a technique
   */
  async addTechnique(runId: string, techniqueId: string, techniqueData: any) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_techniques')
      .insert({
        run_id: runId,
        technique_id: techniqueId,
        technique_data: techniqueData
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// QUESTS
// ============================================

export const questQueries = {
  /**
   * Get active quests
   */
  async getActiveQuests(runId: string) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_quests')
      .select('*')
      .eq('run_id', runId)
      .eq('status', 'active');
    
    if (error) throw error;
    return data;
  },

  /**
   * Add a quest
   */
  async addQuest(runId: string, questId: string, questData: any) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_quests')
      .insert({
        run_id: runId,
        quest_id: questId,
        quest_data: questData,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update quest status
   */
  async updateQuestStatus(questId: string, status: 'active' | 'completed' | 'failed' | 'abandoned') {
    // Use imported supabase
    const { data, error } = await supabase
      .from('character_quests')
      .update({ 
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', questId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// COMBAT & STATISTICS
// ============================================

export const combatQueries = {
  /**
   * Record combat result
   */
  async recordCombat(
    runId: string,
    enemyId: string,
    enemyName: string,
    victory: boolean,
    playerDamageDealt: number,
    playerDamageTaken: number,
    rewards: any,
    gameDate: { year: number; month: number; day: number },
    turnNo: number
  ) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('combat_history')
      .insert({
        run_id: runId,
        enemy_id: enemyId,
        enemy_name: enemyName,
        victory,
        player_damage_dealt: playerDamageDealt,
        player_damage_taken: playerDamageTaken,
        rewards,
        combat_date: gameDate,
        turn_no: turnNo
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get combat history
   */
  async getCombatHistory(runId: string, limit: number = 20) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('combat_history')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// LEADERBOARDS
// ============================================

export const leaderboardQueries = {
  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 100) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .limit(limit);
    
    if (error) throw error;
    return data;
  },

  /**
   * Update player statistics
   * Uses RPC function to bypass RLS restrictions
   */
  async updateStatistics(
    runId: string,
    characterName: string,
    currentRealm: string,
    realmStage: number,
    silver: number,
    spiritStones: number,
    combatWins: number,
    cultivationExp: number,
    achievementsCount: number,
    totalDeaths: number = 0,
    playTimeMinutes: number = 0
  ) {
    const totalWealth = silver + (spiritStones * 100);

    const { data, error } = await supabase.rpc('upsert_player_statistics', {
      p_run_id: runId,
      p_character_name: characterName,
      p_current_realm: currentRealm,
      p_realm_stage: realmStage,
      p_total_wealth: totalWealth,
      p_total_combat_wins: combatWins,
      p_total_deaths: totalDeaths,
      p_highest_cultivation_exp: cultivationExp,
      p_play_time_minutes: playTimeMinutes,
      p_achievements_count: achievementsCount
    });

    if (error) throw error;
    return data;
  }
};

// ============================================
// NPC RELATIONSHIPS
// ============================================

export const npcQueries = {
  /**
   * Get NPC relationships
   */
  async getRelationships(runId: string) {
    // Use imported supabase
    const { data, error } = await supabase
      .from('npc_relationships')
      .select('*')
      .eq('run_id', runId)
      .order('relationship_level', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Update NPC relationship
   */
  async updateRelationship(
    runId: string,
    npcId: string,
    npcName: string,
    npcNameEn: string,
    relationshipChange: number,
    interactionData?: any
  ) {
    // Use imported supabase
    
    // Get existing relationship
    const { data: existing } = await supabase
      .from('npc_relationships')
      .select('*')
      .eq('run_id', runId)
      .eq('npc_id', npcId)
      .single();
    
    if (existing) {
      // Update existing
      const newLevel = Math.max(-100, Math.min(100, existing.relationship_level + relationshipChange));
      let newType = existing.relationship_type;
      
      // Update type based on level
      if (newLevel < -50) newType = 'enemy';
      else if (newLevel < -10) newType = 'neutral';
      else if (newLevel < 30) newType = 'friendly';
      else newType = 'companion';
      
      const newHistory = [...(existing.interaction_history || [])];
      if (interactionData) {
        newHistory.push({ ...interactionData, timestamp: new Date().toISOString() });
      }
      
      const { data, error } = await supabase
        .from('npc_relationships')
        .update({
          relationship_level: newLevel,
          relationship_type: newType,
          last_interaction_at: new Date().toISOString(),
          interaction_history: newHistory.slice(-20) // Keep last 20 interactions
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new relationship
      const { data, error } = await supabase
        .from('npc_relationships')
        .insert({
          run_id: runId,
          npc_id: npcId,
          npc_name: npcName,
          npc_name_en: npcNameEn,
          relationship_level: relationshipChange,
          relationship_type: 'neutral',
          interaction_history: interactionData ? [{ ...interactionData, timestamp: new Date().toISOString() }] : []
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};
