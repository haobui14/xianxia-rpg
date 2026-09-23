using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Events;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.Story;
using TuTien.Core.World;

namespace TuTien.Core
{
    public enum InteractKind
    {
        Town,
        Sect,
        SecretRealm,
        SpiritVein,
        Herb,
        Pass,
        Adventure,
        Npc,
        Beast,
    }

    /// <summary>Something on the map the player can see or act on.</summary>
    public sealed class Interactable
    {
        public InteractKind Kind { get; set; }
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Glyph { get; set; } = "";
        public int X { get; set; }
        public int Y { get; set; }
        public bool Hostile { get; set; }
        public bool Ready { get; set; } = true;
    }

    public sealed class StepResult
    {
        public bool Moved { get; set; }
        public int Cost { get; set; }
        public string? Blocked { get; set; }
        public string? BlockedEn { get; set; }
        public Encounter? Encounter { get; set; }
        public string? AdventureId { get; set; }
        public List<GameEvent> Events { get; } = new List<GameEvent>();
    }

    /// <summary>
    /// The one entry point for play. Every player intent is a method call here; hosts (Godot,
    /// tests, a future server validator) never mutate <see cref="State"/> directly.
    /// </summary>
    public sealed class GameEngine
    {
        public ContentDb Content { get; }
        public GameState State { get; }
        public MapGrid Map { get; private set; }
        public Encounter? ActiveEncounter { get; private set; }

        public PlayerState Player => State.Player;
        public Locale Locale => State.Locale;

        public GameEngine(ContentDb content, GameState state)
        {
            Content = content;
            State = state;
            Map = new MapGrid(content.MapForRegion(state.Player.Region)
                              ?? throw new KeyNotFoundException($"No map for region {state.Player.Region}"));
            if (Player.FootworkMax <= 0)
            {
                Player.FootworkMax = WorldTick.FootworkMax(Player);
                Player.Footwork = Player.FootworkMax;
            }
        }

        public static GameEngine NewGame(ContentDb content, ulong seed, string name, int age, SpiritRootState root,
            CultivationPath path = CultivationPath.Qi, Locale locale = Locale.Vi) =>
            new GameEngine(content, WorldGen.NewGame(content, seed, name, age, root, path, locale));

        public static GameEngine Load(ContentDb content, string json) => new GameEngine(content, SaveCodec.Deserialize(json));

        public string Save() => SaveCodec.Serialize(State);

        private Pcg32 Rng(string purpose) => Seeds.Stream(State.Seed, purpose + ":" + State.NextId, State.Calendar.MonthIndex);

        // ================================================================ map queries

        public AreaDef? ZoneAt(int x, int y) => Content.Area(Map.ZoneAt(x, y));
        public AreaDef? ZoneHere => ZoneAt(Player.X, Player.Y);
        public FogMask Fog() => FogMask.For(Player, Map);
        public int SenseRadius => MapGrid.SenseRadius(Player);

        /// <summary>Live tokens (beasts, NPCs, adventures) are only shown inside the Thần thức radius.</summary>
        public bool Senses(int x, int y)
        {
            var dx = x - Player.X;
            var dy = y - Player.Y;
            var r = SenseRadius;
            return dx * dx + dy * dy <= r * r + r;
        }

        public IEnumerable<Interactable> VisibleThings()
        {
            var fog = Fog();
            foreach (var poi in Map.Def.Pois.Where(poi => fog.Get(poi.X, poi.Y)))
                yield return FromPoi(poi);
            foreach (var pack in State.World.Beasts.Where(b => Senses(b.X, b.Y)))
                yield return FromPack(pack);
            foreach (var npc in State.World.Npcs.Where(n => n.Alive && n.Zone.Length > 0 && Senses(n.X, n.Y)))
                yield return FromNpc(npc);
            foreach (var adv in State.World.Adventures.Where(a => Senses(a.X, a.Y) && (!a.Hidden || Player.SensePulse || Player.Attrs.Per >= 12)))
                yield return FromAdventure(adv);
        }

        /// <summary>Things on the player's tile, plus people and beasts next to it.</summary>
        public List<Interactable> InteractablesNear()
        {
            var here = new Cell(Player.X, Player.Y);
            return VisibleThings()
                .Where(t => (t.X == here.X && t.Y == here.Y)
                            || ((t.Kind == InteractKind.Npc || t.Kind == InteractKind.Beast) && new Cell(t.X, t.Y).Manhattan(here) == 1))
                .ToList();
        }

        private Interactable FromPoi(PoiDef poi)
        {
            var kind = poi.Kind switch
            {
                "town" => InteractKind.Town,
                "sect" => InteractKind.Sect,
                "secret_realm" => InteractKind.SecretRealm,
                "spirit_vein" => InteractKind.SpiritVein,
                "herb" => InteractKind.Herb,
                _ => InteractKind.Pass,
            };
            return new Interactable
            {
                Kind = kind, Id = poi.Id, Name = poi.Name, NameEn = poi.NameEn, Glyph = poi.Glyph, X = poi.X, Y = poi.Y,
                Ready = kind != InteractKind.Herb || Spawns.NodeReady(State, poi.Id),
            };
        }

