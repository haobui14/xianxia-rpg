using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>How a fight with this NPC looks from where the player stands.</summary>
    public enum MatchUp
    {
        Weaker,
        Even,
        Stronger,
        FarStronger,
    }

    /// <summary>
    /// How an NPC cultivator fights: their own stats, arts and element, from who they are, by the player's own
    /// rules. A same-realm duel is a fair fight; a realm above is a wall.
    /// </summary>
    public static class NpcCombat
    {
        /// <summary>
        /// An NPC's stats, grown by the same realm and stage gains as the player's, so a mortal is as strong as a
        /// new life and each step adds what the player's would. On top: a weapon fit for their realm, the Trúc Cơ
        /// foundation their root would lay, a little more for a talented root, their temperament (the bold hit
        /// harder and guard worse, the timid the other way), a few percent of their own, and an injury's toll.
        /// </summary>
        public static CultivatorStats Stats(NpcState npc, ContentDb content)
        {
            var body = new PlayerState();
            while (body.Realm < npc.Realm || (body.Realm == npc.Realm && body.Stage < npc.Stage))
                if (!Progression.StepQi(body)) break;
            var a = body.Attrs;

            var weapon = npc.Realm switch
            {
                Realm.PhamNhan => 3.0,
                Realm.LuyenKhi => 4 + npc.Stage,
                Realm.TrucCo => 12 + 2 * npc.Stage,
                Realm.KetDan => 30 + 3 * npc.Stage,
                _ => 60 + 4 * npc.Stage,
            };
            var foundation = npc.Realm >= Realm.TrucCo ? Foundation.PowerMultiplier(FoundationFor(npc.Grade)) : 1.0;
            var talent = 1 + 0.03 * (int)npc.Grade;
            var aggression = Math.Max(-0.4, Math.Min(0.5, npc.Traits.Sum(t => content.NpcNames.Traits.FirstOrDefault(d => d.Id == t)?.Aggression ?? 0)));
            var offense = 1 + 0.25 * aggression;
            var guard = 1 - 0.2 * aggression;

            var rng = Seeds.Stream(Seeds.Hash(npc.Id), "npc-stats");
            var own = rng.Range(0.94, 1.06);
            var hp = body.HpMax * rng.Range(0.92, 1.08) * (npc.InjuredMonths > 0 ? 0.8 : 1);

            return new CultivatorStats
            {
                HpMax = Math.Max(1, (int)Math.Round(hp)),
                Physical = (a.Str * 1.5 + weapon) * foundation * talent * offense * own,
                Spirit = (a.Int * 2 + a.Str * 0.5) * foundation * talent * offense * own,
                Defense = (5 + a.Agi / 3.0) * guard,
                Resistance = (5 + a.Int / 3.0 + (int)npc.Realm * 6) * guard,
                Perception = a.Per,
                Luck = 3 + (int)npc.Grade,
            };
        }

        /// <summary>The foundation an NPC's root would lay at Trúc Cơ.</summary>
        private static FoundationGrade FoundationFor(RootGrade grade) => grade switch
        {
            RootGrade.ThienPham => FoundationGrade.Thien,
            RootGrade.Hiem => FoundationGrade.Thuong,
            RootGrade.Kha => FoundationGrade.Trung,
            _ => FoundationGrade.Ha,
        };

        /// <summary>An NPC's stats as the damage formula sees them.</summary>
        public static Combatant Combatant(NpcState npc, CultivatorStats s) => new Combatant
        {
            PhysicalPower = s.Physical,
            SpiritPower = s.Spirit,
            Def = s.Defense,
            Res = s.Resistance,
            Per = s.Perception,
            Luck = s.Luck,
            RealmValue = Progression.RealmValue(npc.Realm, npc.Stage),
            Element = npc.Realm == Realm.PhamNhan ? (Element?)null : Element(npc),
            Root = npc.Elements,
        };

        /// <summary>
        /// Weaker, even, stronger or far stronger: how many of the player's best blows it takes to down the NPC,
        /// against how many of theirs to down the player (realm suppression included).
        /// </summary>
        public static MatchUp Assess(ContentDb content, PlayerState p, NpcState npc)
        {
            var me = CombatRules.PlayerCombatant(content, p);
            var stats = Stats(npc, content);
            var them = Combatant(npc, stats);
            double Blow(Combatant att, Combatant def) =>
                Math.Max(att.PhysicalPower * CombatRules.Mitigation(def.Def), att.SpiritPower * CombatRules.Mitigation(def.Res))
                * CombatRules.Suppression(att.RealmValue, def.RealmValue);
            var mine = stats.HpMax / Math.Max(0.1, Blow(me, them));
            var theirs = p.HpMax / Math.Max(0.1, Blow(them, me));
            var ratio = mine / theirs;
            return ratio < 0.6 ? MatchUp.Weaker : ratio <= 1.4 ? MatchUp.Even : ratio <= 2.6 ? MatchUp.Stronger : MatchUp.FarStronger;
        }

        /// <summary>
        /// The arts an NPC fights with, by the player's own rules: their root's first art (and a second root's too,
        /// from Luyện Khí 3), its second-tier art from Luyện Khí 5, their sect's art, and for about a third of them
        /// a guarding art (a healing one if kind-hearted). A mortal only has fists. The same NPC always has the same kit.
        /// </summary>
        public static List<string> Kit(NpcState npc, ContentDb content)
        {
            var kit = new List<string>();
            if (npc.Realm == Realm.PhamNhan)
            {
                kit.Add("vo_ky_kiem");
                return kit;
            }
            var first = Element(npc);
            kit.Add(Skills.StarterArt(first));
            var progressed = npc.Realm > Realm.LuyenKhi || npc.Stage >= Skills.SecondArtStage;
            if (npc.Elements.Count > 1 && (npc.Realm > Realm.LuyenKhi || npc.Stage >= 3)) kit.Add(Skills.StarterArt(npc.Elements[1]));
            if (progressed) kit.Add(Skills.SecondArt(first));
            if (npc.SectId == "thanh_van_kiem") kit.Add("thanh_van_kiem_quyet");
            var rng = Seeds.Stream(Seeds.Hash(npc.Id), "npc-kit");
            if (rng.Chance(1 / 3.0)) kit.Add(npc.Alignment >= 30 || npc.Traits.Contains("kind") ? "hoi_xuan_quyet" : "ho_the_cuong_khi");
            return kit.Where(id => content.Skill(id) != null).Distinct().ToList();
        }

        /// <summary>The element an NPC fights in: their root's first.</summary>
        public static Element Element(NpcState npc) => npc.Elements.Count > 0 ? npc.Elements[0] : Core.Element.Kim;

        /// <summary>Give an NPC encounter (a challenge, a spar, an ambush) the NPC's own stats, arts and element.</summary>
        public static Encounter Prepare(Encounter encounter, NpcState npc, ContentDb content)
        {
            encounter.ArtsOverride = Kit(npc, content);
            encounter.ElementOverride = npc.Realm == Realm.PhamNhan ? (Element?)null : Element(npc);
            encounter.Stats = Stats(npc, content);
            return encounter;
        }
    }
}
