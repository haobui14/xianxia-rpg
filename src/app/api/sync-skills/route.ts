import { NextResponse } from "next/server";
import { runQueries } from "@/lib/database/queries";
import { syncSkillsToTables } from "@/lib/database/syncHelper";
import { GameState, Skill } from "@/types/game";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, skills } = body;

    if (!runId) {
      return NextResponse.json({ error: "Run ID required" }, { status: 400 });
    }

    if (!skills || !Array.isArray(skills)) {
      return NextResponse.json({ error: "Skills array required" }, { status: 400 });
    }

    // Load the current run
    const run = await runQueries.getById(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const state: GameState = run.current_state as GameState;

    // Update the skills in the state
    state.skills = skills as Skill[];

    // Sync skills to database tables
    await syncSkillsToTables(runId, skills as Skill[]);

    // Update the run's current_state
    await runQueries.update(runId, state);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error syncing skills:", error);
    return NextResponse.json(
      { error: "Failed to sync skills" },
      { status: 500 }
    );
  }
}
