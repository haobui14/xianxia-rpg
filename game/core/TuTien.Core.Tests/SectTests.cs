using TuTien.Core.Combat;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>Sect life (design §7.9): the mission hall, contribution and merit, ranks, stipends, the treasury and the chamber.</summary>
public class SectTests
{
    private static Content.ContentDb C => TestContent.Content;

    private static GameEngine Disciple(ulong seed = 42)
    {
        var e = TestContent.NewEngine(seed);
        e.JoinSect("thanh_van_kiem");
        return e;
    }

    /// <summary>Put exactly these missions on the hall's board for this month.</summary>
    private static void Offer(GameEngine e, params string[] templateIds)
    {
        e.Player.MissionBoard.RolledMonth = e.State.Calendar.MonthIndex;
        e.Player.MissionBoard.Offers = templateIds.ToList();
    }

    private static ActiveMission Take(GameEngine e, string templateId)
    {
        Offer(e, templateId);
        e.AcceptMission(templateId);
        return e.Player.Missions.Single(m => m.TemplateId == templateId);
    }

    private static CombatResolution Win(GameEngine e, Encounter enc) => e.ResolveCombat(new CombatOutcome
    {
        EncounterId = enc.Id, Victory = true, HpLeft = e.Player.HpMax, QiLeft = e.Player.QiMax, Defeated = enc.EnemyIds.ToList(),
    });

    private static void PassMonths(GameEngine e, int months)
    {
        for (var i = 0; i < months; i++) e.EndMonth();
    }

    [Fact]
    public void Joining_makes_an_outer_disciple_whose_hall_offers_missions_for_a_sword_sect()
    {
        var e = Disciple();
        Assert.Equal("NgoạiMôn", e.Player.SectRank);
        Assert.Equal(0, e.Player.Merit);
        var board = e.MissionBoard();
        Assert.InRange(board.Count, 1, SectMissions.BoardSize);
        Assert.Equal(board.Count, board.Select(t => t.Id).Distinct().Count());
        foreach (var t in board)
        {
            Assert.Contains("Kiếm", t.SectTypes);
            // Thanh Vân is the only region with a map: nobody is sent to scout another.
            Assert.NotEqual("visit_region", t.Objective.Kind);
        }
    }

    [Fact]
    public void Nobody_outside_a_sect_sees_a_board()
    {
        var e = TestContent.NewEngine();
        Assert.Empty(e.MissionBoard());
        Offer(e, "patrol_bandits_easy");
        Assert.Empty(e.AcceptMission("patrol_bandits_easy"));
        Assert.Empty(e.Player.Missions);
    }

    [Fact]
    public void The_same_world_rolls_the_same_board_and_rolls_again_every_few_months()
    {
        var a = Disciple(7);
        var b = Disciple(7);
        Assert.Equal(a.MissionBoard().Select(t => t.Id), b.MissionBoard().Select(t => t.Id));
        var rolled = a.Player.MissionBoard.RolledMonth;
        PassMonths(a, SectMissions.BoardRefreshMonths - 1);
        a.MissionBoard();
        Assert.Equal(rolled, a.Player.MissionBoard.RolledMonth);
        PassMonths(a, 1);
        a.MissionBoard();
        Assert.Equal(a.State.Calendar.MonthIndex, a.Player.MissionBoard.RolledMonth);
    }

    [Fact]
    public void A_rival_hunt_is_offered_only_while_enough_rival_disciples_live()
    {
        var e = Disciple();
        var hunt = C.Missions.Single(t => t.Id == "hunt_demonic_hard");
        var sect = C.Sects["thanh_van_kiem"];
        foreach (var npc in e.State.World.Npcs.Where(n => n.SectId == "huyet_sat_ma_tong")) npc.SectId = null;
        Assert.DoesNotContain(hunt, SectMissions.Pool(e.State, C, sect));
        for (var i = 0; i < 2; i++) e.State.World.Npcs.Add(new NpcState { Id = $"npc_demon_{i}", Name = $"Ma Tu {i}", SectId = "huyet_sat_ma_tong", Realm = Realm.LuyenKhi, Stage = 3 });
        Assert.Contains(hunt, SectMissions.Pool(e.State, C, sect));
    }

