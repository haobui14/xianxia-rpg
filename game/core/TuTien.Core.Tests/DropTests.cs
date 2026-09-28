using TuTien.Core.Rules;

namespace TuTien.Core.Tests;

/// <summary>
/// Everything the world drops has a use: it's worn, eaten or read, opened (storage rings, treasure pouches), taken to
/// the forge or the furnace, or asked for by a villager — and a save holding the old nameless stubs gets real items.
/// </summary>
public class DropTests
{
    private static Content.ContentDb C => TestContent.Content;

    private static GameEngine Carrying(params (string Id, int Qty)[] items)
    {
        var e = TestContent.NewEngine();
        foreach (var (id, qty) in items) Inventory.Add(e.Player, Inventory.Resolve(C, id, qty));
        return e;
    }

    [Fact]
    public void Every_item_the_world_hands_out_is_a_real_item()
    {
        var issues = C.Validate().Where(i => i.Contains("unknown item") || i.Contains("unknown loot table")).ToList();
        Assert.True(issues.Count == 0, string.Join("\n", issues));
    }

    [Fact]
    public void Everything_that_drops_can_be_worn_used_opened_or_crafted_with()
    {
        var crafted = new HashSet<string>(C.Recipes.SelectMany(r => r.Ingredients).Select(i => i.Item)
            .Concat(Mining.Smelts.Select(s => s.Ore))
            .Concat(C.Towns.Values.SelectMany(t => t.Requests).Select(r => r.Item)));
        var useless = new List<string>();
        foreach (var id in C.LootTables.Values.SelectMany(t => t.Entries).Select(e => e.Id).Distinct())
        {
            var def = C.Item(id)!;
            var worn = Equipment.SlotFor(def) != null;
            var used = Inventory.IsConsumable(C, id) || Containers.OpensInto(def) != null;
            var forged = id.StartsWith("enhancement_stone");
            if (!worn && !used && !forged && !crafted.Contains(id)) useless.Add(id);
        }
        Assert.True(useless.Count == 0, "drops that do nothing: " + string.Join(", ", useless));
    }

    [Fact]
    public void Storage_rings_and_pouches_are_opened_not_worn()
    {
        var e = Carrying(("storage_ring_uncommon", 1), ("random_treasure", 2));
        Assert.Null(Equipment.SlotFor(C.Item("storage_ring_uncommon")));
        Assert.Empty(e.Equip("storage_ring_uncommon"));
        Assert.True(e.CanUse("storage_ring_uncommon") && e.CanUse("random_treasure"));
        var before = e.Player.Items.Sum(i => i.Qty) + e.Player.Silver;
        var ring = e.UseItem("storage_ring_uncommon");
        Assert.Contains(ring, ev => ev.Kind == "item_gained");
        Assert.Equal(0, Inventory.Count(e.Player, "storage_ring_uncommon"));
        e.UseItem("random_treasure");
        e.UseItem("random_treasure");
        Assert.Equal(0, Inventory.Count(e.Player, "random_treasure"));
        Assert.True(e.Player.Items.Sum(i => i.Qty) + e.Player.Silver > before);
    }

    [Fact]
    public void Two_pouches_opened_in_one_month_hold_different_things()
    {
        var a = Carrying(("random_treasure", 5));
        var found = new HashSet<string>();
        for (var i = 0; i < 5; i++) found.Add(string.Join(",", a.UseItem("random_treasure").Select(ev => ev.TextEn)));
        Assert.True(found.Count > 1);
    }

    [Fact]
    public void A_save_holding_the_old_nameless_stubs_gets_real_items_back()
    {
        var e = TestContent.NewEngine();
        e.Player.Items.Add(Inventory.StubStack("random_treasure", 2));
        e.Player.Items.Add(Inventory.StubStack(Inventory.SpiritStoneId, 4));
        var stones = e.Player.SpiritStones;
        var loaded = GameEngine.Load(C, e.Save());
        var pouch = loaded.Player.Items.Single(i => i.Id == "random_treasure");
        Assert.Equal(("Treasure Pouch", "Misc", 2), (pouch.NameEn, pouch.Type, pouch.Qty));
        Assert.True(loaded.CanUse("random_treasure"));
        Assert.Equal(stones + 4, loaded.Player.SpiritStones);
        Assert.Equal(0, Inventory.Count(loaded.Player, Inventory.SpiritStoneId));
    }

    [Fact]
    public void Spirit_stones_handed_out_as_an_item_go_to_the_purse()
    {
        var e = TestContent.NewEngine();
        var stones = e.Player.SpiritStones;
        Inventory.Add(e.Player, Inventory.Resolve(C, Inventory.SpiritStoneId, 3));
        Assert.Equal(stones + 3, e.Player.SpiritStones);
        Assert.Equal(0, Inventory.Count(e.Player, Inventory.SpiritStoneId));
    }
}
