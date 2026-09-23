using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTien.Core.Story
{
    /// <summary>
    /// Structured facts about an NPC and the player — the input contract for the online
    /// storyteller (POST /api/story/dialogue, design §7.13). Serialize with GameJson.
    /// </summary>
    public sealed class NpcCard
    {
        public string NpcId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Role { get; set; } = "";
        public string Realm { get; set; } = "";
        public string? Sect { get; set; }
        public List<string> Traits { get; set; } = new List<string>();
        public int Alignment { get; set; }
        public int RelationToPlayer { get; set; }
        public List<string> Ledger { get; set; } = new List<string>();
        public List<string> RecentRumors { get; set; } = new List<string>();
        public string Place { get; set; } = "";
        public string PlayerName { get; set; } = "";
        public string PlayerRealm { get; set; } = "";
        public string PlayerKarma { get; set; } = "";
        public string Locale { get; set; } = "vi";
    }

    public readonly struct Line
    {
        public readonly string Vi;
        public readonly string En;

        public Line(string vi, string en)
        {
            Vi = vi;
            En = en;
        }

        public string Get(Locale locale) => Names.Pick(locale, Vi, En);
    }

    /// <summary>
    /// Offline fallback for NPC dialogue. The game never blocks on the network: when the
    /// storyteller is unreachable these templates speak instead, from the same facts.
    /// </summary>
    public static class OfflineStoryteller
    {
        public static NpcCard Card(GameState state, ContentDb content, NpcState npc, string place)
        {
            var p = state.Player;
            return new NpcCard
            {
                NpcId = npc.Id,
                Name = npc.Name,
                Role = npc.Role ?? "",
                Realm = $"{Names.Display(npc.Realm, Locale.Vi)} {npc.Stage}",
                Sect = npc.SectId,
                Traits = npc.Traits.ToList(),
                Alignment = npc.Alignment,
                RelationToPlayer = npc.RelationTo(NpcSim.PlayerKey),
                Ledger = p.Ledger.Where(e => e.NpcId == npc.Id && !e.Settled).Select(e => $"{e.Kind}:{e.Weight}:{e.Context}").ToList(),
                RecentRumors = state.World.Rumors.Skip(System.Math.Max(0, state.World.Rumors.Count - 3)).Select(r => r.Text).ToList(),
                Place = place,
                PlayerName = p.Name,
                PlayerRealm = $"{Names.Display(p.Realm, Locale.Vi)} {p.Stage}",
                PlayerKarma = Karma.Band(p.Karma).vi,
                Locale = state.Locale == Locale.En ? "en" : "vi",
            };
        }

        public static List<Line> Greeting(GameState state, NpcState npc)
        {
            var p = state.Player;
            var lines = new List<Line>();
            var relation = npc.RelationTo(NpcSim.PlayerKey);
            var gap = Progression.RealmValue(npc.Realm, npc.Stage) - Progression.RealmValue(p.Realm, p.Stage);
            var owes = Karma.WeightWith(state, npc.Id, LedgerKind.An);
            var grudge = Karma.WeightWith(state, npc.Id, LedgerKind.Oan);

            switch (npc.Id)
            {
                case "npc_elder":
                    lines.Add(new Line(
                        "Con đường tu tiên dài lắm, hài tử. Dạo này sói hoang ở Thanh Lâm quấy phá — bảng cáo thị trong thôn đang treo thưởng.",
                        "The immortal path is long, child. Wild wolves have been troubling the Verdant Forest — the village notice board has a bounty up."));
                    break;
                case "npc_deacon":
                    lines.Add(p.SectId == "thanh_van_kiem"
                        ? new Line("Đệ tử bổn môn, chớ lười biếng. Tàng kinh các luôn mở cho kẻ có cống hiến.",
                            "Disciple, don't slack. The scripture pavilion is open to those who have contributed.")
                        : new Line("Muốn bái nhập Thanh Vân Kiếm Phái? Trước hết hãy qua được kiếm của đệ tử ngoại môn.",
                            "You wish to join the Azure Cloud Sword Sect? First get past an outer disciple's sword."));
                    break;
                case "npc_rival":
                    lines.Add(gap > 0
                        ? new Line("Hừ, ngươi vẫn còn giậm chân tại chỗ sao? Ta đã bỏ ngươi lại phía sau rồi.",
                            "Hmph, still stuck where you were? I've already left you behind.")
                        : new Line("Đừng đắc ý. Chỉ là nhất thời — sớm muộn ta cũng vượt qua ngươi.",
                            "Don't get cocky. It's only for now — sooner or later I'll surpass you."));
                    break;
            }

            if (grudge > 0)
                lines.Add(new Line("Món nợ giữa ta và ngươi, sớm muộn gì cũng phải tính.", "The debt between us will be settled, sooner or later."));
            else if (owes > 0)
                lines.Add(new Line("Ơn ngày trước, ta chưa dám quên.", "I have not forgotten the kindness you did me."));
            else if (relation >= 60)
                lines.Add(new Line($"Đạo hữu {p.Name}! Gặp lại ngươi thật tốt.", $"Fellow daoist {p.Name}! Good to see you again."));
            else if (relation <= -40)
                lines.Add(new Line("Hừ, lại là ngươi.", "Hmph. You again."));
            else if (lines.Count == 0 && gap >= 1)
                lines.Add(new Line("Tiểu bối, có việc gì?", "What is it, junior?"));
            else if (lines.Count == 0 && gap <= -1)
                lines.Add(new Line("Tiền bối! Vãn bối thất lễ rồi.", "Senior! Forgive my rudeness."));
            else if (lines.Count == 0)
                lines.Add(new Line($"Tại hạ {npc.Name}. Đạo hữu có việc gì chăng?", $"I am {npc.Name}. What brings you, fellow daoist?"));

            var rumor = state.World.Rumors.LastOrDefault(r => r.Subject != npc.Id);
            if (rumor != null && (npc.Traits.Contains("chatty") || relation > 20))
                lines.Add(new Line("Nghe đồn: " + rumor.Text, "Rumor has it: " + rumor.TextEn));
            return lines;
        }
    }
}
