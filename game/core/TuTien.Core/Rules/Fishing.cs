using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>What took the bait: a fish (and how hard it will fight), or something sunken.</summary>
    public sealed class Bite
    {
        public string SpotId { get; set; } = "";
        /// <summary>The fish, as an item id; null when the hook snags something sunken.</summary>
        public string? ItemId { get; set; }
        /// <summary>For something sunken: the loot table it is rolled from.</summary>
        public string? Loot { get; set; }
        /// <summary>0–1: how fast it swims and how narrow the chance to hold it.</summary>
        public double Difficulty { get; set; }
        /// <summary>0–1: how often it darts away.</summary>
        public double Dart { get; set; }
        /// <summary>It may be let go (for karma, or a spirit turtle's blessing).</summary>
        public bool CanRelease { get; set; }
    }

    /// <summary>
    /// Fishing at the river landings and the marsh. A cast spends footwork and rolls what bites from the spot's
    /// catches (by season; a lucky fortune stick doubles the rare ones). The host plays the strike and the reel
    /// and then lands the catch here, or lets it go.
    /// </summary>
    public static class Fishing
    {
        public const int CastFootwork = 1;

        /// <summary>1–10: steadier hands with every eight fish landed.</summary>
        public static int Level(PlayerState p) => Math.Min(10, 1 + p.Counters.FishCaught / 8);

        private static bool Rare(ContentDb content, CatchDef c) =>
            c.Item != null && content.Item(c.Item)?.Rarity is "Rare" or "Epic" or "Legendary";

        /// <summary>What can bite at a spot this month, and how likely each is.</summary>
        public static List<(CatchDef Catch, double Weight)> Pool(GameState state, ContentDb content, FishSpotDef spot)
        {
            var season = Calendar.SeasonOf(content, state.Calendar.Month);
            var lucky = Shrine.Current(state, content)?.LuckyCatch == true;
            return spot.Catches
                .Where(c => c.Seasons == null || c.Seasons.Contains(season))
                .Select(c => (c, c.Weight * (lucky && Rare(content, c) ? 2 : 1)))
                .ToList();
        }

        public static Bite? Roll(GameState state, ContentDb content, FishSpotDef spot, Pcg32 rng)
        {
            var pool = Pool(state, content, spot);
            var i = rng.WeightedIndex(pool.Select(x => x.Weight).ToList());
            if (i < 0) return null;
            var c = pool[i].Catch;
            if (c.Item == null) return new Bite { SpotId = spot.Poi, Loot = c.Loot, Difficulty = 0.2, Dart = 0.05 };
            var fish = content.Fish.TryGetValue(c.Item, out var f) ? f : new FishDef { Item = c.Item };
            return new Bite
            {
                SpotId = spot.Poi, ItemId = c.Item, Difficulty = fish.Difficulty, Dart = fish.Dart,
                CanRelease = fish.ReleaseKarma > 0 || fish.ReleaseLifespan > 0,
            };
        }

        /// <summary>The catch is in: into the bag, or (for the few that may be let go) back into the water.</summary>
        public static List<GameEvent> Land(GameState state, ContentDb content, Bite bite, bool release, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (bite.ItemId == null)
            {
                // A clay jar wrapped in weeds, a drowned purse: whatever the river kept.
                var roll = Loot.Roll(content, bite.Loot, 1, rng, maxItems: 1);
                Inventory.Apply(state, content, roll);
                var items = roll.Items.Select(s => (s.Name, s.NameEn, s.Qty)).ToList();
                var vi = string.Join(", ", new[] { roll.Silver > 0 ? $"{roll.Silver} bạc" : null, roll.SpiritStones > 0 ? $"{roll.SpiritStones} linh thạch" : null }
                    .Concat(items.Select(x => $"{x.Name} ×{x.Qty}")).Where(x => x != null));
                var en = string.Join(", ", new[] { roll.Silver > 0 ? $"{roll.Silver} silver" : null, roll.SpiritStones > 0 ? $"{roll.SpiritStones} spirit stones" : null }
                    .Concat(items.Select(x => $"{x.NameEn} ×{x.Qty}")).Where(x => x != null));
                events.Add(GameEvent.Info("fish_sunken", $"Lưỡi câu vướng một chiếc vò sành cũ quấn rong rêu. Bên trong: {vi}.",
                    $"The hook snags an old clay jar wrapped in weeds. Inside: {en}."));
                return events;
            }

            var def = content.Item(bite.ItemId);
            if (def == null) return events;
            p.Counters.FishCaught += 1;
            p.Counters.Catches[def.Id] = (p.Counters.Catches.TryGetValue(def.Id, out var n) ? n : 0) + 1;
            if (release && bite.CanRelease && content.Fish.TryGetValue(def.Id, out var fish))
            {
                Karma.Add(p, fish.ReleaseKarma);
                p.LifespanSpecial += fish.ReleaseLifespan;
                var years = fish.ReleaseLifespan > 0 ? $" Thọ nguyên +{fish.ReleaseLifespan} năm." : "";
                var yearsEn = fish.ReleaseLifespan > 0 ? $" Lifespan +{fish.ReleaseLifespan} year{(fish.ReleaseLifespan > 1 ? "s" : "")}." : "";
                events.Add(GameEvent.Major("fish_released",
                    $"Ngươi thả {def.Name} về nước. Nó quẫy đuôi như cảm tạ rồi lặn mất. Nhân quả +{fish.ReleaseKarma}.{years}",
                    $"You let the {def.NameEn} go. It flicks its tail as if in thanks and slips away. Karma +{fish.ReleaseKarma}.{yearsEn}"));
                return events;
            }
            Inventory.Apply(state, content, new LootRoll { Items = { Inventory.StackOf(def, 1) } });
            var rare = def.Rarity is "Rare" or "Epic" or "Legendary";
            events.Add(rare
                ? GameEvent.Major("fish_caught", $"Câu được {def.Name}! Hiếm thấy lắm.", $"Caught: {def.NameEn}! A rare catch.")
                : GameEvent.Info("fish_caught", $"Câu được {def.Name}.", $"Caught: {def.NameEn}."));
            return events;
        }
    }
}
