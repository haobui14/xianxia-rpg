using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>How a brew came out of the furnace (đan phẩm).</summary>
    public enum PillGrade
    {
        Failed,
        Low,
        Mid,
        High,
    }

    /// <summary>
    /// The alchemy furnace at the Hundred Herbs Hall. Lighting it takes the recipe's herbs, the fee and two footwork;
    /// the host plays the fire and reports how pure the brew came out (0–1) and whether the furnace blew. Purity sets
    /// the grade, and the grade how many pills come out.
    /// </summary>
    public static class Alchemy
    {
        public const int Footwork = 2;

        /// <summary>1–10: a steadier hand at the bellows with every four brews.</summary>
        public static int Level(PlayerState p) => Math.Min(10, 1 + p.Counters.PillsBrewed / 4);

        public static PillGrade Grade(double purity) =>
            purity < 0.35 ? PillGrade.Failed : purity < 0.65 ? PillGrade.Low : purity < 0.88 ? PillGrade.Mid : PillGrade.High;

        public static int Yield(PillGrade grade) => grade switch
        {
            PillGrade.High => 3,
            PillGrade.Mid => 2,
            PillGrade.Low => 1,
            _ => 0,
        };

        public static string GradeName(PillGrade grade, Locale locale) => grade switch
        {
            PillGrade.High => locale == Locale.En ? "high grade" : "thượng phẩm",
            PillGrade.Mid => locale == Locale.En ? "middle grade" : "trung phẩm",
            PillGrade.Low => locale == Locale.En ? "low grade" : "hạ phẩm",
            _ => locale == Locale.En ? "ruined" : "hỏng",
        };

        /// <summary>Why the recipe can't be brewed right now, in both languages (null: it can).</summary>
        public static (string Vi, string En)? Blocked(ContentDb content, PlayerState p, RecipeDef r)
        {
            if (r.Realm is { } realm && (p.Realm < realm || (p.Realm == realm && p.Stage < r.Stage)))
                return ($"Cần {Names.Display(realm, Locale.Vi)} tầng {r.Stage}.", $"Needs {Names.Display(realm, Locale.En)} {r.Stage}.");
            var missing = r.Ingredients.FirstOrDefault(i => Inventory.Count(p, i.Item) < i.Qty);
            if (missing != null)
            {
                var def = content.Item(missing.Item);
                return ($"Thiếu {def?.Name ?? missing.Item}.", $"Missing {def?.NameEn ?? missing.Item}.");
            }
            if (p.Silver < r.Silver) return ("Không đủ bạc.", "Not enough silver.");
            return null;
        }

        /// <summary>Light the furnace: the herbs and the fee go in (a brew abandoned halfway is lost).</summary>
        public static List<GameEvent> Start(ContentDb content, PlayerState p, RecipeDef r)
        {
            var events = new List<GameEvent>();
            if (Blocked(content, p, r) is { } why)
            {
                events.Add(GameEvent.Info("brew_blocked", why.Vi, why.En));
                return events;
            }
            foreach (var i in r.Ingredients) Inventory.Remove(p, i.Item, i.Qty);
            p.Silver -= r.Silver;
            var output = content.Item(r.Output);
            events.Add(GameEvent.Info("brew_started", $"Nhóm lò luyện {output?.Name ?? r.Output}.", $"You light the furnace for {output?.NameEn ?? r.Output}."));
            return events;
        }

        /// <summary>The fire is out: pills by grade, or ash (and a scorched hand if the furnace blew).</summary>
        public static List<GameEvent> Finish(GameState state, ContentDb content, RecipeDef r, double purity, bool exploded)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var output = content.Item(r.Output);
            if (output == null) return events;
            var grade = exploded ? PillGrade.Failed : Grade(Math.Max(0, Math.Min(1, purity)));
            if (exploded)
            {
                var burn = Math.Max(1, p.HpMax / 10);
                p.Hp = Math.Max(1, p.Hp - burn);
                events.Add(GameEvent.Warn("brew_exploded", $"Nổ lò! Dược liệu hóa tro, ngươi bị bỏng (−{burn} khí huyết).",
                    $"The furnace blows! The herbs turn to ash and you are scorched (−{burn} health)."));
                return events;
            }
            if (grade == PillGrade.Failed)
            {
                events.Add(GameEvent.Info("brew_failed", "Lửa không đều, dược lực tan hết. Trong lò chỉ còn tro.",
                    "The fire wavered and the herbs' strength scattered. Only ash is left."));
                return events;
            }
            var count = Yield(grade);
            Inventory.Add(p, Inventory.StackOf(output, count));
            p.Counters.PillsBrewed += 1;
            var line = $"Thành đan {GradeName(grade, Locale.Vi)}: {output.Name} ×{count}.";
            var lineEn = $"A {GradeName(grade, Locale.En)} brew: {output.NameEn} ×{count}.";
            events.Add(grade == PillGrade.High ? GameEvent.Major("brew_done", line, lineEn) : GameEvent.Info("brew_done", line, lineEn));
            return events;
        }
    }
}