        private Interactable FromPack(BeastPack pack)
        {
            var lead = Content.Enemy(pack.EnemyIds.FirstOrDefault()) ?? Encounters.Fallback(pack.EnemyIds.FirstOrDefault() ?? "beast");
            var count = pack.EnemyIds.Count > 1 ? $" ×{pack.EnemyIds.Count}" : "";
            return new Interactable
            {
                Kind = InteractKind.Beast, Id = pack.Id, Name = lead.Name + count, NameEn = lead.NameEn + count,
                Glyph = lead.Glyph, X = pack.X, Y = pack.Y, Hostile = true,
            };
        }

        private Interactable FromNpc(NpcState npc) => new Interactable
        {
            Kind = InteractKind.Npc, Id = npc.Id, Name = npc.Name, NameEn = npc.Name,
            Glyph = NpcGlyph(npc), X = npc.X, Y = npc.Y,
            Hostile = npc.RelationTo(NpcSim.PlayerKey) <= -40,
        };

        public static string NpcGlyph(NpcState npc) => npc.Id switch
        {
            "npc_elder" => "老",
            "npc_deacon" => "執",
            "npc_rival" => "敵",
            _ => npc.SectId == "huyet_sat_ma_tong" ? "魔" : npc.SectId != null ? "劍" : "人",
        };

        private Interactable FromAdventure(AdventureSpot adv)
        {
            var ev = Content.Events.TryGetValue(adv.EventId, out var e) ? e : null;
            return new Interactable
            {
                Kind = InteractKind.Adventure, Id = adv.Id, Name = ev?.Name ?? "Kỳ ngộ", NameEn = ev?.NameEn ?? "Encounter",
                Glyph = "奇", X = adv.X, Y = adv.Y,
            };
        }

        public PoiDef? Poi(string id) => Map.Def.Pois.FirstOrDefault(p => p.Id == id);
        public PoiDef? PoiHere() => Map.Def.Pois.FirstOrDefault(p => p.X == Player.X && p.Y == Player.Y);

        // ================================================================ movement

        public PathResult? PlanPath(int x, int y) => Map.FindPath(new Cell(Player.X, Player.Y), new Cell(x, y), Player);

        public StepResult Step(int dx, int dy) => StepTo(Player.X + dx, Player.Y + dy);

        public StepResult StepTo(int x, int y)
        {
            var result = new StepResult();
            if (Player.Dead)
                return Block(result, "Đạo đồ đã tận.", "Your path has ended.");
            if (ActiveEncounter != null)
                return Block(result, "Đang giao chiến.", "You are in a fight.");
            if (Math.Abs(x - Player.X) + Math.Abs(y - Player.Y) != 1)
                return Block(result, "Chỉ có thể đi từng bước.", "You can only move one step at a time.");

            var cost = Map.StepCost(x, y, Player);
            if (cost < 0)
                return Block(result, "Địa hình không thể vượt qua.", "That terrain can't be crossed.");

            var pack = State.World.Beasts.FirstOrDefault(b => b.X == x && b.Y == y);
            if (pack != null)
            {
                if (Player.Footwork < 1)
                    return Block(result, "Cước lực đã cạn — hãy qua tháng.", "No footwork left — end the month.");
                Player.Footwork -= 1;
                result.Cost = 1;
                result.Encounter = BeginEncounter(new Encounter
                {
                    Id = State.NewId("enc"), Source = "beast", SourceId = pack.Id, EnemyIds = pack.EnemyIds.ToList(),
                    Zone = pack.Zone, Danger = Content.Area(pack.Zone)?.DangerLevel ?? 1,
                });
                return result;
            }
            if (State.World.Npcs.Any(n => n.Alive && n.X == x && n.Y == y))
                return Block(result, "Có người đứng đó.", "Someone is standing there.");
            if (Player.Footwork < cost)
                return Block(result, $"Cước lực không đủ (cần {cost}) — hãy qua tháng.", $"Not enough footwork (need {cost}) — end the month.");

            Player.Footwork -= cost;
            Player.X = x;
            Player.Y = y;
            result.Moved = true;
            result.Cost = cost;

            var fog = Fog();
            fog.RevealCircle(x, y, SenseRadius);
            fog.SaveTo(Player, Map);

            var adv = State.World.Adventures.FirstOrDefault(a => a.X == x && a.Y == y);
            if (adv != null) result.AdventureId = adv.Id;
            return result;
        }

        private static StepResult Block(StepResult r, string vi, string en)
        {
            r.Blocked = vi;
            r.BlockedEn = en;
            return r;
        }

        /// <summary>Thần thức pulse: spend 10 Qi to widen the sense radius for the rest of the month.</summary>
        public bool Pulse()
        {
            if (Player.SensePulse || Player.Qi < 10) return false;
            Player.Qi -= 10;
            Player.SensePulse = true;
            var fog = Fog();
            fog.RevealCircle(Player.X, Player.Y, SenseRadius);
            fog.SaveTo(Player, Map);
            return true;
        }