    [Fact]
    public void Taking_a_mission_takes_it_off_the_board_and_a_disciple_carries_two_at_most()
    {
        var e = Disciple();
        Offer(e, "patrol_bandits_easy", "cultivate_basic_easy", "subdue_beasts_medium");
        e.AcceptMission("patrol_bandits_easy");
        Assert.DoesNotContain(e.MissionBoard(), t => t.Id == "patrol_bandits_easy");
        e.AcceptMission("cultivate_basic_easy");
        var full = e.AcceptMission("subdue_beasts_medium");
        Assert.Equal("mission_full", Assert.Single(full).Kind);
        Assert.Equal(SectMissions.MaxActive, e.Player.Missions.Count);
        var patrol = e.Player.Missions.First();
        Assert.Equal(2, patrol.Goal);
        Assert.Equal(e.State.Calendar.MonthIndex + 5, patrol.DeadlineMonth); // 15 of the web game's turns
    }

    [Fact]
    public void Fights_won_count_and_the_reward_waits_to_be_reported_at_the_hall()
    {
        var e = Disciple();
        var patrol = Take(e, "patrol_bandits_easy");
        Win(e, e.StartAdventureFight("forest_wolf", "verdant_forest")!);
        Assert.Equal(1, patrol.Progress);
        var second = Win(e, e.StartAdventureFight("forest_wolf", "verdant_forest")!);
        Assert.True(patrol.Done);
        Assert.Contains(second.Events, ev => ev.Kind == "mission_ready");
        var third = Win(e, e.StartAdventureFight("forest_wolf", "verdant_forest")!);
        Assert.DoesNotContain(third.Events, ev => ev.Kind == "mission_ready"); // said once

        var silver = e.Player.Silver;
        var done = e.ClaimMissions();
        Assert.Equal("mission_done", Assert.Single(done).Kind);
        Assert.Empty(e.Player.Missions);
        Assert.Equal(30, e.Player.Contribution);
        Assert.Equal(30, e.Player.Merit);
        Assert.Equal(silver + 80, e.Player.Silver);
        Assert.Equal(1, e.Player.Counters.MissionsCompleted);
    }

    [Fact]
    public void Losing_or_fleeing_counts_for_nothing()
    {
        var e = Disciple();
        var patrol = Take(e, "patrol_bandits_easy");
        var enc = e.StartAdventureFight("forest_wolf", "verdant_forest")!;
        e.ResolveCombat(new CombatOutcome { EncounterId = enc.Id, Fled = true, HpLeft = e.Player.Hp, QiLeft = e.Player.Qi });
        Assert.Equal(0, patrol.Progress);
    }

    [Fact]
    public void Gathering_missions_count_the_right_kind_of_find()
    {
        var e = Disciple();
        var mission = Take(e, "gather_materials_medium");
        Inventory.Apply(e.State, C, new LootRoll { Items = { Inventory.Resolve(C, "lingzhi_grass", 2), Inventory.Resolve(C, "healing_herb", 3) } });
        Assert.Equal(2, mission.Progress); // the grass is a material, the herb a medicine
        // Buying isn't gathering.
        e.Player.Silver = 1000;
        var village = e.Map.Def.Pois.First(p => p.Kind == "town");
        e.Buy(e.TownFor(village)!, "hoi_huyet_tan");
        Inventory.Apply(e.State, C, new LootRoll { Items = { Inventory.Resolve(C, "moc_tinh", 5) } });
        Assert.True(mission.Done);
        Assert.Equal(4, mission.Progress);
    }

    [Fact]
    public void A_rare_herb_mission_ignores_common_finds()
    {
        var e = Disciple();
        var mission = Take(e, "gather_rare_herb_hard");
        Inventory.Apply(e.State, C, new LootRoll { Items = { Inventory.Resolve(C, "healing_herb", 3) } });
        Assert.Equal(0, mission.Progress);
        Inventory.Apply(e.State, C, new LootRoll { Items = { Inventory.Resolve(C, "qi_gathering_pill", 1) } });
        Assert.True(mission.Done);
    }

    [Fact]
    public void Cultivation_missions_count_every_bit_of_exp()
    {
        var e = Disciple();
        var mission = Take(e, "cultivate_basic_easy");
        Assert.Equal(120, mission.Goal);
        var report = e.EndMonth();
        Assert.Equal((int)Math.Min(120, report.TotalExp), mission.Progress);
        e.Player.Items.Add(new ItemStack { Id = "low_beast_core", Name = "x", NameEn = "x", Type = "Material", Qty = 10 });
        for (var i = 0; i < 5 && !mission.Done; i++) e.UseItem("low_beast_core");
        Assert.True(mission.Done);
    }

