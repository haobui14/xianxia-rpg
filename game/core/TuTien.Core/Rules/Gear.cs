using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    public enum GearSlot
    {
        Weapon,
        Armor,
        Accessory,
    }

    /// <summary>What refining an item one level more takes, and its odds.</summary>
    public readonly struct RefineCost
    {
        public readonly int Level;
        public readonly int Silver;
        public readonly string StoneId;
        public readonly int Stones;
        public readonly double Chance;

        public RefineCost(int level, int silver, string stoneId, int stones, double chance)
        {
            Level = level;
            Silver = silver;
            StoneId = stoneId;
            Stones = stones;
            Chance = chance;
        }
    }

    /// <summary>
    /// What a cultivator carries on them: a weapon, armor (the web game's "Chest" slot) and an accessory, whose
    /// bonus stats all count; refining gear with enhancement stones (the web game's enhancement rules); and the
    /// things that are opened rather than worn — storage rings a fallen cultivator carried, treasure pouches.
    /// </summary>
    public static class Gear
    {
        public const int MaxRefine = 10;

        /// <summary>Where an item goes on the body, if it's worn at all.</summary>
        public static GearSlot? SlotOf(ItemDef? def)
        {
            if (def == null) return null;
            switch (def.EquipmentSlot)
            {
                case "Weapon":
                    return GearSlot.Weapon;
                case "Chest":
                case "Armor":
                    return GearSlot.Armor;
                case "Accessory":
                    // A storage ring holds things rather than lending power: it's opened, not worn.
                    return IsSealed(def) ? (GearSlot?)null : GearSlot.Accessory;
                default:
                    return null;
            }
        }

        public static bool IsStorageRing(ItemDef def) => def.Effects != null && def.Effects.ContainsKey("storage_capacity");

        /// <summary>A ring (or pendant) that holds things: its seal is broken to empty it.</summary>
        public static bool IsSealed(ItemDef def) => IsStorageRing(def) || def.EquipmentSlot == "Accessory" && def.OpenLoot != null;

        public static string? Equipped(PlayerState p, GearSlot slot) => slot switch
        {
            GearSlot.Weapon => p.WeaponId,
            GearSlot.Armor => p.ArmorId,
            _ => p.AccessoryId,
        };

        private static void Set(PlayerState p, GearSlot slot, string? id)
        {
            switch (slot)
            {
                case GearSlot.Weapon:
                    p.WeaponId = id;
                    break;
                case GearSlot.Armor:
                    p.ArmorId = id;
                    break;
                default:
                    p.AccessoryId = id;
                    break;
            }
        }

        public static bool IsEquipped(PlayerState p, string itemId) => p.WeaponId == itemId || p.ArmorId == itemId || p.AccessoryId == itemId;

        public static int RefineLevel(PlayerState p, string? itemId) => itemId != null && p.Refines.TryGetValue(itemId, out var l) ? l : 0;

        /// <summary>
        /// A stat on refined gear: +10% a level (the web game's rate), and never less than +1 a level, so a
        /// small bonus grows too.
        /// </summary>
        public static int Refined(double value, int level) =>
            value <= 0 || level <= 0 ? (int)Math.Round(value) : (int)Math.Round(value + Math.Max(level, value * 0.1 * level));

        /// <summary>One stat from everything worn (bonus_stats keys: str, agi, int, perception, luck, hp, qi, atk).</summary>
        public static int Bonus(ContentDb content, PlayerState p, string key)
        {
            var total = 0;
            foreach (var id in new[] { p.WeaponId, p.ArmorId, p.AccessoryId })
            {
                var def = content.Item(id);
                if (def?.BonusStats == null || !def.BonusStats.TryGetValue(key, out var v)) continue;
                total += Refined(v, RefineLevel(p, id));
            }
            return total;
        }

        /// <summary>An item's bonus stats at a refine level, for showing.</summary>
        public static IEnumerable<(string Key, int Value)> Stats(ItemDef def, int level) =>
            def.BonusStats == null ? Enumerable.Empty<(string, int)>() : def.BonusStats.Select(kv => (kv.Key, Refined(kv.Value, level)));

        /// <summary>
        /// Max health and Qi from gear are part of the stored maxima, kept in step whenever what's worn (or its
        /// refinement) changes; what's already counted is remembered, so this is safe to call any time.
        /// </summary>
        public static void Recompute(GameState state, ContentDb content)
        {
            var p = state.Player;
            var hp = Bonus(content, p, "hp");
            var qi = Bonus(content, p, "qi");
            var dHp = hp - p.GearHp;
            var dQi = qi - p.GearQi;
            p.HpMax = Math.Max(1, p.HpMax + dHp);
            p.QiMax = Math.Max(0, p.QiMax + dQi);
            p.Hp = Math.Max(1, Math.Min(p.HpMax, p.Hp + Math.Max(0, dHp)));
            p.Qi = Math.Max(0, Math.Min(p.QiMax, p.Qi + Math.Max(0, dQi)));
            p.GearHp = hp;
            p.GearQi = qi;
        }

        public static List<GameEvent> Equip(GameState state, ContentDb content, string itemId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var def = content.Item(itemId);
            var slot = SlotOf(def);
            if (def == null || slot == null || Inventory.Count(p, itemId) <= 0) return events;
            Set(p, slot.Value, itemId);
            Recompute(state, content);
            events.Add(GameEvent.Info("equipped", $"Trang bị {def.Name}.", $"Equipped {def.NameEn}."));
            return events;
        }

        public static List<GameEvent> Unequip(GameState state, ContentDb content, GearSlot slot)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var def = content.Item(Equipped(p, slot));
            if (def == null) return events;
            Set(p, slot, null);
            Recompute(state, content);
            events.Add(GameEvent.Info("unequipped", $"Tháo {def.Name}.", $"Took off {def.NameEn}."));
            return events;
        }

        /// <summary>An item leaving the bag (sold, given): if the last one was worn, it comes off first.</summary>
        public static void Released(GameState state, ContentDb content, string itemId)
        {
            var p = state.Player;
            if (Inventory.Count(p, itemId) > 0) return;
            foreach (var slot in new[] { GearSlot.Weapon, GearSlot.Armor, GearSlot.Accessory })
                if (Equipped(p, slot) == itemId) Set(p, slot, null);
            p.Refines.Remove(itemId);
            Recompute(state, content);
        }

        // ------------------------------------------------------------ refining (the web game's enhancement table)

        private static readonly (int Silver, double Chance)[] RefineSteps =
        {
            (100, 1.0), (200, 1.0), (400, 0.95), (800, 0.9), (1500, 0.85), (3000, 0.75), (5000, 0.65), (8000, 0.55), (12000, 0.45), (20000, 0.35),
        };

        private static readonly (string Stone, int Qty)[] RefineStones =
        {
            ("enhancement_stone_common", 1), ("enhancement_stone_common", 2), ("enhancement_stone_common", 3),
            ("enhancement_stone_uncommon", 1), ("enhancement_stone_uncommon", 2), ("enhancement_stone_uncommon", 3),
            ("enhancement_stone_rare", 1), ("enhancement_stone_rare", 2), ("enhancement_stone_rare", 3),
            ("enhancement_stone_epic", 1),
        };

        /// <summary>What the next level of <paramref name="itemId"/> takes (null at the top).</summary>
        public static RefineCost? NextRefine(PlayerState p, string? itemId)
        {
            if (itemId == null) return null;
            var level = RefineLevel(p, itemId) + 1;
            if (level > MaxRefine) return null;
            var (silver, chance) = RefineSteps[level - 1];
            var (stone, qty) = RefineStones[level - 1];
            return new RefineCost(level, silver, stone, qty, chance);
        }

        public static bool CanAfford(PlayerState p, RefineCost cost) => p.Silver >= cost.Silver && Inventory.Count(p, cost.StoneId) >= cost.Stones;

        /// <summary>
        /// Refine the gear in <paramref name="slot"/> one level: silver and stones are spent either way; on a
        /// failure the level stays where it was (nothing is ever destroyed).
        /// </summary>
        public static List<GameEvent> Refine(GameState state, ContentDb content, GearSlot slot, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var id = Equipped(p, slot);
            var def = content.Item(id);
            if (id == null || def == null || NextRefine(p, id) is not { } cost) return events;
            var stone = content.Item(cost.StoneId);
            if (!CanAfford(p, cost))
            {
                events.Add(GameEvent.Info("refine_poor", $"Cần {cost.Silver} bạc và {cost.Stones} {stone?.Name ?? cost.StoneId}.",
                    $"Needs {cost.Silver} silver and {cost.Stones} × {stone?.NameEn ?? cost.StoneId}."));
                return events;
            }
            p.Silver -= cost.Silver;
            Inventory.Remove(p, cost.StoneId, cost.Stones);
            if (!rng.Chance(cost.Chance))
            {
                events.Add(GameEvent.Warn("refine_failed", $"Luyện {def.Name} thất bại — đá và bạc đã tiêu, cấp vẫn giữ.",
                    $"Refining the {def.NameEn} failed — the stones and silver are spent, the level holds."));
                return events;
            }
            p.Refines[id] = cost.Level;
            Recompute(state, content);
            events.Add(GameEvent.Major("refined", $"Luyện thành {def.Name} +{cost.Level}!", $"The {def.NameEn} is refined to +{cost.Level}!"));
            return events;
        }

        // ------------------------------------------------------------ opening

        /// <summary>The loot table a container is opened into, or null when the item isn't one.</summary>
        public static string? OpensInto(ItemDef? def)
        {
            if (def == null) return null;
            if (def.OpenLoot != null) return def.OpenLoot;
            if (!IsStorageRing(def)) return null;
            // A ring holds what its owner could keep: the finer the ring, the richer the owner.
            return def.Rarity switch
            {
                "Legendary" => "vong_linh_spirit",
                "Epic" => "ancient_treasure",
                "Rare" => "dungeon_boss",
                _ => "cave_treasure",
            };
        }

        public static List<GameEvent> Open(GameState state, ContentDb content, string itemId, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var def = content.Item(itemId);
            var table = OpensInto(def);
            if (def == null || table == null || !Inventory.Remove(p, itemId)) return events;
            var tier = content.LootTables.TryGetValue(content.ResolveLootTable(table), out var t) ? t.Tier : 1;
            var roll = Loot.Roll(content, table, tier, rng);
            Inventory.Apply(state, content, roll);
            var found = new List<string>();
            var foundEn = new List<string>();
            if (roll.Silver > 0)
            {
                found.Add($"{roll.Silver} bạc");
                foundEn.Add($"{roll.Silver} silver");
            }
            if (roll.SpiritStones > 0)
            {
                found.Add($"{roll.SpiritStones} linh thạch");
                foundEn.Add($"{roll.SpiritStones} spirit stone{(roll.SpiritStones == 1 ? "" : "s")}");
            }
            foreach (var s in roll.Items)
            {
                found.Add($"{s.Name} ×{s.Qty}");
                foundEn.Add($"{s.NameEn} ×{s.Qty}");
            }
            var vi = found.Count > 0 ? string.Join(", ", found) : "trống rỗng";
            var en = foundEn.Count > 0 ? string.Join(", ", foundEn) : "nothing";
            events.Add(GameEvent.Info("item_gained", IsSealed(def) ? $"Phá phong ấn {def.Name}: {vi}." : $"Mở {def.Name}: {vi}.",
                IsSealed(def) ? $"You break the {def.NameEn}'s seal: {en}." : $"You open the {def.NameEn}: {en}."));
            return events;
        }
    }
}
