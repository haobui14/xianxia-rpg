import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { GameState, InventoryItem } from "@/types/game";
import { syncInventoryToTables } from "@/lib/database/syncHelper";

export async function POST(request: NextRequest) {
  try {
    const { itemId, action } = await request.json();

    if (!itemId || !action) {
      return NextResponse.json(
        { error: "Missing itemId or action" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 },
      );
    }

    const character = characters[0];

    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json(
        { error: "No active run found" },
        { status: 404 },
      );
    }

    const run = runs[0];

    const state = run.current_state as GameState;

    if (action === "equip") {
      // Find the item in inventory - for equipment/accessories
      const itemIndex = state.inventory.items.findIndex(
        (item, idx) =>
          item.id === itemId &&
          (item.type === "Equipment" || item.type === "Accessory"),
      );

      console.log("Equip attempt:", {
        itemId,
        itemIndex,
        totalItems: state.inventory.items.length,
      });
      console.log(
        "Matching items:",
        state.inventory.items.filter((i) => i.id === itemId),
      );

      if (itemIndex === -1) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      const item = state.inventory.items[itemIndex];

      // Auto-assign equipment_slot for accessories if missing
      if (item.type === "Accessory" && !item.equipment_slot) {
        item.equipment_slot = "Accessory";
        console.log("Auto-assigned Accessory slot");
      }

      console.log("Item to equip:", {
        id: item.id,
        type: item.type,
        slot: item.equipment_slot,
      });

      if (
        (item.type !== "Equipment" && item.type !== "Accessory") ||
        !item.equipment_slot
      ) {
        return NextResponse.json(
          {
            error: `Item cannot be equipped - type: ${item.type}, slot: ${item.equipment_slot}`,
          },
          { status: 400 },
        );
      }

      // Unequip existing item in that slot if any
      const currentEquipped = state.equipped_items[item.equipment_slot];
      if (currentEquipped) {
        // Add the unequipped item back to inventory with quantity 1
        const existingInInventory = state.inventory.items.find(
          (inv) =>
            inv.id === currentEquipped.id && inv.type === currentEquipped.type,
        );
        if (existingInInventory) {
          existingInInventory.quantity += 1;
        } else {
          state.inventory.items.push({
            ...currentEquipped,
            is_equipped: false,
            quantity: 1,
          });
        }
      }

      // Equip the new item (always quantity 1 when equipped)
      state.equipped_items[item.equipment_slot] = {
        ...item,
        is_equipped: true,
        quantity: 1,
      };

      // Check if this is a storage ring and update inventory capacity
      if (item.effects?.storage_capacity) {
        state.inventory.storage_ring = {
          id: item.id,
          name: item.name,
          name_en: item.name_en,
          capacity: item.effects.storage_capacity,
          rarity: item.rarity,
        };
      }

      // Remove ONE item from inventory
      if (item.quantity > 1) {
        state.inventory.items[itemIndex].quantity -= 1;
      } else {
        state.inventory.items.splice(itemIndex, 1);
      }
    } else if (action === "unequip") {
      // Find equipped item
      const slot = Object.keys(state.equipped_items).find((s) => {
        const equipped =
          state.equipped_items[s as keyof typeof state.equipped_items];
        return equipped && equipped.id === itemId;
      });

      if (!slot) {
        return NextResponse.json(
          { error: "Item not equipped" },
          { status: 404 },
        );
      }

      const equippedItem =
        state.equipped_items[slot as keyof typeof state.equipped_items];
      if (equippedItem) {
        // Check if this is a storage ring being unequipped
        if (
          equippedItem.effects?.storage_capacity &&
          state.inventory.storage_ring?.id === equippedItem.id
        ) {
          delete state.inventory.storage_ring;
        }

        // Add back to inventory
        const existingItem = state.inventory.items.find(
          (item) =>
            item.id === equippedItem.id && item.type === equippedItem.type,
        );

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          state.inventory.items.push({
            ...equippedItem,
            is_equipped: false,
            quantity: 1,
          });
        }

        // Remove from equipped
        delete state.equipped_items[slot as keyof typeof state.equipped_items];
      }
    }

    // Update the run with new state
    await runQueries.update(run.id, state);

    // Sync to normalized tables for better querying
    await syncInventoryToTables(run.id, state.inventory, state.equipped_items);

    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error("Equip/unequip error:", error);
    return NextResponse.json(
      { error: "Failed to process item" },
      { status: 500 },
    );
  }
}
