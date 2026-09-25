using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Gear (the web game's equipment.ts and enhancement.ts): a weapon, armour and an accessory, each worn in its
    /// slot. The village forge enhances a slot from +1 to +10 for silver and enhancement stones. Whatever is worn
    /// there gains 10% of its bonuses per level, and the slot's own tempering adds a flat bonus (attack for the
    /// weapon, defense for armour, resistance for the accessory), so a better find keeps the work already done.
    /// A failed attempt keeps the level but uses up the silver and the stones.
    /// </summary>
    public static class Equipment
    {
        public const string Weapon = "Weapon";
        public const string Chest = "Chest";
        public const string Accessory = "Accessory";

        /// <summary>The slots, in the order the bag and the forge list them.</summary>
        public static readonly string[] Slots = { Weapon, Chest, Accessory };

        public const int MaxLevel = 10;

        public const string StoneCommon = "enhancement_stone_common";
        public const string StoneUncommon = "enhancement_stone_uncommon";
        public const string StoneRare = "enhancement_stone_rare";
        public const string StoneEpic = "enhancement_stone_epic";

        /// <summary>What a slot's tempering adds by itself, per level, while something is worn there.</summary>
        public const double FlatPerLevel = 2;

        /// <summary>What the next level of a slot costs, and its odds.</summary>
        public sealed class Step
        {
            public Step(int silver, string stoneId, int stones, double chance)
            {
                Silver = silver;
                StoneId = stoneId;
                Stones = stones;
                Chance = chance;
            }

            public int Silver { get; }
            public string StoneId { get; }
            public int Stones { get; }
            public double Chance { get; }
        }

        // The web game's ENHANCEMENT_CONFIG and ENHANCEMENT_MATERIALS, level by level.
        private static readonly Step[] Steps =
        {
            new Step(100, StoneCommon, 1, 1.0),
            new Step(200, StoneCommon, 2, 1.0),
            new Step(400, StoneCommon, 3, 0.95),
            new Step(800, StoneUncommon, 1, 0.9),
            new Step(1500, StoneUncommon, 2, 0.85),
            new Step(3000, StoneUncommon, 3, 0.75),
            new Step(5000, StoneRare, 1, 0.65),
            new Step(8000, StoneRare, 2, 0.55),
            new Step(12000, StoneRare, 3, 0.45),
            new Step(20000, StoneEpic, 1, 0.35),
        };

        /// <summary>The cost of taking a slot at <paramref name="level"/> one step higher, or null at +10.</summary>
        public static Step? Next(int level) => level >= MaxLevel ? null : Steps[Math.Max(0, level)];

        /// <summary>How much of an item's bonuses a slot at <paramref name="level"/> gives: +10% a level.</summary>
        public static double Multiplier(int level) => 1 + 0.1 * level;

        /// <summary>An item bonus of <paramref name="baseValue"/> worn in a slot at <paramref name="level"/> (rounded up, so +1 always shows).</summary>
        public static int Scaled(double baseValue, int level) =>
            baseValue <= 0 ? (int)Math.Round(baseValue) : (int)Math.Ceiling(baseValue * Multiplier(level) - 1e-9);

        /// <summary>The bonus key a slot's tempering adds to.</summary>
        public static string FlatKey(string slot) => slot switch
        {
            Weapon => "atk",
            Chest => "def",
            _ => "res",
        };

        public static string SlotName(string slot, Locale locale) => slot switch
        {
            Weapon => locale == Locale.En ? "Weapon" : "Binh khí",
            Chest => locale == Locale.En ? "Armor" : "Giáp y",
            _ => locale == Locale.En ? "Accessory" : "Trang sức",
        };

        /// <summary>The slot an item is worn in, if it is gear the game has a slot for.</summary>
        public static string? SlotFor(ItemDef? def) => def?.EquipmentSlot is { } s && Slots.Contains(s) ? s : null;

        public static GearSlot Slot(PlayerState p, string slot)
        {
            if (!p.Gear.TryGetValue(slot, out var g)) p.Gear[slot] = g = new GearSlot();
            return g;
        }

        public static bool IsWorn(PlayerState p, string itemId) => p.Gear.Values.Any(g => g.ItemId == itemId);

        /// <summary>One bonus of everything worn (str, agi, int, perception, luck, atk, def, res, hp, qi), enhancement included.</summary>
        public static double Bonus(ContentDb content, PlayerState p, string key)
        {
            double total = 0;
            foreach (var pair in p.Gear) total += SlotBonus(content, pair.Key, pair.Value, key);
            return total;
        }

        /// <summary>One bonus of the item worn in a slot, as it stands at <paramref name="level"/> (the slot's own level if null).</summary>
        public static double SlotBonus(ContentDb content, string slot, GearSlot g, string key, int? level = null)
        {
            if (g.ItemId == null) return 0;
            var lv = level ?? g.Level;
            double total = 0;
            var def = content.Item(g.ItemId);
            if (def?.BonusStats != null && def.BonusStats.TryGetValue(key, out var v)) total += Scaled(v, lv);
            if (FlatKey(slot) == key) total += FlatPerLevel * lv;
            return total;
        }

        /// <summary>Everything the item in a slot gives at <paramref name="level"/>, for the bag and the forge to show.</summary>
        public static List<KeyValuePair<string, double>> SlotBonuses(ContentDb content, string slot, GearSlot g, int? level = null)
        {
            var keys = new List<string>();
            var def = content.Item(g.ItemId);
            if (def?.BonusStats != null) keys.AddRange(def.BonusStats.Keys);
            if (!keys.Contains(FlatKey(slot))) keys.Add(FlatKey(slot));
            return keys
                .Select(k => new KeyValuePair<string, double>(k, SlotBonus(content, slot, g, k, level)))
                .Where(kv => Math.Abs(kv.Value) > 1e-9)
                .ToList();
        }

        /// <summary>
        /// Bring a slot's share of max health and Qi up to date (after equipping, removing or enhancing). A mortal
        /// has no Qi to hold, so Qi from gear waits for Qi Condensation.
        /// </summary>
        public static void Refresh(ContentDb content, PlayerState p, string slot)
        {
            var g = Slot(p, slot);
            var hp = (int)SlotBonus(content, slot, g, "hp");
            var qi = p.Realm == Realm.PhamNhan ? 0 : (int)SlotBonus(content, slot, g, "qi");
            p.HpMax += hp - g.AppliedHp;
            p.QiMax += qi - g.AppliedQi;
            g.AppliedHp = hp;
            g.AppliedQi = qi;
            p.Hp = Math.Min(p.Hp, p.HpMax);
            p.Qi = Math.Min(p.Qi, p.QiMax);
        }

        public static void RefreshAll(ContentDb content, PlayerState p)
        {
            foreach (var slot in p.Gear.Keys.ToList()) Refresh(content, p, slot);
        }

        /// <summary>The last of a worn item left the bag (sold, given, taken by an event): the slot empties.</summary>
        public static void Lost(PlayerState p, string itemId)
        {
            foreach (var g in p.Gear.Values.Where(g => g.ItemId == itemId))
            {
                p.HpMax -= g.AppliedHp;
                p.QiMax -= g.AppliedQi;
                g.AppliedHp = g.AppliedQi = 0;
                g.ItemId = null;
            }
            p.Hp = Math.Min(p.Hp, p.HpMax);
            p.Qi = Math.Min(p.Qi, p.QiMax);
        }

        public static List<GameEvent> Equip(ContentDb content, PlayerState p, string itemId)
        {
            var events = new List<GameEvent>();
            var def = content.Item(itemId);
            var slot = SlotFor(def);
            if (def == null || slot == null || Inventory.Count(p, itemId) <= 0) return events;
            var g = Slot(p, slot);
            if (g.ItemId == itemId) return events;
            g.ItemId = itemId;
            Refresh(content, p, slot);
            events.Add(GameEvent.Info("equipped", $"Trang bị {def.Name}.", $"Equipped {def.NameEn}."));
            return events;
        }

        public static List<GameEvent> Unequip(ContentDb content, PlayerState p, string slot)
        {
            var events = new List<GameEvent>();
            if (!p.Gear.TryGetValue(slot, out var g) || g.ItemId == null) return events;
            var def = content.Item(g.ItemId);
            g.ItemId = null;
            Refresh(content, p, slot);
            if (def != null) events.Add(GameEvent.Info("unequipped", $"Tháo {def.Name}.", $"Took off {def.NameEn}."));
            return events;
        }

        /// <summary>Enhance a slot one level at the forge: pay the silver and the stones, then the odds decide.</summary>
        public static List<GameEvent> Enhance(ContentDb content, PlayerState p, string slot, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var g = Slot(p, slot);
            var step = Next(g.Level);
            string vi = SlotName(slot, Locale.Vi), en = SlotName(slot, Locale.En);
            if (step == null)
            {
                events.Add(GameEvent.Info("enhance_max", $"{vi} đã cường hóa tối đa (+{MaxLevel}).", $"Your {en.ToLowerInvariant()} slot is fully enhanced (+{MaxLevel})."));
                return events;
            }
            if (g.ItemId == null)
            {
                events.Add(GameEvent.Info("enhance_empty", $"Ô {vi.ToLowerInvariant()} đang trống: hãy trang bị một món trước.", $"Your {en.ToLowerInvariant()} slot is empty: wear something there first."));
                return events;
            }
            if (p.Silver < step.Silver)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            if (Inventory.Count(p, step.StoneId) < step.Stones)
            {
                events.Add(GameEvent.Info("enhance_stones", "Thiếu đá cường hóa.", "Not enough enhancement stones."));
                return events;
            }
            p.Silver -= step.Silver;
            Inventory.Remove(p, step.StoneId, step.Stones);
            if (rng.Chance(step.Chance))
            {
                g.Level += 1;
                Refresh(content, p, slot);
                events.Add(GameEvent.Major("enhanced", $"Cường hóa thành công: {vi} +{g.Level}!", $"Enhancement succeeded: {en} +{g.Level}!"));
            }
            else
            {
                events.Add(GameEvent.Warn("enhance_failed", $"Cường hóa thất bại: bạc và đá đã mất, {vi.ToLowerInvariant()} vẫn +{g.Level}.",
                    $"The enhancement failed: the silver and stones are spent, and your {en.ToLowerInvariant()} stays +{g.Level}."));
            }
            return events;
        }

        /// <summary>What the forge sells: common stones for silver, the rarer ones only for spirit stones.</summary>
        public static readonly (string StoneId, int Silver, int SpiritStones)[] ForgeStock =
        {
            (StoneCommon, 60, 0),
            (StoneUncommon, 0, 5),
            (StoneRare, 0, 15),
            (StoneEpic, 0, 50),
        };

        public static List<GameEvent> BuyStone(ContentDb content, PlayerState p, string stoneId)
        {
            var events = new List<GameEvent>();
            var offer = ForgeStock.FirstOrDefault(s => s.StoneId == stoneId);
            var def = content.Item(stoneId);
            if (offer.StoneId == null || def == null) return events;
            if (p.Silver < offer.Silver || p.SpiritStones < offer.SpiritStones)
            {
                events.Add(GameEvent.Info("poor", offer.SpiritStones > 0 ? "Không đủ linh thạch." : "Không đủ bạc.",
                    offer.SpiritStones > 0 ? "Not enough spirit stones." : "Not enough silver."));
                return events;
            }
            p.Silver -= offer.Silver;
            p.SpiritStones -= offer.SpiritStones;
            Inventory.Add(p, Inventory.StackOf(def, 1));
            var price = offer.SpiritStones > 0 ? $"{offer.SpiritStones} linh thạch" : $"{offer.Silver} bạc";
            var priceEn = offer.SpiritStones > 0 ? $"{offer.SpiritStones} spirit stones" : $"{offer.Silver} silver";
            events.Add(GameEvent.Info("bought", $"Mua {def.Name} (−{price}).", $"Bought {def.NameEn} (−{priceEn})."));
            return events;
        }
    }
}
