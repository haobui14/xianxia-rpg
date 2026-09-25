using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>Everything the world drops has a use: gear is worn (weapon, armor, accessory) and refined, containers are opened.</summary>
public class GearTests
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
        // The pouch the fight's follow-up event gives is one of them now.
        Assert.NotNull(C.Item("random_treasure")?.OpenLoot);
    }

    [Fact]
    public void Everything_that_drops_can_be_worn_used_opened_or_refined_with()
    {
        var useless = new List<string>();
        foreach (var id in C.LootTables.Values.SelectMany(t => t.Entries).Select(e => e.Id).Distinct())
        {
            var def = C.Item(id)!;
            var worn = Gear.SlotOf(def) != null;
            var used = Inventory.IsConsumable(C, id) || Gear.OpensInto(def) != null;
            var refines = id.StartsWith("enhancement_stone");
            if (!worn && !used && !refines) useless.Add(id);
        }
        Assert.True(useless.Count == 0, "drops that do nothing: " + string.Join(", ", useless));
    }

    [Fact]
    public void Armor_and_an_accessory_are_worn_and_their_stats_count()
    {
        var e = Carrying(("leather_armor", 1), ("jade_pendant", 1), ("mystic_robe", 1));
        var hp = e.Player.HpMax;
        var luck = CombatRules.EffectiveAttrs(C, e.Player).Luck;
        Assert.Equal("equipped", Assert.Single(e.Equip("leather_armor")).Kind);
        Assert.Equal("leather_armor", e.Player.ArmorId);
        Assert.Equal(hp + 20, e.Player.HpMax);
        e.Equip("jade_pendant");
        Assert.Equal(luck + 2, CombatRules.EffectiveAttrs(C, e.Player).Luck);
        // A second armor takes the first one's place.
        var qi = e.Player.QiMax;
        e.Equip("mystic_robe");
        Assert.Equal("mystic_robe", e.Player.ArmorId);
        Assert.Equal(hp, e.Player.HpMax);
        Assert.Equal(qi + 30, e.Player.QiMax);
        e.Unequip(GearSlot.Armor);
        Assert.Null(e.Player.ArmorId);
        Assert.Equal(qi, e.Player.QiMax);
    }

    [Fact]
    public void Storage_rings_and_pouches_are_opened_not_worn()
    {
        var e = Carrying(("storage_ring_uncommon", 1), ("random_treasure", 2));
        Assert.Null(Gear.SlotOf(C.Item("storage_ring_uncommon")));
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

    [Fact]
    public void Refining_spends_stones_and_silver_and_raises_every_stat()
    {
        var e = Carrying(("iron_sword", 1), ("enhancement_stone_common", 3));
        e.Equip("iron_sword");
        var str = CombatRules.EffectiveAttrs(C, e.Player).Str;
        e.Player.Silver = 0;
        Assert.Equal("refine_poor", Assert.Single(e.Refine(GearSlot.Weapon)).Kind); // no silver
        Assert.Equal(3, Inventory.Count(e.Player, "enhancement_stone_common")); // and nothing spent
        e.Player.Silver = 1000;
        Assert.Equal("refined", Assert.Single(e.Refine(GearSlot.Weapon)).Kind); // +1 never fails
        Assert.Equal(1, Gear.RefineLevel(e.Player, "iron_sword"));
        Assert.Equal(900, e.Player.Silver);
        Assert.Equal(2, Inventory.Count(e.Player, "enhancement_stone_common"));
        Assert.Equal(str + 1, CombatRules.EffectiveAttrs(C, e.Player).Str); // +1 a level at least
        e.Refine(GearSlot.Weapon); // +2 takes both remaining stones
        Assert.Equal(2, Gear.RefineLevel(e.Player, "iron_sword"));
        Assert.Equal(0, Inventory.Count(e.Player, "enhancement_stone_common"));
        var next = Gear.NextRefine(e.Player, "iron_sword")!.Value;
        Assert.Equal((3, 400, 3, 0.95), (next.Level, next.Silver, next.Stones, next.Chance));
    }

    [Fact]
    public void A_failed_refine_spends_its_cost_but_keeps_the_level()
    {
        var e = Carrying(("iron_sword", 1), ("enhancement_stone_epic", 40));
        e.Equip("iron_sword");
        e.Player.Refines["iron_sword"] = 9;
        e.Player.Silver = 20000 * 40;
        var failed = false;
        for (var i = 0; i < 40 && Gear.RefineLevel(e.Player, "iron_sword") == 9; i++)
            failed |= e.Refine(GearSlot.Weapon).Any(ev => ev.Kind == "refine_failed");
        Assert.True(failed); // a 35% chance fails sooner or later
        Assert.InRange(Gear.RefineLevel(e.Player, "iron_sword"), 9, 10);
        Assert.Null(Gear.NextRefine(new PlayerState { Refines = { ["x"] = Gear.MaxRefine } }, "x"));
    }

    [Fact]
    public void Selling_the_last_worn_piece_takes_it_off_first()
    {
        var e = Carrying(("leather_armor", 2));
        var hp = e.Player.HpMax;
        e.Equip("leather_armor");
        e.Sell("leather_armor");
        Assert.Equal("leather_armor", e.Player.ArmorId); // one is left, still worn
        Assert.Empty(e.Sell("leather_armor")); // the last one is worn: not for sale
        e.Unequip(GearSlot.Armor);
        e.Sell("leather_armor");
        Assert.Null(e.Player.ArmorId);
        Assert.Equal(hp, e.Player.HpMax);
    }

    [Fact]
    public void Gear_and_its_refinement_survive_a_save()
    {
        var e = Carrying(("leather_armor", 1), ("enhancement_stone_common", 1));
        e.Player.Silver = 500;
        e.Equip("leather_armor");
        e.Refine(GearSlot.Armor);
        var hp = e.Player.HpMax;
        Assert.Equal(e.Player.HpMax, GameEngine.Load(C, e.Save()).Player.HpMax);
        var loaded = GameEngine.Load(C, e.Save());
        Assert.Equal(hp, loaded.Player.HpMax);
        Assert.Equal(1, Gear.RefineLevel(loaded.Player, "leather_armor"));
        Assert.Equal(20 + Math.Max(1, 2), loaded.Player.GearHp); // 20 HP, refined once: +2 (10%)
    }
}