        // ================================================================ the month

        private int VeinBonusHere() => PoiHere() is { Kind: "spirit_vein" } vein ? vein.QiBonus : 0;

        /// <summary>What one month would yield here, without changing anything (for the seclusion screen).</summary>
        public CultivationBreakdown PreviewMonth(bool seclusion, int extraQiDensity = 0) =>
            Cultivation.MonthlyGain(State, Content, (ZoneHere?.CultivationBonus ?? 0) + extraQiDensity + VeinBonusHere(), seclusion);

        public MonthReport EndMonth()
        {
            var report = WorldTick.EndMonth(State, Content, Map, seclusion: false, VeinBonusHere());
            return report;
        }

        /// <summary>
        /// Bế quan for up to <paramref name="months"/> months. Stops early on death, an ambush, or a
        /// cultivation event (15%/month) the player has to answer.
        /// </summary>
        public MonthReport Seclude(int months, int extraQiDensity, int silverPerMonth = 0)
        {
            var total = new MonthReport();
            for (var i = 0; i < months; i++)
            {
                if (silverPerMonth > 0)
                {
                    if (Player.Silver < silverPerMonth)
                    {
                        total.Events.Add(GameEvent.Warn("seclusion_money", "Hết bạc thuê phòng — kết thúc bế quan.", "Out of silver for the room — seclusion ends."));
                        break;
                    }
                    Player.Silver -= silverPerMonth;
                }
                var m = WorldTick.EndMonth(State, Content, Map, seclusion: true, extraQiDensity + VeinBonusHere());
                total.Months += 1;
                total.Month = m.Month;
                total.Year = m.Year;
                total.TotalExp += m.TotalExp;
                total.Cultivation = m.Cultivation;
                total.Events.AddRange(m.Events);
                total.Rumors.AddRange(m.Rumors);
                if (m.Died) { total.Died = true; break; }
                if (m.Ambushed) { total.Ambushed = true; break; }

                var rng = Rng("seclusion");
                if (i < months - 1 && rng.Chance(0.15))
                {
                    var ev = EventEngine.Select(EventEngine.ValidEvents(State, Content, "cultivation", Map.Def.RegionId), Player, rng);
                    if (ev != null)
                    {
                        total.InterruptEventId = ev.Id;
                        break;
                    }
                }
            }
            return total;
        }

        // ================================================================ encounters

        private Encounter BeginEncounter(Encounter e)
        {
            ActiveEncounter = e;
            Player.Counters.Fights += 1;
            return e;
        }

        public Encounter? TakeAmbush()
        {
            var ambush = State.World.PendingAmbush;
            if (ambush == null) return null;
            State.World.PendingAmbush = null;
            return BeginEncounter(ambush);
        }

        public Encounter? ChallengeNpc(string npcId, bool lethal)
        {
            var npc = State.World.Npcs.FirstOrDefault(n => n.Id == npcId && n.Alive);
            if (npc == null || ActiveEncounter != null) return null;
            return BeginEncounter(new Encounter
            {
                Id = State.NewId("enc"), Source = lethal ? "npc" : "spar", SourceId = npc.Id,
                EnemyIds = { npc.SectId == "thanh_van_kiem" ? "sect_disciple" : "rogue_cultivator" },
                Zone = npc.Zone, Danger = 1, NonLethal = !lethal,
                RealmOverride = npc.Realm, StageOverride = npc.Stage, DisplayName = npc.Name,
            });
        }

        public Encounter? StartSectTrial(string sectId)
        {
            if (ActiveEncounter != null || Player.SectId != null) return null;
            if (Content.Sects.TryGetValue(sectId, out var sect) && sect.Type != "Ma" && !Karma.AcceptableToRighteous(Player.Karma))
                return null;
            return BeginEncounter(new Encounter
            {
                Id = State.NewId("enc"), Source = "trial", SourceId = sectId, EnemyIds = { "sect_disciple" },
                Danger = 1, NonLethal = true,
            });
        }

        public Encounter? StartAdventureFight(string enemyId, string? zone)
        {
            if (ActiveEncounter != null) return null;
            return BeginEncounter(new Encounter
            {
                Id = State.NewId("enc"), Source = "adventure", EnemyIds = { enemyId },
                Zone = zone, Danger = Content.Area(zone)?.DangerLevel ?? 1,
            });
        }

        public List<EnemyInstance> BuildEnemies(Encounter e) => Encounters.Build(Content, e);

        public void AbandonEncounter() => ActiveEncounter = null;

