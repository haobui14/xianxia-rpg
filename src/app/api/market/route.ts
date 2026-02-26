import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { GameState, MarketItem, MarketState } from "@/types/game";
import { DeterministicRNG } from "@/lib/game/rng";
import {
  syncMarketToTables,
  loadMarketFromTables,
  recordMarketTransaction,
  syncInventoryToTables,
} from "@/lib/database/syncHelper";

// Generate market items using AI-like logic
function generateMarketItems(state: GameState, rng: DeterministicRNG): MarketItem[] {
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

  // Always include a guaranteed selection of enhancement stones so crafting is always possible
  const enhancementStonePool: MarketItem[] = [
    {
      id: "enhancement_stone_common",
      name: "Đá Cường Hóa (Thường)",
      name_en: "Enhancement Stone (Common)",
      description: "Đá cường hóa cơ bản, dùng để nâng cấp trang bị +1 đến +3.",
      description_en: "Basic enhancement stone, used to upgrade equipment from +1 to +3.",
      type: "Material",
      rarity: "Common",
      quantity: rng.randomInt(3, 8),
      price_silver: 150,
    },
    {
      id: "enhancement_stone_uncommon",
      name: "Đá Cường Hóa (Tốt)",
      name_en: "Enhancement Stone (Uncommon)",
      description: "Đá cường hóa chất lượng tốt, dùng để nâng cấp trang bị +4 đến +6.",
      description_en: "Good quality enhancement stone, used to upgrade equipment from +4 to +6.",
      type: "Material",
      rarity: "Uncommon",
      quantity: rng.randomInt(2, 5),
      price_silver: 400,
    },
    {
      id: "enhancement_stone_rare",
      name: "Đá Cường Hóa (Hiếm)",
      name_en: "Enhancement Stone (Rare)",
      description: "Đá cường hóa hiếm, dùng để nâng cấp trang bị +7 đến +9.",
      description_en: "Rare enhancement stone, used to upgrade equipment from +7 to +9.",
      type: "Material",
      rarity: "Rare",
      quantity: rng.randomInt(1, 3),
      price_silver: 1200,
      price_spirit_stones: 5,
    },
    {
      id: "enhancement_stone_epic",
      name: "Đá Cường Hóa (Sử Thi)",
      name_en: "Enhancement Stone (Epic)",
      description: "Đá cường hóa cực phẩm, dùng để nâng cấp trang bị lên +10.",
      description_en: "Epic enhancement stone, used to upgrade equipment to +10.",
      type: "Material",
      rarity: "Epic",
      quantity: rng.randomInt(1, 2),
      price_silver: 5000,
      price_spirit_stones: 20,
    },
  ];

  items.push(...enhancementStonePool);

  return items;
}

function selectRarity(weights: Record<string, number>, rng: DeterministicRNG): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng.random() * total;

  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return "Common";
}

function generateEquipment(
  id: number,
  rarity: string,
  rng: DeterministicRNG,
  realm: string
): MarketItem {
  const slots = ["Weapon", "Head", "Chest", "Legs", "Feet", "Hands", "Accessory", "Artifact"];
  const slot = slots[rng.randomInt(0, slots.length - 1)];

  const rarityMultiplier =
    {
      Common: 1,
      Uncommon: 2,
      Rare: 4,
      Epic: 8,
      Legendary: 16,
    }[rarity] || 1;

  const baseStats = rng.randomInt(2, 5) * rarityMultiplier;

  const bonus_stats: any = {};
  const statCount = rng.randomInt(1, 3);
  const availableStats = ["str", "agi", "int", "perception", "luck", "hp", "qi"];

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
    type: "Equipment",
    rarity: rarity as any,
    quantity: 1,
    equipment_slot: slot as any,
    bonus_stats,
    price_silver: rng.randomInt(basePriceSilver, basePriceSilver * 2),
    price_spirit_stones:
      basePriceStones > 0 ? rng.randomInt(basePriceStones, basePriceStones * 2) : 0,
  };
}

