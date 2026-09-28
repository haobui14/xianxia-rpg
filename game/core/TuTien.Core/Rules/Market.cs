using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Wares that change (the web game's monthly market): each month a town's stall lays out a few goods drawn
    /// from the region's loot, and a merchant caravan met on the road opens its own, finer ones. Common and
    /// uncommon goods cost silver; rare and better only spirit stones. The same month always shows the same
    /// wares, and each is sold out once its stock is gone.
    /// </summary>
    public static class Market
    {
        /// <summary>Set by the merchant caravan's "browse their goods": the caravan's wares open.</summary>
        public const string CaravanFlag = "merchant_encounter";
        public const string CaravanKey = "caravan";
        public const int WaresPerMonth = 4;

        private static readonly string[] TownTables = { "thanh_van_wilds", "bandit_loot", "cave_treasure" };
        private static readonly string[] CaravanTables = { "cave_treasure", "dungeon_boss", "hoa_son_volcanic" };

        /// <summary>What a good of <paramref name="rarity"/> costs, and how many the stall holds.</summary>
        private static (int Silver, int Stones, int Qty) Price(string rarity, Pcg32 rng) => rarity switch
        {
            "Legendary" => (0, rng.Range(80, 110), 1),
            "Epic" => (0, rng.Range(30, 45), 1),
            "Rare" => (0, rng.Range(9, 15), 1),
            "Uncommon" => (rng.Range(110, 180), 0, 2),
            _ => (rng.Range(25, 45), 0, 3),
        };

        /// <summary>This month's wares at a town's stall (<paramref name="townId"/> is its area id).</summary>
        public static MarketState Wares(GameState state, ContentDb content, string townId) =>
            Laid(state, content, townId, TownTables, exclude: content.Towns.TryGetValue(townId, out var t) ? t.Shop.Select(s => s.ItemId) : null);

        /// <summary>The merchant caravan's wares this month.</summary>
        public static MarketState Caravan(GameState state, ContentDb content) => Laid(state, content, CaravanKey, CaravanTables, exclude: null);

        private static MarketState Laid(GameState state, ContentDb content, string key, string[] tables, IEnumerable<string>? exclude)
        {
            var month = state.Calendar.MonthIndex;
            if (state.World.Markets.TryGetValue(key, out var m) && m.Month == month) return m;
            m = new MarketState { Month = month };
            state.World.Markets[key] = m;

            var skip = new HashSet<string>(exclude ?? Enumerable.Empty<string>());
            var rng = Seeds.Stream(state.Seed, "market:" + key, month);
            for (var tries = 0; tries < 24 && m.Offers.Count < WaresPerMonth; tries++)
            {
                var roll = Loot.Roll(content, tables[tries % tables.Length], 1, rng, maxItems: 2);
                foreach (var stack in roll.Items)
                {
                    var def = content.Item(stack.Id);
                    if (def == null || skip.Contains(stack.Id) || m.Offers.Any(o => o.ItemId == stack.Id)) continue;
                    var (silver, stones, qty) = Price(def.Rarity, rng);
                    m.Offers.Add(new MarketOffer { ItemId = stack.Id, Silver = silver, SpiritStones = stones, Left = qty });
                    if (m.Offers.Count >= WaresPerMonth) break;
                }
            }
            return m;
        }

        public static List<GameEvent> Buy(GameState state, ContentDb content, MarketState market, int index)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (index < 0 || index >= market.Offers.Count) return events;
            var offer = market.Offers[index];
            var def = content.Item(offer.ItemId);
            if (def == null) return events;
            if (offer.Left <= 0)
            {
                events.Add(GameEvent.Info("sold_out", "Đã bán hết.", "Sold out."));
                return events;
            }
            if (p.Silver < offer.Silver || p.SpiritStones < offer.SpiritStones)
            {
                events.Add(GameEvent.Info("poor", offer.SpiritStones > 0 ? "Không đủ linh thạch." : "Không đủ bạc.",
                    offer.SpiritStones > 0 ? "Not enough spirit stones." : "Not enough silver."));
                return events;
            }
            p.Silver -= offer.Silver;
            p.SpiritStones -= offer.SpiritStones;
            offer.Left -= 1;
            Inventory.Add(p, Inventory.StackOf(def, 1));
            var price = offer.SpiritStones > 0 ? $"{offer.SpiritStones} linh thạch" : $"{offer.Silver} bạc";
            var priceEn = offer.SpiritStones > 0 ? $"{offer.SpiritStones} spirit stones" : $"{offer.Silver} silver";
            events.Add(GameEvent.Info("bought", $"Mua {def.Name} (−{price}).", $"Bought {def.NameEn} (−{priceEn})."));
            return events;
        }
    }
}