        /// <summary>Close the active fight with what happened in the arena. Loot is rolled here, not in the arena.</summary>
        public CombatResolution ResolveCombat(CombatOutcome outcome)
        {
            var result = new CombatResolution();
            var enc = ActiveEncounter;
            if (enc == null || enc.Id != outcome.EncounterId) return result;
            ActiveEncounter = null;

            var rng = Rng("combat:" + enc.Id);
            Player.Hp = Math.Max(0, Math.Min(Player.HpMax, outcome.HpLeft));
            Player.Qi = Math.Max(0, Math.Min(Player.QiMax, outcome.QiLeft));
            Player.Stamina = Player.StaminaMax;
            foreach (var used in outcome.ItemsUsed)
            {
                var n = Math.Min(used.Value, Inventory.Count(Player, used.Key));
                if (n > 0) Inventory.Remove(Player, used.Key, n);
            }
            foreach (var use in outcome.SkillUses)
                result.Events.AddRange(Skills.GrantUseExp(State, Content, use.Key, use.Value, rng));

            var npc = enc.SourceId != null ? State.World.Npcs.FirstOrDefault(n => n.Id == enc.SourceId) : null;

            if (outcome.Fled)
            {
                Player.Footwork = Math.Max(0, Player.Footwork - 1);
                result.Events.Add(GameEvent.Info("fled", "Ngươi thi triển độn thuật thoát thân.", "You escape with a burst of movement."));
                return result;
            }

            if (!outcome.Victory)
            {
                if (enc.NonLethal)
                {
                    Player.Hp = Math.Max(Player.Hp, Player.HpMax * 3 / 10);
                    if (npc != null) Shift(npc, 3);
                    result.Events.Add(enc.Source == "trial"
                        ? GameEvent.Info("trial_failed", "Ngươi thua trận khảo hạch. Hãy rèn luyện thêm rồi quay lại.", "You lost the trial. Train more and come back.")
                        : GameEvent.Info("spar_lost", "Ngươi thua cuộc tỉ thí, nhưng học được đôi điều.", "You lost the spar, but learned something."));
                    return result;
                }
                return Defeat(enc, result);
            }

            // ---------------- victory
            var defeatedDefs = outcome.Defeated.Select(id => Content.Enemy(id) ?? Encounters.Fallback(id)).ToList();
            if (enc.Source == "beast" || (enc.Source == "ambush" && npc == null))
                State.World.Beasts.RemoveAll(b => b.Id == enc.SourceId);

            foreach (var def in defeatedDefs)
            {
                Player.Counters.Kills += 1;
                Player.Counters.KillsByEnemy[def.Id] = (Player.Counters.KillsByEnemy.TryGetValue(def.Id, out var k) ? k : 0) + 1;
                foreach (var bounty in Player.Bounties.Where(b => b.EnemyId == def.Id && b.Progress < b.Count))
                    bounty.Progress += 1;
            }

            if (!enc.NonLethal)
            {
                var strongest = defeatedDefs.OrderByDescending(d => d.Hp).FirstOrDefault();
                var tier = Content.Region(Map.Def.RegionId)?.Tier ?? 1;
                result.Loot = Loot.Roll(Content, strongest?.LootTable ?? ZoneAt(Player.X, Player.Y)?.LootTable, tier, rng, maxItems: 2);
                result.Loot.Silver += defeatedDefs.Sum(d => d.Silver);
                Inventory.Apply(State, Content, result.Loot);
                result.Exp = defeatedDefs.Sum(d => (long)d.Exp);
                var karma = defeatedDefs.Sum(d => d.Karma);
                if (karma != 0) Karma.Add(Player, karma);
            }
            else
            {
                result.Exp = Math.Max(10, defeatedDefs.Sum(d => (long)d.Exp) / 2);
            }

            var qiShare = Player.Path == CultivationPath.Body ? 0 : Player.Path == CultivationPath.Kiem ? Player.QiShare : 100;
            result.Events.AddRange(Cultivation.AddExp(State, Content, result.Exp * qiShare / 100, result.Exp - result.Exp * qiShare / 100));

            switch (enc.Source)
            {
                case "trial":
                    result.Events.AddRange(JoinSect(enc.SourceId ?? ""));
                    break;
                case "spar":
                    if (npc != null)
                    {
                        Shift(npc, npc.Traits.Contains("proud") ? -3 : 8);
                        result.Events.Add(GameEvent.Info("spar_won", $"Ngươi thắng {npc.Name} trong cuộc tỉ thí.", $"You beat {npc.Name} in a spar."));
                    }
                    break;
                case "npc":
                case "ambush":
                    if (npc != null) KillNpc(npc, result);
                    break;
                case "dungeon":
                    if (State.World.Run != null) State.World.Run.FloorCleared = true;
                    break;
            }

            if (rng.Chance(0.2) && enc.Source != "trial")
            {
                var ev = EventEngine.Select(EventEngine.ValidEvents(State, Content, "combat_end", Map.Def.RegionId), Player, rng);
                result.FollowUpEventId = ev?.Id;
            }
            return result;
        }

