using System.Collections.Generic;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Things that are opened rather than worn or eaten: a storage ring a fallen cultivator carried, a treasure
    /// pouch. Opening one rolls a loot table into the bag.
    /// </summary>
    public static class Containers
    {
        public static bool IsStorageRing(ItemDef def) => def.Effects != null && def.Effects.ContainsKey("storage_capacity");

        /// <summary>A ring (or pendant) that holds things: its seal is broken to empty it, and it's never worn.</summary>
        public static bool IsSealed(ItemDef def) => IsStorageRing(def) || def.EquipmentSlot == "Accessory" && def.OpenLoot != null;

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
