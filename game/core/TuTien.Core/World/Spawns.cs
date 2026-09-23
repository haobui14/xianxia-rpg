using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Events;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    /// <summary>What appears on the map each month: beast packs, adventures (kỳ ngộ), herb regrowth.</summary>
    public static class Spawns
    {
        public const int MaxAdventures = 3;
        public const int AdventureLifetimeMonths = 3;
        public const int HerbRegrowMonths = 2;

        public static bool IsAggressive(ContentDb content, IEnumerable<string> enemyIds) =>
            enemyIds.Any(id => content.Enemy(id)?.Archetype is "charger" or "swarm");

        /// <summary>A walkable, unoccupied tile in the zone, at least <paramref name="minDistance"/> from <paramref name="avoid"/>.</summary>
        public static Cell? RandomFreeCell(GameState state, MapGrid map, string zone, Pcg32 rng, Cell avoid, int minDistance)
        {
            var cells = map.CellsInZone(zone)
                .Where(c => map.At(c.X, c.Y) != Terrain.Water && map.At(c.X, c.Y) != Terrain.Peak)
                .Where(c => c.Manhattan(avoid) >= minDistance)
                .Where(c => !Occupied(state, map, c.X, c.Y))
                .ToList();
            return cells.Count == 0 ? (Cell?)null : rng.Pick(cells);
        }

        public static bool Occupied(GameState state, MapGrid map, int x, int y)
        {
            if (map.Def.Pois.Any(p => p.X == x && p.Y == y)) return true;
            if (state.World.Beasts.Any(b => b.X == x && b.Y == y)) return true;
            if (state.World.Adventures.Any(a => a.X == x && a.Y == y)) return true;
            if (state.World.Npcs.Any(n => n.Alive && n.X == x && n.Y == y)) return true;
            return state.Player.X == x && state.Player.Y == y;
        }

        private static IEnumerable<AreaDef> WildZones(ContentDb content, MapGrid map) =>
            map.Def.ZoneLegend.Values.Distinct().Select(content.Area).Where(a => a != null && !a.IsSafe).Select(a => a!);

        private static int TargetPacks(AreaDef area) => area.DangerLevel + 1;

        public static void FillBeasts(GameState state, ContentDb content, MapGrid map, Pcg32 rng)
        {
            var player = new Cell(state.Player.X, state.Player.Y);
            foreach (var area in WildZones(content, map))
            {
                var pool = area.EnemyPool.Where(id => content.Enemy(id) != null).ToList();
                if (pool.Count == 0) continue;
                var existing = state.World.Beasts.Count(b => b.Zone == area.Id);
                for (var i = existing; i < TargetPacks(area); i++)
                {
                    var cell = RandomFreeCell(state, map, area.Id, rng, player, 5);
                    if (cell == null) break;
                    var size = rng.Range(1, Math.Min(3, area.DangerLevel));
                    var members = Enumerable.Range(0, size).Select(_ => rng.Pick(pool)).ToList();
                    state.World.Beasts.Add(new BeastPack
                    {
                        Id = state.NewId("pack"),
                        EnemyIds = members,
                        Zone = area.Id,
                        X = cell.Value.X,
                        Y = cell.Value.Y,
                        Aggressive = IsAggressive(content, members),
                    });
                }
            }
        }

        /// <summary>Beasts roam inside their zone; hungry ones close in on a player they can sense.</summary>
        public static void MoveBeasts(GameState state, ContentDb content, MapGrid map, Pcg32 rng, List<GameEvent> events)
        {
            var p = state.Player;
            var player = new Cell(p.X, p.Y);
            foreach (var pack in state.World.Beasts)
            {
                var steps = rng.Range(0, 3);
                for (var s = 0; s < steps; s++)
                {
                    var here = new Cell(pack.X, pack.Y);
                    var options = map.Neighbors(here)
                        .Where(c => map.ZoneAt(c.X, c.Y) == pack.Zone)
                        .Where(c => map.StepCost(c.X, c.Y, p) > 0)
                        .Where(c => !(c.X == p.X && c.Y == p.Y) || pack.Aggressive)
                        .Where(c => !map.Def.Pois.Any(poi => poi.X == c.X && poi.Y == c.Y))
                        .Where(c => !state.World.Beasts.Any(b => b != pack && b.X == c.X && b.Y == c.Y))
                        .ToList();
                    if (options.Count == 0) break;
                    var hunting = pack.Aggressive && here.Manhattan(player) <= 6;
                    var next = hunting ? options.OrderBy(c => c.Manhattan(player)).First() : rng.Pick(options);
                    pack.X = next.X;
                    pack.Y = next.Y;
                }

                if (state.World.PendingAmbush != null || !pack.Aggressive) continue;
                if (new Cell(pack.X, pack.Y).Manhattan(player) > 1) continue;
                var dodge = 0.3 + p.Attrs.Per * 0.02;
                if (rng.Chance(dodge))
                {
                    events.Add(GameEvent.Info("ambush_avoided", "Thần thức cảnh giác — ngươi tránh được một đàn yêu thú rình rập.",
                        "Your spiritual sense warns you — you slip away from a stalking pack."));
                    continue;
                }
                state.World.PendingAmbush = new Encounter
                {
                    Id = state.NewId("enc"),
                    Source = "ambush",
                    SourceId = pack.Id,
                    EnemyIds = pack.EnemyIds.ToList(),
                    Zone = pack.Zone,
                    Danger = content.Area(pack.Zone)?.DangerLevel ?? 1,
                };
            }
        }

        public static void RefreshAdventures(GameState state, ContentDb content, MapGrid map, Pcg32 rng)
        {
            var month = state.Calendar.MonthIndex;
            state.World.Adventures.RemoveAll(a => a.ExpiresMonth <= month);
            var player = new Cell(state.Player.X, state.Player.Y);
            var zones = WildZones(content, map).ToList();
            if (zones.Count == 0) return;

            var guard = 0;
            while (state.World.Adventures.Count < MaxAdventures && guard++ < 10)
            {
                var trigger = rng.Chance(0.6) ? "exploration" : "travel";
                var ev = EventEngine.Select(EventEngine.ValidEvents(state, content, trigger, map.Def.RegionId), state.Player, rng);
                if (ev == null) continue;
                if (state.World.Adventures.Any(a => a.EventId == ev.Id)) continue;
                var zone = zones[Math.Max(0, rng.WeightedIndex(zones.Select(z => (double)z.DangerLevel).ToList()))];
                var cell = RandomFreeCell(state, map, zone.Id, rng, player, 3);
                if (cell == null) continue;
                state.World.Adventures.Add(new AdventureSpot
                {
                    Id = state.NewId("adv"),
                    EventId = ev.Id,
                    Zone = zone.Id,
                    X = cell.Value.X,
                    Y = cell.Value.Y,
                    ExpiresMonth = month + AdventureLifetimeMonths,
                    Hidden = ev.Rarity is "rare" or "legendary",
                });
            }
        }

        public static bool NodeReady(GameState state, string poiId)
        {
            var node = state.World.Nodes.FirstOrDefault(n => n.PoiId == poiId);
            return node == null || node.ReadyMonth <= state.Calendar.MonthIndex;
        }

        public static void Deplete(GameState state, string poiId)
        {
            var node = state.World.Nodes.FirstOrDefault(n => n.PoiId == poiId);
            if (node == null)
            {
                node = new NodeState { PoiId = poiId };
                state.World.Nodes.Add(node);
            }
            node.ReadyMonth = state.Calendar.MonthIndex + HerbRegrowMonths;
        }
    }
}
