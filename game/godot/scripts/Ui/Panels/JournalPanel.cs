using System.Linq;
using Godot;
using TuTien.Core.State;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>Sổ tay: the chronicle, rumors, the karma ledger, bounties, and how to play.</summary>
public partial class JournalPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Book;
    protected override string TitleText => T("Sổ tay tu hành", "Journal");
    protected override Vector2 PanelSize => new(820, 680);

    protected override void Build()
    {
        Tabs(T("Biên niên", "Chronicle"), T("Tin đồn", "Rumors"), T("Nhân quả", "Ledger"), T("Nhiệm vụ", "Tasks"), T("Cách chơi", "How to play"));
        var state = E.State;
        switch (Tab)
        {
            case 0:
                foreach (var entry in state.Chronicle.AsEnumerable().Reverse().Take(40))
                    Para(T(entry.Text, entry.TextEn), 15, Ink.InkSoft);
                Para(T("(Biên niên ngoại tuyến. Linh Thức sẽ chấp bút lại thành truyện khi trực tuyến.)",
                    "(Offline chronicle. The Spirit Sense storyteller rewrites it as prose when online.)"), 13, Ink.InkFaint);
                break;
            case 1:
                if (state.World.Rumors.Count == 0) Para(T("Giang hồ còn yên ắng.", "All is quiet so far."));
                foreach (var r in state.World.Rumors.AsEnumerable().Reverse().Take(40))
                    Para($"{T("Tháng", "Month")} {r.MonthIndex}: “{T(r.Text, r.TextEn)}”", 15, Ink.Violet);
                break;
            case 2:
                if (state.Player.Ledger.Count == 0)
                    Para(T("Chưa mang ơn ai, cũng chưa kết oán với ai.", "No debts of gratitude, no grudges — yet."));
                foreach (var l in state.Player.Ledger.AsEnumerable().Reverse())
                {
                    var who = E.Npc(l.NpcId)?.Name ?? l.NpcId;
                    var kind = l.Kind == LedgerKind.An ? T("Ân", "Debt") : T("Oán", "Grudge");
                    Para($"{who} — {kind} {l.Weight}{(l.Settled ? T(" (đã trả)", " (settled)") : "")}: {T(l.Context, l.ContextEn)}", 15,
                        l.Kind == LedgerKind.An ? Ink.JadeDeep : Ink.CinnabarDeep);
                }
                Para(T("Ân oán không tự mất: người mang ơn sẽ giúp ngươi lúc hoạn nạn, kẻ ôm hận sẽ tìm tới báo thù.",
                    "Bonds don't fade on their own: those in your debt come to help, those with grudges come for revenge."), 13, Ink.InkFaint);
                break;
            case 3:
                Section(T("Nhiệm vụ tông môn", "Sect missions"));
                if (state.Player.SectId == null)
                    Para(T("Chưa vào tông môn nào — Nhiệm Vụ Đường chỉ giao việc cho đệ tử.", "You belong to no sect — only disciples get missions from a mission hall."), 15, Ink.InkMute);
                else if (state.Player.Missions.Count == 0)
                    Para(T("Chưa nhận nhiệm vụ — tới Nhiệm Vụ Đường ở sơn môn.", "No missions taken — visit the mission hall at the sect gate."), 15, Ink.InkMute);
                foreach (var m in state.Player.Missions)
                {
                    var t = TuTien.Core.Rules.SectMissions.Template(E.Content, m.TemplateId);
                    var left = m.DeadlineMonth - state.Calendar.MonthIndex;
                    Para($"{(t != null ? T(t.Name, t.NameEn) : m.TemplateId)}: {m.Progress}/{m.Goal} · " + (m.Done
                            ? T("xong, về sơn môn báo cáo", "done, report at the sect")
                            : T($"còn {left} tháng", $"{left} month{(left == 1 ? "" : "s")} left")),
                        16, m.Done ? Ink.JadeDeep : left <= 1 ? Ink.CinnabarDeep : Ink.InkColor);
                }
                Section(T("Cáo thị", "Bounties"));
                if (state.Player.Bounties.Count == 0) Para(T("Chưa nhận cáo thị nào — xem bảng cáo thị ở thôn.", "No bounties taken — check the village board."));
                foreach (var b in state.Player.Bounties)
                    Para($"{T(b.Name, b.NameEn)}: {b.Progress}/{b.Count} · {b.RewardSilver} {T("bạc", "silver")}", 16, b.Progress >= b.Count ? Ink.JadeDeep : Ink.InkColor);
                Section(T("Thôn dân nhờ vả", "Villagers' requests"));
                if (E.Map.Def.Pois.FirstOrDefault(p => p.Kind == "town") is { } village && E.TownFor(village) is { } town)
                {
                    foreach (var r in E.RequestsFor(town))
                    {
                        var item = E.Content.Item(r.Item);
                        var done = E.RequestDone(town, r.Id);
                        var have = TuTien.Core.Rules.Inventory.Count(state.Player, r.Item);
                        Para($"{T(r.Giver, r.GiverEn)}: {(item != null ? Text.Name(item) : r.Item)} {System.Math.Min(have, r.Qty)}/{r.Qty}" + (done ? T(" · đã giao", " · handed over") : ""),
                            16, done ? Ink.JadeDeep : have >= r.Qty ? Ink.GoldDeep : Ink.InkColor);
                    }
                    Para(T("Giao đồ ở bảng cáo thị trong thôn.", "Hand them over at the village bounty board."), 13, Ink.InkFaint);
                }
                break;
            default:
                HowToPlay();
                break;
        }
    }

    private void HowToPlay()
    {
        static string K(string action) => KeyMap.Label(action);
        Section(T("Vòng lặp", "The loop"));
        Para(T($"Mỗi tháng ngươi có một lượng cước lực. Mỗi ô đất bước qua tốn cước lực theo địa hình; hết cước lực thì tháng tự qua ngay trên đường: tu vi tăng, thế giới chuyển động (tu sĩ tu luyện, kết thù, tọa hóa), yêu thú di chuyển, kỳ ngộ mới xuất hiện. Muốn qua tháng sớm thì bấm {K("end_month")}.",
            $"Each month you have footwork. Every tile you cross spends some, more on rough ground; when it runs out the month turns right there on the road: you cultivate, the world moves (cultivators train, feud, pass away), beasts roam, new encounters appear. {K("end_month")} ends the month early."), 15);
        Para(T($"Bế quan ({K("seclude")}) đốt nhiều tháng một lúc với tu vi ×1.6 — tốt nhất ở linh mạch hay linh tuyền. Khi tu vi viên mãn, mở Đột phá: một thử thách thật, có thể thất bại.",
            $"Seclusion ({K("seclude")}) burns several months at ×1.6 cultivation — best at a spirit vein or spring. When your cultivation is full, Break through: a real trial you can fail."), 15);
        Section(T("Thế giới", "The world"));
        Para(KeysText.World(), 15);
        Para(T($"Yêu thú lang thang quanh ổ; bầy hung hãn thấy ngươi sẽ đuổi theo (dấu «!»). Người tu hành đi lại trong vùng — tới gần bấm {K("interact")} để gặp. Cột sáng vàng có ngôi sao là kỳ ngộ. Chỉ thấy chúng khi mây mù trong tầm thần thức đã tan. Trên bản đồ ({K("open_map")}), nhấp nơi đã thấy để tự đi tới; từ Trúc Cơ, đường qua sông sẽ bay.",
            $"Beasts prowl around their lair; aggressive packs that spot you give chase (a “!”). Cultivators walk the region — go up to one and press {K("interact")} to meet them. Gold pillars of light under a star are encounters. You only see things where the clouds of your sense have cleared. On the map ({K("open_map")}), click somewhere you've seen and you'll walk there; from Foundation, a way over the river is flown."), 15);
        Section(T("Việc khác ngoài chiến đấu", "Besides fighting"));
        Para(T("Câu cá ở các bến sông và đầm lầy (chờ phao chìm hẳn mới giật; khi kéo thì giữ để nâng lưới, thả để hạ). Vung kiếm bổ mạch khoáng trên đồi và núi, rồi đem quặng tới lò rèn luyện thành đá cường hóa. Luyện đan ở Bách Thảo Đường phía tây làng. Mỗi tháng xin một quẻ ở miếu Thổ Địa bên đường cái. Dẹp Hắc Phong Trại trong rừng rậm phía nam đường cái để lấy kho tang. Thôn dân nhờ gì thì mang tới bảng cáo thị.",
            "Fish at the river landings and the marsh (wait for the float to go right under before you strike; when reeling, hold to lift the net and let go to drop it). Strike ore veins in the hills and mountains with your sword, and take the ore to the forge to smelt into enhancement stones. Brew pills at the apothecary west of the village. Draw a fortune stick each month at the Earth God shrine by the high road. Break the Black Wind Camp in the dense forest south of the high road for its hoard. Bring the villagers what they ask for at the bounty board."), 15);
        Section(T("Chiến đấu", "Combat"));
        Para(KeysText.Fight(), 15);
        Para(T("Ngũ Hành: đòn có hệ để lại ấn (Kim, Mộc, Thủy, Hỏa, Thổ) trên địch, hiện thành biểu tượng cạnh thanh máu. Đòn kế tiếp khắc ấn đó thì phá ấn (chảy máu, phá giáp, trói chân…); đòn được ấn sinh ra thì cộng hưởng ×1.5. Vùng đỏ là đòn sắp giáng — hãy lướt ra.",
            "Five Phases: elemental hits leave a mark (Metal, Wood, Water, Fire, Earth), shown as an icon by the health bar. A hit that overcomes the mark shatters it (bleed, armor break, root…); a hit the mark generates is amplified ×1.5. Red zones are incoming attacks — dash out."), 15);
        Section(T("Phím", "Keys"));
        Para(T("Mọi phím đều đổi được: Cài đặt → Phím (hoặc Esc → Đổi phím).", "Every key can be changed: Settings → Keys (or Esc → Rebind keys)."), 14, Ink.InkMute);
    }
}
