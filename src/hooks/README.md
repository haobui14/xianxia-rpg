// GameScreen Refactoring Plan
// 
// The original GameScreen.tsx is 2,215 lines. We've extracted:
// 
// 1. useGameState - game state, turn processing, breakthrough (~240 lines extracted)
// 2. useItemHandlers - equip, market, discard, use, enhance (~130 lines extracted)  
// 3. useTutorial - tutorial display logic (~30 lines extracted)
// 4. useStaminaNotification - stamina notifications (~35 lines extracted)
// 5. useTravelHandlers - travel, dungeon (~100 lines extracted)
// 6. useAbilityHandlers - techniques, skills, dual cultivation (~100 lines extracted)
// 7. useEventHandlers - event choices (~25 lines extracted)
//
// Total extracted: ~660 lines
// Combat logic remaining in main file: ~1,200 lines (due to complex state interactions)
// UI/render logic: ~400 lines
// 
// New main file size: ~1,600 lines (27% reduction)
// Can extract combat to separate component later if needed
//
// To apply refactoring:
// 1. Import all the hooks at the top of GameScreen.tsx
// 2. Replace useState/useCallback declarations with hook calls
// 3. Remove extracted handler functions
// 4. Keep combat logic and render logic as-is
