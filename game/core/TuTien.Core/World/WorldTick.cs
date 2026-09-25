using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Events;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    public sealed class MonthReport
    {
        public int Months { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public CultivationBreakdown Cultivation { get; set; } = new CultivationBreakdown();
        public long TotalExp { get; set; }
        public List<GameEvent> Events { get; } = new List<GameEvent>();
        public List<Rumor> Rumors { get; } = new List<Rumor>();
        public bool Ambushed { get; set; }
        public bool Died { get; set; }
        /// <summary>A cultivation event that interrupted seclusion; the player must resolve it.</summary>
        public string? InterruptEventId { get; set; }
    }

    /// <summary>
    /// Qua tháng — the month resolution. The order is fixed (design §7.1) so the same save and
    /// the same choices always produce the same world.
    /// </summary>
    public static class WorldTick
    {
        /// <summary>
        /// Cước lực per month, roughly "days of travel": a plains tile costs 1, rough ground 2–3. Tuned for
        /// the real-time map, where walking spends it and the month turns when it runs out.
        /// </summary>
        public static int FootworkMax(PlayerState p) => 24 + p.Attrs.Agi / 2 + 3 * (int)p.Realm;

        public static MonthReport EndMonth(GameState state, ContentDb content, MapGrid map, bool seclusion, int extraQiDensity)
        {
            var report = new MonthReport { Months = 1 };
            var p = state.Player;
            if (p.Dead) return report;
            var zone = content.Area(map.ZoneAt(p.X, p.Y));

            // 1–2. Cultivation, then every minor breakthrough it pays for.
            var density = (zone?.CultivationBonus ?? 0) + extraQiDensity;
            report.Cultivation = Cultivation.MonthlyGain(state, content, density, seclusion);
            report.TotalExp = report.Cultivation.Total;
            report.Events.AddRange(Cultivation.AddExp(state, content, report.Cultivation.ToQi, report.Cultivation.ToBody));

            // 3. Recovery and healing.
            var safe = seclusion || (zone?.IsSafe ?? false);
            p.Hp = safe ? p.HpMax : p.Hp + (p.HpMax - p.Hp) / 2;
            p.Qi = safe ? p.QiMax : p.Qi + (p.QiMax - p.Qi) / 2;
            p.Stamina = p.StaminaMax;
            foreach (var injury in p.Injuries.ToList())
            {
                injury.MonthsLeft -= 1;
                if (injury.MonthsLeft > 0) continue;
                p.Injuries.Remove(injury);
                report.Events.Add(GameEvent.Info("healed", $"Đã lành: {injury.Name}.", $"Healed: {injury.NameEn}."));
            }

            // 4. Calendar, age, lifespan.
            var yearsLeftBefore = Progression.YearsLeft(content, p);
            Calendar.AdvanceMonth(state);
            report.Month = state.Calendar.Month;
            report.Year = state.Calendar.Year;
            var yearsLeft = Progression.YearsLeft(content, p);
            if (yearsLeft <= 0)
            {
                p.Dead = true;
                p.DeathCause = "lifespan";
                report.Died = true;
                report.Events.Add(GameEvent.Warn("death",
                    "Thọ nguyên cạn kiệt. Đạo đồ đến đây là hết.",
                    "Your lifespan is spent. Your path ends here."));
                return report;
            }
            foreach (var threshold in new[] { 20, 10, 5 })
            {
                if (yearsLeftBefore > threshold && yearsLeft <= threshold)
                    report.Events.Add(GameEvent.Warn("lifespan",
                        $"Thọ nguyên chỉ còn {yearsLeft} năm — phải đột phá để kéo dài tuổi thọ!",
                        $"Only {yearsLeft} years of lifespan left — break through to extend it!"));
            }

            // 5. A disciple's month: the sect's stipend, and missions that ran out of time.
            report.Events.AddRange(SectMissions.MonthPassed(state, content));

            // 6. The living world.
            EventEngine.TickCooldowns(state);
            NpcSim.Tick(state, content, map, report.Rumors, report.Events);

            // 7. Spawns: beasts roam and respawn, adventures refresh, herbs regrow.
            var rng = Seeds.Stream(state.Seed, "spawns", state.Calendar.MonthIndex);
            Spawns.MoveBeasts(state, content, map, rng, report.Events);
            Spawns.FillBeasts(state, content, map, rng);
            Spawns.RefreshAdventures(state, content, map, rng);
            report.Ambushed = state.World.PendingAmbush != null;

            // 8. A fresh month of footwork.
            p.FootworkMax = FootworkMax(p);
            p.Footwork = p.FootworkMax;
            p.SensePulse = false;
            var fog = FogMask.For(p, map);
            fog.RevealCircle(p.X, p.Y, MapGrid.SenseRadius(p));
            fog.SaveTo(p, map);

            // 9. A plain-facts chronicle line; the storyteller rewrites these when online.
            state.Chronicle.Add(new ChronicleEntry
            {
                MonthIndex = state.Calendar.MonthIndex,
                Text = $"Tháng {state.Calendar.Month} năm {state.Calendar.Year}: tu vi +{report.TotalExp}"
                       + (report.Events.Count(e => e.Level == EventLevel.Major) > 0
                           ? "; " + string.Join("; ", report.Events.Where(e => e.Level == EventLevel.Major).Select(e => e.Text))
                           : ""),
                TextEn = $"Month {state.Calendar.Month}, year {state.Calendar.Year}: cultivation +{report.TotalExp}"
                         + (report.Events.Count(e => e.Level == EventLevel.Major) > 0
                             ? "; " + string.Join("; ", report.Events.Where(e => e.Level == EventLevel.Major).Select(e => e.TextEn))
                             : ""),
            });
            if (state.Chronicle.Count > 120) state.Chronicle.RemoveRange(0, state.Chronicle.Count - 120);
            return report;
        }
    }
}
