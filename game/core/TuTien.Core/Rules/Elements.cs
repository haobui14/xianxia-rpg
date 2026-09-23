using System.Collections.Generic;
using System.Linq;

namespace TuTien.Core.Rules
{
    public enum ReactionKind
    {
        None,
        Shatter,
        Amplify,
    }

    /// <summary>Ngũ Hành reactions (design §7.4). Five shatters (khắc) and five amplifies (sinh).</summary>
    public enum Reaction
    {
        None,
        DoanMoc,   // Mộc mark + Kim hit: bleed
        PhaTho,    // Thổ mark + Mộc hit: −30% DEF
        YemThuy,   // Thủy mark + Thổ hit: root
        DietHoa,   // Hỏa mark + Thủy hit: steam burst + blind
        DungKim,   // Kim mark + Hỏa hit: −30% RES
        LietDiem,  // Mộc mark + Hỏa hit: ×1.5, burning spreads
        LuyenKim,  // Thổ mark + Kim hit: ×1.5, armor pierce
        SinhCo,    // Thủy mark + Mộc hit: ×1.5, heal 10% of damage
        TroTan,    // Hỏa mark + Thổ hit: ×1.5, stun 0.5 s
        HanTrieu,  // Kim mark + Thủy hit: ×1.5, slow
    }

    public sealed class ReactionInfo
    {
        public Reaction Reaction { get; }
        public ReactionKind Kind { get; }
        public string Name { get; }
        public string NameEn { get; }
        public double DamageMultiplier { get; }
        /// <summary>bleed | def_break | root | blind_burst | res_break | spread_burn | pierce | lifesteal | stun | slow</summary>
        public string Effect { get; }
        public double Duration { get; }

        public ReactionInfo(Reaction reaction, ReactionKind kind, string name, string nameEn, double mult, string effect, double duration)
        {
            Reaction = reaction; Kind = kind; Name = name; NameEn = nameEn;
            DamageMultiplier = mult; Effect = effect; Duration = duration;
        }
    }

    public static class Elements
    {
        public static readonly Element[] All = { Element.Kim, Element.Moc, Element.Thuy, Element.Hoa, Element.Tho };

        /// <summary>What each phase overcomes (khắc): Kim→Mộc→Thổ→Thủy→Hỏa→Kim.</summary>
        public static Element OvercomeTarget(Element e) => e switch
        {
            Element.Kim => Element.Moc,
            Element.Moc => Element.Tho,
            Element.Tho => Element.Thuy,
            Element.Thuy => Element.Hoa,
            _ => Element.Kim, // Hỏa
        };

        /// <summary>What each phase generates (sinh): Kim→Thủy→Mộc→Hỏa→Thổ→Kim.</summary>
        public static Element GenerateTarget(Element e) => e switch
        {
            Element.Kim => Element.Thuy,
            Element.Thuy => Element.Moc,
            Element.Moc => Element.Hoa,
            Element.Hoa => Element.Tho,
            _ => Element.Kim, // Thổ
        };

        public static bool Overcomes(Element a, Element b) => OvercomeTarget(a) == b;
        public static bool Generates(Element a, Element b) => GenerateTarget(a) == b;

        /// <summary>Attack element vs the target's own element (Appendix A).</summary>
        public static double AttackMultiplier(Element? attack, Element? target)
        {
            if (attack == null || target == null) return 1.0;
            if (Overcomes(attack.Value, target.Value)) return 1.3;
            if (Overcomes(target.Value, attack.Value)) return 0.7;
            if (Generates(attack.Value, target.Value)) return 0.85;
            return 1.0;
        }

