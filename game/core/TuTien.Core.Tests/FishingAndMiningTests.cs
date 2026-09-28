using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Tests;

/// <summary>Fishing at the river landings and the marsh; ore veins that break under the sword; the forge's smelting.</summary>
public class FishingAndMiningTests
{
    private static ContentDb C => TestContent.Content;

    private static void Stand(GameEngine e, string poiId)
    {
        var poi = e.Poi(poiId)!;
        e.Player.X = poi.X;
        e.Player.Y = poi.Y;
    }

    private static int MonthIn(Season season) => Enumerable.Range(1, 12).First(m => Calendar.SeasonOf(C, m) == season);

    [Fact]
    public void The_new_places_stand_on_the_map_with_what_they_need()
    {
        var pois = C.Maps["thanh_van"].Pois;
        Assert.Equal(4, pois.Count(p => p.Kind == "fishing"));
        Assert.Equal(4, pois.Count(p => p.Kind == "ore"));
        Assert.Single(pois, p => p.Kind == "shrine");
        Assert.Single(pois, p => p.Kind == "camp");
        Assert.DoesNotContain(C.Validate(), i => i.StartsWith("fish") || i.StartsWith("place ") || i.StartsWith("recipe ")
                                                  || i.StartsWith("camp ") || i.StartsWith("loot table ") || i.StartsWith("town "));
    }

    [Fact]
    public void Every_fishing_spot_has_something_biting_in_every_season()
    {
        var e = TestContent.NewEngine();
        foreach (var spot in C.FishSpots.Values)
            foreach (var season in Enum.GetValues<Season>())
            {
                e.State.Calendar.Month = MonthIn(season);
                Assert.True(Fishing.Pool(e.State, C, spot).Any(x => x.Catch.Item != null), $"{spot.Poi} in {season}");
            }
    }

    [Fact]
    public void Casting_spends_a_footwork_and_something_bites()
    {
        var e = TestContent.NewEngine();
        Stand(e, "poi_fish_bridge");
        var footwork = e.Player.Footwork;
        var bite = e.CastLine("poi_fish_bridge");
        Assert.NotNull(bite);
        Assert.Same(bite, e.PendingBite);
        Assert.Equal(footwork - Fishing.CastFootwork, e.Player.Footwork);
        Assert.True(bite!.ItemId != null || bite.Loot != null);
        Assert.InRange(bite.Difficulty, 0, 1);
    }

    [Fact]
    public void You_can_only_fish_at_the_water()
    {
        var e = TestContent.NewEngine();
        var footwork = e.Player.Footwork;
        Assert.Null(e.CastLine("poi_fish_bridge"));
        Assert.Null(e.CastLine("poi_village"));
        Assert.Equal(footwork, e.Player.Footwork);
        Assert.Empty(e.LandCatch());
    }

    [Fact]
    public void A_landed_fish_goes_in_the_bag_and_the_log()
    {
        var e = TestContent.NewEngine();
        Stand(e, "poi_fish_reeds");
        Bite? bite = null;
        for (var i = 0; i < 40 && bite?.ItemId == null; i++) bite = e.CastLine("poi_fish_reeds");
        Assert.NotNull(bite?.ItemId);
        var id = bite!.ItemId!;
        var before = Inventory.Count(e.Player, id);
        var events = e.LandCatch();
        Assert.Contains(events, ev => ev.Kind == "fish_caught");
        Assert.Equal(before + 1, Inventory.Count(e.Player, id));
        Assert.Equal(1, e.Player.Counters.Catches[id]);
        Assert.True(e.Player.Counters.FishCaught >= 1);
        Assert.Null(e.PendingBite);
        Assert.Empty(e.LandCatch()); // it's already in the bag
    }

