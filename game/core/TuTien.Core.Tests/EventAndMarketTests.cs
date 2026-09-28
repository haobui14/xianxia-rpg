using System.Text.Json;
using TuTien.Core.Content;
using TuTien.Core.Events;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>The web game's events made whole (their rewards, foes, "set" effects, rest nights) and the monthly market.</summary>
public class EventAndMarketTests
{
    private static ContentDb C => TestContent.Content;

    private static DeltaDef Delta(string field, string op, string valueJson) =>
        new() { Field = field, Operation = op, Value = JsonDocument.Parse(valueJson).RootElement.Clone() };

    [Fact]
    public void Every_event_reward_and_foe_is_defined()
    {
        var missing = new List<string>();
        foreach (var ev in C.Events.Values)
        foreach (var choice in ev.Choices)
        foreach (var outcome in choice.Outcomes)
        {
            foreach (var id in outcome.Items ?? new List<string>())
                if (id != EventEngine.SpiritStoneReward && id != EventEngine.RandomTreasureReward && C.Item(id) == null)
                    missing.Add($"{ev.Id}: item {id}");
            if (!string.IsNullOrEmpty(outcome.TriggerCombat) && C.Enemy(outcome.TriggerCombat) == null)
                missing.Add($"{ev.Id}: foe {outcome.TriggerCombat}");
        }
        Assert.True(missing.Count == 0, string.Join("\n", missing));
    }

    [Fact]
    public void Set_puts_a_stat_at_a_value_or_at_its_maximum()
    {
        var e = TestContent.NewEngine();
        var p = e.Player;
        p.QiMax = 80;
        p.Qi = 10;
        var events = new List<GameEvent>();
        EventEngine.ApplyDelta(e.State, C, Delta("stats.qi", "set", "\"qi_max\""), DeltaPolicy.Authored, events);
        Assert.Equal(80, p.Qi);
        EventEngine.ApplyDelta(e.State, C, Delta("stats.qi", "set", "0"), DeltaPolicy.Authored, events);
        Assert.Equal(0, p.Qi);
    }

    [Fact]
    public void A_spirit_stone_reward_pays_stones_and_random_treasure_is_a_real_item()
    {
        var e = TestContent.NewEngine();
        var p = e.Player;
        var ev = new EventDef
        {
            Id = "test_rewards",
            Choices =
            {
                new EventChoiceDef
                {
                    Id = "take",
                    Outcomes = { new EventOutcomeDef { Items = new List<string> { EventEngine.SpiritStoneReward, EventEngine.RandomTreasureReward } } },
                },
            },
        };
        var stones = p.SpiritStones;
        var items = p.Items.Sum(i => i.Qty);
        EventEngine.Resolve(e.State, C, ev, "take", new Pcg32(7), DeltaPolicy.Authored);
        Assert.Equal(stones + EventEngine.SpiritStonesPerReward, p.SpiritStones);
        Assert.Equal(items + 1, p.Items.Sum(i => i.Qty));
        Assert.DoesNotContain(p.Items, i => i.Id == EventEngine.SpiritStoneReward || i.Id == EventEngine.RandomTreasureReward);
        Assert.All(p.Items, i => Assert.NotNull(C.Item(i.Id)));
    }

    [Fact]
    public void A_breakthrough_feeling_held_back_eases_the_next_one_and_is_then_spent()
    {
        var e = TestContent.NewEngine();
        var plain = Cultivation.MajorBreakthroughThreshold(e.State);
        e.State.Flags[Cultivation.StoredFeelingFlag] = true;
        Assert.Equal(plain - 0.08, Cultivation.MajorBreakthroughThreshold(e.State), 6);
        e.Player.PendingMajorBreakthrough = true;
        Cultivation.CompleteMajorBreakthrough(e.State, C, performance: 1);
        Assert.False(e.State.Flag(Cultivation.StoredFeelingFlag));

        e.State.Flags[Cultivation.InnerDemonFlag] = true;
        Assert.True(Cultivation.MajorBreakthroughThreshold(e.State) < Cultivation.MajorBreakthroughThreshold(TestContent.NewEngine().State));
    }

    [Fact]
    public void Some_nights_at_the_inn_bring_a_rest_event()
    {
        var e = TestContent.NewEngine();
        var town = C.Towns.Values.First();
        var seen = new HashSet<string>();
        for (var i = 0; i < 60; i++)
        {
            e.Player.Silver = 1000;
            e.Player.Footwork = 20;
            e.Rest(town);
            if (e.RestEvent is { } id) seen.Add(id);
        }
        Assert.NotEmpty(seen);
        Assert.All(seen, id => Assert.Equal("rest", C.Events[id].Trigger));
    }

    [Fact]
    public void The_months_wares_hold_for_the_month_then_change()
    {
        var e = TestContent.NewEngine();
        var town = C.Towns.Values.First();
        var wares = e.Wares(town);
        Assert.Equal(Market.WaresPerMonth, wares.Offers.Count);
        Assert.Same(wares, e.Wares(town));
        Assert.DoesNotContain(wares.Offers, o => town.Shop.Any(s => s.ItemId == o.ItemId));
        foreach (var o in wares.Offers)
        {
            var rarity = C.Item(o.ItemId)!.Rarity;
            var forStones = rarity is "Rare" or "Epic" or "Legendary";
            Assert.Equal(forStones, o.SpiritStones > 0);
            Assert.Equal(forStones, o.Silver == 0);
        }

        var before = wares.Offers.Select(o => o.ItemId).ToList();
        e.State.Calendar.MonthIndex += 1;
        var next = e.Wares(town);
        Assert.NotSame(wares, next);
        e.State.Calendar.MonthIndex -= 1;
        Assert.Equal(before, e.Wares(town).Offers.Select(o => o.ItemId).ToList()); // the same month rolls the same wares
    }

    [Fact]
    public void Buying_a_ware_takes_one_from_its_stock_until_it_sells_out()
    {
        var e = TestContent.NewEngine();
        var wares = e.Wares(C.Towns.Values.First());
        var i = wares.Offers.FindIndex(o => o.SpiritStones == 0);
        Assert.True(i >= 0, "a ware for silver");
        var offer = wares.Offers[i];
        e.Player.Silver = 100000;
        var left = offer.Left;
        for (var n = 0; n < left; n++) e.BuyWare(wares, i);
        Assert.Equal(0, offer.Left);
        Assert.Equal(left, Inventory.Count(e.Player, offer.ItemId));
        var events = e.BuyWare(wares, i);
        Assert.Contains(events, ev => ev.Kind == "sold_out");
        Assert.Equal(left, Inventory.Count(e.Player, offer.ItemId));
    }

    [Fact]
    public void The_caravan_lays_out_its_own_wares()
    {
        var e = TestContent.NewEngine();
        var caravan = e.CaravanWares();
        Assert.NotEmpty(caravan.Offers);
        Assert.All(caravan.Offers, o => Assert.NotNull(C.Item(o.ItemId)));
    }
}