function generateConsumable(
  id: number,
  rarity: string,
  rng: DeterministicRNG,
  realm: string
): MarketItem {
  const types = [
    {
      type: "Medicine",
      effect: "hp_restore",
      name: "Healing Pill",
      name_vi: "Hồi Huyết Đan",
    },
    {
      type: "Medicine",
      effect: "qi_restore",
      name: "Qi Pill",
      name_vi: "Hồi Khí Đan",
    },
    {
      type: "Medicine",
      effect: "cultivation_exp",
      name: "Cultivation Pill",
      name_vi: "Tu Luyện Đan",
    },
    {
      type: "Material",
      effect: "crafting",
      name: "Spirit Herb",
      name_vi: "Linh Thảo",
    },
  ];

  const selected = types[rng.randomInt(0, types.length - 1)];

  const rarityMultiplier =
    {
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

// Helper function to initialize or regenerate market
async function initializeMarket(
  state: GameState,
  worldSeed: string,
  runId: string
): Promise<GameState> {
  const generationMonth = state.time_year * 12 + state.time_month;

  if (!state.market || shouldRegenerateMarket(state)) {
    // Try loading from tables first
    const cachedMarket = await loadMarketFromTables(worldSeed, generationMonth);

    if (cachedMarket && cachedMarket.length > 0) {
      state.market = {
        items: cachedMarket,
        last_regenerated: new Date().toISOString(),
        next_regeneration: {
          month: (state.time_month % 12) + 1,
          year: state.time_month === 12 ? state.time_year + 1 : state.time_year,
        },
      };
    } else {
      // Generate new market
      const seed = `${worldSeed}_${state.time_year}_${state.time_month}`;
      const rng = new DeterministicRNG(seed);
      const newItems = generateMarketItems(state, rng);

      state.market = {
        items: newItems,
        last_regenerated: new Date().toISOString(),
        next_regeneration: {
          month: (state.time_month % 12) + 1,
          year: state.time_month === 12 ? state.time_year + 1 : state.time_year,
        },
      };

      // Sync to tables for other players with same world seed
      await syncMarketToTables(worldSeed, generationMonth, newItems);
    }

    // Save state with new market
    await runQueries.update(runId, state);
  }

  return state;
}

// GET endpoint to initialize market (called when opening market tab)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // First check if we have a session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("Session error in market GET:", sessionError);
      return NextResponse.json(
        {
          error: "Not authenticated - please sign in again",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User error in market GET:", userError);
      return NextResponse.json(
        {
          error: "Not authenticated - please sign in again",
        },
        { status: 401 }
      );
    }

    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const character = characters[0];
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json({ error: "No active run" }, { status: 404 });
    }

    const run = runs[0];
    let state = run.current_state as GameState;

    // Initialize market if needed
    state = await initializeMarket(state, run.world_seed, run.id);

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error("Market init error:", error);
    return NextResponse.json({ error: "Failed to initialize market" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, itemId, amount } = await request.json();

    // Get authenticated user
    const supabase = await createServerClient();

    // First check if we have a session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("Session error in market POST:", sessionError);
      return NextResponse.json(
        {
          error: "Not authenticated - please sign in again",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User error in market POST:", userError);
      return NextResponse.json(
        {
          error: "Not authenticated - please sign in again",
        },
        { status: 401 }
      );
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
      return NextResponse.json({ error: "No active run" }, { status: 404 });
    }

    const run = runs[0];
    let state = run.current_state as GameState;

    // Initialize or regenerate market if needed
    state = await initializeMarket(state, run.world_seed, run.id);

    if (action === "refresh") {
      // Cost: 20 spirit stones to refresh market
      const REFRESH_COST = 20;

      if (state.inventory.spirit_stones < REFRESH_COST) {
        return NextResponse.json({ error: "Not enough spirit stones (need 20)" }, { status: 400 });
      }

      // Deduct spirit stones
      state.inventory.spirit_stones -= REFRESH_COST;

      // Generate new market with different seed
      const refreshSeed = `${state.time_year}_${state.time_month}_refresh_${Date.now()}`;
      const rng = new DeterministicRNG(refreshSeed);
      const newItems = generateMarketItems(state, rng);

      state.market = {
        items: newItems,
        last_regenerated: new Date().toISOString(),
        next_regeneration: state.market?.next_regeneration || {
          month: (state.time_month % 12) + 1,
          year: state.time_month === 12 ? state.time_year + 1 : state.time_year,
        },
      };
    } else if (action === "exchange") {
      // Exchange spirit stones to silver: 1 spirit stone = 100 silver
      const EXCHANGE_RATE = 100;
      const stonesToExchange = amount || 1;

      if (!stonesToExchange || stonesToExchange < 1) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      if (state.inventory.spirit_stones < stonesToExchange) {
        return NextResponse.json({ error: "Not enough spirit stones" }, { status: 400 });
      }

      // Exchange
      state.inventory.spirit_stones -= stonesToExchange;
      state.inventory.silver += stonesToExchange * EXCHANGE_RATE;
    } else if (action === "buy") {
      const item = state.market?.items.find((i) => i.id === itemId);
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      // Check affordability
      if (item.price_silver && state.inventory.silver < item.price_silver) {
        return NextResponse.json({ error: "Not enough silver" }, { status: 400 });
      }
      if (item.price_spirit_stones && state.inventory.spirit_stones < item.price_spirit_stones) {
        return NextResponse.json({ error: "Not enough spirit stones" }, { status: 400 });
      }

      // Deduct currency
      if (item.price_silver) state.inventory.silver -= item.price_silver;
      if (item.price_spirit_stones) state.inventory.spirit_stones -= item.price_spirit_stones;

      // Add to inventory
      const existingItem = state.inventory.items.find(
        (inv) => inv.id === item.id && inv.type === item.type
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        const { price_silver, price_spirit_stones, ...itemWithoutPrice } = item;
        state.inventory.items.push(itemWithoutPrice);
      }

      // Remove from market
      if (state.market) {
        state.market.items = state.market.items.filter((i) => i.id !== itemId);
      }

      // Record transaction in history
      await recordMarketTransaction(
        run.id,
        "buy",
        item.id,
        item.name,
        item.quantity,
        item.price_silver || 0,
        item.price_spirit_stones || 0,
        { year: state.time_year, month: state.time_month, day: state.time_day }
      );
    } else if (action === "sell") {
      const itemIndex = state.inventory.items.findIndex((i) => i.id === itemId);
      if (itemIndex === -1) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      const item = state.inventory.items[itemIndex];

      // Calculate sell price (50% of estimated value)
      const rarityValue =
        {
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
      await recordMarketTransaction(run.id, "sell", item.id, item.name, 1, sellPrice, 0, {
        year: state.time_year,
        month: state.time_month,
        day: state.time_day,
      });
    }

    await runQueries.update(run.id, state);

    // Sync inventory to tables
    await syncInventoryToTables(run.id, state.inventory, state.equipped_items);

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error("Market error:", error);
    return NextResponse.json({ error: "Market operation failed" }, { status: 500 });
  }
}

function shouldRegenerateMarket(state: GameState): boolean {
  if (!state.market || !state.market.items || state.market.items.length === 0) return true;

  const { next_regeneration } = state.market;
  return (
    state.time_year > next_regeneration.year ||
    (state.time_year === next_regeneration.year && state.time_month >= next_regeneration.month)
  );
}
