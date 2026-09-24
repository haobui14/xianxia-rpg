using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>Every factor of one month's cultivation, so the UI can show the player why.</summary>
    public sealed class CultivationBreakdown
    {
        public long Base { get; set; }
        public double RootMultiplier { get; set; } = 1;
        public double TechniqueMultiplier { get; set; } = 1;
        public double SectMultiplier { get; set; } = 1;
        public int QiDensity { get; set; }
        public int SeasonBonus { get; set; }
        public int SpecialBonus { get; set; }
        public string SpecialReason { get; set; } = "";
        public string SpecialReasonEn { get; set; } = "";
        public int FullMoonBonus { get; set; }
        public double ActivityMultiplier { get; set; } = 1;
        public double InjuryMultiplier { get; set; } = 1;
        public long Total { get; set; }
        public long ToQi { get; set; }
        public long ToBody { get; set; }

        public int TotalPercentBonus => QiDensity + SeasonBonus + SpecialBonus + FullMoonBonus;
    }

    public static class Cultivation
    {
        /// <summary>Seclusion (bế quan) multiplier, design §7.5.</summary>
        public const double SeclusionMultiplier = 1.6;

        private static readonly double[] TechniqueStackWeights = { 1.0, 0.5, 0.3, 0.2, 0.1 };

        public static double RootMultiplier(RootGrade grade) => grade switch
        {
            RootGrade.ThienPham => 2.0,
            RootGrade.Hiem => 1.5,
            RootGrade.Kha => 1.2,
            _ => 1.0,
        };

        /// <summary>Port of getTechniqueBonus: level-scaled bonus × element fit, with diminishing stacking.</summary>
        public static double TechniqueMultiplier(PlayerState p)
        {
            if (p.Techniques.Count == 0) return 1.0;
            var contributions = p.Techniques
                .Select(t =>
                {
                    var effective = t.SpeedBonus * (1 + 0.1 * (Math.Max(1, t.Level) - 1));
                    var fit = t.Elements.Count == 0 ? 1.2 : 1 + Elements.TechniqueCompatibility(p.Root.Elements, t.Elements);
                    return effective / 100.0 * fit;
                })
                .OrderByDescending(c => c)
                .ToList();
            double total = 0;
            for (var i = 0; i < contributions.Count; i++)
                total += contributions[i] * (i < TechniqueStackWeights.Length ? TechniqueStackWeights[i] : 0.05);
            return 1.0 + total;
        }

        /// <summary>Sect rank → cultivation bonus %, as granted by the web game's promotion rules.</summary>
        public static int SectBonusPercent(string? rank) => rank switch
        {
            "NgoạiMôn" => 5,
            "NộiMôn" => 10,
            "ChânTruyền" => 20,
            "TrưởngLão" => 30,
            "ChưởngMôn" => 50,
            _ => 0,
        };

        public static CultivationBreakdown MonthlyGain(GameState state, ContentDb content, int qiDensity, bool seclusion)
        {
            var p = state.Player;
            var season = Calendar.SeasonOf(content, state.Calendar.Month);
            var special = Calendar.SpecialMonth(state.Calendar.Month);
            var realmForBase = p.Path == CultivationPath.Body ? (Realm)(int)p.BodyRealm : p.Realm;
            if (p.Path == CultivationPath.Kiem) realmForBase = (Realm)Math.Max((int)p.Realm, (int)p.BodyRealm);

            var b = new CultivationBreakdown
            {
                Base = Progression.BaseMonthly(realmForBase),
                RootMultiplier = RootMultiplier(p.Root.Grade),
                TechniqueMultiplier = TechniqueMultiplier(p),
                SectMultiplier = 1 + SectBonusPercent(p.SectRank) / 100.0,
                QiDensity = qiDensity,
                SeasonBonus = Calendar.SeasonElementBonus(content, season, p.Root.Elements),
                SpecialBonus = special.bonus,
                SpecialReason = special.vi,
                SpecialReasonEn = special.en,
                FullMoonBonus = seclusion ? Calendar.FullMoonSeclusionBonus : 0,
                ActivityMultiplier = seclusion ? SeclusionMultiplier : 1.0,
                InjuryMultiplier = p.Injuries.Count == 0 ? 1.0 : p.Injuries.Min(i => i.CultivationMultiplier),
            };

            var total = b.Base * b.RootMultiplier * b.TechniqueMultiplier * b.SectMultiplier
                        * (1 + b.TotalPercentBonus / 100.0) * b.ActivityMultiplier * b.InjuryMultiplier;
            b.Total = Math.Max(0, (long)Math.Floor(total));

            switch (p.Path)
            {
                case CultivationPath.Body:
                    b.ToBody = b.Total;
                    break;
                case CultivationPath.Kiem:
                    b.ToQi = b.Total * Math.Max(0, Math.Min(100, p.QiShare)) / 100;
                    b.ToBody = b.Total - b.ToQi;
                    break;
                default:
                    b.ToQi = b.Total;
                    break;
            }
            return b;
        }

        /// <summary>
        /// Add exp and take every minor stage breakthrough it pays for. Stops at a major
        /// breakthrough (realm change) and flags it: those are set pieces the player triggers.
        /// </summary>
        public static List<GameEvent> AddExp(GameState state, ContentDb content, long qiExp, long bodyExp)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            p.Exp += Math.Max(0, qiExp);
            p.BodyExp += Math.Max(0, bodyExp);

            for (var guard = 0; guard < 20; guard++)
            {
                var need = Progression.RequiredExp(content, p.Realm, p.Stage);
                if (need == long.MaxValue || p.Exp < need) break;
                if (Progression.NextStepIsMajor(p.Realm, p.Stage))
                {
                    if (!p.PendingMajorBreakthrough)
                    {
                        p.PendingMajorBreakthrough = true;
                        events.Add(GameEvent.Major("breakthrough_ready",
                            $"Tu vi viên mãn — có thể đột phá {Names.Display(p.Realm + 1, Locale.Vi)}.",
                            $"Cultivation is full — ready to break through to {Names.Display(p.Realm + 1, Locale.En)}."));
                    }
                    break;
                }
                p.Exp -= need;
                var carry = p.Exp;
                Progression.StepQi(p);
                p.Exp = carry;
                events.Add(GameEvent.Major("stage_up",
                    $"Đột phá {Names.Display(p.Realm, Locale.Vi)} tầng {p.Stage}!",
                    $"Broke through to {Names.Display(p.Realm, Locale.En)} stage {p.Stage}!"));
                // Halfway through Luyện Khí the root's element opens its second art.
                if (p.Realm == Realm.LuyenKhi && p.Stage == Skills.SecondArtStage && p.Root.Elements.Count > 0)
                    events.AddRange(Skills.Learn(state, content, Skills.SecondArt(p.Root.Elements[0])));
            }

            for (var guard = 0; guard < 20; guard++)
            {
                var need = Progression.RequiredBodyExp(content, p.BodyRealm, p.BodyStage);
                if (need == long.MaxValue || p.BodyExp < need) break;
                p.BodyExp -= need;
                var carry = p.BodyExp;
                if (!Progression.StepBody(p)) break;
                p.BodyExp = carry;
                events.Add(GameEvent.Major("body_up",
                    $"Luyện thể: {Names.Display(p.BodyRealm, Locale.Vi)} tầng {p.BodyStage}!",
                    $"Body tempering: {Names.Display(p.BodyRealm, Locale.En)} stage {p.BodyStage}!"));
            }
            return events;
        }

        /// <summary>
        /// Outcome of a major breakthrough set piece. <paramref name="performance"/> is 0..1
        /// from the trial; success needs performance ≥ the difficulty the preparation leaves.
        /// </summary>
        public static List<GameEvent> CompleteMajorBreakthrough(GameState state, ContentDb content, double performance)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (!p.PendingMajorBreakthrough) return events;
            p.PendingMajorBreakthrough = false;

            var threshold = MajorBreakthroughThreshold(p);
            if (performance >= threshold)
            {
                var from = p.Realm;
                var need = Progression.RequiredExp(content, p.Realm, p.Stage);
                var carry = need == long.MaxValue ? 0 : Math.Max(0, p.Exp - need);
                Progression.StepQi(p);
                events.Add(GameEvent.Major("realm_up",
                    $"Đột phá thành công! Bước vào {Names.Display(p.Realm, Locale.Vi)} ({Names.Han(p.Realm)}).",
                    $"Breakthrough! You enter {Names.Display(p.Realm, Locale.En)} ({Names.Han(p.Realm)})."));
                if (from == Realm.PhamNhan)
                {
                    events.Add(GameEvent.Info("qi_awakened",
                        "Linh khí nhập thể — ngươi đã có thể thi triển linh kỹ.",
                        "Qi flows through you — you can now use spirit arts."));
                }
                if (from == Realm.LuyenKhi)
                {
                    // The meridian storm laid the foundation: a better one adds a share of the gains on top, for good.
                    var grade = Foundation.GradeFor(performance);
                    p.Foundation = grade;
                    Progression.Apply(p, Progression.RealmChangeGains(from), Foundation.GainMultiplier(grade) - 1);
                    p.Hp = p.HpMax;
                    p.Qi = p.QiMax;
                    events.Add(GameEvent.Major("foundation",
                        $"Trúc cơ {Foundation.Name(grade, Locale.Vi)}! Uy lực +{(Foundation.PowerMultiplier(grade) - 1) * 100:0}% vĩnh viễn.",
                        $"A {Foundation.Name(grade, Locale.En)} foundation! +{(Foundation.PowerMultiplier(grade) - 1) * 100:0}% power for good."));
                }
                p.Exp = carry;
                return events;
            }

            // Failure: lose part of the accumulated exp and take a meridian injury (BreakthroughOutcome).
            var lost = p.Exp / 5;
            p.Exp -= lost;
            p.Injuries.Add(new InjuryState
            {
                Id = state.NewId("injury"),
                Name = "Kinh mạch tổn thương",
                NameEn = "Damaged meridians",
                MonthsLeft = 2,
                CultivationMultiplier = 0.5,
            });
            events.Add(GameEvent.Major("breakthrough_failed",
                $"Đột phá thất bại — tổn hao {lost} tu vi, kinh mạch bị thương.",
                $"Breakthrough failed — lost {lost} cultivation and injured your meridians."));
            return events;
        }

        /// <summary>Easier with good preparation: spirit root grade, techniques, and no injuries.</summary>
        public static double MajorBreakthroughThreshold(PlayerState p)
        {
            var t = 0.55 - 0.05 * (int)p.Root.Grade - 0.02 * p.Techniques.Count;
            if (p.Injuries.Count > 0) t += 0.15;
            return Math.Max(0.25, Math.Min(0.9, t));
        }
    }

    /// <summary>
    /// Trúc Cơ's foundation (design §7.5): the meridian storm's result, graded Hạ / Trung / Thượng / Thiên.
    /// It multiplies that breakthrough's gains and adds a permanent edge in every fight.
    /// </summary>
    public static class Foundation
    {
        /// <summary>Performance needed for each grade above Hạ (passing at all lays at least a Hạ foundation).</summary>
        public const double Trung = 0.62, Thuong = 0.8, Thien = 0.95;

        public static FoundationGrade GradeFor(double performance) =>
            performance >= Thien ? FoundationGrade.Thien
            : performance >= Thuong ? FoundationGrade.Thuong
            : performance >= Trung ? FoundationGrade.Trung
            : FoundationGrade.Ha;

        /// <summary>The Trúc Cơ realm change's gains, ×1 / ×1.25 / ×1.5 / ×2 by grade.</summary>
        public static double GainMultiplier(FoundationGrade g) => g switch
        {
            FoundationGrade.Thien => 2.0,
            FoundationGrade.Thuong => 1.5,
            FoundationGrade.Trung => 1.25,
            _ => 1.0,
        };

        /// <summary>Physical and spirit power, for good: +0% / 5% / 10% / 20%.</summary>
        public static double PowerMultiplier(FoundationGrade g) => g switch
        {
            FoundationGrade.Thien => 1.2,
            FoundationGrade.Thuong => 1.1,
            FoundationGrade.Trung => 1.05,
            _ => 1.0,
        };

        public static string Name(FoundationGrade g, Locale locale) => g switch
        {
            FoundationGrade.Thien => locale == Locale.En ? "heaven-grade" : "Thiên phẩm",
            FoundationGrade.Thuong => locale == Locale.En ? "upper-grade" : "Thượng phẩm",
            FoundationGrade.Trung => locale == Locale.En ? "middle-grade" : "Trung phẩm",
            FoundationGrade.Ha => locale == Locale.En ? "lower-grade" : "Hạ phẩm",
            _ => locale == Locale.En ? "none" : "chưa có",
        };
    }
}
