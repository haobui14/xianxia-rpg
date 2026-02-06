# GameScreen Refactoring

## Summary
Broke down the 2,215-line GameScreen.tsx into smaller, manageable custom hooks.
GameScreen.tsx is now ~790 lines. All logic has been extracted into 8 hooks totaling ~1,562 lines.

## Created Hooks (`src/hooks/`)

1. **useCombat.ts** (~814 lines)
   - Test combat (dummy enemy sparring)
   - Active combat (AI-triggered combat encounters)
   - Skill usage with exp gain, level-ups, cooldowns
   - Attack/qi_attack/defend/flee/skill actions
   - isAttackSkill/isHealSkill branching for defense/support skills
   - Loot distribution and combat end (victory/defeat)
   - Skill exp sync to database after combat

2. **useGameState.ts** (~255 lines)
   - Core game state management (state, narrative, choices, loading, processing, error)
   - Load/save run data with stamina regeneration on load
   - Turn processing (`processTurn`) with save status handling
   - Breakthrough detection (realm/stage changes)
   - Auto-start first turn
   - `lastTurnEvents` state for bridging combat encounters from AI turns to useCombat

3. **useItemHandlers.ts** (~138 lines)
   - Equipment handlers (equip/unequip)
   - Market actions (buy/sell/refresh/exchange)
   - Item usage (use/discard/enhance)

4. **useTravelHandlers.ts** (~137 lines)
   - Area/region travel
   - Dungeon actions (enter/advance/exit)
   - Triggers active combat via `setActiveCombat` for dungeon encounters

5. **useAbilityHandlers.ts** (~113 lines)
   - Technique/skill swapping
   - Dual cultivation toggle
   - Experience split management

6. **useStaminaNotification.ts** (~44 lines)
   - Stamina full notifications (fires when stamina reaches max)
   - 1-hour cooldown between notifications

7. **useTutorial.ts** (~33 lines)
   - Tutorial display logic
   - localStorage persistence

8. **useEventHandlers.ts** (~28 lines)
   - Event choice handling (prefixes choiceId with `event_`)

## GameScreen.tsx (~790 lines)
The main component now only contains:
- Hook wiring (connecting all 8 hooks)
- Two local `useEffect`s: combat encounter detection (from `lastTurnEvents`), market tab init
- `handleChoice` and `handleCustomAction` callbacks
- JSX rendering with dynamic imports for heavy components

## Key Architecture Decisions
- **Cross-hook communication**: `useGameState` exposes `lastTurnEvents`/`setLastTurnEvents`. GameScreen has a `useEffect` that watches `lastTurnEvents` for `combat_encounter` events and calls `setActiveCombat` from `useCombat`. This bridges the two hooks without circular dependencies.
- **State ownership**: `useGameState` owns the core `GameState`. Other hooks receive `setState` to update it directly.
- **API calls**: Item/travel/ability handlers use the `apiCall` utility wrapper from `src/lib/utils/api.ts`.

## Benefits
- **Maintainability**: Each hook handles a specific concern
- **Testability**: Hooks can be tested independently
- **Reusability**: Hooks can be reused in other components
- **Readability**: Main component reduced from 2,215 to 790 lines (64% reduction)