    [Fact]
    public void Rival_hunts_count_only_the_rival_sects_disciples()
    {
        var e = Disciple();
        e.State.World.Npcs.Add(new NpcState { Id = "npc_demon", Name = "Huyết Ảnh", SectId = "huyet_sat_ma_tong", Realm = Realm.LuyenKhi, Stage = 2, Zone = "verdant_forest" });
        e.State.World.Npcs.Add(new NpcState { Id = "npc_plain", Name = "Vô Danh", Realm = Realm.LuyenKhi, Stage = 2, Zone = "verdant_forest" });
        var hunt = Take(e, "hunt_demonic_hard");
        Assert.Equal("huyet_sat_ma_tong", hunt.RivalSectId);
        Win(e, e.ChallengeNpc("npc_plain", lethal: false)!);
        Assert.Equal(0, hunt.Progress);
        Win(e, e.ChallengeNpc("npc_demon", lethal: false)!);
        Assert.Equal(1, hunt.Progress);
    }

    [Fact]
    public void The_entrance_trial_is_not_a_mission_win()
    {
        var e = TestContent.NewEngine();
        var trial = e.StartSectTrial("thanh_van_kiem")!;
        Win(e, trial);
        Assert.Equal("thanh_van_kiem", e.Player.SectId);
        var patrol = Take(e, "patrol_bandits_easy");
        Assert.Equal(0, patrol.Progress);
    }

    [Fact]
    public void A_missed_deadline_fails_the_mission_and_costs_contribution()
    {
        var e = Disciple();
        e.Player.Contribution = 40;
        var mission = Take(e, "patrol_bandits_easy");
        var months = mission.DeadlineMonth - e.State.Calendar.MonthIndex;
        PassMonths(e, months - 1);
        Assert.Single(e.Player.Missions);
        var report = e.EndMonth();
        Assert.Empty(e.Player.Missions);
        Assert.Contains(report.Events, ev => ev.Kind == "mission_failed" && ev.Level == EventLevel.Warning);
        Assert.Equal(40 - SectMissions.Penalty(30), e.Player.Contribution);
    }

    [Fact]
    public void A_finished_mission_waits_at_the_hall_past_its_deadline()
    {
        var e = Disciple();
        var mission = Take(e, "patrol_bandits_easy");
        mission.Progress = mission.Goal;
        PassMonths(e, 8);
        Assert.Single(e.Player.Missions);
        Assert.Single(e.ClaimMissions());
    }

    [Fact]
    public void Giving_up_costs_what_failing_would_and_contribution_never_goes_below_zero()
    {
        var e = Disciple();
        var mission = Take(e, "subdue_beasts_medium");
        var events = e.AbandonMission(mission.Id);
        Assert.Equal("mission_abandoned", Assert.Single(events).Kind);
        Assert.Empty(e.Player.Missions);
        Assert.Equal(0, e.Player.Contribution);
    }

    [Fact]
    public void Promotion_needs_merit_and_cultivation_and_spending_never_costs_it()
    {
        var e = Disciple();
        e.Player.Merit = 200;
        e.Player.Contribution = 0;
        Assert.False(SectRanks.CanPromote(e.Player)); // a mortal still
        Assert.Empty(e.Promote());
        e.Player.Realm = Realm.LuyenKhi;
        e.Player.Stage = 5;
        Assert.True(SectRanks.CanPromote(e.Player));
        var events = e.Promote();
        Assert.Equal("sect_promotion", Assert.Single(events).Kind);
        Assert.Equal("NộiMôn", e.Player.SectRank);
        Assert.Equal(10, Cultivation.SectBonusPercent(e.Player.SectRank));
        Assert.Contains(e.State.World.Rumors, r => r.Kind == "sect_promotion");
        Assert.False(SectRanks.CanPromote(e.Player)); // true disciples need 500 merit and Trúc Cơ
    }