    [Fact]
    public void A_fish_that_gets_away_is_gone()
    {
        var e = TestContent.NewEngine();
        Stand(e, "poi_fish_bridge");
        e.CastLine("poi_fish_bridge");
        e.LoseCatch();
        Assert.Null(e.PendingBite);
        Assert.Empty(e.LandCatch());
        Assert.Equal(0, e.Player.Counters.FishCaught);
    }

    [Fact]
    public void The_seasons_decide_what_bites_upstream()
    {
        var e = TestContent.NewEngine();
        var upper = C.FishSpots["poi_fish_upper"];
        e.State.Calendar.Month = MonthIn(Season.Summer);
        Assert.DoesNotContain(Fishing.Pool(e.State, C, upper), x => x.Catch.Item == "fish_silver_thread");
        e.State.Calendar.Month = MonthIn(Season.Winter);
        Assert.Contains(Fishing.Pool(e.State, C, upper), x => x.Catch.Item == "fish_silver_thread");
    }

    [Fact]
    public void A_lucky_stick_doubles_the_rare_fish_only()
    {
        var e = TestContent.NewEngine();
        var spot = C.FishSpots["poi_fish_bridge"];
        double Weight(string id) => Fishing.Pool(e.State, C, spot).First(x => x.Catch.Item == id).Weight;
        var golden = Weight("fish_golden_carp");
        var carp = Weight("fish_carp");
        var lucky = C.Fortunes.First(f => f.LuckyCatch);
        e.Player.Fortune = new FortuneState { Id = lucky.Id, Month = e.State.Calendar.MonthIndex };
        Assert.Equal(golden * 2, Weight("fish_golden_carp"));
        Assert.Equal(carp, Weight("fish_carp"));
    }

    [Fact]
    public void Letting_a_spirit_turtle_go_earns_karma_and_a_year_of_life()
    {
        var e = TestContent.NewEngine();
        var karma = e.Player.Karma;
        var lifespan = e.Player.LifespanSpecial;
        var events = Fishing.Land(e.State, C, new Bite { ItemId = "spirit_turtle", CanRelease = true }, release: true, new Pcg32(1));
        Assert.Contains(events, ev => ev.Kind == "fish_released");
        Assert.Equal(karma + C.Fish["spirit_turtle"].ReleaseKarma, e.Player.Karma);
        Assert.Equal(lifespan + 1, e.Player.LifespanSpecial);
        Assert.Equal(0, Inventory.Count(e.Player, "spirit_turtle"));
        Assert.Equal(1, e.Player.Counters.Catches["spirit_turtle"]);
    }

    [Fact]
    public void Only_some_catches_may_be_let_go()
    {
        var e = TestContent.NewEngine();
        Fishing.Land(e.State, C, new Bite { ItemId = "fish_carp", CanRelease = false }, release: true, new Pcg32(1));
        Assert.Equal(1, Inventory.Count(e.Player, "fish_carp"));
        Assert.True(C.Fish["fish_golden_carp"].ReleaseKarma > 0);
        Assert.Equal(0, C.Fish["fish_carp"].ReleaseKarma);
    }

    [Fact]
    public void Something_sunken_pays_out()
    {
        var e = TestContent.NewEngine();
        var silver = e.Player.Silver;
        var events = Fishing.Land(e.State, C, new Bite { Loot = "sunken_things" }, release: false, new Pcg32(3));
        Assert.Contains(events, ev => ev.Kind == "fish_sunken");
        Assert.True(e.Player.Silver >= silver + 15);
    }

    [Fact]
    public void Steadier_hands_come_with_every_eight_fish()
    {
        var p = new PlayerState();
        Assert.Equal(1, Fishing.Level(p));
        p.Counters.FishCaught = 8;
        Assert.Equal(2, Fishing.Level(p));
        p.Counters.FishCaught = 500;
        Assert.Equal(10, Fishing.Level(p));
    }

