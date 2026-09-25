using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// The Earth God shrine (Miếu Thổ Địa) by the road: once a month, burn incense and draw a fortune stick (xin xăm).
    /// The stick's verse speaks for the month: more or less cultivation, rare fish biting, rich veins, or the smoke
    /// pointing to a chance meeting. An ill omen can be lifted for a little silver, and an offering earns karma.
    /// </summary>
    public static class Shrine
    {
        public const int IncenseSilver = 5;
        public const int DispelSilver = 20;
        public const int OfferingSilver = 50;
        public const int OfferingKarma = 2;

        public static bool DrawnThisMonth(GameState state) => state.Player.Fortune?.Month == state.Calendar.MonthIndex;

        public static bool OfferedThisMonth(GameState state) => state.Player.ShrineOfferingMonth == state.Calendar.MonthIndex;

        /// <summary>This month's stick, if one was drawn this month.</summary>
        public static FortuneDef? Current(GameState state, ContentDb content) =>
            DrawnThisMonth(state) ? content.Fortunes.FirstOrDefault(f => f.Id == state.Player.Fortune!.Id) : null;

        /// <summary>Percent on this month's cultivation from the stick (a lifted ill omen counts for nothing).</summary>
        public static int CultivationBonus(GameState state, ContentDb content)
        {
            var f = Current(state, content);
            if (f == null || (f.Cultivation < 0 && state.Player.Fortune!.Dispelled)) return 0;
            return f.Cultivation;
        }

        public static string GradeName(string grade, Locale locale) => grade switch
        {
            "great" => locale == Locale.En ? "Great fortune" : "Đại cát",
            "good" => locale == Locale.En ? "Good fortune" : "Cát",
            "ill" => locale == Locale.En ? "Ill omen" : "Hung",
            _ => locale == Locale.En ? "Middling" : "Bình",
        };

        /// <summary>What the stick means for the month, in plain words.</summary>
        public static (string Vi, string En) Meaning(FortuneDef f)
        {
            var vi = new List<string>();
            var en = new List<string>();
            if (f.Cultivation != 0)
            {
                vi.Add($"tu luyện tháng này {(f.Cultivation > 0 ? "+" : "")}{f.Cultivation}%");
                en.Add($"cultivation {(f.Cultivation > 0 ? "+" : "")}{f.Cultivation}% this month");
            }
            if (f.LuckyCatch)
            {
                vi.Add("cá hiếm cắn câu gấp đôi");
                en.Add("rare fish bite twice as often");
            }
            if (f.RichVein)
            {
                vi.Add("mạch khoáng cho thêm một khối");
                en.Add("every ore vein gives one more piece");
            }
            if (f.Guidance)
            {
                vi.Add("khói hương chỉ về một kỳ ngộ");
                en.Add("the incense smoke points to a chance meeting");
            }
            if (vi.Count == 0) return ("Không lành không dữ.", "Neither lucky nor unlucky.");
            return (Cap(string.Join(", ", vi)) + ".", Cap(string.Join(", ", en)) + ".");
        }

        private static string Cap(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s.Substring(1);

        public static List<GameEvent> Draw(GameState state, ContentDb content, MapGrid map, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (DrawnThisMonth(state))
            {
                events.Add(GameEvent.Info("fortune_again", "Mỗi tháng chỉ xin một quẻ. Tháng sau hãy quay lại.", "One stick a month. Come back next month."));
                return events;
            }
            if (p.Silver < IncenseSilver || content.Fortunes.Count == 0)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc mua hương.", "Not enough silver for incense."));
                return events;
            }
            p.Silver -= IncenseSilver;
            var f = content.Fortunes[Math.Max(0, rng.WeightedIndex(content.Fortunes.Select(x => x.Weight).ToList()))];
            p.Fortune = new FortuneState { Id = f.Id, Month = state.Calendar.MonthIndex };
            var (vi, en) = Meaning(f);
            var line = $"Quẻ số {f.Number} — {GradeName(f.Grade, Locale.Vi)}: “{f.Verse}” {vi}";
            var lineEn = $"Stick {f.Number}, {GradeName(f.Grade, Locale.En)}: “{f.VerseEn}” {en}";
            events.Add(f.Grade is "great" or "good" ? GameEvent.Major("fortune", line, lineEn)
                : f.Grade == "ill" ? GameEvent.Warn("fortune", line, lineEn) : GameEvent.Info("fortune", line, lineEn));
            if (f.Guidance) events.AddRange(Guide(state, content, map));
            return events;
        }

        /// <summary>The nearest chance meeting on the map shows itself, wherever it is.</summary>
        public static List<GameEvent> Guide(GameState state, ContentDb content, MapGrid map)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var adv = state.World.Adventures.OrderBy(a => Math.Abs(a.X - p.X) + Math.Abs(a.Y - p.Y)).FirstOrDefault();
            if (adv == null)
            {
                events.Add(GameEvent.Info("fortune_guide", "Khói hương bay xa rồi tan, chưa chỉ về đâu cả.", "The incense smoke drifts far and fades, pointing nowhere yet."));
                return events;
            }
            adv.Hidden = false;
            adv.Revealed = true;
            var fog = FogMask.For(p, map);
            fog.RevealCircle(adv.X, adv.Y, 2);
            fog.SaveTo(p, map);
            var zone = content.Area(adv.Zone);
            events.Add(GameEvent.Info("fortune_guide", $"Khói hương uốn về phía {zone?.Name ?? "xa"}: có kỳ ngộ đang chờ (đã đánh dấu trên bản đồ).",
                $"The incense smoke bends toward the {zone?.NameEn ?? "distance"}: a chance meeting waits there (marked on your map)."));
            return events;
        }

        /// <summary>The shrine keeper lifts an ill omen for a little silver.</summary>
        public static List<GameEvent> Dispel(GameState state, ContentDb content)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var f = Current(state, content);
            if (f == null || f.Grade != "ill" || p.Fortune!.Dispelled) return events;
            if (p.Silver < DispelSilver)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            p.Silver -= DispelSilver;
            p.Fortune.Dispelled = true;
            events.Add(GameEvent.Info("fortune_dispelled", "Thủ từ đốt lá xăm, khấn giải hạn. Điềm dữ đã qua.", "The shrine keeper burns the stick and prays the omen away. It has passed."));
            return events;
        }

        /// <summary>An offering for the shrine's upkeep (công đức): karma, once a month.</summary>
        public static List<GameEvent> Offer(GameState state)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (OfferedThisMonth(state)) return events;
            if (p.Silver < OfferingSilver)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            p.Silver -= OfferingSilver;
            p.ShrineOfferingMonth = state.Calendar.MonthIndex;
            Karma.Add(p, OfferingKarma);
            events.Add(GameEvent.Info("offering", $"Ngươi cúng {OfferingSilver} bạc tu sửa miếu. Nhân quả +{OfferingKarma}.",
                $"You give {OfferingSilver} silver for the shrine's upkeep. Karma +{OfferingKarma}."));
            return events;
        }
    }
}
