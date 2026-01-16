# Data Migration Guide

This guide explains how to migrate your existing game data from JSONB storage to the new normalized database tables.

## Why Migrate?

The new normalized tables provide:
- ✅ Better query performance (indexed lookups)
- ✅ Analytics and leaderboards
- ✅ Transaction and combat history
- ✅ Easier data management

**Note:** Migration is optional - your game will continue working with JSONB. New data is automatically synced to both.

## Migration Options

### Option 1: API Endpoint (Recommended)

1. **Check migration status:**
   ```bash
   GET http://localhost:3000/api/migrate
   ```

2. **Run migration:**
   ```bash
   POST http://localhost:3000/api/migrate
   ```

   Response will show:
   ```json
   {
     "success": true,
     "results": {
       "processed": 5,
       "successful": 5,
       "failed": 0,
       "errors": []
     }
   }
   ```

### Option 2: Command Line Script

1. **Install tsx (if not installed):**
   ```bash
   npm install -D tsx
   ```

2. **Set environment variables:**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   # Optional: for admin access
   SUPABASE_SERVICE_KEY=your_service_key
   ```

3. **Run migration:**
   ```bash
   npm run migrate
   ```

   You'll see output like:
   ```
   🚀 Starting migration to normalized tables...
   
   Found 5 runs to migrate
   
   [1/5] Migrating run abc-123 (Character Name)...
     ✓ Migrated 25 inventory items
     ✓ Migrated 8 equipped items
     ✓ Migrated player statistics
   
   ═══════════════════════════════════════
   ✅ Migration Complete!
   
   Total runs processed: 5
   Successful: 5
   Failed: 0
   ═══════════════════════════════════════
   ```

## What Gets Migrated?

For each run:
- ✅ **Inventory items** → `character_inventory` table
- ✅ **Equipped items** → `character_equipment` table
- ✅ **Player statistics** → `player_statistics` table (for leaderboards)

## After Migration

Once migrated, the new tables will be used for:

1. **Leaderboards**
   ```bash
   GET /api/leaderboard
   ```

2. **Combat History**
   ```bash
   GET /api/combat-history
   ```

3. **Transaction History**
   ```bash
   GET /api/transaction-history
   ```

## Troubleshooting

### Migration fails with "Not authenticated"
- Make sure you're logged in before calling `/api/migrate`
- Or use the CLI script with `SUPABASE_SERVICE_KEY`

### Some items failed to migrate
- Check the error messages in the response
- Re-run migration (it will skip already migrated items)

### Data looks wrong in new tables
- Tables are automatically cleared and re-synced on each migration
- Safe to run multiple times

## Rollback

If you need to rollback:

```sql
-- Run in Supabase SQL Editor
DELETE FROM character_inventory;
DELETE FROM character_equipment;
DELETE FROM player_statistics;
```

Your JSONB data remains untouched and will continue working.