        private CombatResolution Defeat(Encounter enc, CombatResolution result)
        {
            Player.Counters.Defeats += 1;
            var lost = Player.Silver / 5;
            Player.Silver -= lost;
            var months = enc.Danger >= 3 ? 2 : 1;
            Player.Injuries.Add(new InjuryState
            {
                Id = State.NewId("injury"), Name = "Trọng thương", NameEn = "Grievous wounds",
                MonthsLeft = months + 1, CultivationMultiplier = 0.6,
            });
            var town = Map.Def.Pois.FirstOrDefault(p => p.Kind == "town");
            if (town != null)
            {
                Player.X = town.X;
                Player.Y = town.Y;
            }
            if (enc.Source == "dungeon") State.World.Run = null; // carried out of the secret realm
            result.MonthsLost = months;
            result.Events.Add(GameEvent.Warn("defeated",
                $"Ngươi gục ngã, mất {lost} bạc. Người qua đường đưa ngươi về thôn; {months} tháng sau mới tỉnh lại.",
                $"You collapse and lose {lost} silver. A passerby carries you to the village; you wake {months} month(s) later."));
            for (var i = 0; i < months; i++)
            {
                var m = WorldTick.EndMonth(State, Content, Map, seclusion: false, 0);
                result.Events.AddRange(m.Events);
                if (m.Died) break;
            }
            Player.Hp = Math.Max(Player.Hp, Player.HpMax * 3 / 10);
            return result;
        }

        private void KillNpc(NpcState npc, CombatResolution result)
        {
            npc.Alive = false;
            var karma = npc.Alignment < -40 ? 20 : npc.Alignment > 20 ? -60 : -25;
            Karma.Add(Player, karma);
            result.Events.Add(GameEvent.Major("npc_killed",
                $"{npc.Name} đã chết dưới tay ngươi. Nhân quả {(karma > 0 ? "+" : "")}{karma}.",
                $"{npc.Name} died by your hand. Karma {(karma > 0 ? "+" : "")}{karma}."));
            NpcSim.AddRumor(State, new List<Rumor>(), "player_kill", npc.Id,
                $"{Player.Name} đã giết {npc.Name}.", $"{Player.Name} killed {npc.Name}.");
            // Those who loved the dead now hold a grudge (oán).
            foreach (var friend in State.World.Npcs.Where(n => n.Alive && n.RelationTo(npc.Id) >= 40))
            {
                Karma.Record(State, friend.Id, LedgerKind.Oan, 40,
                    $"Ngươi đã giết {npc.Name}, người {friend.Name} quý trọng.", $"You killed {npc.Name}, whom {friend.Name} cherished.");
                friend.Relations[NpcSim.PlayerKey] = Math.Min(friend.RelationTo(NpcSim.PlayerKey), -50);
            }
        }

        // ================================================================ adventures & events

        public AdventureSpot? Adventure(string id) => State.World.Adventures.FirstOrDefault(a => a.Id == id);

        public EventDef? EventFor(string adventureId) =>
            Adventure(adventureId) is { } adv && Content.Events.TryGetValue(adv.EventId, out var ev) ? ev : null;

        public List<ChoiceView> Choices(EventDef ev) => EventEngine.Choices(State, ev);

        /// <summary>Answer an event. Adventures on the map are consumed; direct events (seclusion, after a fight) pass null.</summary>
        public OutcomeResult ResolveEvent(string eventId, string choiceId, string? adventureId = null)
        {
            var ev = Content.Events[eventId];
            var available = Choices(ev).FirstOrDefault(c => c.Choice.Id == choiceId);
            if (available == null || !available.Available)
                throw new InvalidOperationException($"Choice {choiceId} is not available");
            var zone = adventureId != null ? Adventure(adventureId)?.Zone : Map.ZoneAt(Player.X, Player.Y);
            if (adventureId != null) State.World.Adventures.RemoveAll(a => a.Id == adventureId);
            var result = EventEngine.Resolve(State, Content, ev, choiceId, Rng("event:" + eventId), DeltaPolicy.Authored);
            if (result.CombatEnemyId != null)
            {
                var enc = StartAdventureFight(result.CombatEnemyId, zone);
                if (enc != null) result.Events.Add(GameEvent.Info("fight", "Chiến đấu!", "Fight!"));
            }
            return result;
        }

        // ================================================================ gathering & items

        public List<GameEvent> Gather(string poiId)
        {
            var events = new List<GameEvent>();
            var poi = Poi(poiId);
            if (poi == null || poi.Kind != "herb" || poi.X != Player.X || poi.Y != Player.Y) return events;
            if (!Spawns.NodeReady(State, poiId))
            {
                events.Add(GameEvent.Info("herb_empty", "Dược điền đã bị hái trụi, chờ mọc lại.", "Already picked clean — wait for it to regrow."));
                return events;
            }
            if (Player.Footwork < 1)
            {
                events.Add(GameEvent.Info("no_footwork", "Cước lực đã cạn.", "No footwork left."));
                return events;
            }
            Player.Footwork -= 1;
            var roll = Loot.Roll(Content, poi.LootTable ?? ZoneHere?.LootTable, 1, Rng("gather:" + poiId), maxItems: 2);
            roll.Silver = 0;
            Inventory.Apply(State, Content, roll);
            Spawns.Deplete(State, poiId);
            Player.Counters.HerbsGathered += 1;
            foreach (var s in roll.Items)
                events.Add(GameEvent.Info("item_gained", $"Hái được {s.Name} ×{s.Qty}.", $"Gathered {s.NameEn} ×{s.Qty}."));
            return events;
        }

