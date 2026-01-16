import { createServerClient } from './client';
import { Character, Run, TurnLog, GameState } from '@/types/game';

export const characterQueries = {
  async create(userId: string, name: string, age: number): Promise<Character> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('characters')
      .insert({ user_id: userId, name, age })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Character | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async getByUserId(userId: string): Promise<Character[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteById(id: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteAllByUserId(userId: string): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  },
};

export const runQueries = {
  async create(
    characterId: string,
    worldSeed: string,
    locale: 'vi' | 'en',
    initialState: GameState
  ): Promise<Run> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('runs')
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
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async update(id: string, state: GameState): Promise<void> {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('runs')
      .update({ current_state: state })
      .eq('id', id);

    if (error) throw error;
  },

  async getByCharacterId(characterId: string): Promise<Run[]> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('character_id', characterId)
      .order('updated_at', { ascending: false });

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
      .from('turn_logs')
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
      .from('turn_logs')
      .select('*')
      .eq('run_id', runId)
      .order('turn_no', { ascending: false });

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
      .from('turn_logs')
      .select('*')
      .eq('run_id', runId)
      .order('turn_no', { ascending: false })
      .limit(count);

    if (error) throw error;
    return (data || []).reverse(); // Return in chronological order
  },
};
