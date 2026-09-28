using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    /// <summary>
    /// The monthly life of NPC cultivators (design §7.8): they cultivate, travel between zones,
    /// feud, befriend, die — and act on the karma ledger they share with the player.
    /// Everything here is deterministic given the world seed and the month.
    /// </summary>
    public static class NpcSim
    {
        public const string PlayerKey = "player";
        private const int MaxInteractionsPerMonth = 6;
        private const int MaxRumors = 40;

        // ------------------------------------------------------------ generation

        public static List<NpcState> Generate(GameState state, ContentDb content, MapGrid map, int count, Pcg32 rng)
        {
            var npcs = new List<NpcState>();
            npcs.AddRange(Anchors(state, content, map, rng));
            var taken = new HashSet<string>(npcs.Select(n => n.Name));
            var zones = map.Def.ZoneLegend.Values.Distinct().Where(z => content.Area(z) != null).ToList();

            for (var i = 0; i < count; i++)
            {
                var female = rng.Chance(0.45);
                var name = UniqueName(content.NpcNames, female, taken, rng);
                if (name == null) break;
                taken.Add(name);

                var roll = rng.NextDouble();
                var realm = roll < 0.3 ? Realm.PhamNhan : roll < 0.9 ? Realm.LuyenKhi : Realm.TrucCo;
                var stage = realm == Realm.PhamNhan ? 0 : Math.Min(9, 1 + (int)Math.Floor(Math.Pow(rng.NextDouble(), 1.6) * 9));
                var age = realm switch
                {
                    Realm.PhamNhan => rng.Range(14, 45),
                    Realm.LuyenKhi => rng.Range(16, 90),
                    _ => rng.Range(60, 170),
                };
                var alignment = Math.Max(-100, Math.Min(100, rng.Range(-60, 60) + rng.Range(-60, 60) + rng.Range(-30, 30)));
                var npc = new NpcState
                {
                    Id = state.NewId("npc"),
                    Name = name,
                    Female = female,
                    Age = age,
                    Realm = realm,
                    Stage = stage,
                    Grade = RollGrade(rng),
                    Elements = new List<Element> { rng.Pick(Elements.All) },
                    Alignment = alignment,
                    Traits = PickTraits(content, rng),
                };
                npc.Lifespan = 80 + Progression.LifespanBonus(content, realm) + rng.Range(-10, 10);
                if (npc.Age >= npc.Lifespan) npc.Age = npc.Lifespan - rng.Range(5, 30);
                if (realm >= Realm.LuyenKhi && alignment > 20 && rng.Chance(0.4)) npc.SectId = "thanh_van_kiem";
                else if (alignment < -40 && rng.Chance(0.25)) npc.SectId = "huyet_sat_ma_tong";

                PlaceInZone(npc, PickHomeZone(content, zones, npc, rng), state, map, rng);
                npcs.Add(npc);
            }
            return npcs;
        }

        /// <summary>Hand-placed NPCs every run has: the village elder, a sect deacon, and a rival of your generation.</summary>
        private static IEnumerable<NpcState> Anchors(GameState state, ContentDb content, MapGrid map, Pcg32 rng)
        {
            var town = map.Def.Pois.FirstOrDefault(p => p.Kind == "town");
            var sect = map.Def.Pois.FirstOrDefault(p => p.Kind == "sect");
            var player = state.Player;

            if (town != null)
            {
                yield return new NpcState
                {
                    Id = "npc_elder", Name = "Lâm Bá", Age = 71, Lifespan = 84, Realm = Realm.PhamNhan,
                    Grade = RootGrade.PhoThong, Elements = { Element.Tho }, Alignment = 60,
                    Traits = { "kind", "loyal" }, Zone = map.ZoneAt(town.X, town.Y) ?? "", X = town.X, Y = town.Y + 1,
                    Anchor = true, Role = "Trưởng thôn", RoleEn = "Village elder",
                };
            }
            if (sect != null)
            {
                yield return new NpcState
                {
                    Id = "npc_deacon", Name = "Tống Vân Hạc", Age = 118, Lifespan = 240, Realm = Realm.TrucCo, Stage = 2,
                    Grade = RootGrade.Kha, Elements = { Element.Kim }, Alignment = 45, SectId = "thanh_van_kiem",
                    Traits = { "proud", "loyal" }, Zone = map.ZoneAt(sect.X, sect.Y) ?? "", X = sect.X + 1, Y = sect.Y,
                    Anchor = true, Role = "Chấp sự Thanh Vân Kiếm Phái", RoleEn = "Deacon of the Azure Cloud Sword Sect",
                };
            }
            var rivalZone = town != null ? map.ZoneAt(town.X, town.Y) ?? "" : "";
            yield return new NpcState
            {
                Id = "npc_rival", Name = "Tạ Lăng Phong", Age = Math.Max(15, player.Age + rng.Range(-2, 2)), Lifespan = 82,
                Realm = Realm.PhamNhan, Grade = RootGrade.Hiem, Elements = { Element.Kim }, Alignment = 10,
                Traits = { "proud", "belligerent" }, Zone = rivalZone, X = (town?.X ?? player.X) - 2, Y = (town?.Y ?? player.Y) + 1,
                Anchor = true, Role = "Thiên tài đồng lứa", RoleEn = "Rival of your generation",
                Relations = { [PlayerKey] = -10 },
            };
        }

        private static string? UniqueName(NpcNamesDef names, bool female, HashSet<string> taken, Pcg32 rng)
        {
            var given = female ? names.GivenFemale : names.GivenMale;
            if (names.Surnames.Count == 0 || given.Count == 0) return null;
            var deny = new HashSet<string>(names.Denylist.Select(Names.StripMarks), StringComparer.OrdinalIgnoreCase);
            for (var attempt = 0; attempt < 50; attempt++)
            {
                var name = rng.Pick(names.Surnames) + " " + rng.Pick(given);
                if (taken.Contains(name) || deny.Contains(Names.StripMarks(name))) continue;
                return name;
            }
            return null;
        }

        private static RootGrade RollGrade(Pcg32 rng)
        {
            var r = rng.NextDouble();
            return r < 0.6 ? RootGrade.PhoThong : r < 0.85 ? RootGrade.Kha : r < 0.97 ? RootGrade.Hiem : RootGrade.ThienPham;
        }

        private static List<string> PickTraits(ContentDb content, Pcg32 rng)
        {
            var ids = content.NpcNames.Traits.Select(t => t.Id).ToList();
            rng.Shuffle(ids);
            return ids.Take(2).ToList();
        }

        private static string PickHomeZone(ContentDb content, List<string> zones, NpcState npc, Pcg32 rng)
        {
            // Weaker cultivators stay where it's safe; the strong roam the dangerous zones.
            var weights = zones.Select(z =>
            {
                var area = content.Area(z)!;
                var gap = area.DangerLevel - 1 - (int)npc.Realm;
                return area.IsSafe ? 3.0 : gap > 1 ? 0.2 : 1.5;
            }).ToList();
            var i = rng.WeightedIndex(weights);
            return zones[Math.Max(0, i)];
        }

        public static void PlaceInZone(NpcState npc, string zone, GameState state, MapGrid map, Pcg32 rng)
        {
            npc.Zone = zone;
            var cell = Spawns.RandomFreeCell(state, map, zone, rng, new Cell(state.Player.X, state.Player.Y), 0);
            if (cell != null)
            {
                npc.X = cell.Value.X;
                npc.Y = cell.Value.Y;
            }
        }

        // ------------------------------------------------------------ the monthly tick

        public static void Tick(GameState state, ContentDb content, MapGrid map, List<Rumor> rumors, List<GameEvent> events)
        {
            var rng = Seeds.Stream(state.Seed, "npc", state.Calendar.MonthIndex);
            var month = state.Calendar.MonthIndex;
            var alive = state.World.Npcs.Where(n => n.Alive).ToList();

            foreach (var npc in alive)
            {
                AgeOneMonth(npc);
                if (npc.Age >= npc.Lifespan)
                {
                    npc.Alive = false;
                    AddRumor(state, rumors, "death", npc.Id,
                        $"{npc.Name} ({Names.Display(npc.Realm, Locale.Vi)}) đã tọa hóa, thọ {npc.Age} tuổi.",
                        $"{npc.Name} ({Names.Display(npc.Realm, Locale.En)}) passed away at the age of {npc.Age}.");
                    continue;
                }
                if (npc.InjuredMonths > 0)
                {
                    npc.InjuredMonths -= 1;
                    continue;
                }
                Cultivate(state, content, npc, rng, rumors);
                Wander(state, content, map, npc, rng);
                Fortune(state, content, npc, rng, rumors);
            }

            Interact(state, content, alive.Where(n => n.Alive && n.InjuredMonths == 0).ToList(), rng, rumors);
            ActOnLedger(state, content, map, rng, rumors, events);

            if (state.World.Rumors.Count > MaxRumors)
                state.World.Rumors.RemoveRange(0, state.World.Rumors.Count - MaxRumors);
        }

        private static void AgeOneMonth(NpcState npc)
        {
            npc.AgeMonths += 1;
            if (npc.AgeMonths < 12) return;
            npc.AgeMonths = 0;
            npc.Age += 1;
        }

        /// <summary>NPCs have no techniques or seclusion, so they cultivate at 70% of the player's base rate.</summary>
        private const double NpcCultivationRate = 0.7;

        private static void Cultivate(GameState state, ContentDb content, NpcState npc, Pcg32 rng, List<Rumor> rumors)
        {
            // Old mortals are villagers, not cultivators: they never start down the path.
            if (npc.Realm == Realm.PhamNhan && npc.Age >= 45) return;
            var sectBonus = npc.SectId != null ? 1.15 : 1.0;
            var rivalry = npc.Id == "npc_rival" && Progression.RealmValue(npc.Realm, npc.Stage)
                          < Progression.RealmValue(state.Player.Realm, state.Player.Stage) ? 2.5 : 1.0;
            npc.Exp += (long)(Progression.BaseMonthly(npc.Realm) * Cultivation.RootMultiplier(npc.Grade) * sectBonus
                              * NpcCultivationRate * rivalry * rng.Range(0.5, 1.3));
            var need = Progression.RequiredExp(content, npc.Realm, npc.Stage);
            if (need == long.MaxValue || npc.Exp < need) return;

            if (!Progression.NextStepIsMajor(npc.Realm, npc.Stage))
            {
                npc.Exp -= need;
                npc.Stage += 1;
                return;
            }

            var target = npc.Realm + 1;
            var newsworthy = target >= Realm.TrucCo;
            var chance = 0.35 + 0.05 * (int)npc.Grade;
            if (rng.Chance(chance))
            {
                npc.Exp = 0;
                npc.Realm = target;
                npc.Stage = 1;
                npc.Lifespan += Progression.LifespanBonus(content, npc.Realm) - Progression.LifespanBonus(content, npc.Realm - 1);
                if (newsworthy)
                {
                    AddRumor(state, rumors, "breakthrough", npc.Id,
                        $"{npc.Name} đột phá {Names.Display(npc.Realm, Locale.Vi)}! Thiên địa linh khí chấn động.",
                        $"{npc.Name} broke through to {Names.Display(npc.Realm, Locale.En)}! Heaven and earth trembled.");
                }
            }
            else
            {
                npc.Exp = npc.Exp * 4 / 5;
                npc.InjuredMonths = 2;
                if (newsworthy && CountThisMonth(rumors, "failed_breakthrough") == 0)
                {
                    AddRumor(state, rumors, "failed_breakthrough", npc.Id,
                        $"{npc.Name} xung kích {Names.Display(target, Locale.Vi)} thất bại, kinh mạch trọng thương.",
                        $"{npc.Name} failed to reach {Names.Display(target, Locale.En)} and was badly hurt.");
                }
            }
        }

        private static int CountThisMonth(List<Rumor> rumors, string kind) => rumors.Count(r => r.Kind == kind);

        /// <summary>Small chances each month: stumble on a treasure, or be taken in by a sect.</summary>
        private static void Fortune(GameState state, ContentDb content, NpcState npc, Pcg32 rng, List<Rumor> rumors)
        {
            var area = content.Area(npc.Zone);
            if (area != null && !area.IsSafe && rng.Chance(0.03) && CountThisMonth(rumors, "treasure") == 0)
            {
                var table = content.LootTables.TryGetValue(content.ResolveLootTable(area.LootTable), out var t) ? t : null;
                var entry = table != null && table.Entries.Count > 0 ? rng.Pick(table.Entries) : null;
                if (entry != null)
                {
                    AddRumor(state, rumors, "treasure", npc.Id,
                        $"Có người thấy {npc.Name} nhặt được {entry.Name} ở {area.Name}.",
                        $"{npc.Name} was seen finding {entry.NameEn} in {area.NameEn}.");
                }
            }
            if (npc.SectId == null && npc.Alignment > 20 && npc.Realm >= Realm.LuyenKhi && npc.Stage >= 3 && rng.Chance(0.03))
            {
                npc.SectId = "thanh_van_kiem";
                var sect = content.Sects.TryGetValue("thanh_van_kiem", out var sd) ? sd : null;
                AddRumor(state, rumors, "sect_join", npc.Id,
                    $"{npc.Name} vượt qua khảo hạch, bái nhập {sect?.Name ?? "tông môn"}.",
                    $"{npc.Name} passed the trial and joined the {sect?.NameEn ?? "sect"}.");
            }
        }

        private static void Wander(GameState state, ContentDb content, MapGrid map, NpcState npc, Pcg32 rng)
        {
            if (npc.Anchor || !rng.Chance(0.25)) return;
            var area = content.Area(npc.Zone);
            if (area == null) return;
            var options = area.ConnectedAreas
                .Where(z => map.Def.ZoneLegend.ContainsValue(z))
                .Where(z =>
                {
                    var a = content.Area(z);
                    return a != null && a.DangerLevel - 1 - (int)npc.Realm <= 1;
                })
                .ToList();
            if (options.Count == 0) return;
            PlaceInZone(npc, rng.Pick(options), state, map, rng);
        }

        private static double Trait(ContentDb content, NpcState npc, Func<NpcTraitDef, double> pick) =>
            npc.Traits.Select(id => content.NpcNames.Traits.FirstOrDefault(t => t.Id == id)).Where(t => t != null).Sum(t => pick(t!));

        private const int MaxFightsPerMonth = 2;

        private static void Interact(GameState state, ContentDb content, List<NpcState> npcs, Pcg32 rng, List<Rumor> rumors)
        {
            var interactions = 0;
            var fights = 0;
            foreach (var group in npcs.GroupBy(n => n.Zone))
            {
                var members = group.ToList();
                for (var i = 0; i < members.Count && interactions < MaxInteractionsPerMonth; i++)
                {
                    for (var j = i + 1; j < members.Count && interactions < MaxInteractionsPerMonth; j++)
                    {
                        if (!rng.Chance(0.05)) continue;
                        var a = members[i];
                        var b = members[j];
                        if (!a.Alive || !b.Alive) continue;
                        var relation = (a.RelationTo(b.Id) + b.RelationTo(a.Id)) / 2;
                        var hostility = (Math.Abs(a.Alignment - b.Alignment) > 90 ? 0.3 : 0)
                                        + Trait(content, a, t => t.Aggression) + Trait(content, b, t => t.Aggression)
                                        + (relation < -30 ? 0.4 : 0)
                                        + (a.SectId != null && b.SectId != null && a.SectId != b.SectId ? 0.3 : 0);
                        var warmth = Trait(content, a, t => t.Sociability) + Trait(content, b, t => t.Sociability)
                                     + (relation > 30 ? 0.3 : 0) + (a.SectId != null && a.SectId == b.SectId ? 0.3 : 0);
                        interactions++;
                        var edge = hostility - warmth;
                        if (edge > 0.15 && fights < MaxFightsPerMonth && rng.Chance(Math.Min(0.6, edge)))
                        {
                            fights++;
                            Fight(state, a, b, rng, rumors);
                        }
                        else if (edge <= 0 && rng.Chance(Math.Min(0.8, 0.15 + warmth / 2)))
                        {
                            Befriend(state, a, b, rumors);
                        }
                    }
                }
            }
        }

        private static void Fight(GameState state, NpcState a, NpcState b, Pcg32 rng, List<Rumor> rumors)
        {
            var powerA = Progression.RealmValue(a.Realm, a.Stage) + rng.Range(0, 0.6);
            var powerB = Progression.RealmValue(b.Realm, b.Stage) + rng.Range(0, 0.6);
            var (winner, loser) = powerA >= powerB ? (a, b) : (b, a);
            Shift(loser, winner.Id, -40);
            Shift(winner, loser.Id, -20);
            loser.InjuredMonths = 3;
            if (winner.Alignment < -40 && !loser.Anchor && rng.Chance(0.35))
            {
                loser.Alive = false;
                AddRumor(state, rumors, "killed", loser.Id,
                    $"{loser.Name} bị {winner.Name} hạ sát. Oán khí vương vất nơi đó.",
                    $"{loser.Name} was slain by {winner.Name}. Resentment lingers there.");
                return;
            }
            var notable = winner.Anchor || loser.Anchor || winner.Realm >= Realm.TrucCo || loser.Realm >= Realm.TrucCo;
            if (!notable && CountThisMonth(rumors, "duel") > 0) return;
            AddRumor(state, rumors, "duel", winner.Id,
                $"{winner.Name} và {loser.Name} giao đấu; {loser.Name} trọng thương bỏ chạy.",
                $"{winner.Name} fought {loser.Name}; {loser.Name} fled badly wounded.");
        }

        private static void Befriend(GameState state, NpcState a, NpcState b, List<Rumor> rumors)
        {
            var wereSworn = a.RelationTo(b.Id) > 60 && b.RelationTo(a.Id) > 60;
            Shift(a, b.Id, 15);
            Shift(b, a.Id, 15);
            if (!wereSworn && a.RelationTo(b.Id) > 60 && b.RelationTo(a.Id) > 60)
            {
                AddRumor(state, rumors, "sworn", a.Id,
                    $"{a.Name} và {b.Name} kết nghĩa kim lan, thề đồng sinh cộng tử.",
                    $"{a.Name} and {b.Name} swore brotherhood, vowing to live and die together.");
            }
        }

        /// <summary>Grudges come back as ambushes; gratitude comes back as gifts (design §7.7).</summary>
        private static void ActOnLedger(GameState state, ContentDb content, MapGrid map, Pcg32 rng, List<Rumor> rumors, List<GameEvent> events)
        {
            var player = state.Player;
            foreach (var entry in player.Ledger.Where(e => !e.Settled).ToList())
            {
                var npc = state.World.Npcs.FirstOrDefault(n => n.Id == entry.NpcId);
                if (npc == null || !npc.Alive || npc.InjuredMonths > 0) continue;

                if (entry.Kind == LedgerKind.Oan && entry.Weight >= 30 && state.World.PendingAmbush == null && rng.Chance(0.3))
                {
                    var zone = map.ZoneAt(player.X, player.Y);
                    if (zone == null) continue;
                    PlaceInZone(npc, zone, state, map, rng);
                    state.World.PendingAmbush = NpcCombat.Prepare(new Encounter
                    {
                        Id = state.NewId("enc"),
                        Source = "ambush",
                        SourceId = npc.Id,
                        EnemyIds = { "rogue_cultivator" },
                        Zone = zone,
                        Danger = content.Area(zone)?.DangerLevel ?? 1,
                        RealmOverride = npc.Realm,
                        StageOverride = npc.Stage,
                        DisplayName = npc.Name,
                    }, npc, content);
                    AddRumor(state, rumors, "revenge", npc.Id,
                        $"Nghe nói {npc.Name} đang truy tìm {player.Name} để báo thù.",
                        $"Word is that {npc.Name} is hunting {player.Name} for revenge.");
                    entry.Weight = Math.Max(0, entry.Weight - 20);
                }
                else if (entry.Kind == LedgerKind.An && entry.Weight >= 30 && rng.Chance(0.2))
                {
                    var silver = 30 + entry.Weight * 2;
                    player.Silver += silver;
                    entry.Settled = true;
                    events.Add(GameEvent.Major("gratitude",
                        $"{npc.Name} nhớ ơn xưa, sai người mang tặng {silver} bạc.",
                        $"{npc.Name} remembers your kindness and sends you {silver} silver."));
                }
            }
        }

        private static void Shift(NpcState npc, string otherId, int delta) =>
            npc.Relations[otherId] = Math.Max(-100, Math.Min(100, npc.RelationTo(otherId) + delta));

        public static void AddRumor(GameState state, List<Rumor> rumors, string kind, string? subject, string vi, string en)
        {
            var rumor = new Rumor { MonthIndex = state.Calendar.MonthIndex, Kind = kind, Subject = subject, Text = vi, TextEn = en };
            state.World.Rumors.Add(rumor);
            rumors.Add(rumor);
        }

        public static string TraitName(ContentDb content, string id, Locale locale)
        {
            var t = content.NpcNames.Traits.FirstOrDefault(x => x.Id == id);
            return t == null ? id : Names.Pick(locale, t.Name, t.NameEn);
        }
    }
}
