import { createServerClient } from "./client";
import { Character, Run, TurnLog, GameState } from "@/types/game";

export const characterQueries = {
  async create(userId: string, name: string, age: number): Promise<Character> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("characters")
      .insert({ user_id: userId, name, age })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Character | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("characters").select("*").eq("id", id).single();

    if (error) return null;
    return data;
  },

  async getByUserId(userId: string): Promise<Character[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteById(id: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase.from("characters").delete().eq("id", id);

    if (error) throw error;
  },

  async deleteAllByUserId(userId: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase.from("characters").delete().eq("user_id", userId);

    if (error) throw error;
  },
};

export const runQueries = {
  async create(
    characterId: string,
    worldSeed: string,
    locale: "vi" | "en",
    initialState: GameState
  ): Promise<Run> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("runs")
      .insert({
        character_id: characterId,
        world_seed: worldSeed,
        locale,
        current_state: initialState,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Run | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("runs").select("*").eq("id", id).single();

    if (error) return null;
    return data;
  },

  async update(
    id: string,
    state: GameState,
    retries: number = 3
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();

    // Verify state contains skills/techniques before saving
    console.log(
      `[DB] Updating run ${id} - Skills: ${state.skills?.length || 0}, Techniques: ${state.techniques?.length || 0}, Turn: ${state.turn_count}`
    );

    // Validate critical state fields before saving
    if (!state.stats || !state.progress || !state.inventory) {
      console.error("[DB] Critical state fields missing, aborting save");
      return { success: false, error: "Invalid state: missing critical fields" };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { error } = await supabase
          .from("runs")
          .update({
            current_state: state,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          lastError = error;
          console.error(`[DB] Save attempt ${attempt + 1} failed:`, error.message);

          // Wait before retry with exponential backoff
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
          }
          continue;
        }

        console.log(`[DB] Successfully saved run ${id} on attempt ${attempt + 1}`);
        return { success: true };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[DB] Save attempt ${attempt + 1} error:`, lastError.message);

        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }

    console.error(`[DB] All ${retries} save attempts failed for run ${id}`);
    return { success: false, error: lastError?.message || "Save failed after all retries" };
  },

  async getByCharacterId(characterId: string): Promise<Run[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("character_id", characterId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },
};

export const turnLogQueries = {
  async create(
    runId: string,
    turnNo: number,
    choiceId: string | null,
    narrative: string,
    aiJson: any
  ): Promise<TurnLog> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("turn_logs")
      .insert({
        run_id: runId,
        turn_no: turnNo,
        choice_id: choiceId,
        narrative,
        ai_json: aiJson,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getByRunId(runId: string, limit?: number): Promise<TurnLog[]> {
    const supabase = await createServerClient();
    let query = supabase
      .from("turn_logs")
      .select("*")
      .eq("run_id", runId)
      .order("turn_no", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getLastTurns(runId: string, count: number): Promise<TurnLog[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("turn_logs")
      .select("*")
      .eq("run_id", runId)
      .order("turn_no", { ascending: false })
      .limit(count);

    if (error) throw error;
    return (data || []).reverse(); // Return in chronological order
  },
};
