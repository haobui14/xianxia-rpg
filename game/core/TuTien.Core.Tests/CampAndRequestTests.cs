using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Tests;

/// <summary>The Black Wind Camp and its garrison; the villagers' requests on the bounty board.</summary>
public class CampAndRequestTests
{
    private static ContentDb C => TestContent.Content;
    private const string CampId = "poi_camp_black_wind";

    private static TownDef Town => C.Towns["thanh_van_village"];

    private static CombatResolution BreakGarrison(GameEngine e)
    {
        var garrison = Camps.Garrison(e.State, CampId)!;
        var enc = e.Engage(garrison.Id)!;
        return e.ResolveCombat(new CombatOutcome
        {
            EncounterId = enc.Id, Victory = true, HpLeft = e.Player.Hp, QiLeft = e.Player.Qi, Defeated = enc.EnemyIds.ToList(),
        });
    }

    private static void StandInCamp(GameEngine e)
    {
        var poi = e.Poi(CampId)!;
        e.Player.X = poi.X;
        e.Player.Y = poi.Y;
    }

    [Fact]
    public void Bandits_hold_the_camp_from_the_start()
    {
        var e = TestContent.NewEngine();
        var garrison = Camps.Garrison(e.State, CampId);
        Assert.NotNull(garrison);
        Assert.Equal(C.Camps[CampId].Garrison, garrison!.EnemyIds);
        Assert.True(garrison.Aggressive);
        var poi = e.Poi(CampId)!;
        Assert.Equal((poi.X, poi.Y), (garrison.X, garrison.Y));
        Assert.All(garrison.EnemyIds, id => Assert.True(C.Enemy(id)!.Humanoid, id));
        // The camp doesn't take the place of the forest's own beasts.
        var area = C.Area("verdant_forest")!;
        Assert.Equal(area.DangerLevel + 1, e.State.World.Beasts.Count(b => b.Zone == area.Id && b.CampId == null));
    }

    [Fact]
    public void The_garrison_holds_its_ground_and_never_ambushes()
    {
        var e = TestContent.NewEngine();
        var poi = e.Poi(CampId)!;
        // Stand right beside the camp for a year of months.
        e.Player.X = poi.X - 1;
        e.Player.Y = poi.Y;
        for (var i = 0; i < 12; i++)
        {
            e.EndMonth();
            var ambush = e.State.World.PendingAmbush;
            Assert.True(ambush == null || e.State.World.Beasts.FirstOrDefault(b => b.Id == ambush.SourceId)?.CampId == null);
            e.State.World.PendingAmbush = null;
            e.Player.X = poi.X - 1;
            e.Player.Y = poi.Y;
        }
        var garrison = Camps.Garrison(e.State, CampId)!;
        Assert.Equal((poi.X, poi.Y), (garrison.X, garrison.Y));
        Assert.Single(e.State.World.Beasts, b => b.CampId == CampId);
    }

    [Fact]
    public void Breaking_the_garrison_opens_the_hoard_until_the_bandits_return()
    {
        var e = TestContent.NewEngine();
        var result = BreakGarrison(e);
        Assert.Contains(result.Events, ev => ev.Kind == "camp_fallen");
        Assert.Null(Camps.Garrison(e.State, CampId));
        var camp = e.Camp(CampId);
        Assert.True(camp.HoardReady);
        Assert.Equal(e.State.Calendar.MonthIndex + C.Camps[CampId].RespawnMonths, camp.ReturnMonth);
        Assert.Equal(1, e.Player.Counters.CampsCleared);
        var poi = e.Poi(CampId)!;
        var fog = e.Fog();
        fog.RevealCircle(poi.X, poi.Y, 1);
        fog.SaveTo(e.Player, e.Map);
        Assert.Contains(e.VisibleThings(), t => t.Kind == InteractKind.Camp && t.Id == CampId && t.Ready);

        // Only from inside the camp.
        Assert.Empty(e.OpenHoard(CampId));
        StandInCamp(e);
        var silver = e.Player.Silver;
        Assert.Contains(e.OpenHoard(CampId), ev => ev.Kind == "camp_hoard");
        Assert.True(e.Player.Silver >= silver + 120);
        Assert.False(camp.HoardReady);
        Assert.Empty(e.OpenHoard(CampId));

        // They regroup and come back.
        for (var i = 0; i < C.Camps[CampId].RespawnMonths; i++) e.EndMonth();
        Assert.NotNull(Camps.Garrison(e.State, CampId));
    }

    [Fact]
    public void A_hoard_left_too_long_goes_back_to_the_bandits()
    {
        var e = TestContent.NewEngine();
        BreakGarrison(e);
        for (var i = 0; i < C.Camps[CampId].RespawnMonths; i++) e.EndMonth();
        Assert.False(e.Camp(CampId).HoardReady);
        StandInCamp(e);
        Assert.Empty(e.OpenHoard(CampId));
    }

