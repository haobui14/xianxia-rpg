using System;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Realm ladders, exp curves, stat gains and lifespan. Gains are exactly what the web
    /// game's performBreakthrough / performBodyBreakthrough apply (mechanics.ts) — the UI's
    /// display table disagreed for Nguyên Anh stages, so this is now the single source.
    /// </summary>
    public static class Progression
    {
        public const int MaxStage = 9;

        /// <summary>Base monthly cultivation exp by realm (design doc §7.5, initial tuning).</summary>
        private static readonly long[] BaseMonthlyExp = { 60, 150, 900, 4000, 16000 };

        public readonly struct Gains
        {
            public readonly int Hp, Qi, Stamina, Str, Agi, Int, Per;

            public Gains(int hp, int qi, int stamina, int str, int agi, int intel, int per)
            {
                Hp = hp; Qi = qi; Stamina = stamina; Str = str; Agi = agi; Int = intel; Per = per;
            }
        }

        // Qi realm change, keyed by the realm being LEFT.
        private static readonly Gains[] RealmChange =
        {
            new Gains(50, 100, 2, 2, 2, 2, 1),   // Phàm Nhân → Luyện Khí 1
            new Gains(100, 200, 5, 3, 3, 3, 2),  // Luyện Khí 9 → Trúc Cơ 1
            new Gains(150, 300, 8, 4, 4, 4, 3),  // Trúc Cơ 9 → Kết Đan 1
            new Gains(200, 400, 10, 5, 5, 5, 4), // Kết Đan 9 → Nguyên Anh 1
        };

        // Qi stage step inside a realm, keyed by the current realm.
        private static readonly Gains[] StageStep =
        {
            new Gains(0, 0, 0, 0, 0, 0, 0),
            new Gains(30, 50, 0, 1, 1, 1, 0),
            new Gains(50, 80, 0, 2, 2, 2, 0),
            new Gains(80, 120, 0, 3, 3, 3, 0),
            new Gains(100, 150, 0, 4, 4, 4, 0),
        };

        // Body realm change, keyed by the body realm being LEFT.
        private static readonly Gains[] BodyRealmChange =
        {
            new Gains(80, 0, 3, 3, 1, 0, 0),
            new Gains(120, 0, 5, 4, 2, 0, 0),
            new Gains(180, 0, 8, 5, 3, 0, 0),
            new Gains(250, 0, 12, 6, 4, 0, 0),
        };

        private static readonly Gains[] BodyStageStep =
        {
            new Gains(0, 0, 0, 0, 0, 0, 0),
            new Gains(40, 0, 0, 2, 1, 0, 0),
            new Gains(60, 0, 0, 3, 1, 0, 0),
            new Gains(100, 0, 0, 4, 2, 0, 0),
            new Gains(150, 0, 0, 5, 3, 0, 0),
        };

        public static long BaseMonthly(Realm realm) => BaseMonthlyExp[(int)realm];

        /// <summary>
        /// Exp needed to leave the current stage. Same indexing as the web game's getRequiredExp:
        /// Phàm Nhân uses [stage]; every other realm runs stages 1..9 and uses [stage − 1].
        /// </summary>
        public static long RequiredExp(ContentDb content, Realm realm, int stage) =>
            Lookup(content.Progression.CultivationExp, Names.Id(realm), realm == Realm.PhamNhan ? stage : stage - 1);

        public static long RequiredBodyExp(ContentDb content, BodyRealm realm, int stage) =>
            Lookup(content.Progression.BodyExp, Names.Id(realm), realm == BodyRealm.PhamThe ? stage : stage - 1);

        private static long Lookup(System.Collections.Generic.Dictionary<string, long[]> table, string key, int idx)
        {
            if (!table.TryGetValue(key, out var reqs)) return long.MaxValue;
            if (idx < 0 || idx >= reqs.Length) return long.MaxValue;
            return reqs[idx];
        }

        /// <summary>True when the next step leaves the realm (a set-piece breakthrough in this design).</summary>
        public static bool NextStepIsMajor(Realm realm, int stage) =>
            realm == Realm.PhamNhan || (stage >= MaxStage && realm < Realm.NguyenAnh);

        public static bool AtPeak(Realm realm, int stage) => realm == Realm.NguyenAnh && stage >= MaxStage;

        /// <summary>Advance one qi step and apply its gains. Returns false at the very top.</summary>
        public static bool StepQi(PlayerState p)
        {
            if (AtPeak(p.Realm, p.Stage)) return false;
            if (p.Realm == Realm.PhamNhan || p.Stage >= MaxStage)
            {
                Apply(p, RealmChange[(int)p.Realm]);
                p.Realm = p.Realm + 1;
                p.Stage = 1;
            }
            else
            {
                p.Stage += 1;
                Apply(p, StageStep[(int)p.Realm]);
            }
            p.Exp = 0;
            p.Hp = p.HpMax;
            p.Qi = p.QiMax;
            return true;
        }

        public static bool StepBody(PlayerState p)
        {
            if (p.BodyRealm == BodyRealm.ThaiCo && p.BodyStage >= MaxStage) return false;
            if (p.BodyRealm == BodyRealm.PhamThe || p.BodyStage >= MaxStage)
            {
                Apply(p, BodyRealmChange[(int)p.BodyRealm]);
                p.BodyRealm = p.BodyRealm + 1;
                p.BodyStage = 1;
            }
            else
            {
                p.BodyStage += 1;
                Apply(p, BodyStageStep[(int)p.BodyRealm]);
            }
            p.BodyExp = 0;
            p.Hp = p.HpMax;
            return true;
        }

        public static Gains RealmChangeGains(Realm from) => RealmChange[(int)from];
        public static Gains StageStepGains(Realm realm) => StageStep[(int)realm];

        private static void Apply(PlayerState p, Gains g)
        {
            p.HpMax += g.Hp;
            p.QiMax += g.Qi;
            p.StaminaMax += g.Stamina;
            p.Attrs.Str += g.Str;
            p.Attrs.Agi += g.Agi;
            p.Attrs.Int += g.Int;
            p.Attrs.Per += g.Per;
        }

        /// <summary>
        /// Max lifespan: base + the better of the qi-realm bonus and 70% of the equivalent body
        /// bonus (body cultivators live shorter, design §7.6) + special − penalty.
        /// </summary>
        public static int MaxLifespan(ContentDb content, PlayerState p)
        {
            var qiBonus = LifespanBonus(content, p.Realm);
            var bodyBonus = (int)Math.Round(LifespanBonus(content, (Realm)(int)p.BodyRealm) * 0.7);
            return p.LifespanBase + Math.Max(qiBonus, bodyBonus) + p.LifespanSpecial - p.LifespanPenalty;
        }

        public static int LifespanBonus(ContentDb content, Realm realm) =>
            content.Progression.RealmLifespanBonus.TryGetValue(Names.Id(realm), out var v) ? v : 0;

        public static int YearsLeft(ContentDb content, PlayerState p) => MaxLifespan(content, p) - p.Age;

        /// <summary>Realm index plus a tenth per stage — the scale realm suppression works on.</summary>
        public static double RealmValue(Realm realm, int stage) => (int)realm + stage / 10.0;
    }
}
