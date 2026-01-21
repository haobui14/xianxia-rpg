import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database/client';
import { characterQueries, runQueries } from '@/lib/database/queries';
import { GameState } from '@/types/game';
import { migrateGameState } from '@/lib/game/mechanics';
import {
  canEnterDungeon,
  enterDungeon,
  exitDungeon,
  advanceFloor,
  clearCurrentFloor,
  tickDungeonTime,
  collectChest,
  discoverSecret,
  unlockShortcut,
  defeatBoss,
  getDungeonProgress,
  isDungeonComplete,
  getCompletionRewards,
  getCurrentDungeon,
  getCurrentFloor,
  isInDungeon,
  getRandomEnemyWave,
  hasMiniBoss,
  hasFloorBoss,
  canUnlockShortcut,
  getDifficultyRating,
} from '@/lib/world/dungeon-engine';
import { getDungeonById, getDungeonsInRegion } from '@/lib/world/dungeons';
import { DeterministicRNG } from '@/lib/game/rng';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, dungeon_id, floor_action, chest_id, secret_id } = body;

    const validActions = [
      'list_dungeons',
      'get_info',
      'enter',
      'exit',
      'explore_floor',
      'clear_floor',
      'advance_floor',
      'collect_chest',
      'discover_secret',
      'unlock_shortcut',
      'defeat_boss',
      'get_progress',
    ];

    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Use one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get character
    const characters = await characterQueries.getByUserId(user.id);
    if (characters.length === 0) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    const character = characters[0];

    // Get current run
    const runs = await runQueries.getByCharacterId(character.id);
    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'No active run found' },
        { status: 404 }
      );
    }

    const run = runs[0];
    let state = migrateGameState(run.current_state as GameState);

    // Create RNG for this action
    const rng = new DeterministicRNG(`${run.world_seed}-dungeon-${state.turn_count}-${Date.now()}`);

    // Handle different actions
    switch (action) {
      case 'list_dungeons': {
        // List dungeons available in current region
        const regionId = state.travel?.current_region || 'thanh_van';
        const dungeons = getDungeonsInRegion(regionId);

        return NextResponse.json({
          success: true,
          dungeons: dungeons.map(d => ({
            id: d.id,
            name: d.name,
            name_en: d.name_en,
            type: d.type,
            tier: d.tier,
            floors: d.floors.length,
            recommended_realm: d.recommended_realm,
            difficulty: getDifficultyRating(d.id, state.progress.realm),
            cleared_before: state.dungeon?.completed_dungeons[d.id] !== undefined,
            times_cleared: state.dungeon?.completed_dungeons[d.id]?.times_cleared || 0,
          })),
        });
      }

      case 'get_info': {
        if (!dungeon_id) {
          return NextResponse.json({ error: 'dungeon_id required' }, { status: 400 });
        }

        const dungeon = getDungeonById(dungeon_id);
        if (!dungeon) {
          return NextResponse.json({ error: 'Dungeon not found' }, { status: 404 });
        }

        const canEnter = canEnterDungeon(dungeon_id, state);

        return NextResponse.json({
          success: true,
          dungeon: {
            id: dungeon.id,
            name: dungeon.name,
            name_en: dungeon.name_en,
            description: dungeon.description,
            description_en: dungeon.description_en,
            type: dungeon.type,
            tier: dungeon.tier,
            floors: dungeon.floors.length,
            time_limit: dungeon.time_limit,
            recommended_realm: dungeon.recommended_realm,
            entry_cost: dungeon.entry_cost,
            entry_requirements: dungeon.entry_requirements,
            can_enter: canEnter.canEnter,
            enter_blocked_reason: canEnter.reason_en || canEnter.reason,
            difficulty: getDifficultyRating(dungeon.id, state.progress.realm),
            completion_rewards: dungeon.completion_rewards,
            first_clear_bonus: dungeon.first_clear_bonus,
          },
        });
      }

      case 'enter': {
        if (!dungeon_id) {
          return NextResponse.json({ error: 'dungeon_id required' }, { status: 400 });
        }

        const canEnter = canEnterDungeon(dungeon_id, state);
        if (!canEnter.canEnter) {
          return NextResponse.json({
            success: false,
            error: canEnter.reason_en || canEnter.reason,
          }, { status: 400 });
        }

        const { newState, entryCost } = enterDungeon(dungeon_id, state.dungeon!);

        // Deduct entry cost
        if (entryCost) {
          state.inventory.silver -= entryCost.silver;
          state.inventory.spirit_stones -= entryCost.spirit_stones;
          if (entryCost.item) {
            const itemIndex = state.inventory.items.findIndex(i => i.id === entryCost.item);
            if (itemIndex !== -1) {
              if (state.inventory.items[itemIndex].quantity > 1) {
                state.inventory.items[itemIndex].quantity--;
              } else {
                state.inventory.items.splice(itemIndex, 1);
              }
            }
          }
        }

        state.dungeon = newState;

        const dungeon = getCurrentDungeon(state.dungeon!);
        const floor = getCurrentFloor(state.dungeon!);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          dungeon_info: {
            name: dungeon?.name,
            name_en: dungeon?.name_en,
            current_floor: state.dungeon!.current_floor,
            total_floors: dungeon?.floors.length,
            turns_remaining: state.dungeon!.turns_remaining,
          },
          floor_info: {
            name: floor?.name,
            name_en: floor?.name_en,
            description: floor?.description,
            description_en: floor?.description_en,
          },
          message: 'Entered dungeon successfully',
        });
      }

      case 'exit': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        const wasComplete = isDungeonComplete(state.dungeon!);
        let rewards: any[] = [];

        if (wasComplete) {
          rewards = getCompletionRewards(state.dungeon!, () => rng.random());
          // Apply rewards to inventory
          for (const reward of rewards) {
            switch (reward.type) {
              case 'silver':
                state.inventory.silver += reward.amount || 0;
                break;
              case 'spirit_stones':
                state.inventory.spirit_stones += reward.amount || 0;
                break;
              case 'exp':
                state.progress.cultivation_exp += reward.amount || 0;
                break;
              // Items/techniques/skills would need to be added to inventory
            }
          }
        }

        state.dungeon = exitDungeon(state.dungeon!, wasComplete);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          completed: wasComplete,
          rewards: wasComplete ? rewards : [],
          message: wasComplete ? 'Dungeon completed!' : 'Exited dungeon',
        });
      }

      case 'get_progress': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        const progress = getDungeonProgress(state.dungeon!);
        const dungeon = getCurrentDungeon(state.dungeon!);
        const floor = getCurrentFloor(state.dungeon!);

        return NextResponse.json({
          success: true,
          progress: {
            ...progress,
            dungeon_name: dungeon?.name,
            dungeon_name_en: dungeon?.name_en,
            floor_name: floor?.name,
            floor_name_en: floor?.name_en,
            has_mini_boss: hasMiniBoss(state.dungeon!) !== null,
            has_floor_boss: hasFloorBoss(state.dungeon!) !== null,
            boss_defeated: state.dungeon!.boss_defeated,
            is_complete: isDungeonComplete(state.dungeon!),
          },
        });
      }

      case 'explore_floor': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        // Tick time
        const { newState: timedState, timeExpired, turnsRemaining } = tickDungeonTime(state.dungeon!);
        state.dungeon = timedState;

        if (timeExpired) {
          state.dungeon = exitDungeon(state.dungeon!, false);
          await runQueries.update(run.id, state);

          return NextResponse.json({
            success: true,
            state,
            time_expired: true,
            message: 'Time limit reached! Forced exit from dungeon.',
          });
        }

        // Check for enemy encounter
        const enemyWave = getRandomEnemyWave(state.dungeon!, () => rng.random());

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          turns_remaining: turnsRemaining,
          encounter: enemyWave ? {
            type: 'enemy_wave',
            enemies: enemyWave.enemies,
            is_ambush: enemyWave.is_ambush,
          } : null,
        });
      }

      case 'clear_floor': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        state.dungeon = clearCurrentFloor(state.dungeon!);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          message: 'Floor cleared!',
        });
      }

      case 'advance_floor': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        const dungeon = getCurrentDungeon(state.dungeon!);
        if (state.dungeon!.current_floor >= (dungeon?.floors.length || 0)) {
          return NextResponse.json({
            success: false,
            error: 'Already at final floor',
          }, { status: 400 });
        }

        state.dungeon = advanceFloor(state.dungeon!);
        const newFloor = getCurrentFloor(state.dungeon!);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          new_floor: {
            number: state.dungeon!.current_floor,
            name: newFloor?.name,
            name_en: newFloor?.name_en,
            description: newFloor?.description,
            description_en: newFloor?.description_en,
          },
        });
      }

      case 'collect_chest': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        if (!chest_id) {
          return NextResponse.json({ error: 'chest_id required' }, { status: 400 });
        }

        if (state.dungeon!.collected_chests.includes(chest_id)) {
          return NextResponse.json({
            success: false,
            error: 'Chest already collected',
          }, { status: 400 });
        }

        state.dungeon = collectChest(state.dungeon!, chest_id);

        // Generate loot (simplified - would use loot tables in full implementation)
        const loot = {
          silver: Math.floor(rng.random() * 100) + 50,
          spirit_stones: rng.random() > 0.7 ? Math.floor(rng.random() * 10) + 1 : 0,
        };

        state.inventory.silver += loot.silver;
        state.inventory.spirit_stones += loot.spirit_stones;

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          loot,
        });
      }

      case 'discover_secret': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        if (!secret_id) {
          return NextResponse.json({ error: 'secret_id required' }, { status: 400 });
        }

        state.dungeon = discoverSecret(state.dungeon!, secret_id);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          message: 'Secret discovered!',
        });
      }

      case 'unlock_shortcut': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        const playerItems = state.inventory.items.map(i => i.id);
        const playerSkills = state.skills.map(s => s.id);
        const canUnlock = canUnlockShortcut(state.dungeon!, playerItems, playerSkills);

        if (!canUnlock.canUnlock) {
          return NextResponse.json({
            success: false,
            error: canUnlock.reason,
          }, { status: 400 });
        }

        state.dungeon = unlockShortcut(state.dungeon!, state.dungeon!.current_floor);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          message: `Shortcut to floor ${state.dungeon!.current_floor} unlocked!`,
        });
      }

      case 'defeat_boss': {
        if (!isInDungeon(state.dungeon!)) {
          return NextResponse.json({
            success: false,
            error: 'Not in a dungeon',
          }, { status: 400 });
        }

        state.dungeon = defeatBoss(state.dungeon!);

        // Save to database
        await runQueries.update(run.id, state);

        return NextResponse.json({
          success: true,
          state,
          dungeon_complete: isDungeonComplete(state.dungeon!),
          message: 'Boss defeated!',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Dungeon error:', error);
    return NextResponse.json(
      { error: 'Failed to process dungeon action' },
      { status: 500 }
    );
  }
}
