using System;
using System.Collections.Generic;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// The month turn. Seasons and special dates come from the web game's time.ts, adapted
    /// from per-segment to per-month bonuses (design §7.1).
    /// </summary>
    public static class Calendar
    {
        public const int FullMoonSeclusionBonus = 25;

        public static Season SeasonOf(ContentDb content, int month)
        {
            foreach (var kv in content.Progression.SeasonMonths)
            {
                if (Array.IndexOf(kv.Value, month) >= 0 && Enum.TryParse(kv.Key, out Season s)) return s;
            }
            return month <= 3 ? Season.Spring : month <= 6 ? Season.Summer : month <= 9 ? Season.Autumn : Season.Winter;
        }

        public static string SeasonName(Season s, Locale locale) => s switch
        {
            Season.Spring => locale == Locale.En ? "Spring" : "Xuân",
            Season.Summer => locale == Locale.En ? "Summer" : "Hạ",
            Season.Autumn => locale == Locale.En ? "Autumn" : "Thu",
            _ => locale == Locale.En ? "Winter" : "Đông",
        };

        /// <summary>Best season bonus among the spirit root's elements, floored at 0 (as in time.ts).</summary>
        public static int SeasonElementBonus(ContentDb content, Season season, IEnumerable<Element> root)
        {
            if (!content.Progression.SeasonElementBonus.TryGetValue(season.ToString(), out var table)) return 0;
            var best = 0;
            foreach (var e in root)
            {
                if (table.TryGetValue(Names.Id(e), out var v) && v > best) best = v;
            }
            return best;
        }

        /// <summary>New Year (month 1) +30%, solstices (months 6 and 12) +20%.</summary>
        public static (int bonus, string vi, string en) SpecialMonth(int month)
        {
            if (month == 1) return (30, "Tết đầu năm", "New Year");
            if (month == 6) return (20, "Hạ chí", "Summer solstice");
            if (month == 12) return (20, "Đông chí", "Winter solstice");
            return (0, "", "");
        }

        /// <summary>
        /// Advance one month. Age grows every 12 months lived — the same pace as the web game's
        /// year rollover, without depending on the starting month.
        /// </summary>
        public static void AdvanceMonth(GameState state)
        {
            var c = state.Calendar;
            c.MonthIndex += 1;
            c.Month += 1;
            if (c.Month > 12)
            {
                c.Month = 1;
                c.Year += 1;
            }
            var p = state.Player;
            p.AgeMonths += 1;
            if (p.AgeMonths >= 12)
            {
                p.AgeMonths = 0;
                p.Age += 1;
            }
        }

        /// <summary>Day-of-month for display: footwork spent maps onto days 1–30.</summary>
        public static int DisplayDay(PlayerState p)
        {
            if (p.FootworkMax <= 0) return 1;
            var spent = Math.Max(0, p.FootworkMax - p.Footwork);
            return 1 + (int)Math.Floor(29.0 * spent / p.FootworkMax);
        }
    }
}
