using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Tests;

/// <summary>The alchemy furnace at the Hundred Herbs Hall, and the Earth God shrine's fortune sticks.</summary>
public class AlchemyAndShrineTests
{
    private static ContentDb C => TestContent.Content;

    private static void Give(GameEngine e, string id, int qty) => Inventory.Add(e.Player, Inventory.Resolve(C, id, qty));

    [Fact]
    public void Purity_sets_the_grade_and_the_grade_the_pills()
    {
        Assert.Equal(PillGrade.Failed, Alchemy.Grade(0.2));
        Assert.Equal(PillGrade.Low, Alchemy.Grade(0.5));
        Assert.Equal(PillGrade.Mid, Alchemy.Grade(0.7));
        Assert.Equal(PillGrade.High, Alchemy.Grade(0.95));
        Assert.Equal(new[] { 0, 1, 2, 3 }, new[] { PillGrade.Failed, PillGrade.Low, PillGrade.Mid, PillGrade.High }.Select(Alchemy.Yield));
    }

    [Fact]
    public void Lighting_the_furnace_takes_the_herbs_the_fee_and_two_footwork()
    {
        var e = TestContent.NewEngine();
        Give(e, "healing_herb", 3);
        var silver = e.Player.Silver;
        var footwork = e.Player.Footwork;
        var events = e.StartBrew("hoi_huyet_dan");
        Assert.Contains(events, ev => ev.Kind == "brew_started");
        Assert.Equal(0, Inventory.Count(e.Player, "healing_herb"));
        Assert.Equal(silver - C.Recipe("hoi_huyet_dan")!.Silver, e.Player.Silver);
        Assert.Equal(footwork - Alchemy.Footwork, e.Player.Footwork);
        Assert.Equal("hoi_huyet_dan", e.PendingBrew?.Id);
        Assert.Empty(e.StartBrew("hoi_huyet_dan")); // one brew at a time

        var pills = Inventory.Count(e.Player, "healing_pill");
        Assert.Contains(e.FinishBrew(0.95, exploded: false), ev => ev.Kind == "brew_done");
        Assert.Equal(pills + 3, Inventory.Count(e.Player, "healing_pill"));
        Assert.Equal(1, e.Player.Counters.PillsBrewed);
        Assert.Null(e.PendingBrew);
        Assert.Empty(e.FinishBrew(1, false));
    }

    [Fact]
    public void A_wavering_fire_leaves_ash_and_a_blown_furnace_a_burn()
    {
        var e = TestContent.NewEngine();
        Give(e, "lingzhi_grass", 6);
        e.StartBrew("tu_khi_dan_ha");
        Assert.Contains(e.FinishBrew(0.1, false), ev => ev.Kind == "brew_failed");
        Assert.Equal(0, Inventory.Count(e.Player, "low_grade_pill"));

        var hp = e.Player.Hp;
        e.StartBrew("tu_khi_dan_ha");
        Assert.Contains(e.FinishBrew(0.99, exploded: true), ev => ev.Kind == "brew_exploded");
        Assert.Equal(0, Inventory.Count(e.Player, "low_grade_pill"));
        Assert.True(e.Player.Hp < hp && e.Player.Hp >= 1);
        Assert.Equal(0, e.Player.Counters.PillsBrewed);
    }

    [Fact]
    public void Recipes_wait_for_the_realm_and_the_herbs()
    {
        var e = TestContent.NewEngine();
        var pill = C.Recipe("truc_co_dan")!;
        var why = Alchemy.Blocked(C, e.Player, pill);
        Assert.NotNull(why);
        Assert.Contains("Qi Condensation 7", why!.Value.En);
        Assert.Empty(e.StartBrew("unknown_recipe"));

        e.Player.Realm = Realm.LuyenKhi;
        e.Player.Stage = 7;
        Assert.StartsWith("Missing", Alchemy.Blocked(C, e.Player, pill)!.Value.En);
        foreach (var i in pill.Ingredients) Give(e, i.Item, i.Qty);
        e.Player.Silver = 0;
        Assert.Contains(e.StartBrew("truc_co_dan"), ev => ev.Kind == "brew_blocked");
        Assert.True(pill.Ingredients.All(i => Inventory.Count(e.Player, i.Item) == i.Qty));
        e.Player.Silver = 100;
        Assert.Null(Alchemy.Blocked(C, e.Player, pill));
    }

    [Fact]
    public void Every_recipe_can_be_gathered_for_on_this_map()
    {
        // Each ingredient is a herb from a patch, a fish from a spot, a beast's drop or a vein's ore.
        var sources = C.LootTables.Values.SelectMany(t => t.Entries.Select(x => x.Id))
            .Concat(C.FishSpots.Values.SelectMany(s => s.Catches.Where(c => c.Item != null).Select(c => c.Item!)))
            .ToHashSet();
        foreach (var r in C.Recipes)
            foreach (var i in r.Ingredients)
                Assert.True(sources.Contains(i.Item), $"{r.Id}: nowhere to get {i.Item}");
        Assert.Equal(C.Recipes.Count, C.Recipes.Select(r => r.Id).Distinct().Count());
    }

