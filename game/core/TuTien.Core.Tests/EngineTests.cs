using TuTien.Core.Combat;
using TuTien.Core.Events;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Tests;

public class EngineTests
{
    private static Content.ContentDb C => TestContent.Content;

    private static CombatOutcome Win(GameEngine e, Encounter enc) => new()
    {
        EncounterId = enc.Id, Victory = true, HpLeft = e.Player.Hp, QiLeft = e.Player.Qi,
        Defeated = enc.EnemyIds.ToList(),
    };

    private static void PlaceNextTo(GameEngine e, BeastPack pack)
    {
        foreach (var c in e.Map.Neighbors(new Cell(pack.X, pack.Y)))
        {
            if (e.Map.StepCost(c.X, c.Y, e.Player) < 0 || Spawns.Occupied(e.State, e.Map, c.X, c.Y)) continue;
            e.Player.X = c.X;
            e.Player.Y = c.Y;
            return;
        }
        throw new InvalidOperationException("no free tile next to the pack");
    }

    [Fact]
    public void Moving_spends_footwork_by_terrain_and_reveals_fog()
    {
        var e = TestContent.NewEngine();
        var before = e.Player.Footwork;
        var step = e.Step(1, 0);
        if (!step.Moved) step = e.Step(0, -1);
        Assert.True(step.Moved);
        Assert.Equal(before - step.Cost, e.Player.Footwork);
        Assert.True(e.Fog().Get(e.Player.X, e.Player.Y));
    }

    [Fact]
    public void Movement_stops_when_footwork_runs_out()
    {
        var e = TestContent.NewEngine();
        e.Player.Footwork = 0;
        var step = e.Step(1, 0);
        Assert.False(step.Moved);
        Assert.NotNull(step.Blocked);
    }

    [Fact]
    public void Walking_into_a_beast_starts_a_fight_and_winning_clears_it()
    {
        var e = TestContent.NewEngine();
        var pack = e.State.World.Beasts.First();
        PlaceNextTo(e, pack);
        var step = e.StepTo(pack.X, pack.Y);
        Assert.NotNull(step.Encounter);
        Assert.Same(step.Encounter, e.ActiveEncounter);
        Assert.Equal(pack.EnemyIds.Count, e.BuildEnemies(step.Encounter!).Count);

        var silver = e.Player.Silver;
        var result = e.ResolveCombat(Win(e, step.Encounter!));
        Assert.DoesNotContain(e.State.World.Beasts, b => b.Id == pack.Id);
        Assert.True(result.Exp > 0);
        Assert.Equal(silver + result.Loot.Silver, e.Player.Silver);
        Assert.Null(e.ActiveEncounter);
        Assert.Equal(pack.EnemyIds.Count, e.Player.Counters.Kills);
    }

    [Fact]
    public void Defeat_injures_costs_silver_and_carries_you_to_the_village()
    {
        var e = TestContent.NewEngine();
        var pack = e.State.World.Beasts.First();
        PlaceNextTo(e, pack);
        var enc = e.StepTo(pack.X, pack.Y).Encounter!;
        var month = e.State.Calendar.MonthIndex;
        var result = e.ResolveCombat(new CombatOutcome { EncounterId = enc.Id, Victory = false, HpLeft = 0 });
        var town = e.Map.Def.Pois.First(p => p.Kind == "town");
        Assert.Equal((town.X, town.Y), (e.Player.X, e.Player.Y));
        Assert.Equal(80, e.Player.Silver);
        Assert.NotEmpty(e.Player.Injuries);
        Assert.Equal(month + result.MonthsLost, e.State.Calendar.MonthIndex);
        Assert.True(e.Player.Hp >= e.Player.HpMax * 3 / 10);
    }

    [Fact]
    public void Bounties_track_kills_and_pay_out()
    {
        var e = TestContent.NewEngine();
        var town = C.Towns["thanh_van_village"];
        e.AcceptBounty(town, "bounty_wolves");
        for (var i = 0; i < 3; i++)
        {
            var enc = e.StartAdventureFight("forest_wolf", "verdant_forest")!;
            e.ResolveCombat(Win(e, enc));
        }
        var silver = e.Player.Silver;
        var events = e.ClaimBounties();
        Assert.Single(events);
        Assert.Equal(silver + 60, e.Player.Silver);
        Assert.Empty(e.Player.Bounties);
    }

