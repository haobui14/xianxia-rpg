import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database/client";
import { characterQueries, runQueries } from "@/lib/database/queries";
import { ActiveSectMission, GameState, Run } from "@/types/game";
import {
  getMissionTemplate,
  instantiateMission,
  mostHostileRival,
  rollOpenMissions,
} from "@/lib/game/sect-missions";

const MAX_ACTIVE = 3;
const REROLL_COOLDOWN_TURNS = 3;
const MAX_OPTIMISTIC_RETRIES = 3;

type RequestBody =
  | { action: "list"; reroll?: boolean }
  | { action: "accept"; template_id: string }
  | { action: "abandon"; instance_id: string };

/**
 * Run a mutation against the latest persisted run state with optimistic
 * locking. If another writer (e.g. the turn route) updates between our read
 * and write, we re-fetch and re-apply the mutator so the player-facing
 * change isn't lost. The mutator is idempotent by contract — it must cope
 * with re-application on a fresher state.
 *
 * `mutator` returns either a body to respond with on success, or an Error
 * to bail out with. Mutations that don't need to persist (e.g. list with
 * no reroll) can return { skipSave: true, body }.
 */
async function withOptimisticLock<T>(
  characterId: string,
  mutator: (run: Run, state: GameState) => { body: T; skipSave?: true } | { error: string; status: number }
): Promise<{ status: number; body: T | { error: string } }> {
  for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
    const runs = await runQueries.getByCharacterId(characterId);
    if (runs.length === 0) {
      return { status: 404, body: { error: "No active run found" } };
    }
    const run = runs[0];
    const state = run.current_state as GameState;

    const result = mutator(run, state);
    if ("error" in result) {
      return { status: result.status, body: { error: result.error } };
    }
    if (result.skipSave) {
      return { status: 200, body: result.body };
    }

    const saveResult = await runQueries.updateIfUnchanged(run.id, state, run.updated_at);
    if (saveResult.success) {
      return { status: 200, body: result.body };
    }
    if (!saveResult.conflict) {
      return {
        status: 500,
        body: { error: saveResult.error || "Failed to save" },
      };
    }
    // Conflict: loop to re-fetch and re-apply.
  }
  return {
    status: 409,
    body: { error: "Save conflict — please retry" },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    const character = characters[0];

    // ——— list ———
    if (body.action === "list") {
      const { status, body: resBody } = await withOptimisticLock(character.id, (run, state) => {
        if (!state.sect_membership) return { error: "Not in a sect", status: 400 };
        const sectType = state.sect_membership.sect.type;

        const hasCache = !!state.mission_list_cache && state.mission_list_cache.length > 0;
        const turnsSinceLastRoll =
          state.last_mission_list_turn !== undefined
            ? state.turn_count - state.last_mission_list_turn
            : Infinity;
        const canReroll = turnsSinceLastRoll >= REROLL_COOLDOWN_TURNS;

        let templates = state.mission_list_cache ?? [];
        let changed = false;
        if (!hasCache || (body.reroll && canReroll)) {
          templates = rollOpenMissions(sectType, 3);
          state.mission_list_cache = templates;
          state.last_mission_list_turn = state.turn_count;
          changed = true;
        }

        const responseBody = {
          available: templates,
          active: state.sect_missions ?? [],
          reroll_available_in: Math.max(0, REROLL_COOLDOWN_TURNS - turnsSinceLastRoll),
        };
        return changed
          ? { body: responseBody }
          : { body: responseBody, skipSave: true };
      });
      return NextResponse.json(resBody, { status });
    }

    // ——— accept ———
    if (body.action === "accept") {
      const { status, body: resBody } = await withOptimisticLock(character.id, (run, state) => {
        if (!state.sect_membership) return { error: "Not in a sect", status: 400 };
        const sectType = state.sect_membership.sect.type;

        const template = getMissionTemplate(body.template_id);
        if (!template) return { error: "Mission template not found", status: 404 };
        if (!template.sect_types.includes(sectType)) {
          return { error: "Mission not offered to your sect", status: 400 };
        }
        state.sect_missions ||= [];
        if (state.sect_missions.length >= MAX_ACTIVE) {
          return {
            error: `Max ${MAX_ACTIVE} active missions — complete or abandon one first`,
            status: 400,
          };
        }
        if (state.sect_missions.some((m) => m.template_id === template.id)) {
          return { error: "Mission already active", status: 400 };
        }

        // For AI-invented sects, the named-sect rival list is empty; fall
        // back to the most-hostile entry from sect_relations so rival-hunt
        // missions still get a target.
        const hostile = mostHostileRival(state);
        const mission: ActiveSectMission = instantiateMission(
          template,
          state.turn_count,
          state.sect_membership.sect.id,
          hostile?.sect_id
        );
        state.sect_missions.push(mission);
        state.flags ||= {};
        state.flags[`sect_mission_${mission.instance_id}`] = true;

        if (state.mission_list_cache) {
          state.mission_list_cache = state.mission_list_cache.filter(
            (t) => t.id !== template.id
          );
        }

        return { body: { success: true, mission } };
      });
      return NextResponse.json(resBody, { status });
    }

    // ——— abandon ———
    if (body.action === "abandon") {
      const { status, body: resBody } = await withOptimisticLock(character.id, (run, state) => {
        if (!state.sect_membership) return { error: "Not in a sect", status: 400 };
        if (!state.sect_missions || state.sect_missions.length === 0) {
          return { error: "No active missions", status: 400 };
        }
        const before = state.sect_missions.length;
        state.sect_missions = state.sect_missions.filter(
          (m) => m.instance_id !== body.instance_id
        );
        if (state.sect_missions.length === before) {
          return { error: "Mission not found", status: 404 };
        }
        if (state.flags) delete state.flags[`sect_mission_${body.instance_id}`];
        state.sect_membership.reputation = Math.max(
          0,
          state.sect_membership.reputation - 3
        );
        return { body: { success: true } };
      });
      return NextResponse.json(resBody, { status });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("sect-mission route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