    [Fact]
    public void One_fortune_stick_a_month_for_a_little_incense()
    {
        var e = TestContent.NewEngine();
        var silver = e.Player.Silver;
        var events = e.DrawFortune();
        Assert.Contains(events, ev => ev.Kind == "fortune");
        Assert.NotNull(e.Fortune);
        Assert.Equal(silver - Shrine.IncenseSilver, e.Player.Silver);
        Assert.Contains(e.DrawFortune(), ev => ev.Kind == "fortune_again");
        Assert.Equal(silver - Shrine.IncenseSilver, e.Player.Silver);

        e.State.Calendar.MonthIndex += 1;
        Assert.Null(e.Fortune);
        Assert.Contains(e.DrawFortune(), ev => ev.Kind == "fortune");
    }

    [Fact]
    public void A_good_stick_raises_the_months_cultivation_and_an_ill_one_can_be_lifted()
    {
        var e = TestContent.NewEngine();
        var plain = e.PreviewMonth(seclusion: false).Total;
        var great = C.Fortunes.First(f => f.Cultivation >= 15);
        e.Player.Fortune = new FortuneState { Id = great.Id, Month = e.State.Calendar.MonthIndex };
        Assert.Equal(great.Cultivation, e.PreviewMonth(seclusion: false).BlessingBonus);
        Assert.True(e.PreviewMonth(seclusion: false).Total > plain);

        var ill = C.Fortunes.First(f => f.Grade == "ill");
        e.Player.Fortune = new FortuneState { Id = ill.Id, Month = e.State.Calendar.MonthIndex };
        Assert.True(e.PreviewMonth(seclusion: false).BlessingBonus < 0);
        e.Player.Silver = Shrine.DispelSilver;
        Assert.Contains(e.DispelFortune(), ev => ev.Kind == "fortune_dispelled");
        Assert.Equal(0, e.Player.Silver);
        Assert.Equal(0, e.PreviewMonth(seclusion: false).BlessingBonus);
        Assert.Empty(e.DispelFortune());
    }

    [Fact]
    public void A_stick_speaks_only_for_its_own_month()
    {
        var e = TestContent.NewEngine();
        e.Player.Fortune = new FortuneState { Id = C.Fortunes[0].Id, Month = e.State.Calendar.MonthIndex - 1 };
        Assert.Null(e.Fortune);
        Assert.Equal(0, Shrine.CultivationBonus(e.State, C));
    }

    [Fact]
    public void The_month_that_ends_under_a_good_stick_is_counted_with_it()
    {
        var blessed = TestContent.NewEngine(seed: 9);
        var plain = TestContent.NewEngine(seed: 9);
        var great = C.Fortunes.First(f => f.Cultivation >= 15);
        blessed.Player.Fortune = new FortuneState { Id = great.Id, Month = blessed.State.Calendar.MonthIndex };
        Assert.True(blessed.EndMonth().Cultivation!.Total > plain.EndMonth().Cultivation!.Total);
    }

    [Fact]
    public void Every_stick_has_a_verse_in_both_languages_and_a_meaning()
    {
        Assert.Equal(12, C.Fortunes.Count);
        Assert.Equal(C.Fortunes.Count, C.Fortunes.Select(f => f.Number).Distinct().Count());
        foreach (var f in C.Fortunes)
        {
            Assert.False(string.IsNullOrWhiteSpace(f.Verse) || string.IsNullOrWhiteSpace(f.VerseEn), f.Id);
            Assert.False(Names.HasVietnamese(Shrine.Meaning(f).En), f.Id);
            Assert.Contains(f.Grade, new[] { "great", "good", "fair", "ill" });
        }
        Assert.Contains(C.Fortunes, f => f.Guidance);
    }

    [Fact]
    public void A_guiding_stick_shows_the_nearest_chance_meeting_from_afar()
    {
        var e = TestContent.NewEngine();
        Assert.NotEmpty(e.State.World.Adventures);
        var p = e.Player;
        var nearest = e.State.World.Adventures.OrderBy(a => Math.Abs(a.X - p.X) + Math.Abs(a.Y - p.Y)).First();
        nearest.Hidden = true;
        var events = Shrine.Guide(e.State, C, e.Map);
        Assert.Contains(events, ev => ev.Kind == "fortune_guide");
        Assert.True(nearest.Revealed);
        Assert.False(nearest.Hidden);
        Assert.True(e.Fog().Get(nearest.X, nearest.Y));
        Assert.Contains(e.VisibleThings(), t => t.Kind == InteractKind.Adventure && t.Id == nearest.Id);
    }

    [Fact]
    public void An_offering_earns_karma_once_a_month()
    {
        var e = TestContent.NewEngine();
        e.Player.Silver = 200;
        var karma = e.Player.Karma;
        Assert.Contains(e.MakeOffering(), ev => ev.Kind == "offering");
        Assert.Equal(karma + Shrine.OfferingKarma, e.Player.Karma);
        Assert.Empty(e.MakeOffering());
        Assert.Equal(200 - Shrine.OfferingSilver, e.Player.Silver);
    }
}