        public List<GameEvent> UseItem(string itemId) => Inventory.Use(State, Content, itemId);

        /// <summary>Put a known art into one of the four spirit-art slots (empty string clears it).</summary>
        public bool SetSkillSlot(int slot, string skillId)
        {
            while (Player.SkillSlots.Count < 4) Player.SkillSlots.Add("");
            if (slot < 0 || slot >= Player.SkillSlots.Count) return false;
            if (skillId.Length > 0 && !Skills.Knows(Player, skillId)) return false;
            if (skillId.Length > 0)
            {
                var other = Player.SkillSlots.IndexOf(skillId);
                if (other >= 0) Player.SkillSlots[other] = Player.SkillSlots[slot]; // swap
            }
            Player.SkillSlots[slot] = skillId;
            return true;
        }

        /// <summary>Kiêm tu: how much of each month's exp goes to Qi (the rest tempers the body).</summary>
        public void SetQiShare(int percent) => Player.QiShare = Math.Max(0, Math.Min(100, percent));

        public SectDef? SectFor(PoiDef poi) => poi.Ref != null && Content.Sects.TryGetValue(poi.Ref, out var s) ? s : null;

        public List<GameEvent> Equip(string itemId)
        {
            var events = new List<GameEvent>();
            var def = Content.Item(itemId);
            if (def == null || def.EquipmentSlot != "Weapon" || Inventory.Count(Player, itemId) <= 0) return events;
            Player.WeaponId = itemId;
            events.Add(GameEvent.Info("equipped", $"Trang bị {def.Name}.", $"Equipped {def.NameEn}."));
            return events;
        }

        // ================================================================ towns

        public TownDef? TownFor(PoiDef poi) => poi.Ref != null && Content.Towns.TryGetValue(poi.Ref, out var t) ? t : null;

        public List<GameEvent> Rest(TownDef town)
        {
            var events = new List<GameEvent>();
            if (Player.Silver < town.RestCost || Player.Footwork < 1)
            {
                events.Add(GameEvent.Info("rest_denied", "Không đủ bạc hoặc cước lực.", "Not enough silver or footwork."));
                return events;
            }
            Player.Silver -= town.RestCost;
            Player.Footwork -= 1;
            Player.Hp = Player.HpMax;
            Player.Qi = Player.QiMax;
            events.Add(GameEvent.Info("rested", "Một đêm yên giấc, khí huyết sung mãn.", "A night's rest — fully recovered."));
            return events;
        }

        public List<GameEvent> Buy(TownDef town, string itemId)
        {
            var events = new List<GameEvent>();
            var entry = town.Shop.FirstOrDefault(s => s.ItemId == itemId);
            var def = Content.Item(itemId);
            if (entry == null || def == null) return events;
            if (Player.Silver < entry.Price)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            Player.Silver -= entry.Price;
            Inventory.Add(Player, Inventory.StackOf(def, 1));
            events.Add(GameEvent.Info("bought", $"Mua {def.Name} (−{entry.Price} bạc).", $"Bought {def.NameEn} (−{entry.Price} silver)."));
            return events;
        }

        public static int SellPrice(string rarity) => rarity switch
        {
            "Legendary" => 400,
            "Epic" => 160,
            "Rare" => 60,
            "Uncommon" => 25,
            _ => 10,
        };

        public List<GameEvent> Sell(string itemId)
        {
            var events = new List<GameEvent>();
            var stack = Player.Items.FirstOrDefault(i => i.Id == itemId);
            if (stack == null || itemId == Player.WeaponId && stack.Qty <= 1) return events;
            var price = SellPrice(stack.Rarity);
            Inventory.Remove(Player, itemId);
            Player.Silver += price;
            events.Add(GameEvent.Info("sold", $"Bán {stack.Name} (+{price} bạc).", $"Sold {stack.NameEn} (+{price} silver)."));
            return events;
        }

        public List<GameEvent> AcceptBounty(TownDef town, string bountyId)
        {
            var events = new List<GameEvent>();
            var def = town.Bounties.FirstOrDefault(b => b.Id == bountyId);
            if (def == null || Player.Bounties.Any(b => b.Id == bountyId)) return events;
            Player.Bounties.Add(new ActiveBounty
            {
                Id = def.Id, EnemyId = def.EnemyId, Count = def.Count, RewardSilver = def.RewardSilver,
                RewardKarma = def.RewardKarma, Name = def.Name, NameEn = def.NameEn,
            });
            events.Add(GameEvent.Info("bounty_taken", $"Nhận cáo thị: {def.Name}.", $"Took the bounty: {def.NameEn}."));
            return events;
        }

        public List<GameEvent> ClaimBounties()
        {
            var events = new List<GameEvent>();
            foreach (var b in Player.Bounties.Where(b => b.Progress >= b.Count).ToList())
            {
                Player.Bounties.Remove(b);
                Player.Silver += b.RewardSilver;
                Karma.Add(Player, b.RewardKarma);
                events.Add(GameEvent.Major("bounty_done", $"Hoàn thành {b.Name}: +{b.RewardSilver} bạc.", $"Completed {b.NameEn}: +{b.RewardSilver} silver."));
            }
            return events;
        }

