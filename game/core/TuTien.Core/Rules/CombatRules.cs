using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    public enum DamageKind
    {
        Physical,
        Spirit,
    }

    /// <summary>Everything the damage formula needs about one side of a hit.</summary>
    public struct Combatant
    {
        public double PhysicalPower;
        public double SpiritPower;
        public double Def;
        public double Res;
        public double Per;
        public double Luck;
        public double RealmValue;
        public Element? Element;
        public IReadOnlyList<Element> Root;
    }

    public struct DamageResult
    {
        public int Amount;
        public bool Crit;
        public double ElementMultiplier;
        public double Suppression;
        public bool Affinity;
        public Reaction Reaction;
        /// <summary>True when the hit leaves a fresh elemental mark on the target.</summary>
        public bool AppliesMark;
    }

    /// <summary>
    /// The one damage formula (design Appendix A), replacing the three divergent formulas in
    /// the web game (combat.ts and two copies in useCombat.ts).
    /// </summary>
    public static class CombatRules
    {
        public static double Mitigation(double armor) => 100.0 / (100.0 + Math.Max(0, armor));

        /// <summary>Cảnh giới áp chế: up to ×2 against weaker realms, steep penalty against stronger ones.</summary>
        public static double Suppression(double attackerRealm, double defenderRealm)
        {
            var d = attackerRealm - defenderRealm;
            return d >= 0 ? Math.Min(2.0, 1 + 0.25 * d) : 1.0 / (1 + 0.35 * -d);
        }

        public static double CritChance(double per, double luck) => Math.Min(0.5, 0.05 + per * 0.003 + luck * 0.002);
        public static double CritDamage(double luck) => 1.5 + luck * 0.01;

        public static DamageResult Compute(
            DamageKind kind, double multiplier, Element? element,
            in Combatant attacker, in Combatant defender, Element? targetMark, Pcg32 rng)
        {
            var raw = (kind == DamageKind.Physical ? attacker.PhysicalPower : attacker.SpiritPower) * multiplier;
            var mitigation = Mitigation(kind == DamageKind.Physical ? defender.Def : defender.Res);
            var elementMult = Elements.AttackMultiplier(element, defender.Element);
            var affinity = element != null && attacker.Root != null && attacker.Root.Contains(element.Value);
            var reaction = element != null && targetMark != null ? Elements.ReactionFor(targetMark.Value, element.Value) : Reaction.None;
            var reactionMult = Elements.Info(reaction)?.DamageMultiplier ?? 1.0;
            var suppression = Suppression(attacker.RealmValue, defender.RealmValue);
            var crit = rng.Chance(CritChance(attacker.Per, attacker.Luck));
            var critMult = crit ? CritDamage(attacker.Luck) : 1.0;
            var variance = rng.Range(0.9, 1.1);

            var amount = raw * mitigation * elementMult * (affinity ? 1.2 : 1.0) * reactionMult * suppression * critMult * variance;
            return new DamageResult
            {
                Amount = Math.Max(1, (int)Math.Round(amount)),
                Crit = crit,
                ElementMultiplier = elementMult,
                Suppression = suppression,
                Affinity = affinity,
                Reaction = reaction,
                AppliesMark = element != null && reaction == Reaction.None,
            };
        }

        /// <summary>Spirit-root affinity makes matching arts 15% cheaper.</summary>
        public static int QiCost(SkillDef skill, IReadOnlyList<Element> root) =>
            skill.Element != null && root.Contains(skill.Element.Value)
                ? (int)Math.Ceiling(skill.QiCost * 0.85)
                : skill.QiCost;

        // ------------------------------------------------------------ player profile

        private static double WeaponBonus(ContentDb content, PlayerState p, string key)
        {
            var weapon = content.Item(p.WeaponId);
            return weapon?.BonusStats != null && weapon.BonusStats.TryGetValue(key, out var v) ? v : 0;
        }

        /// <summary>Base attributes plus the equipped weapon's bonus_stats (as calculateTotalAttributes did).</summary>
        public static Attributes EffectiveAttrs(ContentDb content, PlayerState p) => new Attributes
        {
            Str = p.Attrs.Str + (int)WeaponBonus(content, p, "str"),
            Agi = p.Attrs.Agi + (int)WeaponBonus(content, p, "agi"),
            Int = p.Attrs.Int + (int)WeaponBonus(content, p, "int"),
            Per = p.Attrs.Per + (int)WeaponBonus(content, p, "perception"),
            Luck = p.Attrs.Luck + (int)WeaponBonus(content, p, "luck"),
        };

        /// <summary>DEF grows with agility and, much more, with body tempering (thể tu are tanks).</summary>
        public static double PlayerDefense(PlayerState p, Attributes a)
        {
            double[] bodyDef = { 0, 12, 30, 60, 110 };
            return 5 + a.Agi / 3.0 + bodyDef[(int)p.BodyRealm] + p.BodyStage * 1.5;
        }

        public static double PlayerResistance(PlayerState p, Attributes a) => 5 + a.Int / 3.0 + (int)p.Realm * 6;

        public static Combatant PlayerCombatant(ContentDb content, PlayerState p)
        {
            var a = EffectiveAttrs(content, p);
            var foundation = Foundation.PowerMultiplier(p.Foundation);
            return new Combatant
            {
                PhysicalPower = (a.Str * 1.5 + WeaponBonus(content, p, "atk")) * foundation,
                SpiritPower = (a.Int * 2 + a.Str * 0.5) * foundation,
                Def = PlayerDefense(p, a),
                Res = PlayerResistance(p, a),
                Per = a.Per,
                Luck = a.Luck,
                RealmValue = Math.Max(Progression.RealmValue(p.Realm, p.Stage), Progression.RealmValue((Realm)(int)p.BodyRealm, p.BodyStage)),
                Element = null,
                Root = p.Root.Elements,
            };
        }

        /// <summary>Move speed in px/s; agility adds 1% each.</summary>
        public static double PlayerMoveSpeed(ContentDb content, PlayerState p) => 250 * (1 + EffectiveAttrs(content, p).Agi * 0.01);
    }
}
