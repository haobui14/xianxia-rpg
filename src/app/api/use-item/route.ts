import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { GameState } from "@/types/game";
import { syncInventoryToTables } from "@/lib/database/syncHelper";

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
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

    // Only consumables (Medicine, Book type or items with effects) can be used
    if (item.type !== "Medicine" && item.type !== "Book" && !item.effects) {
      return NextResponse.json({ error: "This item cannot be used" }, { status: 400 });
    }

    // Track what was applied for response message
    const appliedEffects: string[] = [];

    // Handle Book type - teach techniques or skills
    if (item.type === "Book") {
      // Check if book teaches a technique
      if (item.teaches_technique) {
        const technique = item.teaches_technique;

        // Check if already learned
        const alreadyLearned = state.techniques.some((t) => t.id === technique.id);
        if (alreadyLearned) {
          return NextResponse.json({ error: "You already know this technique" }, { status: 400 });
        }

        // Add technique to state
        state.techniques.push(technique);
        appliedEffects.push(`Learned technique: ${technique.name}`);
      }

      // Check if book teaches a skill
      if (item.teaches_skill) {
        const skill = item.teaches_skill;

        // Check if already learned
        const alreadyLearned = state.skills.some((s) => s.id === skill.id);
        if (alreadyLearned) {
          return NextResponse.json({ error: "You already know this skill" }, { status: 400 });
        }

        // Add skill to state
        state.skills.push(skill);
        appliedEffects.push(`Learned skill: ${skill.name}`);
      }

      // If book doesn't teach anything, it's just a regular consumable with effects
      if (!item.teaches_technique && !item.teaches_skill && !item.effects) {
        return NextResponse.json(
          { error: "This book has no teachings or effects" },
          { status: 400 }
        );
      }
    }

    // Apply effects
    if (item.effects) {
      // HP restoration
      if (item.effects.hp_restore) {
        const hpBefore = state.stats.hp;
        state.stats.hp = Math.min(
          state.stats.hp_max,
          state.stats.hp + (item.effects.hp_restore as number)
        );
        const restored = state.stats.hp - hpBefore;
        if (restored > 0) appliedEffects.push(`HP +${restored}`);
      }

      // Qi restoration
      if (item.effects.qi_restore) {
        const qiBefore = state.stats.qi;
        state.stats.qi = Math.min(
          state.stats.qi_max,
          state.stats.qi + (item.effects.qi_restore as number)
        );
        const restored = state.stats.qi - qiBefore;
        if (restored > 0) appliedEffects.push(`Qi +${restored}`);
      }

      // Stamina restoration
      if (item.effects.stamina_restore) {
        const staminaBefore = state.stats.stamina;
        state.stats.stamina = Math.min(
          state.stats.stamina_max,
          state.stats.stamina + (item.effects.stamina_restore as number)
        );
        const restored = state.stats.stamina - staminaBefore;
        if (restored > 0) appliedEffects.push(`Stamina +${restored}`);
      }

      // Cultivation exp boost
      if (item.effects.cultivation_exp) {
        state.progress.cultivation_exp += item.effects.cultivation_exp as number;
        appliedEffects.push(`Exp +${item.effects.cultivation_exp}`);
      }

      // Permanent stat increases
      if (item.effects.permanent_hp) {
        state.stats.hp_max += item.effects.permanent_hp as number;
        state.stats.hp += item.effects.permanent_hp as number;
        appliedEffects.push(`HP Max +${item.effects.permanent_hp}`);
      }

      if (item.effects.permanent_qi) {
        state.stats.qi_max += item.effects.permanent_qi as number;
        state.stats.qi += item.effects.permanent_qi as number;
        appliedEffects.push(`Qi Max +${item.effects.permanent_qi}`);
      }

      if (item.effects.permanent_str) {
        state.attrs.str += item.effects.permanent_str as number;
        appliedEffects.push(`STR +${item.effects.permanent_str}`);
      }
      if (item.effects.permanent_agi) {
        state.attrs.agi += item.effects.permanent_agi as number;
        appliedEffects.push(`AGI +${item.effects.permanent_agi}`);
      }
      if (item.effects.permanent_int) {
        state.attrs.int += item.effects.permanent_int as number;
        appliedEffects.push(`INT +${item.effects.permanent_int}`);
      }
      if (item.effects.permanent_perception) {
        state.attrs.perception += item.effects.permanent_perception as number;
        appliedEffects.push(`PER +${item.effects.permanent_perception}`);
      }
      if (item.effects.permanent_luck) {
        state.attrs.luck += item.effects.permanent_luck as number;
        appliedEffects.push(`LUCK +${item.effects.permanent_luck}`);
      }
    }

    // Decrease quantity or remove item
    if (item.quantity > 1) {
      state.inventory.items[itemIndex].quantity -= 1;
    } else {
      state.inventory.items.splice(itemIndex, 1);
    }

    // Update the run with new state
    await runQueries.update(run.id, state);

    // Sync to normalized tables
    await syncInventoryToTables(run.id, state.inventory, state.equipped_items);

    return NextResponse.json({
      success: true,
      state,
      message: appliedEffects.length > 0 ? appliedEffects.join(", ") : "Item used",
    });
  } catch (error) {
    console.error("Use item error:", error);
    return NextResponse.json({ error: "Failed to use item" }, { status: 500 });
  }
}