    [Fact]
    public void Gathering_uses_footwork_and_the_patch_regrows()
    {
        var e = TestContent.NewEngine();
        var herb = e.Map.Def.Pois.First(p => p.Kind == "herb");
        e.Player.X = herb.X;
        e.Player.Y = herb.Y;
        var footwork = e.Player.Footwork;
        var events = e.Gather(herb.Id);
        Assert.Contains(events, ev => ev.Kind == "item_gained");
        Assert.Equal(footwork - 1, e.Player.Footwork);
        Assert.Contains(e.Gather(herb.Id), ev => ev.Kind == "herb_empty");
        e.EndMonth();
        e.EndMonth();
        e.Player.X = herb.X;
        e.Player.Y = herb.Y;
        Assert.Contains(e.Gather(herb.Id), ev => ev.Kind == "item_gained");
    }

    [Fact]
    public void Shop_buy_sell_and_manuals_teach_arts()
    {
        var e = TestContent.NewEngine();
        var town = C.Towns["thanh_van_village"];
        e.Player.Silver = 500;
        e.Buy(town, "manual_ho_the");
        Assert.Equal(320, e.Player.Silver);
        var learned = e.UseItem("manual_ho_the");
        Assert.Contains(learned, ev => ev.Kind == "skill_learned");
        Assert.Contains("ho_the_cuong_khi", e.Player.SkillSlots);

        e.Buy(town, "hoi_huyet_tan");
        e.Sell("hoi_huyet_tan");
        Assert.Equal(320 - 15 + 10, e.Player.Silver);
    }

    [Fact]
    public void Winning_the_sect_trial_joins_the_sect_and_boosts_cultivation()
    {
        var e = TestContent.NewEngine();
        var before = Cultivation.MonthlyGain(e.State, C, 0, false).SectMultiplier;
        var enc = e.StartSectTrial("thanh_van_kiem")!;
        Assert.True(enc.NonLethal);
        e.ResolveCombat(Win(e, enc));
        Assert.Equal("thanh_van_kiem", e.Player.SectId);
        Assert.Equal("NgoạiMôn", e.Player.SectRank);
        Assert.True(Cultivation.MonthlyGain(e.State, C, 0, false).SectMultiplier > before);
        Assert.Contains(e.Player.Skills, s => s.Id == "thanh_van_kiem_quyet");
    }

    [Fact]
    public void Bad_karma_bars_righteous_sects()
    {
        var e = TestContent.NewEngine();
        e.Player.Karma = -300;
        Assert.Null(e.StartSectTrial("thanh_van_kiem"));
    }

    [Fact]
    public void Gifts_build_favor_and_leave_a_debt_of_gratitude()
    {
        var e = TestContent.NewEngine();
        var npc = e.State.World.Npcs.First(n => !n.Anchor);
        var events = e.Gift(npc.Id, "hoi_huyet_tan");
        Assert.Single(events);
        Assert.True(npc.RelationTo(NpcSim.PlayerKey) > 0);
        Assert.True(Karma.WeightWith(e.State, npc.Id, LedgerKind.An) > 0);
        Assert.Contains(e.Gift(npc.Id, "hoi_huyet_tan"), ev => ev.Kind == "gift_again"); // once a month
    }

    [Fact]
    public void Killing_a_righteous_npc_costs_karma_and_makes_enemies_of_their_friends()
    {
        var e = TestContent.NewEngine();
        var victim = e.State.World.Npcs.First(n => !n.Anchor);
        victim.Alignment = 60;
        var friend = e.State.World.Npcs.First(n => n.Id != victim.Id && !n.Anchor);
        friend.Relations[victim.Id] = 80;

        var enc = e.ChallengeNpc(victim.Id, lethal: true)!;
        Assert.Equal(victim.Realm, enc.RealmOverride);
        e.ResolveCombat(Win(e, enc));
        Assert.False(victim.Alive);
        Assert.Equal(-60, e.Player.Karma);
        Assert.True(Karma.WeightWith(e.State, friend.Id, LedgerKind.Oan) >= 40);
    }

    [Fact]
    public void Npc_combatants_scale_with_their_realm()
    {
        var e = TestContent.NewEngine();
        var weak = e.BuildEnemies(new Encounter { Id = "a", EnemyIds = { "rogue_cultivator" }, RealmOverride = Realm.LuyenKhi, StageOverride = 1 })[0];
        var strong = e.BuildEnemies(new Encounter { Id = "b", EnemyIds = { "rogue_cultivator" }, RealmOverride = Realm.TrucCo, StageOverride = 3 })[0];
        Assert.True(strong.HpMax > weak.HpMax * 2);
        Assert.Equal(Realm.TrucCo, strong.Realm);
    }

