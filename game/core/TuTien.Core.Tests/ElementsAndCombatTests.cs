using TuTien.Core.Rules;

namespace TuTien.Core.Tests;

public class ElementsTests
{
    [Theory]
    [InlineData(Element.Kim, Element.Moc)]
    [InlineData(Element.Moc, Element.Tho)]
    [InlineData(Element.Tho, Element.Thuy)]
    [InlineData(Element.Thuy, Element.Hoa)]
    [InlineData(Element.Hoa, Element.Kim)]
    public void Overcoming_cycle(Element a, Element b)
    {
        Assert.True(Elements.Overcomes(a, b));
        Assert.False(Elements.Overcomes(b, a));
    }

    [Theory]
    [InlineData(Element.Kim, Element.Thuy)]
    [InlineData(Element.Thuy, Element.Moc)]
    [InlineData(Element.Moc, Element.Hoa)]
    [InlineData(Element.Hoa, Element.Tho)]
    [InlineData(Element.Tho, Element.Kim)]
    public void Generating_cycle(Element a, Element b) => Assert.True(Elements.Generates(a, b));

    [Fact]
    public void Attack_multipliers()
    {
        Assert.Equal(1.3, Elements.AttackMultiplier(Element.Kim, Element.Moc));
        Assert.Equal(0.7, Elements.AttackMultiplier(Element.Moc, Element.Kim));
        Assert.Equal(0.85, Elements.AttackMultiplier(Element.Moc, Element.Hoa));
        Assert.Equal(1.0, Elements.AttackMultiplier(Element.Moc, Element.Moc));
        Assert.Equal(1.0, Elements.AttackMultiplier(null, Element.Moc));
    }

    [Theory]
    [InlineData(Element.Moc, Element.Kim, Reaction.DoanMoc)]
    [InlineData(Element.Tho, Element.Moc, Reaction.PhaTho)]
    [InlineData(Element.Thuy, Element.Tho, Reaction.YemThuy)]
    [InlineData(Element.Hoa, Element.Thuy, Reaction.DietHoa)]
    [InlineData(Element.Kim, Element.Hoa, Reaction.DungKim)]
    [InlineData(Element.Moc, Element.Hoa, Reaction.LietDiem)]
    [InlineData(Element.Tho, Element.Kim, Reaction.LuyenKim)]
    [InlineData(Element.Thuy, Element.Moc, Reaction.SinhCo)]
    [InlineData(Element.Hoa, Element.Tho, Reaction.TroTan)]
    [InlineData(Element.Kim, Element.Thuy, Reaction.HanTrieu)]
    [InlineData(Element.Moc, Element.Moc, Reaction.None)]
    [InlineData(Element.Moc, Element.Thuy, Reaction.None)]
    public void Reaction_table_matches_design_7_4(Element mark, Element attack, Reaction expected) =>
        Assert.Equal(expected, Elements.ReactionFor(mark, attack));

    [Fact]
    public void Technique_compatibility_ports_getElementCompatibility()
    {
        Assert.Equal(0.3, Elements.TechniqueCompatibility(new[] { Element.Moc, Element.Hoa }, new[] { Element.Moc }));
        Assert.Equal(0.15, Elements.TechniqueCompatibility(new[] { Element.Moc }, new[] { Element.Hoa }), 6);
        Assert.Equal(-0.2, Elements.TechniqueCompatibility(new[] { Element.Moc }, new[] { Element.Kim }), 6);
        Assert.Equal(0, Elements.TechniqueCompatibility(new[] { Element.Moc }, Array.Empty<Element>()));
    }
}

public class CombatRulesTests
{
    private static Combatant Attacker(double realm = 1) => new()
    {
        PhysicalPower = 20, SpiritPower = 30, Def = 0, Res = 0, Per = 0, Luck = 0, RealmValue = realm,
        Root = new[] { Element.Moc },
    };

    private static Combatant Target(Element? element = null, double realm = 1) => new()
    {
        PhysicalPower = 10, SpiritPower = 10, Def = 20, Res = 20, RealmValue = realm, Element = element,
        Root = Array.Empty<Element>(),
    };

    [Fact]
    public void Mitigation_is_percentage_based()
    {
        Assert.Equal(1.0, CombatRules.Mitigation(0));
        Assert.Equal(0.5, CombatRules.Mitigation(100));
        Assert.True(CombatRules.Mitigation(50) > CombatRules.Mitigation(60));
    }

    [Fact]
    public void Realm_suppression_is_capped_and_asymmetric()
    {
        Assert.Equal(1.0, CombatRules.Suppression(2, 2));
        Assert.Equal(1.25, CombatRules.Suppression(2, 1));
        Assert.Equal(2.0, CombatRules.Suppression(4.9, 0));
        Assert.Equal(1 / 1.35, CombatRules.Suppression(1, 2), 6);
    }

    [Fact]
    public void Crit_chance_caps_at_half() => Assert.Equal(0.5, CombatRules.CritChance(500, 500));

    [Fact]
    public void Same_seed_same_damage_and_multipliers_compose()
    {
        var a = Attacker();
        var plain = CombatRules.Compute(DamageKind.Spirit, 1.0, null, a, Target(), null, new Pcg32(7));
        var again = CombatRules.Compute(DamageKind.Spirit, 1.0, null, a, Target(), null, new Pcg32(7));
        Assert.Equal(plain.Amount, again.Amount);

        // Metal hits Wood: ×1.3 element; Metal is not in the attacker's Wood root, so no affinity.
        var metal = CombatRules.Compute(DamageKind.Spirit, 1.0, Element.Kim, a, Target(Element.Moc), null, new Pcg32(7));
        Assert.Equal(1.3, metal.ElementMultiplier);
        Assert.InRange(metal.Amount / (double)plain.Amount, 1.25, 1.35);
        Assert.True(metal.AppliesMark);

        // Fire on a Wood mark: Wood feeds Fire (Liệt Diễm) — ×1.5, and the mark is consumed.
        var fire = CombatRules.Compute(DamageKind.Spirit, 1.0, Element.Hoa, a, Target(), Element.Moc, new Pcg32(7));
        Assert.Equal(Reaction.LietDiem, fire.Reaction);
        Assert.False(fire.AppliesMark);
        Assert.InRange(fire.Amount / (double)plain.Amount, 1.45, 1.55);
    }

    [Fact]
    public void Damage_is_never_below_one()
    {
        var weak = new Combatant { PhysicalPower = 0.01, Root = Array.Empty<Element>() };
        var tank = new Combatant { Def = 10000, Root = Array.Empty<Element>() };
        Assert.Equal(1, CombatRules.Compute(DamageKind.Physical, 1, null, weak, tank, null, new Pcg32(1)).Amount);
    }

    [Fact]
    public void Root_affinity_discounts_qi()
    {
        var skill = TestContent.Content.Skill("thanh_moc_cham")!;
        Assert.Equal(9, CombatRules.QiCost(skill, new[] { Element.Moc }));
        Assert.Equal(10, CombatRules.QiCost(skill, new[] { Element.Kim }));
    }
}