        // ================================================================ sects

        public List<GameEvent> JoinSect(string sectId)
        {
            var events = new List<GameEvent>();
            if (!Content.Sects.TryGetValue(sectId, out var sect) || Player.SectId != null) return events;
            Player.SectId = sectId;
            Player.SectRank = "NgoạiMôn";
            Player.Contribution = 0;
            events.Add(GameEvent.Major("sect_join",
                $"Bái nhập {sect.Name} — đệ tử ngoại môn. Tu luyện +{Cultivation.SectBonusPercent(Player.SectRank)}%.",
                $"Joined the {sect.NameEn} as an outer disciple. Cultivation +{Cultivation.SectBonusPercent(Player.SectRank)}%."));
            if (sectId == "thanh_van_kiem") events.AddRange(Skills.Learn(State, Content, "thanh_van_kiem_quyet"));
            NpcSim.AddRumor(State, new List<Rumor>(), "sect_join", null,
                $"{Player.Name} được thu nhận vào {sect.Name}.", $"{Player.Name} was accepted into the {sect.NameEn}.");
            return events;
        }

        // ================================================================ people

        public NpcState? Npc(string id) => State.World.Npcs.FirstOrDefault(n => n.Id == id);

        private void Shift(NpcState npc, int delta) =>
            npc.Relations[NpcSim.PlayerKey] = Math.Max(-100, Math.Min(100, npc.RelationTo(NpcSim.PlayerKey) + delta));

        public List<Line> Talk(string npcId)
        {
            var npc = Npc(npcId);
            if (npc == null) return new List<Line>();
            var lines = OfflineStoryteller.Greeting(State, npc);
            if (npc.LastTalkMonth != State.Calendar.MonthIndex)
            {
                npc.LastTalkMonth = State.Calendar.MonthIndex;
                if (npc.RelationTo(NpcSim.PlayerKey) > -40) Shift(npc, 2);
            }
            return lines;
        }

        public NpcCard CardFor(string npcId)
        {
            var npc = Npc(npcId) ?? throw new KeyNotFoundException(npcId);
            var zone = Content.Area(npc.Zone);
            return OfflineStoryteller.Card(State, Content, npc, zone?.Name ?? "");
        }

        /// <summary>A gift raises favor once a month and leaves a debt of gratitude (ân) in the ledger.</summary>
        public List<GameEvent> Gift(string npcId, string itemId)
        {
            var events = new List<GameEvent>();
            var npc = Npc(npcId);
            var stack = Player.Items.FirstOrDefault(i => i.Id == itemId);
            if (npc == null || stack == null) return events;
            if (npc.LastGiftMonth == State.Calendar.MonthIndex)
            {
                events.Add(GameEvent.Info("gift_again", $"{npc.Name} khách sáo từ chối.", $"{npc.Name} politely declines."));
                return events;
            }
            Inventory.Remove(Player, itemId);
            npc.LastGiftMonth = State.Calendar.MonthIndex;
            var gain = stack.Rarity switch { "Legendary" => 30, "Epic" => 22, "Rare" => 15, "Uncommon" => 10, _ => 6 };
            if (npc.Traits.Contains("greedy")) gain += 5;
            Shift(npc, gain);
            Karma.Record(State, npc.Id, LedgerKind.An, gain, $"Ngươi tặng {npc.Name} {stack.Name}.", $"You gave {npc.Name} {stack.NameEn}.");
            events.Add(GameEvent.Info("gift", $"{npc.Name} nhận {stack.Name}. Hảo cảm +{gain}.", $"{npc.Name} accepts the {stack.NameEn}. Favor +{gain}."));
            return events;
        }

        // ================================================================ breakthroughs

        public bool BreakthroughReady => Player.PendingMajorBreakthrough;

        /// <summary>Close a breakthrough set piece; <paramref name="performance"/> is 0..1 from the trial.</summary>
        public List<GameEvent> CompleteBreakthrough(double performance)
        {
            var before = Player.Realm;
            var events = Cultivation.CompleteMajorBreakthrough(State, Content, performance);
            if (Player.Realm != before)
            {
                Player.FootworkMax = WorldTick.FootworkMax(Player);
                if (before == Realm.PhamNhan)
                {
                    var starter = StarterArt(Player.Root.Elements.FirstOrDefault());
                    events.AddRange(Skills.Learn(State, Content, starter));
                }
                NpcSim.AddRumor(State, new List<Rumor>(), "player_breakthrough", null,
                    $"{Player.Name} đột phá {Names.Display(Player.Realm, Locale.Vi)}.",
                    $"{Player.Name} broke through to {Names.Display(Player.Realm, Locale.En)}.");
            }
            return events;
        }