        private static readonly Dictionary<Reaction, ReactionInfo> Infos = new Dictionary<Reaction, ReactionInfo>
        {
            [Reaction.DoanMoc] = new ReactionInfo(Reaction.DoanMoc, ReactionKind.Shatter, "Đoạn Mộc", "Severed Wood", 1.15, "bleed", 4),
            [Reaction.PhaTho] = new ReactionInfo(Reaction.PhaTho, ReactionKind.Shatter, "Phá Thổ", "Broken Earth", 1.15, "def_break", 5),
            [Reaction.YemThuy] = new ReactionInfo(Reaction.YemThuy, ReactionKind.Shatter, "Yểm Thủy", "Dammed Water", 1.15, "root", 1.5),
            [Reaction.DietHoa] = new ReactionInfo(Reaction.DietHoa, ReactionKind.Shatter, "Diệt Hỏa", "Quenched Flame", 1.15, "blind_burst", 2),
            [Reaction.DungKim] = new ReactionInfo(Reaction.DungKim, ReactionKind.Shatter, "Dung Kim", "Molten Metal", 1.15, "res_break", 5),
            [Reaction.LietDiem] = new ReactionInfo(Reaction.LietDiem, ReactionKind.Amplify, "Liệt Diễm", "Wildfire", 1.5, "spread_burn", 3),
            [Reaction.LuyenKim] = new ReactionInfo(Reaction.LuyenKim, ReactionKind.Amplify, "Luyện Kim", "Forged Metal", 1.5, "pierce", 0),
            [Reaction.SinhCo] = new ReactionInfo(Reaction.SinhCo, ReactionKind.Amplify, "Sinh Cơ", "Spring of Life", 1.5, "lifesteal", 0),
            [Reaction.TroTan] = new ReactionInfo(Reaction.TroTan, ReactionKind.Amplify, "Tro Tàn", "Ashfall", 1.5, "stun", 0.5),
            [Reaction.HanTrieu] = new ReactionInfo(Reaction.HanTrieu, ReactionKind.Amplify, "Hàn Triều", "Cold Tide", 1.5, "slow", 2),
        };

        public static ReactionInfo? Info(Reaction reaction) => Infos.TryGetValue(reaction, out var i) ? i : null;

        /// <summary>
        /// A hit that overcomes the mark shatters it; a hit the mark generates is amplified.
        /// Anything else leaves no reaction (and the hit re-marks the target).
        /// </summary>
        public static Reaction ReactionFor(Element mark, Element attack)
        {
            if (Overcomes(attack, mark))
            {
                return mark switch
                {
                    Element.Moc => Reaction.DoanMoc,
                    Element.Tho => Reaction.PhaTho,
                    Element.Thuy => Reaction.YemThuy,
                    Element.Hoa => Reaction.DietHoa,
                    _ => Reaction.DungKim,
                };
            }
            if (Generates(mark, attack))
            {
                return mark switch
                {
                    Element.Moc => Reaction.LietDiem,
                    Element.Tho => Reaction.LuyenKim,
                    Element.Thuy => Reaction.SinhCo,
                    Element.Hoa => Reaction.TroTan,
                    _ => Reaction.HanTrieu,
                };
            }
            return Reaction.None;
        }

        /// <summary>
        /// Port of the web game's getElementCompatibility (spirit root vs technique elements):
        /// +0.3 when every technique element is in the root, otherwise the average of pairwise terms.
        /// </summary>
        public static double TechniqueCompatibility(IReadOnlyCollection<Element> root, IReadOnlyCollection<Element> technique)
        {
            if (technique.Count == 0) return 0;
            if (technique.All(root.Contains)) return 0.3;

            double total = 0;
            var count = 0;
            foreach (var t in technique)
            {
                foreach (var r in root)
                {
                    if (t == r) { total += 0.3; count++; }
                    else if (Generates(r, t)) { total += 0.15; count++; }
                    else if (Generates(t, r)) { total += 0.1; count++; }
                    else if (Overcomes(t, r)) { total -= 0.2; count++; }
                    else if (Overcomes(r, t)) { total -= 0.1; count++; }
                }
            }
            return count > 0 ? total / count : 0;
        }
    }
}
