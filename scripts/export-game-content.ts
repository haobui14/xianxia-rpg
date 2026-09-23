// Export the web game's static content to JSON for the Godot client
// (game/godot/content). The TypeScript modules stay the source of truth
// during the migration; re-run this whenever they change.
// Run from the repo root with: npx tsx scripts/export-game-content.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REGIONS } from "../src/lib/world/regions";
import { ALL_DUNGEONS } from "../src/lib/world/dungeons";
import { ALL_EVENTS } from "../src/lib/world/events";
import { NAMED_SECTS } from "../src/lib/game/sects";
import { LOOT_TABLES, DUNGEON_REWARD_ITEMS, LOOT_TABLE_ALIASES } from "../src/lib/game/loot";
import { MISSION_TEMPLATES } from "../src/lib/game/sect-missions";
import {
  CULTIVATION_EXP_REQUIREMENTS,
  BODY_CULTIVATION_EXP_REQUIREMENTS,
} from "../src/lib/game/mechanics";
import { SEASON_ELEMENT_BONUS, SEASON_MONTHS } from "../src/lib/game/time";
import { BODY_REALM_BONUSES } from "../src/lib/game/dual-cultivation";
import { REALM_LIFESPAN_BONUS } from "../src/types/game";

const repoRoot = process.cwd();
if (!existsSync(join(repoRoot, "package.json")) || !existsSync(join(repoRoot, "game"))) {
  console.error("Run this from the repository root: npx tsx scripts/export-game-content.ts");
  process.exit(1);
}

const outDir = join(repoRoot, "game", "godot", "content");
mkdirSync(outDir, { recursive: true });

const SOURCE = "scripts/export-game-content.ts — generated, do not edit by hand";

function write(file: string, data: unknown): void {
  const body = JSON.stringify({ $source: SOURCE, data }, null, 2) + "\n";
  writeFileSync(join(outDir, file), body, "utf8");
  console.log(`wrote content/${file} (${(body.length / 1024).toFixed(1)} KB)`);
}

write("regions.json", Object.values(REGIONS));
write("dungeons.json", ALL_DUNGEONS);
write("events.json", ALL_EVENTS);
write("sects.json", NAMED_SECTS);
write("loot.json", {
  tables: Object.values(LOOT_TABLES),
  reward_items: DUNGEON_REWARD_ITEMS,
  aliases: LOOT_TABLE_ALIASES,
});
write("sect_missions.json", MISSION_TEMPLATES);
write("progression.json", {
  cultivation_exp: CULTIVATION_EXP_REQUIREMENTS,
  body_exp: BODY_CULTIVATION_EXP_REQUIREMENTS,
  realm_lifespan_bonus: REALM_LIFESPAN_BONUS,
  body_realm_bonuses: BODY_REALM_BONUSES,
  season_months: SEASON_MONTHS,
  season_element_bonus: SEASON_ELEMENT_BONUS,
});