    [Fact]
    public void A_vein_breaks_into_ore_then_rests_three_months()
    {
        var e = TestContent.NewEngine();
        Stand(e, "poi_ore_village");
        var footwork = e.Player.Footwork;
        var bag = e.Player.Items.Sum(i => i.Qty);
        var events = e.Mine("poi_ore_village");
        Assert.Contains(events, ev => ev.Kind == "ore_mined");
        Assert.Equal(footwork - Mining.Footwork, e.Player.Footwork);
        Assert.InRange(e.Player.Items.Sum(i => i.Qty) - bag, 1, 3);
        Assert.Equal(e.Player.Items.Sum(i => i.Qty) - bag, e.Player.Counters.OreMined);
        Assert.False(e.OreReady("poi_ore_village"));
        Assert.Contains(e.Mine("poi_ore_village"), ev => ev.Kind == "ore_empty");

        e.State.Calendar.MonthIndex += Mining.RegrowMonths;
        Assert.True(e.OreReady("poi_ore_village"));
    }

    [Fact]
    public void You_can_only_mine_at_the_vein()
    {
        var e = TestContent.NewEngine();
        var footwork = e.Player.Footwork;
        Assert.Empty(e.Mine("poi_ore_mountain"));
        Assert.Empty(e.Mine("poi_shrine"));
        Assert.Equal(footwork, e.Player.Footwork);
        Assert.True(e.OreReady("poi_ore_mountain"));
    }

    [Fact]
    public void The_mountain_seam_is_harder_and_gives_cold_iron()
    {
        var mountain = C.Maps["thanh_van"].Pois.First(p => p.Id == "poi_ore_mountain");
        var village = C.Maps["thanh_van"].Pois.First(p => p.Id == "poi_ore_village");
        Assert.True(Mining.Strikes(mountain) > Mining.Strikes(village));
        Assert.Equal(Mining.DefaultStrikes, Mining.Strikes(village));
        var deep = C.LootTables["thanh_van_deep_ore"].Entries;
        Assert.Equal("cold_iron", deep.OrderByDescending(x => x.Weight).First().Id);
    }

    [Fact]
    public void A_rich_vein_stick_gives_one_more_piece()
    {
        var plain = TestContent.NewEngine(seed: 7);
        var blessed = TestContent.NewEngine(seed: 7);
        var rich = C.Fortunes.First(f => f.RichVein);
        blessed.Player.Fortune = new FortuneState { Id = rich.Id, Month = blessed.State.Calendar.MonthIndex };
        foreach (var e in new[] { plain, blessed })
        {
            Stand(e, "poi_ore_north");
            e.Mine("poi_ore_north");
        }
        Assert.Equal(plain.Player.Counters.OreMined + 1, blessed.Player.Counters.OreMined);
    }

    [Fact]
    public void The_forge_smelts_ore_into_enhancement_stones()
    {
        var e = TestContent.NewEngine();
        e.Player.Silver = 100;
        Inventory.Add(e.Player, Inventory.Resolve(C, "iron_ore", 4));
        Assert.Contains(e.Smelt("iron_ore"), ev => ev.Kind == "smelt_short");
        Assert.Equal(4, Inventory.Count(e.Player, "iron_ore"));

        Inventory.Add(e.Player, Inventory.Resolve(C, "iron_ore", 2));
        var stones = Inventory.Count(e.Player, "enhancement_stone_common");
        Assert.Contains(e.Smelt("iron_ore"), ev => ev.Kind == "smelted");
        Assert.Equal(1, Inventory.Count(e.Player, "iron_ore"));
        Assert.Equal(stones + 1, Inventory.Count(e.Player, "enhancement_stone_common"));
        Assert.Equal(80, e.Player.Silver);

        Inventory.Add(e.Player, Inventory.Resolve(C, "cold_iron", 3));
        e.Smelt("cold_iron");
        Assert.Equal(1, Inventory.Count(e.Player, "enhancement_stone_uncommon"));
        Assert.Empty(e.Smelt("raw_jade"));
    }
}
