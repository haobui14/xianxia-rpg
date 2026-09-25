using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    /// <summary>
    /// Bandit camps. A garrison holds each camp (a pack that stays put and comes for whoever walks in). Break it and
    /// the hoard waits in the camp until the bandits regroup some months later and take the place back.
    /// </summary>
    public static class Camps
    {
        public static CampState Of(GameState state, string poiId)
        {
            if (!state.World.Camps.TryGetValue(poiId, out var camp))
            {
                camp = new CampState();
                state.World.Camps[poiId] = camp;
            }
            return camp;
        }

        public static BeastPack? Garrison(GameState state, string poiId) => state.World.Beasts.FirstOrDefault(b => b.CampId == poiId);

        /// <summary>Man every camp whose bandits are due back (a new life, and every month after).</summary>
        public static void Fill(GameState state, ContentDb content, MapGrid map)
        {
            foreach (var poi in map.Def.Pois.Where(p => p.Kind == "camp"))
            {
                if (!content.Camps.TryGetValue(poi.Id, out var def) || def.Garrison.Count == 0) continue;
                var camp = Of(state, poi.Id);
                if (Garrison(state, poi.Id) != null || camp.ReturnMonth > state.Calendar.MonthIndex) continue;
                // Back in force: whatever was left of the hoard is theirs again.
                camp.HoardReady = false;
                state.World.Beasts.Add(new BeastPack
                {
                    Id = state.NewId("camp"),
                    EnemyIds = def.Garrison.ToList(),
                    Zone = map.ZoneAt(poi.X, poi.Y) ?? "",
                    X = poi.X,
                    Y = poi.Y,
                    Aggressive = true,
                    CampId = poi.Id,
                });
            }
        }

        /// <summary>The garrison is broken: the hoard waits, and the bandits stay away for a while.</summary>
        public static List<GameEvent> Fallen(GameState state, ContentDb content, string poiId, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            if (!content.Camps.TryGetValue(poiId, out var def)) return events;
            var camp = Of(state, poiId);
            camp.ReturnMonth = state.Calendar.MonthIndex + def.RespawnMonths;
            camp.HoardReady = true;
            camp.TimesCleared += 1;
            state.Player.Counters.CampsCleared += 1;
            events.Add(GameEvent.Major("camp_fallen", $"{def.Name} đã bị dẹp! Kho tang vật nằm trong trại, chờ ngươi mở.",
                $"The {def.NameEn} has fallen! Its hoard waits in the camp for you to open."));
            if (rng.Chance(def.CaptiveChance))
            {
                Karma.Add(state.Player, 3);
                state.Player.Reputation += 5;
                events.Add(GameEvent.Info("camp_captive", "Sau lều, ngươi cởi trói cho một người lái buôn bị bắt làm con tin. Hắn rối rít cảm tạ rồi chạy về làng. Nhân quả +3.",
                    "Behind a tent you untie a merchant held for ransom. He thanks you again and again and runs for the village. Karma +3."));
            }
            NpcSim.AddRumor(state, new List<Rumor>(), "camp_fallen", null,
                $"{state.Player.Name} đã một mình dẹp {def.Name}.", $"{state.Player.Name} broke the {def.NameEn} single-handed.");
            return events;
        }

        /// <summary>The hoard of a fallen camp: silver, spirit stones and whatever they took from the road.</summary>
        public static List<GameEvent> OpenHoard(GameState state, ContentDb content, PoiDef poi, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            if (!content.Camps.TryGetValue(poi.Id, out var def)) return events;
            var camp = Of(state, poi.Id);
            if (!camp.HoardReady) return events;
            camp.HoardReady = false;
            var roll = Loot.Roll(content, def.Hoard, 2, rng, maxItems: 3);
            Inventory.Apply(state, content, roll);
            var parts = new List<(string Vi, string En)> { ($"{roll.Silver} bạc", $"{roll.Silver} silver") };
            if (roll.SpiritStones > 0) parts.Add(($"{roll.SpiritStones} linh thạch", $"{roll.SpiritStones} spirit stones"));
            parts.AddRange(roll.Items.Select(s => ($"{s.Name} ×{s.Qty}", $"{s.NameEn} ×{s.Qty}")));
            events.Add(GameEvent.Major("camp_hoard", $"Kho tang của {def.Name}: {string.Join(", ", parts.Select(x => x.Vi))}.",
                $"The {def.NameEn}'s hoard: {string.Join(", ", parts.Select(x => x.En))}."));
            return events;
        }
    }
}
