using System;
using System.Linq;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>Nhân quả: the karma value and the ledger of debts and grudges (design §7.7).</summary>
    public static class Karma
    {
        public const int Min = -1000;
        public const int Max = 1000;

        public static int Add(PlayerState p, int delta)
        {
            var before = p.Karma;
            p.Karma = Math.Max(Min, Math.Min(Max, p.Karma + delta));
            return p.Karma - before;
        }

        public static (string vi, string en) Band(int karma)
        {
            if (karma >= 600) return ("Đại thiện", "Great Virtue");
            if (karma >= 200) return ("Thiện lương", "Virtuous");
            if (karma > -200) return ("Trung dung", "Balanced");
            if (karma > -600) return ("Tà ác", "Wicked");
            return ("Nghiệp chướng thâm trọng", "Deep Karmic Debt");
        }

        /// <summary>Record ân (gratitude) or oán (grudge). Repeated bonds with one NPC accumulate.</summary>
        public static void Record(GameState state, string npcId, LedgerKind kind, int weight, string context, string contextEn)
        {
            var ledger = state.Player.Ledger;
            var existing = ledger.FirstOrDefault(e => e.NpcId == npcId && e.Kind == kind && !e.Settled);
            if (existing != null)
            {
                existing.Weight += weight;
                existing.Month = state.Calendar.MonthIndex;
                existing.Context = context;
                existing.ContextEn = contextEn;
                return;
            }
            ledger.Add(new LedgerEntry
            {
                NpcId = npcId,
                Kind = kind,
                Weight = weight,
                Month = state.Calendar.MonthIndex,
                Context = context,
                ContextEn = contextEn,
            });
        }

        public static int WeightWith(GameState state, string npcId, LedgerKind kind) =>
            state.Player.Ledger.Where(e => e.NpcId == npcId && e.Kind == kind && !e.Settled).Sum(e => e.Weight);

        /// <summary>Righteous sects refuse cultivators past this much bad karma.</summary>
        public static bool AcceptableToRighteous(int karma) => karma > -200;
    }
}
