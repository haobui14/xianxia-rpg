import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { GameState } from "@/types/game";
import { initDualCultivation, setExpSplit } from "@/lib/game/dual-cultivation";

export async function POST(request: NextRequest) {
  try {
    const { action, split } = await request.json();

    if (!action || !["toggle", "set_split"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "toggle" or "set_split"' },
        { status: 400 }
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

    let updatedProgress = { ...state.progress };

    if (action === "toggle") {
      // Toggle dual cultivation mode
      if (state.progress.cultivation_path === "dual") {
        // Disable dual mode - PRESERVE all body progress (body_realm, body_stage, body_exp)
        // Only change the cultivation path and exp split, keep body stats intact
        updatedProgress = {
          ...updatedProgress,
          cultivation_path: "qi",
          exp_split: 100,
          // Explicitly preserve body cultivation progress
          body_realm: updatedProgress.body_realm,
          body_stage: updatedProgress.body_stage,
          body_exp: updatedProgress.body_exp,
        };
        console.log(
          `[Dual Cultivation] Disabled - preserved body progress: ${updatedProgress.body_realm} stage ${updatedProgress.body_stage}, exp: ${updatedProgress.body_exp}`
        );
      } else {
        // Enable dual mode - preserve any existing body progress
        const preservedBodyProgress = {
          body_realm: updatedProgress.body_realm,
          body_stage: updatedProgress.body_stage,
          body_exp: updatedProgress.body_exp,
        };
        updatedProgress = initDualCultivation(updatedProgress);
        // Restore preserved progress if it was more advanced
        if (
          preservedBodyProgress.body_exp &&
          preservedBodyProgress.body_exp > (updatedProgress.body_exp || 0)
        ) {
          updatedProgress.body_exp = preservedBodyProgress.body_exp;
        }
        if (
          preservedBodyProgress.body_stage &&
          preservedBodyProgress.body_stage > (updatedProgress.body_stage || 0)
        ) {
          updatedProgress.body_stage = preservedBodyProgress.body_stage;
        }
        if (preservedBodyProgress.body_realm && preservedBodyProgress.body_realm !== "PhàmThể") {
          updatedProgress.body_realm = preservedBodyProgress.body_realm;
        }
        console.log(
          `[Dual Cultivation] Enabled - body progress: ${updatedProgress.body_realm} stage ${updatedProgress.body_stage}, exp: ${updatedProgress.body_exp}`
        );
      }
    } else if (action === "set_split") {
      // Set exp split ratio
      if (typeof split !== "number" || split < 0 || split > 100) {
        return NextResponse.json(
          { error: "Split must be a number between 0 and 100" },
          { status: 400 }
        );
      }

      // Only allow setting split in dual mode
      if (state.progress.cultivation_path !== "dual") {
        return NextResponse.json(
          { error: "Must be in dual cultivation mode to set exp split" },
          { status: 400 }
        );
      }

      updatedProgress = setExpSplit(updatedProgress, split);
    }

    // Update state
    const updatedState: GameState = {
      ...state,
      progress: updatedProgress,
    };

    // Save to database
    await runQueries.update(run.id, updatedState);

    return NextResponse.json({
      success: true,
      state: updatedState,
      message:
        action === "toggle"
          ? updatedProgress.cultivation_path === "dual"
            ? "Dual cultivation enabled"
            : "Dual cultivation disabled"
          : `Exp split set to ${split}% Qi / ${100 - split}% Body`,
    });
  } catch (error) {
    console.error("Dual cultivation error:", error);
    return NextResponse.json(
      { error: "Failed to update dual cultivation settings" },
      { status: 500 }
    );
  }
}