        /// <summary>The first spirit art comes from the spirit root's element.</summary>
        public static string StarterArt(Element element) => element switch
        {
            Element.Kim => "kim_kiem_khi",
            Element.Moc => "thanh_moc_cham",
            Element.Thuy => "thuy_nhan",
            Element.Hoa => "hoa_cau_thuat",
            _ => "tho_thu",
        };

        // ================================================================ secret realms

        public DungeonDef? DungeonFor(PoiDef poi) => poi.Ref != null && Content.Dungeons.TryGetValue(poi.Ref, out var d) ? d : null;

        public List<GameEvent> EnterRealm(string dungeonId)
        {
            var events = new List<GameEvent>();
            if (!Content.Dungeons.TryGetValue(dungeonId, out var d) || State.World.Run != null) return events;
            var silver = d.EntryCost?.Silver ?? 0;
            if (Player.Silver < silver || Player.Footwork < 2)
            {
                events.Add(GameEvent.Info("realm_denied", $"Cần {silver} bạc và 2 cước lực.", $"Requires {silver} silver and 2 footwork."));
                return events;
            }
            Player.Silver -= silver;
            Player.Footwork -= 2;
            State.World.Run = new SecretRealmRun { DungeonId = dungeonId, Floor = 1 };
            events.Add(GameEvent.Major("realm_enter", $"Tiến vào {d.Name}.", $"You enter the {d.NameEn}."));
            return events;
        }

        public FloorDef? CurrentFloor()
        {
            var run = State.World.Run;
            if (run == null || !Content.Dungeons.TryGetValue(run.DungeonId, out var d)) return null;
            return d.Floors.FirstOrDefault(f => f.FloorNumber == run.Floor);
        }

        public Encounter? StartFloorFight()
        {
            var run = State.World.Run;
            var floor = CurrentFloor();
            if (run == null || floor == null || run.FloorCleared || ActiveEncounter != null) return null;
            var d = Content.Dungeons[run.DungeonId];
            var ids = Encounters.RollFloor(floor, Rng("floor:" + run.DungeonId + ":" + run.Floor));
            return BeginEncounter(new Encounter
            {
                Id = State.NewId("enc"), Source = "dungeon", SourceId = run.DungeonId, EnemyIds = ids,
                Danger = Math.Max(1, d.Tier + run.Floor - 1),
            });
        }

        public LootRoll? OpenFloorChest()
        {
            var run = State.World.Run;
            var floor = CurrentFloor();
            if (run == null || floor == null || !run.FloorCleared || run.ChestsOpened >= floor.ChestCount) return null;
            run.ChestsOpened += 1;
            var d = Content.Dungeons[run.DungeonId];
            var roll = Loot.Roll(Content, floor.ChestLootTable, d.Tier, Rng("chest:" + run.DungeonId + ":" + run.Floor + ":" + run.ChestsOpened));
            Inventory.Apply(State, Content, roll);
            return roll;
        }

        /// <summary>Descend, or — on the last floor — claim completion rewards and leave.</summary>
        public List<GameEvent> AdvanceRealm()
        {
            var events = new List<GameEvent>();
            var run = State.World.Run;
            if (run == null || !run.FloorCleared) return events;
            var d = Content.Dungeons[run.DungeonId];
            if (run.Floor < d.Floors.Count)
            {
                run.Floor += 1;
                run.FloorCleared = false;
                run.ChestsOpened = 0;
                var f = CurrentFloor();
                events.Add(GameEvent.Info("floor", $"Tầng {run.Floor}: {f?.Name}", $"Floor {run.Floor}: {f?.NameEn}"));
                return events;
            }

            var rng = Rng("realm_rewards:" + d.Id);
            var first = !State.World.DungeonClears.ContainsKey(d.Id);
            var rewards = d.CompletionRewards.Where(r => r.Chance == null || rng.Chance(r.Chance.Value)).ToList();
            if (first && d.FirstClearBonus != null) rewards.AddRange(d.FirstClearBonus);
            foreach (var r in rewards)
            {
                switch (r.Type)
                {
                    case "exp":
                        events.AddRange(Cultivation.AddExp(State, Content, r.Amount ?? 0, 0));
                        break;
                    case "silver":
                        Player.Silver += r.Amount ?? 0;
                        break;
                    case "spirit_stones":
                        Player.SpiritStones += r.Amount ?? 0;
                        break;
                    case "item":
                    case "technique":
                        if (r.Id != null) Inventory.Add(Player, Inventory.Resolve(Content, r.Id));
                        break;
                }
            }
            State.World.DungeonClears[d.Id] = (State.World.DungeonClears.TryGetValue(d.Id, out var n) ? n : 0) + 1;
            State.World.Run = null;
            events.Add(GameEvent.Major("realm_clear", $"Chinh phục {d.Name}!", $"Conquered the {d.NameEn}!"));
            NpcSim.AddRumor(State, new List<Rumor>(), "player_realm", null,
                $"{Player.Name} đã chinh phục {d.Name}.", $"{Player.Name} conquered the {d.NameEn}.");
            return events;
        }

        public void LeaveRealm() => State.World.Run = null;
    }
}