    [Fact]
    public void The_board_prices_the_chiefs_head()
    {
        var bounty = Town.Bounties.Single(b => b.EnemyId == "black_wind_chief");
        var e = TestContent.NewEngine();
        e.AcceptBounty(Town, bounty.Id);
        BreakGarrison(e);
        Assert.Contains(e.ClaimBounties(), ev => ev.Kind == "bounty_done");
    }

    [Fact]
    public void A_camp_save_from_before_the_camps_gets_its_bandits_on_load()
    {
        var e = TestContent.NewEngine();
        e.State.World.Beasts.RemoveAll(b => b.CampId != null);
        e.State.World.Camps.Clear();
        var loaded = GameEngine.Load(C, e.Save());
        Assert.NotNull(Camps.Garrison(loaded.State, CampId));
        // …and a save that has them loads exactly as it was saved.
        var saved = loaded.Save();
        Assert.Equal(saved, GameEngine.Load(C, saved).Save());
    }

    [Fact]
    public void The_board_puts_up_three_requests_and_changes_them_every_two_months()
    {
        var e = TestContent.NewEngine();
        var first = e.RequestsFor(Town).Select(r => r.Id).ToList();
        Assert.Equal(Requests.Shown, first.Count);
        Assert.Equal(first.Count, first.Distinct().Count());
        Assert.Equal(first, e.RequestsFor(Town).Select(r => r.Id));

        e.State.Calendar.MonthIndex += 1;
        Assert.Equal(first, e.RequestsFor(Town).Select(r => r.Id));
        e.State.Calendar.MonthIndex += 1;
        e.RequestsFor(Town);
        Assert.Equal(e.State.Calendar.MonthIndex, e.State.World.Requests[Town.AreaId].RolledMonth);
    }

    [Fact]
    public void Answering_a_request_takes_the_goods_and_pays()
    {
        var e = TestContent.NewEngine();
        var request = e.RequestsFor(Town).First();
        Assert.Contains(e.FulfilRequest(Town, request.Id), ev => ev.Kind == "request_short");

        Inventory.Add(e.Player, Inventory.Resolve(C, request.Item, request.Qty));
        var silver = e.Player.Silver;
        var karma = e.Player.Karma;
        Assert.Contains(e.FulfilRequest(Town, request.Id), ev => ev.Kind == "request_done");
        Assert.Equal(0, Inventory.Count(e.Player, request.Item));
        Assert.Equal(silver + request.Silver, e.Player.Silver);
        Assert.Equal(karma + request.Karma, e.Player.Karma);
        if (request.RewardItem != null) Assert.Equal(1, Inventory.Count(e.Player, request.RewardItem));
        Assert.True(e.RequestDone(Town, request.Id));
        Assert.Equal(1, e.Player.Counters.RequestsDone);

        // Answered once is answered.
        Inventory.Add(e.Player, Inventory.Resolve(C, request.Item, request.Qty));
        Assert.Empty(e.FulfilRequest(Town, request.Id));
        Assert.Empty(e.FulfilRequest(Town, "not_on_the_board"));
    }

    [Fact]
    public void Every_request_asks_for_something_this_map_gives()
    {
        var sources = C.LootTables.Values.SelectMany(t => t.Entries.Select(x => x.Id))
            .Concat(C.FishSpots.Values.SelectMany(s => s.Catches.Where(c => c.Item != null).Select(c => c.Item!)))
            .Concat(C.Recipes.Select(r => r.Output))
            .ToHashSet();
        foreach (var r in Town.Requests)
        {
            Assert.True(sources.Contains(r.Item), $"{r.Id}: nowhere to get {r.Item}");
            Assert.True(r.Silver > 0 && r.Qty > 0, r.Id);
            Assert.False(Names.HasVietnamese(r.GiverEn + r.TextEn), r.Id);
        }
    }

    [Fact]
    public void The_new_things_survive_a_save()
    {
        var e = TestContent.NewEngine();
        e.DrawFortune();
        e.RequestsFor(Town);
        BreakGarrison(e);
        e.Player.Counters.Catches["fish_carp"] = 2;
        var loaded = GameEngine.Load(C, e.Save());
        Assert.Equal(e.Player.Fortune!.Id, loaded.Player.Fortune!.Id);
        Assert.True(loaded.Camp(CampId).HoardReady);
        Assert.Equal(e.State.World.Requests[Town.AreaId].Offers, loaded.State.World.Requests[Town.AreaId].Offers);
        Assert.Equal(2, loaded.Player.Counters.Catches["fish_carp"]);
    }
}
