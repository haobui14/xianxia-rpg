using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Rules
{
    /// <summary>A rank in a sect: what it takes (merit and cultivation) and what it pays each month.</summary>
    public sealed class SectRankDef
    {
        public string Id { get; }
        public int Merit { get; }
        public Realm Realm { get; }
        public int Stage { get; }
        public int StipendSilver { get; }
        public int StipendStones { get; }

        public SectRankDef(string id, int merit, Realm realm, int stage, int stipendSilver, int stipendStones)
        {
            Id = id;
            Merit = merit;
            Realm = realm;
            Stage = stage;
            StipendSilver = stipendSilver;
            StipendStones = stipendStones;
        }
    }

    /// <summary>
    /// The disciple's ladder (design §7.9). The thresholds are the web game's promotion rules: outer → inner
    /// at 200 contribution and Luyện Khí 5, inner → true at 500 and Trúc Cơ 1, true → elder at 1500 and
    /// Kết Đan 1. Here they count merit (all contribution ever earned), so spending at the treasury never
    /// costs a promotion. The sect master's seat isn't won by merit.
    /// </summary>
    public static class SectRanks
    {
        public static readonly SectRankDef[] Ladder =
        {
            new SectRankDef("NgoạiMôn", 0, Realm.PhamNhan, 0, 15, 0),
            new SectRankDef("NộiMôn", 200, Realm.LuyenKhi, 5, 40, 1),
            new SectRankDef("ChânTruyền", 500, Realm.TrucCo, 1, 80, 3),
            new SectRankDef("TrưởngLão", 1500, Realm.KetDan, 1, 160, 6),
        };

        /// <summary>Where a rank sits on the ladder (−1 for none or an unknown one).</summary>
        public static int IndexOf(string? rank) => Array.FindIndex(Ladder, r => r.Id == rank);

        public static SectRankDef? Of(string? rank) => IndexOf(rank) is var i and >= 0 ? Ladder[i] : null;

        public static SectRankDef? Next(string? rank)
        {
            var i = IndexOf(rank);
            return i >= 0 && i + 1 < Ladder.Length ? Ladder[i + 1] : null;
        }

        /// <summary>True when <paramref name="rank"/> is <paramref name="min"/> or higher (no minimum: anyone).</summary>
        public static bool AtLeast(string? rank, string? min) => min == null || IndexOf(rank) >= IndexOf(min) && IndexOf(min) >= 0;

        public static bool RealmReached(PlayerState p, SectRankDef r) =>
            Progression.RealmValue(p.Realm, p.Stage) >= Progression.RealmValue(r.Realm, r.Stage);

        public static bool CanPromote(PlayerState p) =>
            p.SectId != null && Next(p.SectRank) is { } next && p.Merit >= next.Merit && RealmReached(p, next);
    }

    /// <summary>
    /// The mission hall (Nhiệm Vụ Đường, design §7.9): a board of missions for the sect's kind, rolled every
    /// few months from the web game's templates; progress that tracks itself from what the player does; a
    /// report back at the hall for the reward; and a deadline that costs standing when it's missed.
    /// </summary>
    public static class SectMissions
    {
        public const int BoardSize = 3;
        public const int MaxActive = 2;
        public const int BoardRefreshMonths = 3;

        /// <summary>The web game counted deadlines in turns, about three to a month; never less than three months.</summary>
        public static int DeadlineMonths(MissionTemplateDef t) => Math.Max(3, (t.DeadlineTurns + 2) / 3);

        public static int Goal(MissionObjectiveDef o) => o.Kind switch
        {
            "cultivate_exp" => Math.Max(1, o.Amount ?? 1),
            "visit_region" => 1,
            _ => Math.Max(1, o.Count ?? 1),
        };

        /// <summary>A failed or abandoned mission costs a quarter of what it would have paid.</summary>
        public static int Penalty(int rewardContribution) => Math.Max(5, rewardContribution / 4);

        private static readonly string[] RarityOrder = { "Common", "Uncommon", "Rare", "Epic", "Legendary" };

        private static bool RarityAtLeast(string rarity, string? min) =>
            min == null || Array.IndexOf(RarityOrder, rarity) >= Array.IndexOf(RarityOrder, min);

        public static MissionTemplateDef? Template(ContentDb content, string id) => content.Missions.FirstOrDefault(t => t.Id == id);

        /// <summary>Whose members a rival-hunting mission wants: its own target, else the sect's first rival.</summary>
        private static string? RivalFor(MissionTemplateDef t, SectDef sect) => t.Objective.RivalSectId ?? sect.Rivals.FirstOrDefault();

        /// <summary>
        /// Templates for this sect's kind that can actually be done in this world: a region to scout must be
        /// somewhere else that has a map, enough of the rival's disciples must be alive, and the things to
        /// gather must drop somewhere.
        /// </summary>
        public static List<MissionTemplateDef> Pool(GameState state, ContentDb content, SectDef sect) =>
            content.Missions.Where(t => t.SectTypes.Contains(sect.Type) && Feasible(state, content, t, sect)).ToList();

        private static bool Feasible(GameState state, ContentDb content, MissionTemplateDef t, SectDef sect)
        {
            var o = t.Objective;
            switch (o.Kind)
            {
                case "visit_region":
                    return o.RegionId != null && o.RegionId != state.Player.Region && content.MapForRegion(o.RegionId) != null;
                case "defeat_rival_member":
                    var rival = RivalFor(t, sect);
                    return rival != null && state.World.Npcs.Count(n => n.Alive && n.SectId == rival) >= Goal(o);
                case "gather_items":
                    return content.LootTables.Values.SelectMany(l => l.Entries)
                        .Any(e => (o.ItemType == null || e.Type == o.ItemType) && RarityAtLeast(e.Rarity, o.MinRarity));
                case "win_combats":
                case "cultivate_exp":
                    return true;
                default:
                    return false;
            }
        }

        /// <summary>
        /// What the hall offers now. The board is rolled again every <see cref="BoardRefreshMonths"/> months
        /// (the same world always rolls the same board): easy missions come up most, hard ones least, as in
        /// the web game, and never one already in hand.
        /// </summary>
        public static List<MissionTemplateDef> Board(GameState state, ContentDb content)
        {
            var p = state.Player;
            if (p.SectId == null || !content.Sects.TryGetValue(p.SectId, out var sect)) return new List<MissionTemplateDef>();
            var board = p.MissionBoard;
            var period = state.Calendar.MonthIndex / BoardRefreshMonths;
            if (board.RolledMonth < 0 || board.RolledMonth / BoardRefreshMonths != period)
            {
                board.RolledMonth = state.Calendar.MonthIndex;
                board.Offers.Clear();
                var pool = Pool(state, content, sect).Where(t => p.Missions.All(m => m.TemplateId != t.Id)).ToList();
                var rng = Seeds.Stream(state.Seed, "mission_board", period);
                for (var i = 0; i < BoardSize && pool.Count > 0; i++)
                {
                    var pick = rng.WeightedIndex(pool.Select(t => t.Difficulty switch { "easy" => 50.0, "medium" => 35.0, _ => 15.0 }).ToList());
                    if (pick < 0) break;
                    board.Offers.Add(pool[pick].Id);
                    pool.RemoveAt(pick);
                }
            }
            return board.Offers.Select(id => Template(content, id)).Where(t => t != null).Select(t => t!).ToList();
        }

        public static List<GameEvent> Accept(GameState state, ContentDb content, string templateId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var offered = Board(state, content).FirstOrDefault(t => t.Id == templateId);
            if (offered == null || p.SectId == null || !content.Sects.TryGetValue(p.SectId, out var sect)) return events;
            if (p.Missions.Count >= MaxActive)
            {
                events.Add(GameEvent.Info("mission_full", $"Đã nhận đủ {MaxActive} nhiệm vụ — hoàn thành bớt rồi hẵng nhận thêm.",
                    $"You already carry {MaxActive} missions — finish one before taking another."));
                return events;
            }
            var o = offered.Objective;
            p.Missions.Add(new ActiveMission
            {
                Id = state.NewId("mission"), TemplateId = offered.Id, Kind = o.Kind, Goal = Goal(o),
                ItemType = o.ItemType, MinRarity = o.MinRarity, RegionId = o.RegionId,
                RivalSectId = o.Kind == "defeat_rival_member" ? RivalFor(offered, sect) : null,
                AcceptedMonth = state.Calendar.MonthIndex, DeadlineMonth = state.Calendar.MonthIndex + DeadlineMonths(offered),
                RewardContribution = offered.Reward.Contribution, RewardSilver = offered.Reward.Silver ?? 0, RewardStones = offered.Reward.SpiritStones ?? 0,
            });
            p.MissionBoard.Offers.Remove(offered.Id);
            events.Add(GameEvent.Info("mission_taken", $"Nhận nhiệm vụ: {offered.Name}. Hạn {DeadlineMonths(offered)} tháng.",
                $"Mission taken: {offered.NameEn}. {DeadlineMonths(offered)} months to do it."));
            return events;
        }

        public static List<GameEvent> Abandon(GameState state, ContentDb content, string missionId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var m = p.Missions.FirstOrDefault(x => x.Id == missionId);
            if (m == null) return events;
            p.Missions.Remove(m);
            var cost = Math.Min(p.Contribution, Penalty(m.RewardContribution));
            p.Contribution -= cost;
            var t = Template(content, m.TemplateId);
            events.Add(GameEvent.Warn("mission_abandoned", $"Bỏ dở nhiệm vụ {t?.Name ?? m.TemplateId}: cống hiến −{cost}.",
                $"Mission given up: {t?.NameEn ?? m.TemplateId}. Contribution −{cost}."));
            return events;
        }

        // ------------------------------------------------------------ progress (called by the rules as things happen)

        private static void Advance(GameState state, Func<ActiveMission, int> by)
        {
            foreach (var m in state.Player.Missions)
            {
                if (m.Done) continue;
                var n = by(m);
                if (n > 0) m.Progress = Math.Min(m.Goal, m.Progress + n);
            }
        }

        /// <summary>A fight won (not the entrance trial); <paramref name="foe"/> is the person beaten, if it was one.</summary>
        public static void Won(GameState state, NpcState? foe) => Advance(state, m => m.Kind switch
        {
            "win_combats" => 1,
            "defeat_rival_member" => foe != null && foe.SectId != null && foe.SectId == m.RivalSectId ? 1 : 0,
            _ => 0,
        });

        /// <summary>Things gathered or looted (buying doesn't count).</summary>
        public static void Gathered(GameState state, IEnumerable<ItemStack> items)
        {
            var list = items.ToList();
            Advance(state, m => m.Kind != "gather_items" ? 0
                : list.Where(s => (m.ItemType == null || s.Type == m.ItemType) && RarityAtLeast(s.Rarity, m.MinRarity)).Sum(s => s.Qty));
        }

        public static void Cultivated(GameState state, long exp)
        {
            if (exp <= 0) return;
            Advance(state, m => m.Kind == "cultivate_exp" ? (int)Math.Min(int.MaxValue, exp) : 0);
        }

        public static void Arrived(GameState state, string regionId) =>
            Advance(state, m => m.Kind == "visit_region" && m.RegionId == regionId ? 1 : 0);

        /// <summary>Missions that just got done, said once: they wait at the hall for their reward.</summary>
        public static List<GameEvent> Announce(GameState state, ContentDb content)
        {
            var events = new List<GameEvent>();
            foreach (var m in state.Player.Missions.Where(m => m.Done && !m.Announced))
            {
                m.Announced = true;
                var t = Template(content, m.TemplateId);
                events.Add(GameEvent.Major("mission_ready", $"Nhiệm vụ hoàn thành: {t?.Name ?? m.TemplateId} — về Nhiệm Vụ Đường báo cáo để nhận thưởng.",
                    $"Mission done: {t?.NameEn ?? m.TemplateId}. Report to the sect's mission hall for the reward."));
            }
            return events;
        }

        /// <summary>At the hall: every finished mission pays out.</summary>
        public static List<GameEvent> Claim(GameState state, ContentDb content)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            foreach (var m in p.Missions.Where(m => m.Done).ToList())
            {
                p.Missions.Remove(m);
                p.Contribution += m.RewardContribution;
                p.Merit += m.RewardContribution;
                p.Silver += m.RewardSilver;
                p.SpiritStones += m.RewardStones;
                p.Counters.MissionsCompleted += 1;
                var t = Template(content, m.TemplateId);
                events.Add(GameEvent.Major("mission_done",
                    $"Báo cáo {t?.Name ?? m.TemplateId}: cống hiến +{m.RewardContribution}, {Pay(m.RewardSilver, m.RewardStones, Locale.Vi)}.",
                    $"Reported {t?.NameEn ?? m.TemplateId}: contribution +{m.RewardContribution}, {Pay(m.RewardSilver, m.RewardStones, Locale.En)}."));
            }
            return events;
        }

        /// <summary>A reward: "+40 silver" or "+40 silver, +1 spirit stone".</summary>
        public static string Pay(int silver, int stones, Locale locale) => locale == Locale.En
            ? $"+{silver} silver" + (stones > 0 ? $", +{Stones(stones, locale)}" : "")
            : $"+{silver} bạc" + (stones > 0 ? $", +{Stones(stones, locale)}" : "");

        /// <summary>A stipend: "40 silver" or "40 silver and 3 spirit stones".</summary>
        public static string Stipend(int silver, int stones, Locale locale) => locale == Locale.En
            ? $"{silver} silver" + (stones > 0 ? $" and {Stones(stones, locale)}" : "")
            : $"{silver} bạc" + (stones > 0 ? $" và {Stones(stones, locale)}" : "");

        public static string Stones(int n, Locale locale) => locale == Locale.En ? $"{n} spirit stone{(n == 1 ? "" : "s")}" : $"{n} linh thạch";

        /// <summary>
        /// The month turns for a disciple: the sect pays its stipend by rank, and missions past their deadline
        /// fail (a quarter of their contribution is lost).
        /// </summary>
        public static List<GameEvent> MonthPassed(GameState state, ContentDb content)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (p.SectId == null) return events;
            var now = state.Calendar.MonthIndex;
            foreach (var m in p.Missions.Where(m => !m.Done && now >= m.DeadlineMonth).ToList())
            {
                p.Missions.Remove(m);
                var cost = Math.Min(p.Contribution, Penalty(m.RewardContribution));
                p.Contribution -= cost;
                var t = Template(content, m.TemplateId);
                events.Add(GameEvent.Warn("mission_failed", $"Quá hạn nhiệm vụ {t?.Name ?? m.TemplateId}: cống hiến −{cost}.",
                    $"Mission failed, out of time: {t?.NameEn ?? m.TemplateId}. Contribution −{cost}."));
            }
            if (SectRanks.Of(p.SectRank) is { } rank && (rank.StipendSilver > 0 || rank.StipendStones > 0))
            {
                p.Silver += rank.StipendSilver;
                p.SpiritStones += rank.StipendStones;
                events.Add(GameEvent.Info("stipend",
                    $"Nguyệt lệ tông môn: {Pay(rank.StipendSilver, rank.StipendStones, Locale.Vi)}.",
                    $"The sect's monthly stipend: {Pay(rank.StipendSilver, rank.StipendStones, Locale.En)}."));
            }
            return events;
        }

        /// <summary>Rise one rank when merit and cultivation allow it.</summary>
        public static List<GameEvent> Promote(GameState state, ContentDb content)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (!SectRanks.CanPromote(p) || !content.Sects.TryGetValue(p.SectId!, out var sect)) return events;
            var next = SectRanks.Next(p.SectRank)!;
            p.SectRank = next.Id;
            var (vi, en) = RankName(next.Id);
            events.Add(GameEvent.Major("sect_promotion",
                $"Thăng làm {vi} của {sect.Name}! Tu luyện +{Cultivation.SectBonusPercent(next.Id)}%, nguyệt lệ {Stipend(next.StipendSilver, next.StipendStones, Locale.Vi)}.",
                $"Promoted to {en} of the {sect.NameEn}! Cultivation +{Cultivation.SectBonusPercent(next.Id)}%, a stipend of {Stipend(next.StipendSilver, next.StipendStones, Locale.En)}."));
            NpcSim.AddRumor(state, new List<Rumor>(), "sect_promotion", null,
                $"{p.Name} được thăng làm {vi} {sect.Name}.", $"{p.Name} rose to {en} of the {sect.NameEn}.");
            return events;
        }

        /// <summary>A rank in words ("inner disciple"); <see cref="RanksName"/> for "inner disciples".</summary>
        public static (string Vi, string En) RankName(string? rank) => rank switch
        {
            "NgoạiMôn" => ("đệ tử ngoại môn", "outer disciple"),
            "NộiMôn" => ("đệ tử nội môn", "inner disciple"),
            "ChânTruyền" => ("đệ tử chân truyền", "true disciple"),
            "TrưởngLão" => ("trưởng lão", "elder"),
            _ => ("tán tu", "unaffiliated"),
        };

        public static (string Vi, string En) RanksName(string? rank)
        {
            var (vi, en) = RankName(rank);
            return (vi, en + "s");
        }

        /// <summary>Spend contribution at the treasury (Tàng Bảo Các).</summary>
        public static List<GameEvent> Exchange(GameState state, ContentDb content, string itemId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (p.SectId == null || !content.Halls.TryGetValue(p.SectId, out var hall)) return events;
            var entry = hall.Treasury.FirstOrDefault(e => e.ItemId == itemId);
            var def = content.Item(itemId);
            if (entry == null || def == null) return events;
            if (!SectRanks.AtLeast(p.SectRank, entry.MinRank))
            {
                var (vi, en) = RanksName(entry.MinRank);
                events.Add(GameEvent.Info("treasury_rank", $"Chỉ {vi} trở lên mới được đổi {def.Name}.", $"Only {en} and above may take the {def.NameEn}."));
                return events;
            }
            if (p.Contribution < entry.Price)
            {
                events.Add(GameEvent.Info("treasury_poor", "Không đủ cống hiến.", "Not enough contribution."));
                return events;
            }
            p.Contribution -= entry.Price;
            Inventory.Add(p, Inventory.StackOf(def, 1));
            events.Add(GameEvent.Info("treasury", $"Đổi {def.Name} (−{entry.Price} cống hiến).", $"Took the {def.NameEn} (−{entry.Price} contribution)."));
            return events;
        }

        /// <summary>The sect's spirit-gathering chamber, if the player's rank opens it.</summary>
        public static ChamberDef? Chamber(PlayerState p, ContentDb content) =>
            p.SectId != null && content.Halls.TryGetValue(p.SectId, out var hall) && hall.Chamber is { } c && SectRanks.AtLeast(p.SectRank, c.MinRank) ? c : null;
    }
}
