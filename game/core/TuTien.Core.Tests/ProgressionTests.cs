using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>Pins the ported rules to the web game's mechanics.ts values.</summary>
public class ProgressionTests
{
    private static Content.ContentDb C => TestContent.Content;

    [Theory]
    [InlineData(Realm.PhamNhan, 0, 100)]
    [InlineData(Realm.LuyenKhi, 1, 200)]
    [InlineData(Realm.LuyenKhi, 9, 4800)]
    [InlineData(Realm.TrucCo, 1, 5500)]
    [InlineData(Realm.KetDan, 5, 60000)]
    [InlineData(Realm.NguyenAnh, 9, 530000)]
    public void Required_exp_uses_the_web_games_indexing(Realm realm, int stage, long expected) =>
        Assert.Equal(expected, Progression.RequiredExp(C, realm, stage));

    [Fact]
    public void Out_of_range_stage_needs_infinite_exp() =>
        Assert.Equal(long.MaxValue, Progression.RequiredExp(C, Realm.LuyenKhi, 10));

    [Fact]
    public void Mortal_to_qi_condensation_applies_performBreakthrough_gains()
    {
        var p = new PlayerState { HpMax = 100, QiMax = 0, StaminaMax = 100 };
        Progression.StepQi(p);
        Assert.Equal(Realm.LuyenKhi, p.Realm);
        Assert.Equal(1, p.Stage);
        Assert.Equal(150, p.HpMax);
        Assert.Equal(100, p.QiMax);
        Assert.Equal(102, p.StaminaMax);
        Assert.Equal((5, 5, 5, 4), (p.Attrs.Str, p.Attrs.Agi, p.Attrs.Int, p.Attrs.Per));
        Assert.Equal(p.HpMax, p.Hp);
        Assert.Equal(p.QiMax, p.Qi);
    }

    [Fact]
    public void Stage_steps_and_realm_changes_match_the_web_game()
    {
        var p = new PlayerState { Realm = Realm.LuyenKhi, Stage = 8, HpMax = 400, QiMax = 400 };
        Progression.StepQi(p); // stage 8 → 9: +30 hp, +50 qi, +1 str/agi/int
        Assert.Equal((Realm.LuyenKhi, 9, 430, 450), (p.Realm, p.Stage, p.HpMax, p.QiMax));
        Progression.StepQi(p); // 9 → Trúc Cơ 1: +100 hp, +200 qi, +5 stamina, +3/+3/+3/+2
        Assert.Equal((Realm.TrucCo, 1, 530, 650), (p.Realm, p.Stage, p.HpMax, p.QiMax));
        Assert.Equal(105, p.StaminaMax);

        var top = new PlayerState { Realm = Realm.NguyenAnh, Stage = 9 };
        Assert.False(Progression.StepQi(top));
    }

    [Fact]
    public void Body_steps_match_performBodyBreakthrough()
    {
        var p = new PlayerState { HpMax = 100, StaminaMax = 100 };
        Progression.StepBody(p); // Phàm Thể → Luyện Cốt 1: +80 hp, +3 stamina, +3 str, +1 agi
        Assert.Equal((BodyRealm.LuyenCot, 1, 180, 103, 6, 4), (p.BodyRealm, p.BodyStage, p.HpMax, p.StaminaMax, p.Attrs.Str, p.Attrs.Agi));
        Progression.StepBody(p); // stage 1 → 2: +40 hp, +2 str, +1 agi
        Assert.Equal((2, 220, 8, 5), (p.BodyStage, p.HpMax, p.Attrs.Str, p.Attrs.Agi));
    }

    [Fact]
    public void Lifespan_takes_the_better_of_qi_and_body_realms()
    {
        var p = new PlayerState { Age = 20 };
        Assert.Equal(80, Progression.MaxLifespan(C, p));
        p.Realm = Realm.LuyenKhi;
        Assert.Equal(130, Progression.MaxLifespan(C, p));
        var body = new PlayerState { BodyRealm = BodyRealm.LuyenCot };
        Assert.Equal(80 + 35, Progression.MaxLifespan(C, body)); // 70% of Luyện Khí's +50
    }

    [Fact]
    public void Exp_carries_over_minor_breakthroughs_and_stops_at_a_major_one()
    {
        var state = TestContent.NewEngine().State;
        state.Player.Realm = Realm.LuyenKhi;
        state.Player.Stage = 1;
        var events = Cultivation.AddExp(state, C, 200 + 350 + 25, 0);
        Assert.Equal(3, state.Player.Stage);
        Assert.Equal(25, state.Player.Exp);
        Assert.Equal(2, events.Count(e => e.Kind == "stage_up"));

        state.Player.Stage = 9;
        state.Player.Exp = 0;
        Cultivation.AddExp(state, C, 5000, 0);
        Assert.Equal(9, state.Player.Stage);
        Assert.True(state.Player.PendingMajorBreakthrough);
    }

    [Fact]
    public void Mortals_wait_for_the_first_breakthrough_set_piece()
    {
        var state = TestContent.NewEngine().State;
        Cultivation.AddExp(state, C, 150, 0);
        Assert.Equal(Realm.PhamNhan, state.Player.Realm);
        Assert.True(state.Player.PendingMajorBreakthrough);

        var events = Cultivation.CompleteMajorBreakthrough(state, C, performance: 1.0);
        Assert.Equal(Realm.LuyenKhi, state.Player.Realm);
        Assert.Equal(50, state.Player.Exp); // 150 − 100 carried over
        Assert.Contains(events, e => e.Kind == "realm_up");
    }

    [Fact]
    public void A_failed_breakthrough_costs_exp_and_injures()
    {
        var state = TestContent.NewEngine().State;
        Cultivation.AddExp(state, C, 100, 0);
        Cultivation.CompleteMajorBreakthrough(state, C, performance: 0.0);
        Assert.Equal(Realm.PhamNhan, state.Player.Realm);
        Assert.Equal(80, state.Player.Exp);
        Assert.Single(state.Player.Injuries);
    }

    [Fact]
    public void Technique_bonus_ports_getTechniqueBonus()
    {
        var p = new PlayerState { Root = TestContent.Root(RootGrade.PhoThong, Element.Moc) };
        Assert.Equal(1.0, Cultivation.TechniqueMultiplier(p));
        p.Techniques.Add(new TechniqueState { SpeedBonus = 20, Elements = { Element.Moc } }); // perfect match ×1.3
        Assert.Equal(1.26, Cultivation.TechniqueMultiplier(p), 3);
        p.Techniques.Add(new TechniqueState { SpeedBonus = 10 }); // universal ×1.2, second weight 0.5
        Assert.Equal(1.26 + 0.06, Cultivation.TechniqueMultiplier(p), 3);
    }
}
