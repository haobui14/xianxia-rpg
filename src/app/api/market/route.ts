import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';
import { GameState, MarketItem, MarketState } from '@/types/game';
import { DeterministicRNG } from '@/lib/game/rng';
import { syncMarketToTables, loadMarketFromTables, recordMarketTransaction, syncInventoryToTables } from '@/lib/database/syncHelper';

// Generate market items using AI-like logic
function generateMarketItems(
  state: GameState,
  rng: DeterministicRNG
): MarketItem[] {
  const items: MarketItem[] = [];
  const itemCount = rng.randomInt(8, 15);

  const rarityWeights = {
    Common: 50,
    Uncommon: 30,
    Rare: 15,
    Epic: 4,
    Legendary: 1,
  };

  for (let i = 0; i < itemCount; i++) {
    const rarity = selectRarity(rarityWeights, rng);
    const isEquipment = rng.chance(0.6);
    
    const item = isEquipment
      ? generateEquipment(i, rarity, rng, state.progress.realm)
      : generateConsumable(i, rarity, rng, state.progress.realm);
    
    items.push(item);
  }

  return items;
}

function selectRarity(weights: Record<string, number>, rng: DeterministicRNG): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng.random() * total;
  
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  
  return 'Common';
}

function generateEquipment(
  id: number,
  rarity: string,
  rng: DeterministicRNG,
  realm: string
): MarketItem {
  const slots = ['Weapon', 'Head', 'Chest', 'Legs', 'Feet', 'Hands', 'Accessory', 'Artifact'];
  const slot = slots[rng.randomInt(0, slots.length - 1)];
  
  const rarityMultiplier = {
    Common: 1,
    Uncommon: 2,
    Rare: 4,
    Epic: 8,
    Legendary: 16,
  }[rarity] || 1;

  const baseStats = rng.randomInt(2, 5) * rarityMultiplier;
  
  const bonus_stats: any = {};
  const statCount = rng.randomInt(1, 3);
  const availableStats = ['str', 'agi', 'int', 'perception', 'luck', 'hp', 'qi'];
  
  for (let i = 0; i < statCount; i++) {
    const stat = availableStats[rng.randomInt(0, availableStats.length - 1)];
    bonus_stats[stat] = rng.randomInt(baseStats, baseStats * 2);
  }

  const basePriceSilver = 50 * rarityMultiplier;
  const basePriceStones = Math.floor(rarityMultiplier / 2);

  return {
    id: `market_equip_${id}`,
    name: `${rarity} ${slot}`,
    name_en: `${rarity} ${slot}`,
    description: `Trang bị ${rarity.toLowerCase()} cấp ${realm}`,
    description_en: `${rarity} equipment for ${realm} realm`,
    type: 'Equipment',
    rarity: rarity as any,
    quantity: 1,
    equipment_slot: slot as any,
    bonus_stats,
    price_silver: rng.randomInt(basePriceSilver, basePriceSilver * 2),
    price_spirit_stones: basePriceStones > 0 ? rng.randomInt(basePriceStones, basePriceStones * 2) : 0,
  };
}

