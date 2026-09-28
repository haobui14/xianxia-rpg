using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// Growing what you already know (the web game's level-ability route): a technique deepens with spirit stones,
    /// and an art can be trained a level with silver instead of waiting for use to teach it.
    /// </summary>
    public static class Mastery
    {
        public const int TechniqueMaxLevel = 10;
        public const int SkillMaxLevel = 10;

        /// <summary>Spirit stones to deepen a technique one level (getTechniqueLevelUpCost): its grade × its level. Null at the top.</summary>
        public static int? TechniqueCost(TechniqueState t) =>
            t.Level >= TechniqueMaxLevel ? (int?)null : GradeFactor(t.Grade) * Math.Max(1, t.Level);

        private static int GradeFactor(string grade) => grade switch
        {
            "Heaven" => 20,
            "Earth" => 10,
            _ => 5,
        };

        /// <summary>A technique grade's name.</summary>
        public static string GradeName(string grade, Locale locale) => grade switch
        {
            "Heaven" => locale == Locale.En ? "Heaven grade" : "Thiên phẩm",
            "Earth" => locale == Locale.En ? "Earth grade" : "Địa phẩm",
            _ => locale == Locale.En ? "Mortal grade" : "Phàm phẩm",
        };

        public static List<GameEvent> DeepenTechnique(PlayerState p, string techniqueId)
        {
            var events = new List<GameEvent>();
            var t = p.Techniques.FirstOrDefault(x => x.Id == techniqueId);
            if (t == null || TechniqueCost(t) is not { } cost) return events;
            if (p.SpiritStones < cost)
            {
                events.Add(GameEvent.Info("poor", "Không đủ linh thạch.", "Not enough spirit stones."));
                return events;
            }
            p.SpiritStones -= cost;
            t.Level += 1;
            events.Add(GameEvent.Major("technique_level", $"Lĩnh ngộ sâu hơn {t.Name}: tầng {t.Level} (−{cost} linh thạch).",
                $"You grasp {t.NameEn} more deeply: level {t.Level} (−{cost} spirit stones)."));
            return events;
        }

        /// <summary>Silver to train an art one level with a teacher (getSkillLevelUpCost): 150 × its level. Null at the top.</summary>
        public static int? SkillCost(SkillState s) => s.Level >= SkillMaxLevel ? (int?)null : 150 * s.Level;

        public static List<GameEvent> TrainSkill(ContentDb content, PlayerState p, string skillId)
        {
            var events = new List<GameEvent>();
            var s = p.Skills.FirstOrDefault(x => x.Id == skillId);
            var def = content.Skill(skillId);
            if (s == null || def == null || SkillCost(s) is not { } cost) return events;
            if (p.Silver < cost)
            {
                events.Add(GameEvent.Info("poor", "Không đủ bạc.", "Not enough silver."));
                return events;
            }
            p.Silver -= cost;
            s.Level += 1;
            // Whatever use had taught toward the next level still counts, below the new threshold.
            s.Exp = Math.Min(s.Exp, s.Level * 100 - 1);
            events.Add(GameEvent.Info("skill_level", $"Khổ luyện {def.Name}: lên cấp {s.Level} (−{cost} bạc).",
                $"Hard training: {def.NameEn} reached level {s.Level} (−{cost} silver)."));
            return events;
        }
    }
}
