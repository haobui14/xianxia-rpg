using TuTien.Core.Combat;
using TuTien.Core.Rules;
using TuTien.Core.State;
using Xunit.Abstractions;

namespace TuTien.Core.Tests;

/// <summary>
/// NPC cultivators grow by the player's own tables: a duel at the same realm is a fair fight, a realm above is a
/// wall, and a new life cannot cut every stranger down in a few strokes.
/// </summary>
public class BalanceTests
{
    private readonly ITestOutputHelper _out;
    public BalanceTests(ITestOutputHelper output) => _out = output;

    private static Content.ContentDb C => TestContent.Content;

    private static PlayerState PlayerAt(Realm realm, int stage)
    {
        var p = TestContent.NewEngine().Player;
        while (p.Realm < realm || (p.Realm == realm && p.Stage < stage)) Progression.StepQi(p);
        if (p.Realm >= Realm.TrucCo) p.Foundation = FoundationGrade.Trung;
        return p;
    }

    private static NpcState Npc(string id, Realm realm, int stage, RootGrade grade = RootGrade.Kha) => new()
    {
        Id = id, Name = id, Realm = realm, Stage = stage, Grade = grade, Elements = { Element.Kim },
    };

    /// <summary>Basic sword strikes the player needs to down the NPC, and the NPC's basic blows to down the player, on average.</summary>
    private (double Mine, double Theirs) Duel(PlayerState p, NpcState npc)
    {
        var enc = NpcCombat.Prepare(new Encounter { Id = "duel", EnemyIds = { "rogue_cultivator" }, RealmOverride = npc.Realm, StageOverride = npc.Stage }, npc, C);
        var foe = Encounters.Build(C, enc).Single();
        var me = CombatRules.PlayerCombatant(C, p);
        var them = foe.ToCombatant();
        var rng = new Pcg32(7);
        double dealt = 0, taken = 0;
        for (var i = 0; i < 400; i++)
        {
            dealt += CombatRules.Compute(DamageKind.Physical, 1.0, null, me, them, null, rng).Amount;
            taken += CombatRules.Compute(DamageKind.Physical, 1.0, null, them, me, null, rng).Amount;
        }
        var mine = foe.HpMax / (dealt / 400);
        var theirs = p.HpMax / (taken / 400);
        _out.WriteLine($"{p.Realm} {p.Stage} vs {npc.Realm} {npc.Stage}: {mine:0.0} strikes to down them, {theirs:0.0} to down you");
        return (mine, theirs);
    }

    [Fact]
    public void A_new_life_cannot_cut_down_a_stranger_in_a_few_strokes()
    {
        var p = PlayerAt(Realm.PhamNhan, 0);
        var (mortal, _) = Duel(p, Npc("mortal", Realm.PhamNhan, 0));
        Assert.True(mortal >= 9, $"a mortal falls in {mortal:0.0} strikes");
        var (cultivator, back) = Duel(p, Npc("cultivator", Realm.LuyenKhi, 1));
        Assert.True(cultivator >= 18, $"a Luyện Khí 1 cultivator falls in {cultivator:0.0} strikes");
        Assert.True(back < cultivator / 2);
    }

    [Theory]
    [InlineData(Realm.PhamNhan, 0)]
    [InlineData(Realm.LuyenKhi, 1)]
    [InlineData(Realm.LuyenKhi, 5)]
    [InlineData(Realm.LuyenKhi, 9)]
    [InlineData(Realm.TrucCo, 1)]
    public void A_duel_at_the_same_realm_is_a_fair_fight(Realm realm, int stage)
    {
        var (mine, theirs) = Duel(PlayerAt(realm, stage), Npc("peer", realm, stage));
        Assert.InRange(mine / theirs, 0.6, 1.6);
    }

    [Fact]
    public void A_realm_above_is_a_wall_and_a_realm_below_a_rout()
    {
        var p = PlayerAt(Realm.LuyenKhi, 5);
        var (up, upBack) = Duel(p, Npc("elder", Realm.TrucCo, 1));
        Assert.True(up > 3 * upBack);
        var (down, downBack) = Duel(p, Npc("junior", Realm.LuyenKhi, 1));
        Assert.True(downBack > 2 * down);
    }

    [Fact]
    public void Each_npc_has_their_own_steady_numbers()
    {
        var a = NpcCombat.Stats(Npc("npc_a", Realm.LuyenKhi, 4), C);
        var again = NpcCombat.Stats(Npc("npc_a", Realm.LuyenKhi, 4), C);
        Assert.Equal(a.HpMax, again.HpMax);
        Assert.Equal(a.Physical, again.Physical);
        var peers = Enumerable.Range(0, 20).Select(i => NpcCombat.Stats(Npc("npc_" + i, Realm.LuyenKhi, 4), C)).ToList();
        Assert.True(peers.Select(s => s.HpMax).Distinct().Count() > 5);
        var lower = NpcCombat.Stats(Npc("npc_a", Realm.LuyenKhi, 3), C);
        Assert.True(a.HpMax > lower.HpMax && a.Physical > lower.Physical && a.Spirit > lower.Spirit);
    }

    [Fact]
    public void Talent_temperament_and_injury_show_in_the_numbers()
    {
        var common = NpcCombat.Stats(Npc("x", Realm.TrucCo, 2, RootGrade.PhoThong), C);
        var heaven = NpcCombat.Stats(Npc("x", Realm.TrucCo, 2, RootGrade.ThienPham), C);
        Assert.True(heaven.Physical > common.Physical * 1.2);

        var bold = Npc("x", Realm.TrucCo, 2, RootGrade.PhoThong);
        bold.Traits.Add("belligerent");
        var timid = Npc("x", Realm.TrucCo, 2, RootGrade.PhoThong);
        timid.Traits.Add("timid");
        var b = NpcCombat.Stats(bold, C);
        var t = NpcCombat.Stats(timid, C);
        Assert.True(b.Physical > t.Physical && b.Defense < t.Defense);

        var hurt = Npc("x", Realm.TrucCo, 2, RootGrade.PhoThong);
        hurt.InjuredMonths = 3;
        Assert.True(NpcCombat.Stats(hurt, C).HpMax < common.HpMax);
    }

    [Fact]
    public void Sizing_up_an_npc_reads_the_odds()
    {
        var p = PlayerAt(Realm.LuyenKhi, 1);
        Assert.Equal(MatchUp.Weaker, NpcCombat.Assess(C, p, Npc("mortal", Realm.PhamNhan, 0)));
        Assert.Equal(MatchUp.Even, NpcCombat.Assess(C, p, Npc("peer", Realm.LuyenKhi, 1)));
        Assert.Equal(MatchUp.FarStronger, NpcCombat.Assess(C, p, Npc("elder", Realm.TrucCo, 1)));
    }

    [Fact]
    public void A_fight_with_an_npc_uses_their_own_numbers()
    {
        var e = TestContent.NewEngine();
        var npc = e.State.World.Npcs.First(n => n.Alive);
        var foe = Encounters.Build(C, e.ChallengeNpc(npc.Id, lethal: true)!).Single();
        var s = NpcCombat.Stats(npc, C);
        Assert.Equal(s.HpMax, foe.HpMax);
        Assert.Equal(s.Physical, foe.Attack);
        Assert.Equal(s.Spirit, foe.SpiritAttack);
        Assert.Equal(npc.Realm, foe.Realm);
        Assert.Equal(npc.Stage, foe.Stage);
    }
}