function generateConsumable(
  id: number,
  rarity: string,
  rng: DeterministicRNG,
  realm: string
): MarketItem {
  const types = [
    { type: 'Medicine', effect: 'hp_restore', name: 'Healing Pill', name_vi: 'Hồi Huyết Đan' },
    { type: 'Medicine', effect: 'qi_restore', name: 'Qi Pill', name_vi: 'Hồi Khí Đan' },
    { type: 'Medicine', effect: 'cultivation_exp', name: 'Cultivation Pill', name_vi: 'Tu Luyện Đan' },
    { type: 'Material', effect: 'crafting', name: 'Spirit Herb', name_vi: 'Linh Thảo' },
  ];

  const selected = types[rng.randomInt(0, types.length - 1)];
  
  const rarityMultiplier = {
    Common: 1,
    Uncommon: 2,
    Rare: 4,
    Epic: 8,
    Legendary: 16,
  }[rarity] || 1;

  const effectValue = rng.randomInt(20, 50) * rarityMultiplier;
  
  const effects: any = {};
  effects[selected.effect] = effectValue;

  return {
    id: `market_consumable_${id}`,
    name: `${selected.name_vi} (${rarity})`,
    name_en: `${selected.name} (${rarity})`,
    description: `${selected.type} cấp ${rarity.toLowerCase()}`,
    description_en: `${rarity} ${selected.type.toLowerCase()}`,
    type: selected.type as any,
    rarity: rarity as any,
    quantity: rng.randomInt(1, 5),
    effects,
    price_silver: rng.randomInt(30, 80) * rarityMultiplier,
    price_spirit_stones: rarityMultiplier > 2 ? rng.randomInt(1, rarityMultiplier) : 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { action, itemId } = await request.json();

    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get character
    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const character = characters[0];
    
    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json({ error: 'No active run' }, { status: 404 });
    }
    
    const run = runs[0];
    const state = run.current_state as GameState;

    // Initialize or regenerate market if needed
    const generationQuarter = state.time_year * 4 + Math.floor(state.time_month / 3);
    
    if (!state.market || shouldRegenerateMarket(state)) {
      // Try loading from tables first
      const cachedMarket = await loadMarketFromTables(run.world_seed, generationQuarter);
      
      if (cachedMarket && cachedMarket.length > 0) {
        // Use cached market from tables
        state.market = {
          items: cachedMarket,
          last_regenerated: new Date().toISOString(),
          next_regeneration: {
            month: ((Math.floor(state.time_month / 3) + 1) * 3) % 12 || 12,
            year: state.time_month >= 9 ? state.time_year + 1 : state.time_year,
          },
        };
      } else {
        // Generate new market
        const seed = `${state.time_year}_${Math.floor(state.time_month / 3)}`;
        const rng = new DeterministicRNG(seed);
        const newItems = generateMarketItems(state, rng);
        
        state.market = {
          items: newItems,
          last_regenerated: new Date().toISOString(),
          next_regeneration: {
            month: ((Math.floor(state.time_month / 3) + 1) * 3) % 12 || 12,
            year: state.time_month >= 9 ? state.time_year + 1 : state.time_year,
          },
        };
        
        // Sync to tables for other players with same world seed
        await syncMarketToTables(run.world_seed, generationQuarter, newItems);
      }
    }

    if (action === 'buy') {
      const item = state.market.items.find(i => i.id === itemId);
      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      // Check affordability
      if (item.price_silver && state.inventory.silver < item.price_silver) {
        return NextResponse.json({ error: 'Not enough silver' }, { status: 400 });
      }
      if (item.price_spirit_stones && state.inventory.spirit_stones < item.price_spirit_stones) {
        return NextResponse.json({ error: 'Not enough spirit stones' }, { status: 400 });
      }

      // Deduct currency
      if (item.price_silver) state.inventory.silver -= item.price_silver;
      if (item.price_spirit_stones) state.inventory.spirit_stones -= item.price_spirit_stones;

      // Add to inventory
      const existingItem = state.inventory.items.find(
        inv => inv.id === item.id && inv.type === item.type
      );
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        const { price_silver, price_spirit_stones, ...itemWithoutPrice } = item;
        state.inventory.items.push(itemWithoutPrice);
      }

      // Remove from market
      state.market.items = state.market.items.filter(i => i.id !== itemId);
      
      // Record transaction in history
      await recordMarketTransaction(
        run.id,
        'buy',
        item.id,
        item.name,
        item.quantity,
        item.price_silver || 0,
        item.price_spirit_stones || 0,
        { year: state.time_year, month: state.time_month, day: state.time_day }
      );

    } else if (action === 'sell') {
      const itemIndex = state.inventory.items.findIndex(i => i.id === itemId);
      if (itemIndex === -1) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      const item = state.inventory.items[itemIndex];
      
      // Calculate sell price (50% of estimated value)
      const rarityValue = {
        Common: 1,
        Uncommon: 2,
        Rare: 4,
        Epic: 8,
        Legendary: 16,
      }[item.rarity] || 1;

      const sellPrice = Math.floor(25 * rarityValue * item.quantity);
      state.inventory.silver += sellPrice;

      // Remove item from inventory
      if (item.quantity > 1) {
        state.inventory.items[itemIndex].quantity -= 1;
      } else {
        state.inventory.items.splice(itemIndex, 1);
      }
      
      // Record transaction in history
      await recordMarketTransaction(
        run.id,
        'sell',
        item.id,
        item.name,
        1,
        sellPrice,
        0,
        { year: state.time_year, month: state.time_month, day: state.time_day }
      );
    }

    await runQueries.update(run.id, state);
    
    // Sync inventory to tables
    await syncInventoryToTables(run.id, state.inventory, state.equipped_items);

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error('Market error:', error);
    return NextResponse.json({ error: 'Market operation failed' }, { status: 500 });
  }
}

function shouldRegenerateMarket(state: GameState): boolean {
  if (!state.market) return true;
  
  const { next_regeneration } = state.market;
  return (
    state.time_year > next_regeneration.year ||
    (state.time_year === next_regeneration.year && state.time_month >= next_regeneration.month)
  );
}
