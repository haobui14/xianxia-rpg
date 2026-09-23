using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Tests;

public class MapTests
{
    private static MapGrid Map(params string[] rows) => new(new Content.MapDef
    {
        Id = "test", RegionId = "thanh_van", Width = rows[0].Length, Height = rows.Length,
        Terrain = rows.ToList(), Zones = rows.Select(r => new string('f', r.Length)).ToList(),
        ZoneLegend = new Dictionary<string, string> { ["f"] = "verdant_forest" },
    });

    [Fact]
    public void Terrain_costs_follow_design_7_2()
    {
        var map = Map(".=fFh^A~#sTS");
        var mortal = new PlayerState();
        int[] expected = { 1, 1, 2, 3, 2, 3, -1, -1, 1, 3, 1, 1 };
        for (var x = 0; x < expected.Length; x++) Assert.Equal(expected[x], map.StepCost(x, 0, mortal));
    }

    [Fact]
    public void Sword_flight_at_foundation_makes_every_tile_cost_one()
    {
        var map = Map(".~A");
        var foundation = new PlayerState { Realm = Realm.TrucCo, Stage = 1 };
        Assert.Equal(1, map.StepCost(1, 0, foundation));
        Assert.Equal(1, map.StepCost(2, 0, foundation));
    }

    [Fact]
    public void Path_goes_around_expensive_terrain_when_cheaper()
    {
        var map = Map(
            "....",
            ".FF.",
            "....");
        var path = map.FindPath(new Cell(0, 1), new Cell(3, 1), new PlayerState())!;
        Assert.Equal(5, path.Cost); // around the dense forest (1+1+1+1+1) instead of through it (3+3+1)
        Assert.Equal(new Cell(3, 1), path.Steps.Last());
    }

    [Fact]
    public void Water_blocks_mortals()
    {
        var map = Map(".~.");
        Assert.Null(map.FindPath(new Cell(0, 0), new Cell(2, 0), new PlayerState()));
    }

    [Fact]
    public void Fog_round_trips_through_base64()
    {
        var fog = new FogMask(10, 7);
        fog.RevealCircle(3, 3, 2);
        var copy = new FogMask(10, 7, fog.ToBase64());
        for (var y = 0; y < 7; y++)
            for (var x = 0; x < 10; x++)
                Assert.Equal(fog.Get(x, y), copy.Get(x, y));
        Assert.True(copy.Get(3, 3));
        Assert.False(copy.Get(9, 6));
    }
}

public class WorldTickTests
{
    private static Content.ContentDb C => TestContent.Content;

    [Fact]
    public void New_games_are_deterministic_per_seed()
    {
        Assert.Equal(TestContent.NewEngine(7).Save(), TestContent.NewEngine(7).Save());
        Assert.NotEqual(TestContent.NewEngine(7).Save(), TestContent.NewEngine(8).Save());
    }

    [Fact]
    public void The_whole_world_replays_identically_for_24_months()
    {
        var a = TestContent.NewEngine(99);
        var b = TestContent.NewEngine(99);
        for (var i = 0; i < 24; i++)
        {
            a.EndMonth();
            b.EndMonth();
            a.TakeAmbush();
            b.TakeAmbush();
            a.AbandonEncounter();
            b.AbandonEncounter();
        }
        Assert.Equal(a.Save(), b.Save());
    }

    [Fact]
    public void End_month_advances_the_calendar_and_refills_footwork()
    {
        var e = TestContent.NewEngine();
        e.Player.Footwork = 0;
        var report = e.EndMonth();
        Assert.Equal(2, e.State.Calendar.Month);
        Assert.Equal(1, e.State.Calendar.MonthIndex);
        Assert.Equal(e.Player.FootworkMax, e.Player.Footwork);
        Assert.True(report.TotalExp > 0);
    }

    [Fact]
    public void Age_grows_every_twelve_months()
    {
        var e = TestContent.NewEngine();
        var age = e.Player.Age;
        for (var i = 0; i < 12; i++) e.EndMonth();
        Assert.Equal(age + 1, e.Player.Age);
        Assert.Equal(1, e.State.Calendar.Month);
        Assert.Equal(2, e.State.Calendar.Year);
    }

    [Fact]
    public void Seclusion_beats_a_normal_month()
    {
        var normal = TestContent.NewEngine(5);
        var secluded = TestContent.NewEngine(5);
        var n = normal.EndMonth().Cultivation;
        var s = secluded.Seclude(1, extraQiDensity: 0).Cultivation;
        Assert.True(s.Total > n.Total);
        Assert.Equal(Cultivation.SeclusionMultiplier, s.ActivityMultiplier);
        Assert.Equal(Calendar.FullMoonSeclusionBonus, s.FullMoonBonus);
    }

    [Fact]
    public void Npcs_live_their_lives_and_generate_rumors()
    {
        var e = TestContent.NewEngine(123);
        var count = e.State.World.Npcs.Count;
        Assert.True(count >= 20);
        var rumors = 0;
        for (var i = 0; i < 36; i++)
        {
            rumors += e.EndMonth().Rumors.Count;
            e.TakeAmbush();
            e.AbandonEncounter();
        }
        Assert.Equal(count, e.State.World.Npcs.Count); // the dead stay on record
        Assert.True(rumors > 0);
        Assert.Contains(e.State.World.Npcs, n => n.Id == "npc_elder");
    }

    [Fact]
    public void Npc_names_avoid_the_denylist()
    {
        var deny = C.NpcNames.Denylist.Select(Names.StripMarks).ToHashSet(StringComparer.OrdinalIgnoreCase);
        for (ulong seed = 1; seed <= 20; seed++)
            foreach (var npc in TestContent.NewEngine(seed).State.World.Npcs)
                Assert.DoesNotContain(Names.StripMarks(npc.Name), deny);
    }

    [Fact]
    public void Running_out_of_lifespan_ends_the_run()
    {
        var e = TestContent.NewEngine();
        e.Player.Age = 79;
        e.Player.AgeMonths = 11;
        var report = e.EndMonth();
        Assert.True(report.Died);
        Assert.True(e.Player.Dead);
        Assert.NotNull(e.StepTo(e.Player.X + 1, e.Player.Y).Blocked);
    }

    [Fact]
    public void Beasts_and_adventures_spawn_in_wild_zones_only()
    {
        var e = TestContent.NewEngine();
        Assert.NotEmpty(e.State.World.Beasts);
        Assert.All(e.State.World.Beasts, b => Assert.False(C.Area(b.Zone)!.IsSafe));
        Assert.NotEmpty(e.State.World.Adventures);
        Assert.All(e.State.World.Adventures, a => Assert.False(C.Area(a.Zone)!.IsSafe));
    }
}
