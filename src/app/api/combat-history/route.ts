import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { combatQueries } from "@/lib/database/extendedQueries";

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "No active run" }, { status: 404 });
    }

    const run = runs[0];

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get combat history from normalized table
    const history = await combatQueries.getCombatHistory(run.id, limit);

    // Calculate statistics
    const totalCombats = history.length;
    const victories = history.filter((h: any) => h.victory).length;
    const defeats = totalCombats - victories;
    const winRate = totalCombats > 0 ? ((victories / totalCombats) * 100).toFixed(1) : 0;

    const totalDamageDealt = history.reduce(
      (sum: number, h: any) => sum + (h.player_damage_dealt || 0),
      0
    );
    const totalDamageTaken = history.reduce(
      (sum: number, h: any) => sum + (h.player_damage_taken || 0),
      0
    );

    return NextResponse.json({
      history,
      statistics: {
        totalCombats,
        victories,
        defeats,
        winRate: `${winRate}%`,
        totalDamageDealt,
        totalDamageTaken,
      },
    });
  } catch (error) {
    console.error("Combat history error:", error);
    return NextResponse.json({ error: "Failed to load combat history" }, { status: 500 });
  }
}
