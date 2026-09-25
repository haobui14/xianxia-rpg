using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace TuTien.Core.Content
{
    /// <summary>
    /// All static game content, indexed by id. Loading is host-agnostic: pass a function that
    /// returns a file's text (Godot reads res://content, tests read the folder on disk).
    /// </summary>
    public sealed class ContentDb
    {
        public Dictionary<string, RegionDef> Regions { get; } = new Dictionary<string, RegionDef>();
        public Dictionary<string, AreaDef> Areas { get; } = new Dictionary<string, AreaDef>();
        public Dictionary<string, DungeonDef> Dungeons { get; } = new Dictionary<string, DungeonDef>();
        public Dictionary<string, EventDef> Events { get; } = new Dictionary<string, EventDef>();
        public Dictionary<string, SectDef> Sects { get; } = new Dictionary<string, SectDef>();
        public Dictionary<string, LootTableDef> LootTables { get; } = new Dictionary<string, LootTableDef>();
        public Dictionary<string, string> LootAliases { get; } = new Dictionary<string, string>();
        public Dictionary<string, ItemDef> Items { get; } = new Dictionary<string, ItemDef>();
        public List<MissionTemplateDef> Missions { get; } = new List<MissionTemplateDef>();
        public ProgressionDef Progression { get; private set; } = new ProgressionDef();
        public Dictionary<string, EnemyDef> Enemies { get; } = new Dictionary<string, EnemyDef>();
        public Dictionary<string, SkillDef> Skills { get; } = new Dictionary<string, SkillDef>();
        public Dictionary<string, MapDef> Maps { get; } = new Dictionary<string, MapDef>();
        public Dictionary<string, TownDef> Towns { get; } = new Dictionary<string, TownDef>();
        /// <summary>Treasuries and chambers, by sect id.</summary>
        public Dictionary<string, SectHallDef> Halls { get; } = new Dictionary<string, SectHallDef>();
        public NpcNamesDef NpcNames { get; private set; } = new NpcNamesDef();
        /// <summary>How each catch fights on the line, by item id.</summary>
        public Dictionary<string, FishDef> Fish { get; } = new Dictionary<string, FishDef>();
        /// <summary>What bites at each fishing spot, by the spot's place id.</summary>
        public Dictionary<string, FishSpotDef> FishSpots { get; } = new Dictionary<string, FishSpotDef>();
        /// <summary>The alchemy furnace's recipes, in the order the apothecary lists them.</summary>
        public List<RecipeDef> Recipes { get; } = new List<RecipeDef>();
        public List<FortuneDef> Fortunes { get; } = new List<FortuneDef>();
        /// <summary>Bandit camps, by their place id.</summary>
        public Dictionary<string, CampDef> Camps { get; } = new Dictionary<string, CampDef>();

        /// <summary>Map files to load (relative to the content root).</summary>
        public static readonly string[] MapFiles = { "maps/thanh_van.json" };

        public static ContentDb Load(Func<string, string?> readText)
        {
            string Require(string file) =>
                readText(file) ?? throw new InvalidOperationException($"Missing content file: {file}");

            var db = new ContentDb();

            foreach (var region in GameJson.ReadEnvelope<List<RegionDef>>(Require("regions.json"), "regions.json"))
            {
                db.Regions[region.Id] = region;
                foreach (var area in region.Areas)
                {
                    if (string.IsNullOrEmpty(area.RegionId)) area.RegionId = region.Id;
                    db.Areas[area.Id] = area;
                }
            }

            foreach (var d in GameJson.ReadEnvelope<List<DungeonDef>>(Require("dungeons.json"), "dungeons.json"))
                db.Dungeons[d.Id] = d;
            foreach (var e in GameJson.ReadEnvelope<List<EventDef>>(Require("events.json"), "events.json"))
                db.Events[e.Id] = e;
            foreach (var s in GameJson.ReadEnvelope<List<SectDef>>(Require("sects.json"), "sects.json"))
                db.Sects[s.Id] = s;

            var loot = GameJson.ReadEnvelope<LootContent>(Require("loot.json"), "loot.json");
            foreach (var table in loot.Tables)
            {
                db.LootTables[table.Id] = table;
                foreach (var entry in table.Entries)
                    if (!db.Items.ContainsKey(entry.Id)) db.Items[entry.Id] = entry;
            }
            foreach (var kv in loot.RewardItems)
            {
                if (string.IsNullOrEmpty(kv.Value.Id)) kv.Value.Id = kv.Key;
                db.Items[kv.Key] = kv.Value;
            }
            foreach (var kv in loot.Aliases) db.LootAliases[kv.Key] = kv.Value;

            db.Missions.AddRange(GameJson.ReadEnvelope<List<MissionTemplateDef>>(Require("sect_missions.json"), "sect_missions.json"));
            db.Progression = GameJson.ReadEnvelope<ProgressionDef>(Require("progression.json"), "progression.json");

            foreach (var enemy in GameJson.ReadEnvelope<List<EnemyDef>>(Require("enemies.json"), "enemies.json"))
            {
                db.Enemies[enemy.Id] = enemy;
                // Hand-authored creatures join the exported zones' pools here.
                foreach (var zone in enemy.Zones)
                    if (db.Areas.TryGetValue(zone, out var area) && !area.EnemyPool.Contains(enemy.Id))
                        area.EnemyPool.Add(enemy.Id);
            }
            foreach (var skill in GameJson.ReadEnvelope<List<SkillDef>>(Require("skills.json"), "skills.json"))
                db.Skills[skill.Id] = skill;
            foreach (var item in GameJson.ReadEnvelope<List<ItemDef>>(Require("items.json"), "items.json"))
                db.Items[item.Id] = item;
            foreach (var town in GameJson.ReadEnvelope<List<TownDef>>(Require("towns.json"), "towns.json"))
                db.Towns[town.AreaId] = town;
            foreach (var hall in GameJson.ReadEnvelope<List<SectHallDef>>(Require("sect_halls.json"), "sect_halls.json"))
                db.Halls[hall.SectId] = hall;
            db.NpcNames = GameJson.ReadEnvelope<NpcNamesDef>(Require("npc_names.json"), "npc_names.json");

            // Fishing, mining, alchemy, the shrine and the bandit camp. Their loot tables name items defined above.
            var activities = GameJson.ReadEnvelope<ActivitiesDef>(Require("activities.json"), "activities.json");
            foreach (var table in activities.LootTables) db.LootTables[table.Id] = table;
            foreach (var fish in activities.Fishing.Fish) db.Fish[fish.Item] = fish;
            foreach (var spot in activities.Fishing.Spots) db.FishSpots[spot.Poi] = spot;
            db.Recipes.AddRange(activities.Recipes);
            db.Fortunes.AddRange(activities.Fortunes);
            foreach (var camp in activities.Camps) db.Camps[camp.Poi] = camp;

            foreach (var file in MapFiles)
            {
                var map = GameJson.ReadEnvelope<MapDef>(Require(file), file);
                db.Maps[map.Id] = map;
            }

            return db;
        }

        public AreaDef? Area(string? id) => id != null && Areas.TryGetValue(id, out var a) ? a : null;
        public RegionDef? Region(string? id) => id != null && Regions.TryGetValue(id, out var r) ? r : null;
        public EnemyDef? Enemy(string? id) => id != null && Enemies.TryGetValue(id, out var e) ? e : null;
        public SkillDef? Skill(string? id) => id != null && Skills.TryGetValue(id, out var s) ? s : null;
        public ItemDef? Item(string? id) => id != null && Items.TryGetValue(id, out var i) ? i : null;

        public MapDef? MapForRegion(string regionId) => Maps.Values.FirstOrDefault(m => m.RegionId == regionId);
        public RecipeDef? Recipe(string? id) => Recipes.FirstOrDefault(r => r.Id == id);

        /// <summary>Same rule as the web game's getLootTableForDungeonTier.</summary>
        public static string LootTableForTier(int tier)
        {
            if (tier >= 5) return "vong_linh_spirit";
            if (tier == 4) return "ancient_treasure";
            if (tier == 3) return "dungeon_boss";
            if (tier == 2) return "cave_treasure";
            return "common_herbs";
        }

        private static readonly Regex TierPattern = new Regex(@"tier[_ ]?(\d)", RegexOptions.IgnoreCase);

        /// <summary>Same rule as the web game's resolveLootTable: real id → alias → "tierN" suffix → fallback tier.</summary>
        public string ResolveLootTable(string? id, int fallbackTier = 1)
        {
            if (id != null && LootTables.ContainsKey(id)) return id;
            if (id != null && LootAliases.TryGetValue(id, out var alias)) return alias;
            if (id != null)
            {
                var m = TierPattern.Match(id);
                if (m.Success) return LootTableForTier(int.Parse(m.Groups[1].Value));
            }
            return LootTableForTier(fallbackTier);
        }

        /// <summary>Referential-integrity report. Warnings, not errors: content is migrating.</summary>
        public List<string> Validate()
        {
            var issues = new List<string>();
            foreach (var area in Areas.Values)
            {
                foreach (var enemyId in area.EnemyPool.Where(id => !Enemies.ContainsKey(id)))
                    issues.Add($"area {area.Id}: enemy '{enemyId}' has no catalog entry");
                foreach (var eventId in area.EventPool.Where(id => !Events.ContainsKey(id)))
                    issues.Add($"area {area.Id}: event '{eventId}' is not authored");
                foreach (var linked in area.ConnectedAreas.Where(id => !Areas.ContainsKey(id)))
                    issues.Add($"area {area.Id}: connected area '{linked}' does not exist");
            }
            foreach (var dungeon in Dungeons.Values)
            {
                foreach (var floor in dungeon.Floors)
                {
                    var ids = floor.EnemyWaves.SelectMany(w => w.Enemies).ToList();
                    if (floor.MiniBoss != null) ids.Add(floor.MiniBoss);
                    if (floor.FloorBoss != null) ids.Add(floor.FloorBoss);
                    foreach (var id in ids.Distinct().Where(id => !Enemies.ContainsKey(id)))
                        issues.Add($"dungeon {dungeon.Id} floor {floor.FloorNumber}: enemy '{id}' has no catalog entry");
                }
            }
            foreach (var enemy in Enemies.Values)
            {
                foreach (var skillId in enemy.Skills.Where(id => !Skills.ContainsKey(id)))
                    issues.Add($"enemy {enemy.Id}: skill '{skillId}' does not exist");
                foreach (var zone in enemy.Zones.Where(z => !Areas.ContainsKey(z)))
                    issues.Add($"enemy {enemy.Id}: zone '{zone}' does not exist");
            }
            foreach (var item in Items.Values.Where(i => i.TeachesSkillId != null && !Skills.ContainsKey(i.TeachesSkillId)))
                issues.Add($"item {item.Id}: teaches unknown skill '{item.TeachesSkillId}'");
            foreach (var map in Maps.Values)
            {
                if (!Regions.ContainsKey(map.RegionId)) issues.Add($"map {map.Id}: region '{map.RegionId}' does not exist");
                foreach (var zone in map.ZoneLegend.Values.Where(z => !Areas.ContainsKey(z)))
                    issues.Add($"map {map.Id}: zone '{zone}' is not an area");
            }
            foreach (var town in Towns.Values)
            {
                foreach (var entry in town.Shop.Where(e => !Items.ContainsKey(e.ItemId)))
                    issues.Add($"town {town.AreaId}: shop item '{entry.ItemId}' does not exist");
                foreach (var b in town.Bounties.Where(b => !Enemies.ContainsKey(b.EnemyId)))
                    issues.Add($"town {town.AreaId}: bounty target '{b.EnemyId}' does not exist");
                foreach (var r in town.Requests)
                {
                    if (!Items.ContainsKey(r.Item)) issues.Add($"town {town.AreaId}: request {r.Id} asks for unknown item '{r.Item}'");
                    if (r.RewardItem != null && !Items.ContainsKey(r.RewardItem)) issues.Add($"town {town.AreaId}: request {r.Id} rewards unknown item '{r.RewardItem}'");
                }
            }
            // The hand-authored activities.
            var pois = Maps.Values.SelectMany(m => m.Pois).ToList();
            foreach (var fish in Fish.Values.Where(f => !Items.ContainsKey(f.Item)))
                issues.Add($"fish '{fish.Item}' is not an item");
            foreach (var spot in FishSpots.Values)
            {
                if (pois.All(p => p.Id != spot.Poi || p.Kind != "fishing")) issues.Add($"fishing spot '{spot.Poi}' is not a fishing place on any map");
                foreach (var c in spot.Catches)
                {
                    if (c.Item != null && !Fish.ContainsKey(c.Item)) issues.Add($"fishing spot {spot.Poi}: '{c.Item}' has no fish entry");
                    if (c.Loot != null && !LootTables.ContainsKey(c.Loot)) issues.Add($"fishing spot {spot.Poi}: loot table '{c.Loot}' does not exist");
                    if ((c.Item == null) == (c.Loot == null)) issues.Add($"fishing spot {spot.Poi}: a catch needs an item or a loot table");
                }
            }
            foreach (var p in pois.Where(p => p.Kind == "fishing" && !FishSpots.ContainsKey(p.Id)))
                issues.Add($"place {p.Id}: a fishing spot with nothing to catch");
            foreach (var p in pois.Where(p => (p.Kind == "ore" || p.Kind == "herb") && (p.LootTable == null || !LootTables.ContainsKey(p.LootTable))))
                issues.Add($"place {p.Id}: loot table '{p.LootTable}' does not exist");
            foreach (var p in pois.Where(p => p.Kind == "camp" && !Camps.ContainsKey(p.Id)))
                issues.Add($"place {p.Id}: a camp with no garrison");
            foreach (var r in Recipes)
            {
                if (!Items.ContainsKey(r.Output)) issues.Add($"recipe {r.Id}: output '{r.Output}' does not exist");
                foreach (var i in r.Ingredients.Where(i => !Items.ContainsKey(i.Item)))
                    issues.Add($"recipe {r.Id}: ingredient '{i.Item}' does not exist");
            }
            foreach (var camp in Camps.Values)
            {
                foreach (var id in camp.Garrison.Where(id => !Enemies.ContainsKey(id)))
                    issues.Add($"camp {camp.Poi}: '{id}' has no catalog entry");
                if (!LootTables.ContainsKey(camp.Hoard)) issues.Add($"camp {camp.Poi}: hoard '{camp.Hoard}' does not exist");
            }
            foreach (var table in LootTables.Values)
                foreach (var e in table.Entries.Where(e => !Items.ContainsKey(e.Id)))
                    issues.Add($"loot table {table.Id}: item '{e.Id}' does not exist");
            foreach (var hall in Halls.Values)
            {
                if (!Sects.ContainsKey(hall.SectId)) issues.Add($"hall {hall.SectId}: no such sect");
                foreach (var entry in hall.Treasury.Where(e => !Items.ContainsKey(e.ItemId)))
                    issues.Add($"hall {hall.SectId}: treasury item '{entry.ItemId}' does not exist");
                foreach (var rank in hall.Treasury.Select(e => e.MinRank).Append(hall.Chamber?.MinRank).Where(r => r != null && Rules.SectRanks.IndexOf(r) < 0))
                    issues.Add($"hall {hall.SectId}: no such rank '{rank}'");
            }
            return issues;
        }
    }
}
