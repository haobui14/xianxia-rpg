# Database Migration to Normalized Tables

## Overview
This migration adds normalized database tables alongside the existing JSONB storage for better performance, querying capabilities, and data management.

## What Changed

### 1. New Database Schema
Created `schema_extended.sql` with the following table categories:

#### Inventory & Equipment
- `item_templates` - Master item catalog
- `character_inventory` - Player inventory items
- `character_equipment` - Equipped items by slot

#### Market & Economy
- `market_listings` - Quarterly market regeneration (shared across world seed)
- `market_transactions` - Transaction history
- `auction_events` - Biennial auction system
- `auction_bids` - Auction bidding history

#### Skills & Techniques
- `skill_templates` - Skill definitions
- `character_skills` - Learned skills with progress
- `technique_templates` - Cultivation technique catalog
- `character_techniques` - Learned techniques

#### Quests & Achievements
- `quest_templates` - Quest definitions
- `character_quests` - Active/completed quests
- `achievements` - Achievement definitions
- `character_achievements` - Unlocked achievements

#### Relationships & Social
- `sects` - Cultivation school information
- `npc_relationships` - NPC relationship tracking

#### Combat & Statistics
- `enemy_templates` - Enemy definitions
- `combat_history` - Combat log with statistics
- `player_statistics` - Leaderboard data

### 2. New Helper Files

#### `extendedQueries.ts`
TypeScript functions for interacting with normalized tables:
- `inventoryQueries` - Inventory management
- `marketQueries` - Market operations
- `skillQueries` - Skills and techniques
- `questQueries` - Quest management
- `combatQueries` - Combat history
- `leaderboardQueries` - Leaderboard data
- `npcQueries` - NPC relationships

#### `syncHelper.ts`
Synchronization functions to keep JSONB and tables in sync:
- `syncInventoryToTables()` - Sync inventory after changes
- `loadInventoryFromTables()` - Load from tables
- `syncMarketToTables()` - Sync market listings
- `loadMarketFromTables()` - Load market from cache
- `recordCombatHistory()` - Log combat events
- `updatePlayerStats()` - Update leaderboard
- `recordMarketTransaction()` - Log transactions
- `fullSync()` - Complete state synchronization

### 3. Updated API Routes

#### `equip-item/route.ts`
- Now syncs inventory changes to normalized tables
- Equipment operations recorded for analytics

#### `market/route.ts`
- Market listings cached in `market_listings` table (shared across players with same world seed)
- Transactions recorded in `market_transactions` table
- Inventory synced after buy/sell operations

#### `turn/route.ts`
- Combat events recorded to `combat_history` table
- Player statistics updated for leaderboard
- Inventory synced after each turn

### 4. New API Endpoints

#### `/api/leaderboard`
- GET request to fetch top players
- Query params: `limit` (default: 100)
- Returns ranked list by realm stage and wealth

#### `/api/combat-history`
- GET request to view combat logs
- Query params: `limit` (default: 20)
- Returns combat history with statistics (win rate, damage dealt/taken)

#### `/api/transaction-history`
- GET request to view market transactions
- Query params: `limit` (default: 50)
- Returns transaction history with financial statistics

## Setup Instructions

### 1. Run SQL Schema
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy contents of `src/lib/database/schema_extended.sql`
4. Run the SQL to create all tables

### 2. Test the System
The system works in hybrid mode:
- **JSONB (current_state)** remains the source of truth
- **Normalized tables** are synchronized for better querying
- All existing functionality continues to work

### 3. Verify Synchronization
After running the app:
1. Check `character_inventory` table - should populate after equipment changes
2. Check `market_listings` table - should populate when market regenerates
3. Check `combat_history` table - should populate after combat
4. Check `player_statistics` table - should update after turns

## Benefits

### Performance
- **Indexed queries** instead of JSONB path scans
- **Faster searches** for specific items, combats, transactions
- **Efficient joins** for complex queries

### Analytics
- **Combat statistics** - Win rate, damage analysis
- **Financial tracking** - Transaction history, net profit
- **Leaderboards** - Global rankings by realm/wealth
- **Player progression** - Historical data tracking

### Scalability
- **Shared data** - Market listings cached across players
- **Normalized structure** - Easier to add features
- **Data integrity** - Foreign keys and constraints
- **Reduced JSONB size** - Offload data to tables

### Developer Experience
- **Type-safe queries** - TypeScript functions
- **Easier debugging** - Direct SQL queries
- **Better testing** - Query individual components
- **Clear data model** - Explicit relationships

## Architecture

```
┌─────────────────┐
│   runs table    │
│  (current_state)│ ◄─── Source of Truth (JSONB)
└────────┬────────┘
         │
         │ Synced via syncHelper.ts
         │
         ▼
┌─────────────────────────────────────┐
│      Normalized Tables              │
├─────────────────────────────────────┤
│ • character_inventory               │
│ • character_equipment               │
│ • market_listings (cached)          │
│ • market_transactions               │
│ • combat_history                    │
│ • player_statistics (leaderboard)   │
│ • character_skills                  │
│ • character_techniques              │
│ • npc_relationships                 │
└─────────────────────────────────────┘
         │
         │ Queried for analytics
         │
         ▼
┌─────────────────────────────────────┐
│      New API Endpoints              │
├─────────────────────────────────────┤
│ • GET /api/leaderboard              │
│ • GET /api/combat-history           │
│ • GET /api/transaction-history      │
└─────────────────────────────────────┘
```

## Future Enhancements

### Ready to Implement
1. **Quest System** - Use `character_quests` table
2. **Achievement System** - Use `character_achievements` table
3. **Auction System** - Use `auction_events` and `auction_bids` tables
4. **NPC Relationships** - Track via `npc_relationships` table
5. **Sect Management** - Use `sects` table

### Analytics Features
1. **Player Progression Dashboard** - Visualize growth over time
2. **Market Price Trends** - Track item prices across quarters
3. **Combat Analysis** - Identify difficult enemies
4. **Social Features** - Friends, guilds using NPC relationship system

## Maintenance

### Keeping Tables in Sync
The sync happens automatically in:
- `equip-item` route - After equipment changes
- `market` route - After buy/sell operations
- `turn` route - After each game turn

### Manual Sync (if needed)
```typescript
import { fullSync } from '@/lib/database/syncHelper';

// Sync entire game state
await fullSync(runId, state, characterName);
```

### Checking Sync Status
Query both sources to compare:
```sql
-- Check JSONB inventory count
SELECT jsonb_array_length(current_state->'inventory'->'items') 
FROM runs WHERE id = 'run-id';

-- Check normalized table count
SELECT COUNT(*) FROM character_inventory WHERE run_id = 'run-id';
```

## Notes

- **Backward Compatible** - Existing JSONB approach still works
- **Optional Migration** - Can gradually adopt normalized tables
- **No Data Loss** - JSONB remains authoritative source
- **Performance Gain** - Queries are significantly faster with indexes
- **Analytics Ready** - Historical data enables new features