    [Fact]
    public void The_sect_pays_a_stipend_by_rank_every_month()
    {
        var e = Disciple();
        var (silver, stones) = (e.Player.Silver, e.Player.SpiritStones);
        var report = e.EndMonth();
        Assert.Contains(report.Events, ev => ev.Kind == "stipend");
        Assert.Equal(silver + 15, e.Player.Silver);
        Assert.Equal(stones, e.Player.SpiritStones);
        e.Player.SectRank = "NộiMôn";
        e.EndMonth();
        Assert.Equal(silver + 15 + 40, e.Player.Silver);
        Assert.Equal(stones + 1, e.Player.SpiritStones);
    }

    [Fact]
    public void The_treasury_trades_contribution_and_keeps_its_best_for_higher_ranks()
    {
        var e = Disciple();
        Assert.Equal("treasury_poor", Assert.Single(e.Exchange("healing_pill")).Kind);
        e.Player.Contribution = 500;
        Assert.Equal("treasury", Assert.Single(e.Exchange("healing_pill")).Kind);
        Assert.Equal(488, e.Player.Contribution);
        Assert.Equal(1, Inventory.Count(e.Player, "healing_pill"));
        Assert.Equal("treasury_rank", Assert.Single(e.Exchange("thanh_van_kiem_kinh")).Kind);
        e.Player.SectRank = "NộiMôn";
        e.Exchange("thanh_van_kiem_kinh");
        Assert.Equal(1, Inventory.Count(e.Player, "thanh_van_kiem_kinh"));
        e.UseItem("thanh_van_kiem_kinh");
        Assert.Contains(e.Player.Techniques, t => t.Id == "thanh_van_kiem_kinh");
        Assert.Empty(e.Exchange("not_in_the_treasury"));
    }

    [Fact]
    public void The_chamber_opens_to_inner_disciples_and_its_seclusion_burns_spirit_stones()
    {
        var e = Disciple();
        Assert.Null(e.Chamber);
        e.Player.SectRank = "NộiMôn";
        var chamber = e.Chamber!;
        Assert.True(chamber.QiDensity > 0 && chamber.StonesPerMonth > 0);
        e.Player.SpiritStones = chamber.StonesPerMonth;
        var paid = e.Seclude(1, chamber.QiDensity, stonesPerMonth: chamber.StonesPerMonth);
        Assert.Equal(1, paid.Months);
        Assert.Equal(1, e.Player.SpiritStones); // the month's stones went to the array; the stipend brought one
        var dark = e.Seclude(3, chamber.QiDensity, stonesPerMonth: chamber.StonesPerMonth);
        Assert.Equal(0, dark.Months);
        Assert.Contains(dark.Events, ev => ev.Kind == "seclusion_stones");
        // The chamber's qi is worth it: more than meditating in the open.
        Assert.True(e.PreviewMonth(true, chamber.QiDensity).Total > e.PreviewMonth(true).Total);
    }

    [Fact]
    public void Missions_and_merit_survive_a_save()
    {
        var e = Disciple();
        var mission = Take(e, "patrol_bandits_easy");
        mission.Progress = 1;
        e.Player.Merit = 77;
        var loaded = GameEngine.Load(C, e.Save());
        var again = Assert.Single(loaded.Player.Missions);
        Assert.Equal(mission.Id, again.Id);
        Assert.Equal(1, again.Progress);
        Assert.Equal(mission.DeadlineMonth, again.DeadlineMonth);
        Assert.Equal(77, loaded.Player.Merit);
        Assert.Equal(e.Player.MissionBoard.RolledMonth, loaded.Player.MissionBoard.RolledMonth);
    }

    [Fact]
    public void Old_saves_count_a_disciples_contribution_as_merit()
    {
        var e = Disciple();
        e.Player.Contribution = 150;
        e.Player.Merit = 0;
        var json = e.Save().Replace($"\"version\":{SaveCodec.CurrentVersion}", "\"version\":2");
        Assert.Contains("\"version\":2", json);
        var loaded = GameEngine.Load(C, json);
        Assert.Equal(150, loaded.Player.Merit);
        Assert.Equal(SaveCodec.CurrentVersion, loaded.State.Version);
    }

    [Fact]
    public void Every_hall_names_real_items_and_real_ranks()
    {
        Assert.NotEmpty(C.Halls);
        Assert.DoesNotContain(C.Validate(), issue => issue.StartsWith("hall "));
        Assert.True(C.Halls["thanh_van_kiem"].Treasury.Count >= 5);
    }
}