    [Fact]
    public void Secret_realm_three_floors_then_first_clear_rewards()
    {
        var e = TestContent.NewEngine();
        e.Player.Silver = 200;
        Assert.Contains(e.EnterRealm("spirit_herb_realm"), ev => ev.Kind == "realm_enter");
        Assert.Equal(100, e.Player.Silver);

        for (var floor = 1; floor <= 3; floor++)
        {
            var enc = e.StartFloorFight()!;
            Assert.Equal("dungeon", enc.Source);
            e.ResolveCombat(Win(e, enc));
            Assert.NotNull(e.OpenFloorChest());
            var events = e.AdvanceRealm();
            if (floor < 3) Assert.Equal(floor + 1, e.State.World.Run!.Floor);
            else Assert.Contains(events, ev => ev.Kind == "realm_clear");
        }
        Assert.Null(e.State.World.Run);
        Assert.Equal(1, Inventory.Count(e.Player, "wood_cultivation_manual"));
        Assert.Equal(1, e.State.World.DungeonClears["spirit_herb_realm"]);

        // The first-clear book teaches a real technique that speeds cultivation.
        e.UseItem("wood_cultivation_manual");
        Assert.Contains(e.Player.Techniques, t => t.Id == "thanh_moc_truong_sinh_quyet");
    }

    [Fact]
    public void First_breakthrough_unlocks_the_spirit_roots_art()
    {
        var e = GameEngine.NewGame(C, 3, "Hỏa Nhi", 17, TestContent.Root(RootGrade.Kha, Element.Hoa));
        Cultivation.AddExp(e.State, C, 100, 0);
        Assert.True(e.BreakthroughReady);
        e.CompleteBreakthrough(1.0);
        Assert.Equal(Realm.LuyenKhi, e.Player.Realm);
        Assert.Contains("hoa_cau_thuat", e.Player.SkillSlots);
        Assert.Equal(WorldTick.FootworkMax(e.Player), e.Player.FootworkMax);
    }

    [Fact]
    public void Events_check_requirements_and_apply_effects()
    {
        var e = TestContent.NewEngine();
        var ambush = C.Events["bandit_ambush"];
        e.Player.Silver = 40;
        Assert.False(e.Choices(ambush).Single(c => c.Choice.Id == "pay_toll").Available);
        e.Player.Silver = 60;
        Assert.True(e.Choices(ambush).Single(c => c.Choice.Id == "pay_toll").Available);
        e.ResolveEvent("bandit_ambush", "pay_toll");
        Assert.Equal(10, e.Player.Silver);

        var fight = e.ResolveEvent("bandit_ambush", "fight");
        Assert.Equal("bandit_leader", fight.CombatEnemyId);
        Assert.NotNull(e.ActiveEncounter);
        e.AbandonEncounter();

        e.ResolveEvent("resource_discovery", "gather_some");
        Assert.Equal(5, e.Player.Karma);
        Assert.Equal(1, Inventory.Count(e.Player, "spirit_herb"));
    }

    [Fact]
    public void Authored_and_ai_policies_clamp_differently()
    {
        var e = TestContent.NewEngine();
        var huge = new Content.DeltaDef
        {
            Field = "inventory.silver", Operation = "add",
            Value = System.Text.Json.JsonDocument.Parse("50000").RootElement,
        };
        var events = new List<GameEvent>();
        var silver = e.Player.Silver;
        EventEngine.ApplyDelta(e.State, C, huge, DeltaPolicy.Ai, events);
        Assert.Equal(silver + 1000, e.Player.Silver);
        EventEngine.ApplyDelta(e.State, C, huge, DeltaPolicy.Authored, events);
        Assert.Equal(silver + 6000, e.Player.Silver);
    }

    [Fact]
    public void Saves_round_trip_exactly_and_keep_vietnamese_text()
    {
        var e = TestContent.NewEngine(11);
        for (var i = 0; i < 5; i++) e.EndMonth();
        var json = e.Save();
        Assert.Contains("Lâm Vân", json);
        var loaded = GameEngine.Load(C, json);
        Assert.Equal(json, loaded.Save());
    }

    [Fact]
    public void Offline_storyteller_always_has_something_to_say()
    {
        var e = TestContent.NewEngine();
        foreach (var npc in e.State.World.Npcs.Take(8))
            Assert.NotEmpty(e.Talk(npc.Id));
        var card = e.CardFor("npc_elder");
        Assert.Equal("Lâm Bá", card.Name);
        Assert.Equal("Lâm Vân", card.PlayerName);
    }
}
