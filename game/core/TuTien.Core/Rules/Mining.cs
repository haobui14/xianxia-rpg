using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Ore veins in the hills and the mountains. The host counts the sword strikes; when a vein breaks it gives one
    /// to three pieces (one more under a rich-vein fortune) and needs three months before it is worth mining again.
    /// The forge smelts the ore into enhancement stones.
    /// </summary>
    public static class Mining
    {
        public const int RegrowMonths = 3;
        public const int DefaultStrikes = 4;
        public const int Footwork = 1;

        /// <summary>How many sword strikes a vein takes to break.</summary>
        public static int Strikes(PoiDef vein) => vein.Hardness > 0 ? vein.Hardness : DefaultStrikes;

        /// <summary>At the forge: so many pieces of ore and silver for one enhancement stone.</summary>
        public static readonly (string Ore, int Qty, string Stone, int Silver)[] Smelts =
        {
            ("iron_ore", 5, "enhancement_stone_common", 20),
            ("cold_iron", 3, "enhancement_stone_uncommon", 60),
        };

        public static List<GameEvent> Mine(GameState state, ContentDb content, PoiDef vein, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var roll = Loot.Roll(content, vein.LootTable, 1, rng, maxItems: 3);
            roll.Silver = 0;
            if (Shrine.Current(state, content)?.RichVein == true)
            {
                var extra = Loot.Roll(content, vein.LootTable, 1, rng, maxItems: 1).Items.FirstOrDefault();
                if (extra != null)
                {
                    var same = roll.Items.FirstOrDefault(s => s.Id == extra.Id);
                    if (same != null) same.Qty += extra.Qty;
                    else roll.Items.Add(extra);
                }
            }
            Inventory.Apply(state, content, roll);
            Spawns.Deplete(state, vein.Id, RegrowMonths);
            state.Player.Counters.OreMined += roll.Items.Sum(s => s.Qty);
            var vi = string.Join(", ", roll.Items.Select(s => $"{s.Name} ×{s.Qty}"));
            var en = string.Join(", ", roll.Items.Select(s => $"{s.NameEn} ×{s.Qty}"));
            events.Add(GameEvent.Info("ore_mined", $"Mạch khoáng vỡ ra: {vi}.", $"The vein breaks open: {en}."));
            if (roll.SpiritStones > 0)
                events.Add(GameEvent.Info("ore_stones", $"Trong đá lẫn {roll.SpiritStones} linh thạch!", $"Spirit stones in the rock: {roll.SpiritStones}!"));
            return events;
        }

        public static List<GameEvent> Smelt(ContentDb content, PlayerState p, string oreId)
        {
            var events = new List<GameEvent>();
            var smelt = Smelts.FirstOrDefault(s => s.Ore == oreId);
            var ore = content.Item(oreId);
            var stone = content.Item(smelt.Stone);
            if (smelt.Ore == null || ore == null || stone == null) return events;
            if (Inventory.Count(p, oreId) < smelt.Qty)
            {
                events.Add(GameEvent.Info("smelt_short", $"Cần {smelt.Qty} {ore.Name}.", $"That takes {smelt.Qty} {ore.NameEn}."));
                return events;
            }
            if (p.Silver < smelt.Silver)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            Inventory.Remove(p, oreId, smelt.Qty);
            p.Silver -= smelt.Silver;
            Inventory.Add(p, Inventory.StackOf(stone, 1));
            events.Add(GameEvent.Info("smelted", $"Lò rèn luyện {smelt.Qty} {ore.Name} thành một {stone.Name} (−{smelt.Silver} bạc).",
                $"The forge smelts {smelt.Qty} {ore.NameEn} into an {stone.NameEn} (−{smelt.Silver} silver)."));
            return events;
        }
    }
}
