import { NextResponse } from "next/server";
import { runQueries } from "@/lib/database/queries";
import { GameState } from "@/types/game";
import {
  getTechniqueLevelUpCost,
  getSkillLevelUpCost,
  TECHNIQUE_MAX_LEVEL,
} from "@/lib/game/mechanics";
import { syncSkillsToTables, syncTechniquesToTables } from "@/lib/database/syncHelper";

/**
 * Level up a technique (costs spirit stones, scaled by grade × level) or a
 * skill (costs silver, scaled by level). Costs come from the shared helpers
 * in mechanics.ts so the UI always displays the exact server price.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, abilityType, abilityId } = body;

    if (!runId || !abilityType || !abilityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const run = await runQueries.getById(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const state: GameState = run.current_state as GameState;
    let message = "";

    if (abilityType === "technique") {
      // Active list first, then queue — both are levelable
      const technique =
        state.techniques?.find((t) => t.id === abilityId) ||
        state.technique_queue?.find((t) => t.id === abilityId);
      if (!technique) {
        return NextResponse.json({ error: "Technique not found" }, { status: 404 });
      }

      const cost = getTechniqueLevelUpCost(technique);
      if (!cost) {
        return NextResponse.json({ error: "Technique is already at max level" }, { status: 400 });
      }
      if (state.inventory.spirit_stones < cost.spirit_stones) {
        return NextResponse.json(
          { error: `Not enough spirit stones (need ${cost.spirit_stones})` },
          { status: 400 }
        );
      }

      state.inventory.spirit_stones -= cost.spirit_stones;
      technique.level = Math.max(1, technique.level || 1) + 1;
      if (!technique.max_level) technique.max_level = TECHNIQUE_MAX_LEVEL;
      message = `${technique.name} → Lv ${technique.level}`;
    } else if (abilityType === "skill") {
      const skill =
        state.skills?.find((s) => s.id === abilityId) ||
        state.skill_queue?.find((s) => s.id === abilityId);
      if (!skill) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }

      const cost = getSkillLevelUpCost(skill);
      if (!cost) {
        return NextResponse.json({ error: "Skill is already at max level" }, { status: 400 });
      }
      if (state.inventory.silver < cost.silver) {
        return NextResponse.json(
          { error: `Not enough silver (need ${cost.silver})` },
          { status: 400 }
        );
      }

      state.inventory.silver -= cost.silver;
      skill.level += 1;
      // Same growth as the exp-based level-up path in the turn route
      skill.damage_multiplier = (skill.damage_multiplier || 1.5) * 1.05;
      skill.max_exp = skill.level * 100;
      message = `${skill.name} → Lv ${skill.level}`;
    } else {
      return NextResponse.json({ error: "Invalid ability type" }, { status: 400 });
    }

    await runQueries.update(runId, state);

    // Keep normalized tables in step (non-blocking)
    syncSkillsToTables(runId, state.skills).catch(() => {});
    syncTechniquesToTables(runId, state.techniques).catch(() => {});

    return NextResponse.json({ state, message });
  } catch (error) {
    console.error("Error leveling ability:", error);
    return NextResponse.json({ error: "Failed to level ability" }, { status: 500 });
  }
}
