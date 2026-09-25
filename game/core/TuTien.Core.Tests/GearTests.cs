using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>Gear slots and the forge, technique mastery, art training and the money changer (the web game's economy).</summary>
public class GearTests
{
    private static Content.ContentDb C => TestContent.Content;

    private static void Give(GameEngine e, string id, int qty = 1) => Inventory.Add(e.Player, Inventory.Resolve(C, id, qty));

    /// <summary>A generator whose first roll is at least <paramref name="above"/>: the forge's odds will fail.</summary>
    private static Pcg32 Unlucky(double above)
    {
        for (ulong seed = 1; ; seed++)
            if (new Pcg32(seed).NextDouble() >= above) return new Pcg32(seed);
    }

    [Fact]
    public void A_new_life_starts_with_the_wooden_sword_in_hand()
    {
        var e = TestContent.NewEngine();
        Assert.Equal("wooden_sword", e.Player.WeaponId);
        Assert.Equal("wooden_sword", e.Player.Gear[Equipment.Weapon].ItemId);
    }

    [Fact]
    public void Armour_adds_its_health_and_gives_it_back_when_taken_off()
    {
        var e = TestContent.NewEngine();
        var hpMax = e.Player.HpMax;
        Give(e, "leather_armor");
        e.Equip("leather_armor");
        Assert.Equal(hpMax + 20, e.Player.HpMax);
        Assert.True(Equipment.IsWorn(e.Player, "leather_armor"));
        e.Unequip(Equipment.Chest);
        Assert.Equal(hpMax, e.Player.HpMax);
        Assert.True(e.Player.Hp <= e.Player.HpMax);
    }

    [Fact]
    public void Every_slot_counts_in_combat_not_only_the_weapon()
    {
        var e = TestContent.NewEngine();
        var before = CombatRules.EffectiveAttrs(C, e.Player).Luck;
        Give(e, "jade_pendant");
        e.Equip("jade_pendant");
        Assert.Equal(before + 2, CombatRules.EffectiveAttrs(C, e.Player).Luck);
    }

    [Fact]
    public void Enhancing_a_slot_costs_silver_and_stones_and_scales_what_is_worn_there()
    {
        var e = TestContent.NewEngine();
        Give(e, "leather_armor");
        e.Equip("leather_armor");
        var hpMax = e.Player.HpMax;
        var def = CombatRules.PlayerCombatant(C, e.Player).Def;
        e.Player.Silver = 1000;
        Give(e, Equipment.StoneCommon, 3);

        e.Enhance(Equipment.Chest); // +1 always succeeds: 100 silver, 1 common stone
        Assert.Equal(1, e.Player.Gear[Equipment.Chest].Level);
        Assert.Equal(900, e.Player.Silver);
        Assert.Equal(2, Inventory.Count(e.Player, Equipment.StoneCommon));
        Assert.Equal(hpMax + 2, e.Player.HpMax); // 20 health × 1.1
        Assert.Equal(def + Equipment.FlatPerLevel, CombatRules.PlayerCombatant(C, e.Player).Def, 3); // the slot's own defense

        e.Enhance(Equipment.Chest); // +2: 200 silver, 2 common stones
        Assert.Equal(2, e.Player.Gear[Equipment.Chest].Level);
        Assert.Equal(700, e.Player.Silver);
        Assert.Equal(0, Inventory.Count(e.Player, Equipment.StoneCommon));

        e.Enhance(Equipment.Chest); // +3 needs 3 more stones: refused, nothing spent
        Assert.Equal(2, e.Player.Gear[Equipment.Chest].Level);
        Assert.Equal(700, e.Player.Silver);
    }

    [Fact]
    public void A_failed_enhancement_spends_everything_but_keeps_the_level()
    {
        var e = TestContent.NewEngine();
        var slot = Equipment.Slot(e.Player, Equipment.Weapon);
        slot.Level = 6; // the next step, +7, has 65% odds
        e.Player.Silver = 10000;
        Give(e, Equipment.StoneRare);
        var events = Equipment.Enhance(C, e.Player, Equipment.Weapon, Unlucky(0.65));
        Assert.Contains(events, ev => ev.Kind == "enhance_failed");
        Assert.Equal(6, slot.Level);
        Assert.Equal(5000, e.Player.Silver);
        Assert.Equal(0, Inventory.Count(e.Player, Equipment.StoneRare));
    }

    [Fact]
    public void An_enhanced_slot_keeps_its_level_for_a_better_find()
    {
        var e = TestContent.NewEngine();
        Equipment.Slot(e.Player, Equipment.Weapon).Level = 3;
        Give(e, "iron_sword");
        e.Equip("iron_sword");
        Assert.Equal(3, e.Player.Gear[Equipment.Weapon].Level);
        Assert.Equal(3, Equipment.SlotBonus(C, Equipment.Weapon, e.Player.Gear[Equipment.Weapon], "str")); // 2 × 1.3, rounded up
    }

    [Fact]
    public void Selling_the_last_of_a_worn_item_is_refused_and_losing_it_empties_the_slot()
    {
        var e = TestContent.NewEngine();
        Give(e, "leather_armor");
        e.Equip("leather_armor");
        var hpMax = e.Player.HpMax;
        e.Sell("leather_armor");
        Assert.True(Equipment.IsWorn(e.Player, "leather_armor"));
        Inventory.Remove(e.Player, "leather_armor"); // an event takes it
        Assert.False(Equipment.IsWorn(e.Player, "leather_armor"));
        Assert.Equal(hpMax - 20, e.Player.HpMax);
    }

    [Fact]
    public void A_mortal_holds_no_qi_from_gear_until_qi_condensation()
    {
        var e = TestContent.NewEngine();
        Give(e, "mystic_robe");
        e.Equip("mystic_robe");
        Assert.Equal(0, e.Player.QiMax);
        e.Player.Realm = Realm.LuyenKhi;
        Equipment.RefreshAll(C, e.Player);
        Assert.Equal(30, e.Player.QiMax);
    }

    [Fact]
    public void The_forge_sells_stones_for_silver_and_spirit_stones()
    {
        var e = TestContent.NewEngine();
        e.Player.Silver = 100;
        e.Player.SpiritStones = 7;
        e.BuyStone(Equipment.StoneCommon);
        e.BuyStone(Equipment.StoneUncommon);
        e.BuyStone(Equipment.StoneUncommon); // 5 + 5 > 7: refused
        Assert.Equal(40, e.Player.Silver);
        Assert.Equal(2, e.Player.SpiritStones);
        Assert.Equal(1, Inventory.Count(e.Player, Equipment.StoneCommon));
        Assert.Equal(1, Inventory.Count(e.Player, Equipment.StoneUncommon));
    }

    [Fact]
    public void Techniques_deepen_for_spirit_stones_and_arts_train_for_silver()
    {
        var e = TestContent.NewEngine();
        e.Player.Techniques.Add(new TechniqueState { Id = "t", Name = "t", NameEn = "t", Grade = "Earth", SpeedBonus = 12, Level = 2 });
        e.Player.SpiritStones = 25;
        e.DeepenTechnique("t"); // Earth grade × level 2 = 20
        Assert.Equal(3, e.Player.Techniques[0].Level);
        Assert.Equal(5, e.Player.SpiritStones);
        Assert.Equal(30, Mastery.TechniqueCost(e.Player.Techniques[0]));

        e.Player.Skills.Add(new SkillState { Id = "hoa_cau_thuat", Level = 2, Exp = 150 });
        e.Player.Silver = 400;
        e.TrainSkill("hoa_cau_thuat"); // 150 × 2
        var art = e.Player.Skills.First(s => s.Id == "hoa_cau_thuat");
        Assert.Equal(3, art.Level);
        Assert.Equal(100, e.Player.Silver);
        Assert.True(art.Exp < art.Level * 100);
    }

    [Fact]
    public void The_money_changer_gives_a_hundred_silver_a_stone()
    {
        var e = TestContent.NewEngine();
        e.Player.SpiritStones = 3;
        var silver = e.Player.Silver;
        e.ExchangeStones(10);
        Assert.Equal(0, e.Player.SpiritStones);
        Assert.Equal(silver + 300, e.Player.Silver);
    }

    [Fact]
    public void Gear_survives_a_save_and_old_saves_move_their_weapon_into_the_slot()
    {
        var e = TestContent.NewEngine();
        Give(e, "leather_armor");
        e.Equip("leather_armor");
        Equipment.Slot(e.Player, Equipment.Chest).Level = 2;
        var json = e.Save();
        var loaded = GameEngine.Load(C, json);
        Assert.Equal(json, loaded.Save());
        Assert.Equal(2, loaded.Player.Gear[Equipment.Chest].Level);

        // A version 3 save: the weapon sat in "weapon_id" and there were no slots.
        var old = System.Text.Json.Nodes.JsonNode.Parse(json)!;
        old["version"] = 3;
        var player = old["player"]!.AsObject();
        player.Remove("gear");
        player["weapon_id"] = "iron_sword";
        var migrated = GameEngine.Load(C, old.ToJsonString());
        Assert.Equal("iron_sword", migrated.Player.WeaponId);
        Assert.Null(migrated.Player.LegacyWeaponId);
        Assert.DoesNotContain("weapon_id", migrated.Save());
    }
}
